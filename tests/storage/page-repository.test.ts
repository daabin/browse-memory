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

  it("accumulates a repeated URL inside ten minutes", async () => {
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

  it("creates a new visit after ten minutes", async () => {
    const capture = {
      url: "https://example.com/rag",
      title: "RAG Guide",
      content: "browser retrieval",
      durationSeconds: 5,
      capturedAt: 1_000,
    };
    await pages.upsertCapture(capture, 1_000);
    await pages.upsertCapture(capture, 1_000 + 11 * 60_000);

    expect(await pages.count()).toBe(2);
  });
});
