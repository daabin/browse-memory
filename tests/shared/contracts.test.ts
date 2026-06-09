import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/shared/constants";

describe("default settings", () => {
  it("starts useful without a configured API key", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      chatBaseUrl: "https://api.deepseek.com",
      chatModel: "deepseek-v4-flash",
      minimumReadSeconds: 5,
    });
    expect(DEFAULT_SETTINGS.encryptedApiKey).toBeUndefined();
  });
});
