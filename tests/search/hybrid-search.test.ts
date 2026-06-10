import { describe, expect, it } from "vitest";

import {
  cosineSimilarity,
  reciprocalRankFusion,
  vectorSearch,
} from "@/search/hybrid-search";
import type { EmbeddingRecord } from "@/shared/types";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 when one vector is zero", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe("vectorSearch", () => {
  const embeddings: EmbeddingRecord[] = [
    { pageId: "p1", vector: [1, 0, 0], model: "m", createdAt: 1 },
    { pageId: "p2", vector: [0, 1, 0], model: "m", createdAt: 2 },
    { pageId: "p3", vector: [0.9, 0.1, 0], model: "m", createdAt: 3 },
  ];

  it("returns results sorted by similarity", () => {
    const results = vectorSearch(embeddings, [1, 0, 0]);
    expect(results[0].pageId).toBe("p1");
    expect(results[0].score).toBeCloseTo(1);
    expect(results[1].pageId).toBe("p3");
  });

  it("respects topK", () => {
    const results = vectorSearch(embeddings, [1, 0, 0], 1);
    expect(results).toHaveLength(1);
    expect(results[0].pageId).toBe("p1");
  });

  it("returns empty for empty embeddings", () => {
    expect(vectorSearch([], [1, 0, 0])).toEqual([]);
  });
});

describe("reciprocalRankFusion", () => {
  it("fuses BM25 and vector results", () => {
    const bm25 = [{ pageId: "a" }, { pageId: "b" }, { pageId: "c" }];
    const vector = [{ pageId: "b" }, { pageId: "a" }, { pageId: "d" }];

    const fused = reciprocalRankFusion(bm25, vector);
    // "a" and "b" appear in both lists, should rank highest
    const ids = fused.map((r) => r.pageId);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("c"));
    expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("c"));
    expect(fused).toHaveLength(4);
  });

  it("returns empty for empty inputs", () => {
    expect(reciprocalRankFusion([], [])).toEqual([]);
  });

  it("handles only BM25 results", () => {
    const bm25 = [{ pageId: "a" }, { pageId: "b" }];
    const fused = reciprocalRankFusion(bm25, []);
    expect(fused).toHaveLength(2);
    expect(fused[0].pageId).toBe("a");
  });

  it("handles only vector results", () => {
    const vector = [{ pageId: "x" }, { pageId: "y" }];
    const fused = reciprocalRankFusion([], vector);
    expect(fused).toHaveLength(2);
    expect(fused[0].pageId).toBe("x");
  });

  it("scores overlapping items higher", () => {
    const bm25 = [{ pageId: "a" }, { pageId: "b" }];
    const vector = [{ pageId: "a" }];
    const fused = reciprocalRankFusion(bm25, vector);
    // "a" should have higher score than "b"
    expect(fused[0].pageId).toBe("a");
    expect(fused[0].score).toBeGreaterThan(fused[1].score);
  });
});
