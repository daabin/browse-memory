import { describe, expect, it } from "vitest";

import {
  createBm25Index,
  removeDocument,
  searchIndex,
  upsertDocument,
} from "@/search/bm25";

describe("BM25", () => {
  it("ranks a title match above a body-only match", () => {
    const index = createBm25Index();
    upsertDocument(index, {
      pageId: "body",
      title: "Notes",
      content: "A guide to browser RAG systems",
    });
    upsertDocument(index, {
      pageId: "title",
      title: "Browser RAG architecture",
      content: "Short notes",
    });

    expect(searchIndex(index, "browser rag").map((result) => result.pageId)).toEqual([
      "title",
      "body",
    ]);
  });

  it("replaces and removes documents without stale terms", () => {
    const index = createBm25Index();
    upsertDocument(index, { pageId: "a", title: "Alpha", content: "Beta" });
    upsertDocument(index, { pageId: "a", title: "Gamma", content: "Delta" });
    expect(searchIndex(index, "alpha")).toEqual([]);

    removeDocument(index, "a");
    expect(searchIndex(index, "gamma")).toEqual([]);
  });

  it("returns no results for an empty query", () => {
    expect(searchIndex(createBm25Index(), "  ")).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const index = createBm25Index();
    for (let i = 0; i < 25; i++) {
      upsertDocument(index, { pageId: `doc-${i}`, title: `Document ${i}`, content: "browser RAG" });
    }
    expect(searchIndex(index, "browser", 5)).toHaveLength(5);
  });

  it("returns no results from an empty index", () => {
    expect(searchIndex(createBm25Index(), "browser")).toEqual([]);
  });
});
