import { describe, expect, it } from "vitest";

import { buildRagContext } from "@/ai/context";
import type { SearchResult } from "@/shared/types";

function result(index: number, content = "content"): SearchResult {
  return {
    score: 10 - index,
    snippet: content,
    highlights: [],
    page: {
      id: String(index),
      url: `https://example.com/${index}`,
      normalizedUrl: `https://example.com/${index}`,
      title: `Source ${index}`,
      domain: "example.com",
      content,
      contentHash: "hash",
      durationSeconds: 60,
      visitDate: "2026-06-09",
      capturedAt: 0,
      createdAt: 0,
      updatedAt: 0,
    },
  };
}

describe("buildRagContext", () => {
  it("keeps rank order, five sources, and the requested budget", () => {
    const built = buildRagContext(
      Array.from({ length: 8 }, (_, index) => result(index, "x".repeat(500))),
      400,
    );

    expect(built.sources).toHaveLength(5);
    expect(built.sources[0]?.title).toBe("Source 0");
    expect(built.text.length).toBeLessThanOrEqual(400);
  });

  it("uses the local search snippet instead of leaking stored page content", () => {
    const searchResult = result(0, "safe local snippet");
    searchResult.page.content = "private-body-marker";

    const built = buildRagContext([searchResult], 500);

    expect(built.text.length).toBeLessThanOrEqual(500);
    expect(built.text).toContain("safe local snippet");
    expect(built.text).not.toContain("private-body-marker");
  });

  it("handles empty results", () => {
    const built = buildRagContext([], 12_000);
    expect(built.text).toBe("");
    expect(built.sources).toEqual([]);
  });
});
