import { OpenAIRequestError } from "./openai-client";

export interface EmbeddingRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  input: string;
}

type Fetcher = typeof fetch;

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/v1/embeddings`;
}

export class EmbeddingClient {
  private readonly fetcher: Fetcher;

  constructor(fetcher?: Fetcher) {
    this.fetcher = fetcher ?? ((url, init) => self.fetch(url, init));
  }

  async createEmbedding(request: EmbeddingRequest): Promise<number[]> {
    const controller = new AbortController();
    const timeout = self.setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await this.fetcher(endpoint(request.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${request.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          input: request.input,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new OpenAIRequestError(
            "authentication",
            "Embedding API Key 无效或没有访问权限。",
          );
        }
        if (response.status === 429) {
          throw new OpenAIRequestError(
            "rate_limit",
            "Embedding 请求过于频繁，请稍后再试。",
          );
        }
        throw new OpenAIRequestError(
          "provider",
          `Embedding 服务返回错误 (${response.status})。`,
        );
      }

      const body = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
      };
      const vector = body.data?.[0]?.embedding;
      if (!vector) {
        throw new OpenAIRequestError(
          "provider",
          "Embedding 服务未返回向量。",
        );
      }
      return vector;
    } catch (error) {
      if (error instanceof OpenAIRequestError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new OpenAIRequestError("timeout", "Embedding 服务响应超时。");
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new OpenAIRequestError(
        "network",
        `无法连接 Embedding 服务: ${detail}`,
      );
    } finally {
      self.clearTimeout(timeout);
    }
  }
}
