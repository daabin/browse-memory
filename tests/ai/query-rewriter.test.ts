import { describe, expect, it, vi } from "vitest";

import type { OpenAICompatibleClient } from "@/ai/openai-client";
import { QueryRewriter } from "@/ai/query-rewriter";

describe("QueryRewriter", () => {
  const config = {
    baseUrl: "https://api.example.com",
    apiKey: "key",
    model: "m",
  };

  it("returns original question when history is empty", async () => {
    const client = {
      chat: vi.fn(),
    } as unknown as OpenAICompatibleClient;
    const rewriter = new QueryRewriter(client);

    const result = await rewriter.rewrite("What is RAG?", [], config);

    expect(result).toBe("What is RAG?");
    expect(client.chat).not.toHaveBeenCalled();
  });

  it("calls chat API to rewrite when history exists", async () => {
    const client = {
      chat: vi.fn().mockResolvedValue("RAG 架构的优点是什么？"),
    } as unknown as OpenAICompatibleClient;
    const rewriter = new QueryRewriter(client);

    const history = [
      { role: "user" as const, content: "我想了解 RAG 架构" },
      { role: "assistant" as const, content: "RAG 是检索增强生成..." },
    ];

    const result = await rewriter.rewrite("它的优点是什么？", history, config);

    expect(result).toBe("RAG 架构的优点是什么？");
    expect(client.chat).toHaveBeenCalledOnce();
  });

  it("falls back to original question when rewrite is empty", async () => {
    const client = {
      chat: vi.fn().mockResolvedValue(""),
    } as unknown as OpenAICompatibleClient;
    const rewriter = new QueryRewriter(client);

    const history = [{ role: "user" as const, content: "hello" }];
    const result = await rewriter.rewrite("test", history, config);

    expect(result).toBe("test");
  });

  it("only includes last 4 messages from history", async () => {
    const chatMock = vi.fn().mockResolvedValue("rewritten query");
    const client = { chat: chatMock } as unknown as OpenAICompatibleClient;
    const rewriter = new QueryRewriter(client);

    const history = [
      { role: "user" as const, content: "msg1" },
      { role: "assistant" as const, content: "msg2" },
      { role: "user" as const, content: "msg3" },
      { role: "assistant" as const, content: "msg4" },
      { role: "user" as const, content: "msg5" },
      { role: "assistant" as const, content: "msg6" },
    ];

    await rewriter.rewrite("question", history, config);

    const call = chatMock.mock.calls[0]![0];
    const userContent = call.messages[1]!.content;
    // Should contain msg3-6 but not msg1-2
    expect(userContent).toContain("msg3");
    expect(userContent).toContain("msg6");
    expect(userContent).not.toContain("msg1");
  });
});
