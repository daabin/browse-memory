import { describe, expect, it } from "vitest";

import { tokenize } from "@/search/tokenize";

describe("tokenize", () => {
  it("segments Chinese and normalizes Latin words", () => {
    const tokens = tokenize("浏览器 RAG Search，浏览器");

    expect(tokens).toEqual(
      expect.arrayContaining(["浏览器", "rag", "search"]),
    );
    expect(tokens.filter((token) => token === "浏览器")).toHaveLength(2);
  });

  it("removes common stop words and punctuation", () => {
    expect(tokenize("the browser and the web")).toEqual(["browser", "web"]);
  });

  it("normalizes Unicode to NFKC", () => {
    const tokens = tokenize("ＲＡＧ"); // fullwidth Latin
    expect(tokens).toEqual(expect.arrayContaining(["rag"]));
  });

  it("handles empty and whitespace-only input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ")).toEqual([]);
  });
});
