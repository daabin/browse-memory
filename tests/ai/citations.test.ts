import { describe, expect, it } from "vitest";

import { resolveCitations } from "@/ai/citations";

describe("resolveCitations", () => {
  it("maps only citations present in the retrieved source list", () => {
    expect(
      resolveCitations("See [1], [2], and [9].", [
        { index: 1, title: "One", url: "https://example.com/1" },
        { index: 2, title: "Two", url: "https://example.com/2" },
      ]),
    ).toEqual([
      { index: 1, title: "One", url: "https://example.com/1" },
      { index: 2, title: "Two", url: "https://example.com/2" },
    ]);
  });

  it("returns an empty list when there are no citations", () => {
    expect(
      resolveCitations("No citations here.", [
        { index: 1, title: "One", url: "https://example.com/1" },
      ]),
    ).toEqual([]);
  });

  it("ignores citations that reference out-of-range sources", () => {
    expect(
      resolveCitations("[1] [5]", [
        { index: 1, title: "One", url: "https://example.com/1" },
      ]),
    ).toEqual([
      { index: 1, title: "One", url: "https://example.com/1" },
    ]);
  });
});
