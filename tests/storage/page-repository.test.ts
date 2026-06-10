import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrowseMemoryDatabase } from "@/storage/database";
import { PageRepository } from "@/storage/page-repository";

describe("PageRepository", () => {
  let database: BrowseMemoryDatabase;
  let pages: PageRepository;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`pages-${crypto.randomUUID()}`);
    pages = new PageRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("accumulates a repeated URL within the same day", async () => {
    const capture = {
      url: "https://example.com/rag?utm_source=test",
      title: "RAG Guide",
      content: "browser retrieval augmented generation",
      durationSeconds: 5,
      capturedAt: 1_000,
    };
    const first = await pages.upsertCapture(capture, 1_000);
    const second = await pages.upsertCapture(
      { ...capture, durationSeconds: 8 },
      1_000 + 9 * 60_000,
    );

    expect(second.id).toBe(first.id);
    expect(second.durationSeconds).toBe(13);
    expect(await pages.count()).toBe(1);
  });

  it("creates a new visit on a different day", async () => {
    const capture = {
      url: "https://example.com/rag",
      title: "RAG Guide",
      content: "browser retrieval",
      durationSeconds: 5,
      capturedAt: 1_000,
    };
    await pages.upsertCapture(capture, 1_000);
    // 25 hours later is guaranteed to be a different calendar day
    await pages.upsertCapture(capture, 1_000 + 25 * 3_600_000);

    expect(await pages.count()).toBe(2);
  });

  describe("incremental term index", () => {
    it("updates bm25Terms incrementally on new page insert", async () => {
      await pages.upsertCapture(
        {
          url: "https://example.com/a",
          title: "Alpha",
          content: "alpha beta gamma",
          durationSeconds: 10,
          capturedAt: 1_000,
        },
        1_000,
      );

      const terms = await database.bm25Terms.toArray();
      const termNames = terms.map((t) => t.term).sort();
      // title token 'alpha' + content tokens 'alpha','beta','gamma'
      expect(termNames).toContain("alpha");
      expect(termNames).toContain("beta");
      expect(termNames).toContain("gamma");
    });

    it("updates bm25Terms incrementally on page merge (content changes)", async () => {
      const capture = {
        url: "https://example.com/b",
        title: "Page",
        content: "old content only",
        durationSeconds: 5,
        capturedAt: 1_000,
      };
      await pages.upsertCapture(capture, 1_000);
      // Merge within 10 minutes with new content
      await pages.upsertCapture(
        { ...capture, content: "brand new content here" },
        1_000 + 5 * 60_000,
      );

      // 'old','content','only' should be removed or have df decremented
      // 'brand','new','content','here' should be present
      const terms = await database.bm25Terms.toArray();
      const termNames = terms.map((t) => t.term);
      expect(termNames).toContain("brand");
      expect(termNames).toContain("new");
      // 'old' and 'only' should no longer appear (only one page)
      expect(termNames).not.toContain("old");
      expect(termNames).not.toContain("only");
    });

    it("preserves shared terms when one page is updated", async () => {
      await pages.upsertCapture(
        {
          url: "https://example.com/1",
          title: "P1",
          content: "shared unique1",
          durationSeconds: 10,
          capturedAt: 1_000,
        },
        1_000,
      );
      await pages.upsertCapture(
        {
          url: "https://example.com/2",
          title: "P2",
          content: "shared unique2",
          durationSeconds: 10,
          capturedAt: 2_000,
        },
        2_000,
      );
      // Update page 1 with new content on a different calendar day
      await pages.upsertCapture(
        {
          url: "https://example.com/1",
          title: "P1",
          content: "fresh terms now",
          durationSeconds: 5,
          capturedAt: 3_000,
        },
        1_000 + 25 * 3_600_000,
      );

      const sharedTerm = await database.bm25Terms.get("shared");
      // 'shared' should appear in both the old page1 record and page2
      expect(sharedTerm).toBeDefined();
      expect(sharedTerm!.postings).toHaveLength(2); // old page1 + page2
    });
  });

  describe("purgeExpired", () => {
    const DAY = 86_400_000;
    const NOW = 1_700_000_000_000;

    it("clears expired page content while retaining metadata", async () => {
      // Insert a page 10 days ago
      await pages.upsertCapture(
        {
          url: "https://example.com/old",
          title: "Old Page",
          content: "ancient content",
          durationSeconds: 10,
          capturedAt: NOW - 10 * DAY,
        },
        NOW - 10 * DAY,
      );
      // Insert a fresh page
      await pages.upsertCapture(
        {
          url: "https://example.com/new",
          title: "New Page",
          content: "fresh content",
          durationSeconds: 10,
          capturedAt: NOW,
        },
        NOW,
      );

      expect(await pages.count()).toBe(2);

      const purged = await pages.purgeExpired(7, NOW);
      expect(purged).toBe(1);
      expect(await pages.count()).toBe(2);

      const expired = await database.pages
        .where("normalizedUrl")
        .equals("https://example.com/old")
        .first();
      expect(expired).toMatchObject({
        title: "Old Page",
        url: "https://example.com/old",
        durationSeconds: 10,
        content: "",
      });

      // 'ancient' term should be gone
      const ancientTerm = await database.bm25Terms.get("ancient");
      expect(ancientTerm).toBeUndefined();
      // 'fresh' term should still exist
      const freshTerm = await database.bm25Terms.get("fresh");
      expect(freshTerm).toBeDefined();
    });

    it("does not repeatedly purge an already cleared page", async () => {
      await pages.upsertCapture(
        {
          url: "https://example.com/old",
          title: "Old Page",
          content: "ancient content",
          durationSeconds: 10,
          capturedAt: NOW - 10 * DAY,
        },
        NOW - 10 * DAY,
      );

      expect(await pages.purgeExpired(7, NOW)).toBe(1);
      expect(await pages.purgeExpired(7, NOW)).toBe(0);
    });

    it("returns 0 when no pages are expired", async () => {
      await pages.upsertCapture(
        {
          url: "https://example.com/fresh",
          title: "Fresh",
          content: "recent content",
          durationSeconds: 5,
          capturedAt: NOW,
        },
        NOW,
      );
      const purged = await pages.purgeExpired(7, NOW);
      expect(purged).toBe(0);
    });

    it("cleans up bm25Documents for purged pages", async () => {
      await pages.upsertCapture(
        {
          url: "https://example.com/doomed",
          title: "Doomed",
          content: "doomed content",
          durationSeconds: 5,
          capturedAt: NOW - 30 * DAY,
        },
        NOW - 30 * DAY,
      );
      await pages.purgeExpired(7, NOW);
      const docs = await database.bm25Documents.toArray();
      expect(docs).toHaveLength(0);
    });
  });
});
