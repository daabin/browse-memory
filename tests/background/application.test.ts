import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrowseMemoryApplication } from "@/background/application";
import { BrowseMemoryDatabase } from "@/storage/database";

describe("BrowseMemoryApplication", () => {
  let database: BrowseMemoryDatabase;
  let application: BrowseMemoryApplication;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`application-${crypto.randomUUID()}`);
    application = new BrowseMemoryApplication(database, vi.fn());
  });

  afterEach(async () => {
    await database.delete();
  });

  it("stores and searches captures through the application boundary", async () => {
    await application.handle({
      type: "STORE_CAPTURE",
      capture: {
        url: "https://example.com/rag",
        title: "Browser RAG",
        content: "local retrieval architecture",
        durationSeconds: 10,
        capturedAt: Date.now(),
      },
    });

    const response = await application.handle({
      type: "SEARCH",
      query: "browser",
    });

    expect(response).toMatchObject({
      ok: true,
      results: [{ page: { title: "Browser RAG" } }],
    });
  });

  it("encrypts a newly supplied API key and never returns it", async () => {
    await application.handle({
      type: "SAVE_SETTINGS",
      settings: { chatModel: "custom" },
      apiKey: "sk-private",
    });

    expect(await application.handle({ type: "GET_SETTINGS" })).toMatchObject({
      ok: true,
      hasApiKey: true,
      settings: { chatModel: "custom", encryptedApiKey: undefined },
    });
  });
});
