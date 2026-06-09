import { describe, expect, it } from "vitest";

import { buildSnippet } from "@/search/snippet";

describe("buildSnippet", () => {
  it("returns a bounded excerpt and highlight ranges", () => {
    expect(buildSnippet("alpha beta gamma", ["beta"], 40)).toEqual({
      text: "alpha beta gamma",
      ranges: [{ start: 6, end: 10 }],
    });
  });

  it("falls back to the beginning when there is no match", () => {
    expect(buildSnippet("alpha beta gamma", ["missing"], 10).text).toBe(
      "alpha beta…",
    );
  });

  it("highlights multiple occurrences of query tokens", () => {
    const result = buildSnippet("alpha beta alpha beta", ["alpha"], 40);
    expect(result.ranges.length).toBeGreaterThanOrEqual(2);
  });

  it("adds ellipsis when content is truncated", () => {
    const long = "a ".repeat(200).trim();
    const result = buildSnippet(long, ["a"], 20);
    expect(result.text).toContain("…");
  });
});
