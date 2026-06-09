import { describe, expect, it, vi } from "vitest";

import type { OpenAICompatibleClient } from "@/ai/openai-client";
import { RagService } from "@/ai/rag-service";
import type { SearchResult } from "@/shared/types";

function result(index: number): SearchResult {
  return {
    score: 10 - index,
    snippet: `Snippet for result ${index}`,
    highlights: [],
    page: {
      id: String(index),
      url: `https://example.com/${index}`,
      normalizedUrl: `https://example.com/${index}`,
      title: `Source ${index}`,
      domain: "example.com",
      content: `Content for source ${index}`,
      contentHash: "hash",
      durationSeconds: 60,
      visitDate: "2026-06-09",
      capturedAt: 0,
      createdAt: 0,
      updatedAt: 0,
    },
  };
}

describe("RagService", () => {
  it("returns an online answer with resolved citations", async () => {
    const client = {
      chat: vi.fn().mockResolvedValue("You studied RAG [1] and BM25 [2]."),
    } as unknown as OpenAICompatibleClient;
    const service = new RagService(client);

    const answer = await service.answer(
      "What did I study?",
      [result(0), result(1)],
      { baseUrl: "https://api.example.com", apiKey: "key", model: "m" },
      true,
    );

    expect(answer.offline).toBe(false);
    expect(answer.text).toBe("You studied RAG [1] and BM25 [2].");
    expect(answer.sources).toEqual([
      { index: 1, title: "Source 0", url: "https://example.com/0" },
      { index: 2, title: "Source 1", url: "https://example.com/1" },
    ]);
    expect(client.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://api.example.com",
        apiKey: "key",
        model: "m",
      }),
    );
  });

  it("falls back to local snippets when offline", async () => {
    const client = { chat: vi.fn() } as unknown as OpenAICompatibleClient;
    const service = new RagService(client);

    const answer = await service.answer(
      "What did I study?",
      [result(0), result(1)],
      { baseUrl: "https://api.example.com", apiKey: "key", model: "m" },
      false,
    );

    expect(answer.offline).toBe(true);
    expect(answer.text).toContain("离线模式");
    expect(answer.text).toContain("Snippet for result 0");
    expect(client.chat).not.toHaveBeenCalled();
  });

  it("falls back when no configuration is provided", async () => {
    const client = { chat: vi.fn() } as unknown as OpenAICompatibleClient;
    const service = new RagService(client);

    const answer = await service.answer("Question", [result(0)], undefined, true);

    expect(answer.offline).toBe(true);
    expect(client.chat).not.toHaveBeenCalled();
  });

  it("sends system prompt first for prefix caching", async () => {
    const client = {
      chat: vi.fn().mockResolvedValue("Answer"),
    } as unknown as OpenAICompatibleClient;
    const service = new RagService(client);

    await service.answer("Q", [result(0)], {
      baseUrl: "https://api.example.com",
      apiKey: "key",
      model: "m",
    }, true);

    const messages = (client.chat as ReturnType<typeof vi.fn>).mock.calls[0][0].messages;
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });
});
