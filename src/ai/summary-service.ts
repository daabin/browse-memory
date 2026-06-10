import type { OpenAICompatibleClient } from "./openai-client";
import type { RagConfiguration } from "./rag-service";

const SUMMARY_PROMPT =
  "请用不超过 100 个字概括以下网页的核心内容。只输出摘要文本，不要添加前缀或解释。";

const MAX_CONTENT_CHARS = 2000;

export class SummaryService {
  constructor(private readonly client: OpenAICompatibleClient) {}

  async summarize(
    title: string,
    content: string,
    config: RagConfiguration,
  ): Promise<string> {
    const truncated = content.slice(0, MAX_CONTENT_CHARS);
    const userInput = `标题：${title}\n\n内容：${truncated}`;

    const text = await this.client.chat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        { role: "system", content: SUMMARY_PROMPT },
        { role: "user", content: userInput },
      ],
    });

    return text.trim().slice(0, 300);
  }
}
