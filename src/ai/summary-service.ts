import type { OpenAICompatibleClient } from "./openai-client";
import type { RagConfiguration } from "./rag-service";
import { getPrompts } from "./ai-prompts";

const MAX_CONTENT_CHARS = 2000;

export class SummaryService {
  constructor(private readonly client: OpenAICompatibleClient) {}

  async summarize(
    title: string,
    content: string,
    config: RagConfiguration,
    locale?: string,
  ): Promise<string> {
    const prompts = getPrompts(locale);
    const truncated = content.slice(0, MAX_CONTENT_CHARS);
    const userInput = prompts.summaryUser
      .replace("{title}", title)
      .replace("{content}", truncated);

    const text = await this.client.chat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        { role: "system", content: prompts.summarySystem },
        { role: "user", content: userInput },
      ],
    });

    return text.trim().slice(0, 300);
  }
}
