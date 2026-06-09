export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}

export type OpenAIErrorCode =
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "network"
  | "provider";

export class OpenAIRequestError extends Error {
  constructor(
    public readonly code: OpenAIErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OpenAIRequestError";
  }
}

type Fetcher = typeof fetch;

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
}

function parseSse(body: string): string {
  let answer = "";
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") {
      continue;
    }
    const event = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    answer += event.choices?.[0]?.delta?.content ?? "";
  }
  return answer;
}

export class OpenAICompatibleClient {
  private readonly fetcher: Fetcher;

  constructor(fetcher?: Fetcher) {
    // 使用箭头函数保持 globalThis 绑定，避免 Service Worker "Illegal invocation"
    this.fetcher = fetcher ?? ((url, init) => self.fetch(url, init));
  }

  async chat(request: ChatRequest): Promise<string> {
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
          messages: request.messages,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new OpenAIRequestError(
            "authentication",
            "API Key 无效或没有访问权限。",
          );
        }
        if (response.status === 429) {
          throw new OpenAIRequestError(
            "rate_limit",
            "请求过于频繁，请稍后再试。",
          );
        }
        throw new OpenAIRequestError(
          "provider",
          `AI 服务返回错误 (${response.status})。`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        return parseSse(await response.text());
      }
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return body.choices?.[0]?.message?.content ?? "";
    } catch (error) {
      if (error instanceof OpenAIRequestError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new OpenAIRequestError("timeout", "AI 服务响应超时。");
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new OpenAIRequestError(
        "network",
        `无法连接 AI 服务: ${detail}`,
      );
    } finally {
      self.clearTimeout(timeout);
    }
  }
}
