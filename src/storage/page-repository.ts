import { tokenize } from "../search/tokenize";
import { normalizeUrl } from "../shared/url-policy";
import type { PageCapture, PageRecord, TodaySnapshot } from "../shared/types";

import type { Bm25DocumentRecord, BrowseMemoryDatabase } from "./database";

const DEDUPLICATION_WINDOW_MS = 10 * 60_000;

function hashContent(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16);
}

function buildIndexRecord(page: PageRecord): Bm25DocumentRecord {
  const frequencies: Record<string, number> = {};
  for (const token of tokenize(page.content)) {
    frequencies[token] = (frequencies[token] ?? 0) + 1;
  }
  for (const token of tokenize(page.title)) {
    frequencies[token] = (frequencies[token] ?? 0) + 2;
  }
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
        const shouldMerge =
          previous !== undefined &&
          now - previous.updatedAt < DEDUPLICATION_WINDOW_MS;
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
              visitDate: new Date(now).toISOString().slice(0, 10),
              createdAt: now,
              updatedAt: now,
            };

        await this.database.pages.put(page);
        await this.database.bm25Documents.put(buildIndexRecord(page));
        await this.rebuildTerms();
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
    const visitDate = now.toISOString().slice(0, 10);
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

  private async rebuildTerms(): Promise<void> {
    const documents = await this.database.bm25Documents.toArray();
    const termMap = new Map<
      string,
      Array<{ pageId: string; termFrequency: number }>
    >();
    for (const document of documents) {
      for (const [term, termFrequency] of Object.entries(
        document.frequencies,
      )) {
        const postings = termMap.get(term) ?? [];
        postings.push({ pageId: document.pageId, termFrequency });
        termMap.set(term, postings);
      }
    }

    await this.database.bm25Terms.clear();
    await this.database.bm25Terms.bulkPut(
      [...termMap.entries()].map(([term, postings]) => ({
        term,
        documentFrequency: postings.length,
        postings,
      })),
    );
  }
}
