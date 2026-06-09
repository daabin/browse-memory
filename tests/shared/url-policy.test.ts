import { describe, expect, it } from "vitest";

import {
  isBlockedUrl,
  isSupportedUrl,
  normalizeUrl,
} from "@/shared/url-policy";

describe("URL policy", () => {
  it("normalizes tracking parameters, hashes, host casing, and trailing slash", () => {
    expect(normalizeUrl("https://Example.com/a/?utm_source=x&b=2#part")).toBe(
      "https://example.com/a?b=2",
    );
  });

  it("matches wildcard domains without matching unrelated suffixes", () => {
    expect(isBlockedUrl("https://pay.example.com", ["*.example.com"])).toBe(
      true,
    );
    expect(isBlockedUrl("https://example.com", ["*.example.com"])).toBe(true);
    expect(isBlockedUrl("https://notexample.com", ["*.example.com"])).toBe(
      false,
    );
  });

  it("supports only ordinary web pages", () => {
    expect(isSupportedUrl("https://example.com")).toBe(true);
    expect(isSupportedUrl("chrome://settings")).toBe(false);
  });

  it("blocks unsupported schemes as blocked URLs", () => {
    expect(isBlockedUrl("chrome-extension://abc", [])).toBe(true);
    expect(isBlockedUrl("about:blank", [])).toBe(true);
  });

  it("sorts remaining query parameters after removing tracking ones", () => {
    expect(normalizeUrl("https://x.com/?z=3&a=1&utm_source=seo")).toBe(
      "https://x.com/?a=1&z=3",
    );
  });
});
