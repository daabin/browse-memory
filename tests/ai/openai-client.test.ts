import { describe, expect, it, vi } from "vitest";

import {
  OpenAICompatibleClient,
} from "@/ai/openai-client";

describe("OpenAICompatibleClient", () => {
  it("parses a regular JSON response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Answer [1]" } }],
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );
    const client = new OpenAICompatibleClient(fetcher);

    expect(
      await client.chat({
        baseUrl: "https://api.example.com",
        apiKey: "key",
        model: "model",
        messages: [{ role: "user", content: "Question" }],
      }),
    ).toBe("Answer [1]");
  });

  it("parses an SSE response", async () => {
    const body =
      'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"world"}}]}\n\n' +
      "data: [DONE]\n\n";
    const client = new OpenAICompatibleClient(
      vi.fn().mockResolvedValue(
        new Response(body, { headers: { "content-type": "text/event-stream" } }),
      ),
    );

    expect(
      await client.chat({
        baseUrl: "https://api.example.com",
        apiKey: "key",
        model: "model",
        messages: [{ role: "user", content: "Question" }],
      }),
    ).toBe("Hello world");
  });

  it.each([
    [401, "authentication"],
    [403, "authentication"],
    [429, "rate_limit"],
  ])("normalizes HTTP %s", async (status, code) => {
    const client = new OpenAICompatibleClient(
      vi.fn().mockResolvedValue(new Response("error", { status })),
    );

    await expect(
      client.chat({
        baseUrl: "https://api.example.com",
        apiKey: "key",
        model: "model",
        messages: [{ role: "user", content: "Question" }],
      }),
    ).rejects.toMatchObject({ code });
  });

  it("normalizes a timeout abort to a timeout error", async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      const error = new DOMException("The operation was aborted", "AbortError");
      return Promise.reject(error);
    });
    const client = new OpenAICompatibleClient(fetcher);

    await expect(
      client.chat({
        baseUrl: "https://api.example.com",
        apiKey: "key",
        model: "model",
        messages: [{ role: "user", content: "Question" }],
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("normalizes a network failure to a network error", async () => {
    const client = new OpenAICompatibleClient(
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(
      client.chat({
        baseUrl: "https://api.example.com",
        apiKey: "key",
        model: "model",
        messages: [{ role: "user", content: "Question" }],
      }),
    ).rejects.toMatchObject({ code: "network" });
  });

  it("normalizes a 500 response to a provider error", async () => {
    const client = new OpenAICompatibleClient(
      vi.fn().mockResolvedValue(new Response("error", { status: 500 })),
    );

    await expect(
      client.chat({
        baseUrl: "https://api.example.com",
        apiKey: "key",
        model: "model",
        messages: [{ role: "user", content: "Question" }],
      }),
    ).rejects.toMatchObject({ code: "provider" });
  });
});
