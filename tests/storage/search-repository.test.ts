import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrowseMemoryDatabase } from "@/storage/database";
import { PageRepository } from "@/storage/page-repository";
import { SearchRepository } from "@/storage/search-repository";

describe("SearchRepository", () => {
  let database: BrowseMemoryDatabase;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`search-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("searches pages indexed by the page transaction", async () => {
    const pages = new PageRepository(database);
    const search = new SearchRepository(database);
    await pages.upsertCapture(
      {
        url: "https://example.com/browser-rag",
        title: "Browser RAG",
        content: "Local retrieval guide",
        durationSeconds: 12,
        capturedAt: Date.now(),
      },
      Date.now(),
    );

    const results = await search.search("browser");

    expect(results).toHaveLength(1);
    expect(results[0]?.page.title).toBe("Browser RAG");
    expect(results[0]?.snippet).toContain("Browser RAG");
  });

  it("returns recently updated pages for the memory home", async () => {
    const pages = new PageRepository(database);
    const search = new SearchRepository(database);
    await pages.upsertCapture(
      {
        url: "https://example.com/recent",
        title: "Recent memory",
        content: "A useful recent page",
        durationSeconds: 12,
        capturedAt: Date.now(),
      },
      Date.now(),
    );

    expect((await search.recent())[0]?.page.title).toBe("Recent memory");
  });
});
