import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/shared/constants";
import { shouldCapture } from "@/capture/capture-policy";

describe("capture policy", () => {
  it("requires the configured reading duration", () => {
    expect(
      shouldCapture(
        {
          url: "https://example.com",
          durationSeconds: 4,
          incognito: false,
        },
        DEFAULT_SETTINGS,
      ),
    ).toBe(false);
  });

  it("rejects blocked, unsupported, and incognito pages", () => {
    expect(
      shouldCapture(
        {
          url: "https://pay.example.com",
          durationSeconds: 10,
          incognito: false,
        },
        { ...DEFAULT_SETTINGS, blacklistPatterns: ["*.example.com"] },
      ),
    ).toBe(false);
    expect(
      shouldCapture(
        { url: "chrome://settings", durationSeconds: 10, incognito: false },
        DEFAULT_SETTINGS,
      ),
    ).toBe(false);
    expect(
      shouldCapture(
        {
          url: "https://example.com",
          durationSeconds: 10,
          incognito: true,
        },
        DEFAULT_SETTINGS,
      ),
    ).toBe(false);
  });
});
