import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrowseMemoryDatabase } from "@/storage/database";
import { EmbeddingRepository } from "@/storage/embedding-repository";
import { PageRepository } from "@/storage/page-repository";

describe("EmbeddingRepository", () => {
  let database: BrowseMemoryDatabase;
  let repo: EmbeddingRepository;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`emb-${crypto.randomUUID()}`);
    repo = new EmbeddingRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("stores and retrieves an embedding", async () => {
    await repo.put({
      pageId: "p1",
      vector: [0.1, 0.2, 0.3],
      model: "bge-m3",
      createdAt: 1000,
    });

    const record = await repo.get("p1");
    expect(record).toBeDefined();
    expect(record!.vector).toEqual([0.1, 0.2, 0.3]);
    expect(record!.model).toBe("bge-m3");
  });

  it("deletes an embedding", async () => {
    await repo.put({ pageId: "p1", vector: [1], model: "m", createdAt: 1 });
    await repo.delete("p1");
    expect(await repo.get("p1")).toBeUndefined();
  });

  it("counts embeddings", async () => {
    await repo.put({ pageId: "p1", vector: [1], model: "m", createdAt: 1 });
    await repo.put({ pageId: "p2", vector: [2], model: "m", createdAt: 2 });
    expect(await repo.count()).toBe(2);
  });

  it("getAll returns all embeddings", async () => {
    await repo.put({ pageId: "p1", vector: [1], model: "m", createdAt: 1 });
    await repo.put({ pageId: "p2", vector: [2], model: "m", createdAt: 2 });
    const all = await repo.getAll();
    expect(all).toHaveLength(2);
  });

  it("getUnembeddedPageIds finds pages without embeddings", async () => {
    const pages = new PageRepository(database);
    await pages.upsertCapture(
      { url: "https://a.com", title: "A", content: "a", durationSeconds: 10, capturedAt: 1000 },
      1000,
    );
    await pages.upsertCapture(
      { url: "https://b.com", title: "B", content: "b", durationSeconds: 10, capturedAt: 2000 },
      2000,
    );

    // Embed only one page
    const allPages = await database.pages.toArray();
    await repo.put({
      pageId: allPages[0].id,
      vector: [1],
      model: "m",
      createdAt: 1,
    });

    const unembedded = await repo.getUnembeddedPageIds();
    expect(unembedded).toHaveLength(1);
    expect(unembedded).toContain(allPages[1].id);
  });
});
