import { describe, expect, it, vi } from "vitest";

import { EmbeddingClient } from "@/ai/embedding-client";
import { OpenAIRequestError } from "@/ai/openai-client";

describe("EmbeddingClient", () => {
  const mockRequest = {
    baseUrl: "https://api.example.com",
    apiKey: "test-key",
    model: "bge-m3",
    input: "hello world",
  };

  it("returns a vector on success", async () => {
    const vector = [0.1, 0.2, 0.3];
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: vector }] }),
      headers: new Headers({ "content-type": "application/json" }),
    });

    const client = new EmbeddingClient(fetcher);
    const result = await client.createEmbedding(mockRequest);

    expect(result).toEqual(vector);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.com/v1/embeddings",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws authentication error on 401", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const client = new EmbeddingClient(fetcher);
    await expect(client.createEmbedding(mockRequest)).rejects.toThrow(
      OpenAIRequestError,
    );
  });

  it("throws rate_limit error on 429", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const client = new EmbeddingClient(fetcher);
    await expect(client.createEmbedding(mockRequest)).rejects.toMatchObject({
      code: "rate_limit",
    });
  });

  it("throws provider error when no vector in response", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
      headers: new Headers({ "content-type": "application/json" }),
    });

    const client = new EmbeddingClient(fetcher);
    await expect(client.createEmbedding(mockRequest)).rejects.toMatchObject({
      code: "provider",
    });
  });

  it("throws network error on fetch failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const client = new EmbeddingClient(fetcher);
    await expect(client.createEmbedding(mockRequest)).rejects.toMatchObject({
      code: "network",
    });
  });

  it("strips trailing slashes from baseUrl", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [1] }] }),
      headers: new Headers({ "content-type": "application/json" }),
    });

    const client = new EmbeddingClient(fetcher);
    await client.createEmbedding({
      ...mockRequest,
      baseUrl: "https://api.example.com///",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.com/v1/embeddings",
      expect.anything(),
    );
  });
});
