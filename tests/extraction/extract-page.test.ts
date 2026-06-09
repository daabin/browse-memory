import { describe, expect, it } from "vitest";

import { extractPage } from "@/extraction/extract-page";

describe("extractPage", () => {
  it("extracts readable article text", () => {
    document.body.innerHTML = `
      <article>
        <h1>Browser memory</h1>
        <p>${"Useful article content. ".repeat(20)}</p>
      </article>
    `;
    document.title = "Browser memory";

    const result = extractPage(document, "https://example.com/article");

    expect(result.title).toContain("Browser memory");
    expect(result.content).toContain("Useful article content");
  });

  it("falls back to title and URL when readability cannot extract content", () => {
    document.body.innerHTML = "<canvas></canvas>";
    document.title = "Canvas application";

    expect(extractPage(document, "https://example.com/app")).toEqual({
      url: "https://example.com/app",
      title: "Canvas application",
      content: "",
    });
  });
});
