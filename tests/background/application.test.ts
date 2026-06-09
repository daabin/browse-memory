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

  it("returns distinct dates and records by date", async () => {
    await application.handle({
      type: "STORE_CAPTURE",
      capture: {
        url: "https://example.com/page1",
        title: "Page One",
        content: "content one",
        durationSeconds: 10,
        capturedAt: Date.now(),
      },
    });

    const datesResp = await application.handle({ type: "GET_DISTINCT_DATES" });
    expect(datesResp).toMatchObject({ ok: true });
    if ("dates" in datesResp) {
      expect(datesResp.dates.length).toBeGreaterThanOrEqual(1);
    }

    const today = new Date().toISOString().slice(0, 10);
    const recordsResp = await application.handle({ type: "GET_RECORDS_BY_DATE", date: today });
    expect(recordsResp).toMatchObject({ ok: true });
    if ("results" in recordsResp) {
      expect(recordsResp.results.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("creates and retrieves chat sessions", async () => {
    const createResp = await application.handle({
      type: "CREATE_CHAT_SESSION",
      title: "Test question about RAG",
    });
    expect(createResp).toMatchObject({ ok: true });
    if ("session" in createResp) {
      const session = createResp.session;

      await application.handle({
        type: "ADD_CHAT_MESSAGE",
        sessionId: session.id,
        message: { role: "user", content: "What is RAG?" },
      });

      const getResp = await application.handle({
        type: "GET_CHAT_SESSION",
        sessionId: session.id,
      });
      expect(getResp).toMatchObject({ ok: true });
      if ("messages" in getResp) {
        expect(getResp.messages).toHaveLength(1);
      }
    }

    const listResp = await application.handle({ type: "LIST_CHAT_SESSIONS" });
    expect(listResp).toMatchObject({ ok: true });
    if ("sessions" in listResp) {
      expect(listResp.sessions).toHaveLength(1);
    }
  });
});
