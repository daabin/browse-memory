import { describe, expect, it, vi } from "vitest";

import type { OpenAICompatibleClient } from "@/ai/openai-client";
import { SummaryService } from "@/ai/summary-service";

describe("SummaryService", () => {
  const config = {
    baseUrl: "https://api.example.com",
    apiKey: "key",
    model: "m",
  };

  it("returns a trimmed summary from the chat API", async () => {
    const client = {
      chat: vi.fn().mockResolvedValue("  这是一篇关于 RAG 的文章。  "),
    } as unknown as OpenAICompatibleClient;
    const service = new SummaryService(client);

    const summary = await service.summarize("RAG Guide", "Long content...", config);

    expect(summary).toBe("这是一篇关于 RAG 的文章。");
    expect(client.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: config.baseUrl,
        model: config.model,
      }),
    );
  });

  it("truncates long content to MAX_CONTENT_CHARS", async () => {
    const chatMock = vi.fn().mockResolvedValue("Summary");
    const client = { chat: chatMock } as unknown as OpenAICompatibleClient;
    const service = new SummaryService(client);

    const longContent = "x".repeat(5000);
    await service.summarize("Title", longContent, config);

    const call = chatMock.mock.calls[0]![0];
    const userMessage = call.messages[1]!.content;
    // Content in the message should be truncated
    expect(userMessage.length).toBeLessThan(5000);
  });

  it("caps summary at 300 chars", async () => {
    const client = {
      chat: vi.fn().mockResolvedValue("z".repeat(500)),
    } as unknown as OpenAICompatibleClient;
    const service = new SummaryService(client);

    const summary = await service.summarize("T", "content", config);
    expect(summary.length).toBeLessThanOrEqual(300);
  });
});
