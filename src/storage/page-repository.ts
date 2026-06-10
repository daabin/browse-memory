import { tokenize } from "../search/tokenize";
import { toLocalDateKey } from "../shared/local-date";
import { normalizeUrl } from "../shared/url-policy";
import type { PageCapture, PageRecord, TodaySnapshot } from "../shared/types";

import type { Bm25DocumentRecord, BrowseMemoryDatabase } from "./database";

function hashContent(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16);
}

function buildFrequencies(
  content: string,
  title: string,
): Record<string, number> {
  const frequencies: Record<string, number> = {};
  for (const token of tokenize(content)) {
    frequencies[token] = (frequencies[token] ?? 0) + 1;
  }
  for (const token of tokenize(title)) {
    frequencies[token] = (frequencies[token] ?? 0) + 2;
  }
  return frequencies;
}

function buildIndexRecord(page: PageRecord): Bm25DocumentRecord {
  const frequencies = buildFrequencies(page.content, page.title);
  return {
    pageId: page.id,
    length: Object.values(frequencies).reduce(
      (total, frequency) => total + frequency,
      0,
    ),
    frequencies,
  };
}

export class PageRepository {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async upsertCapture(
    capture: PageCapture,
    now = Date.now(),
  ): Promise<PageRecord> {
    const normalizedUrl = normalizeUrl(capture.url);

    return this.database.transaction(
      "rw",
      [
        this.database.pages,
        this.database.bm25Documents,
        this.database.bm25Terms,
      ],
      async () => {
        const previous = (
          await this.database.pages
            .where("normalizedUrl")
            .equals(normalizedUrl)
            .reverse()
            .sortBy("updatedAt")
        )[0];
        const today = toLocalDateKey(new Date(now));
        const shouldMerge =
          previous !== undefined && previous.visitDate === today;
        const page: PageRecord = shouldMerge
          ? {
              ...previous,
              url: capture.url,
              title: capture.title || previous.title,
              content: capture.content || previous.content,
              contentHash: hashContent(capture.content || previous.content),
              durationSeconds:
                previous.durationSeconds + capture.durationSeconds,
              capturedAt: capture.capturedAt,
              updatedAt: now,
            }
          : {
              ...capture,
              id: crypto.randomUUID(),
              normalizedUrl,
              domain: new URL(capture.url).hostname,
              contentHash: hashContent(capture.content),
              visitDate: toLocalDateKey(new Date(now)),
              createdAt: now,
              updatedAt: now,
            };

        await this.database.pages.put(page);
        const newDoc = buildIndexRecord(page);
        const oldDoc = shouldMerge
          ? await this.database.bm25Documents.get(previous.id)
          : undefined;
        await this.database.bm25Documents.put(newDoc);
        await this.updateAffectedTerms(page.id, newDoc, oldDoc);
        return page;
      },
    );
  }

  async count(): Promise<number> {
    return this.database.pages.count();
  }

  async getDistinctDates(): Promise<string[]> {
    const dates = await this.database.pages
      .orderBy("visitDate")
      .keys();
    return [...new Set(dates as string[])].sort().reverse();
  }

  async getByDate(date: string): Promise<PageRecord[]> {
    return this.database.pages
      .where("visitDate")
      .equals(date)
      .reverse()
      .sortBy("updatedAt");
  }

  async getTodaySnapshot(now = new Date()): Promise<TodaySnapshot> {
    const visitDate = toLocalDateKey(now);
    const pages = await this.database.pages
      .where("visitDate")
      .equals(visitDate)
      .toArray();
    const domains = new Map<string, number>();
    for (const page of pages) {
      domains.set(page.domain, (domains.get(page.domain) ?? 0) + 1);
    }
    const topDomain = [...domains.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];

    return {
      pageCount: pages.length,
      readingMinutes: Math.round(
        pages.reduce((total, page) => total + page.durationSeconds, 0) / 60,
      ),
      deepReadCount: pages.filter((page) => page.durationSeconds >= 180).length,
      topDomain,
    };
  }

  async purgeExpired(retentionDays: number, now = Date.now()): Promise<number> {
    const cutoff = now - retentionDays * 86_400_000;
    return this.database.transaction(
      "rw",
      [
        this.database.pages,
        this.database.bm25Documents,
        this.database.bm25Terms,
      ],
      async () => {
        const expiredPages = await this.database.pages
          .where("updatedAt")
          .below(cutoff)
          .filter((page) => page.content.length > 0)
          .toArray();
        if (expiredPages.length === 0) {
          return 0;
        }

        for (const page of expiredPages) {
          const oldDoc = await this.database.bm25Documents.get(page.id);
          if (oldDoc) {
            for (const [term] of Object.entries(oldDoc.frequencies)) {
              const termRecord = await this.database.bm25Terms.get(term);
              if (!termRecord) continue;
              const newPostings = termRecord.postings.filter(
                (p) => p.pageId !== page.id,
              );
              if (newPostings.length === 0) {
                await this.database.bm25Terms.delete(term);
              } else {
                await this.database.bm25Terms.put({
                  ...termRecord,
                  postings: newPostings,
                  documentFrequency: newPostings.length,
                });
              }
            }
            await this.database.bm25Documents.delete(page.id);
          }
          await this.database.pages.update(page.id, {
            content: "",
            contentHash: hashContent(""),
          });
        }

        return expiredPages.length;
      },
    );
  }

  /**
   * Incrementally update only the terms affected by a single page upsert,
   * instead of rebuilding the entire inverted index.
   */
  private async updateAffectedTerms(
    pageId: string,
    newDoc: Bm25DocumentRecord,
    oldDoc: Bm25DocumentRecord | undefined,
  ): Promise<void> {
    const oldFreqs = oldDoc?.frequencies ?? {};
    const newFreqs = newDoc.frequencies;

    const affectedTerms = new Set([
      ...Object.keys(oldFreqs),
      ...Object.keys(newFreqs),
    ]);

    // Sequential awaits inside a Dexie transaction keep it alive
    for (const term of affectedTerms) {
      const oldTf = oldFreqs[term] ?? 0;
      const newTf = newFreqs[term] ?? 0;
      if (oldTf === newTf) continue;

      const record = await this.database.bm25Terms.get(term);

      if (newTf === 0) {
        // Term no longer appears in this page
        if (record) {
          const postings = record.postings.filter(
            (p) => p.pageId !== pageId,
          );
          if (postings.length === 0) {
            await this.database.bm25Terms.delete(term);
          } else {
            await this.database.bm25Terms.put({
              term,
              documentFrequency: postings.length,
              postings,
            });
          }
        }
      } else if (oldTf === 0) {
        // New term for this page
        const postings = record?.postings ?? [];
        postings.push({ pageId, termFrequency: newTf });
        await this.database.bm25Terms.put({
          term,
          documentFrequency: postings.length,
          postings,
        });
      } else {
        // Term frequency changed
        if (record) {
          const postings = record.postings.map((p) =>
            p.pageId === pageId ? { ...p, termFrequency: newTf } : p,
          );
          await this.database.bm25Terms.put({
            term,
            documentFrequency: postings.length,
            postings,
          });
        }
      }
    }
  }
}
