import type { ChatMessage } from "./openai-client";
import type { RagAnswer, SearchResult } from "../shared/types";

import { resolveCitations } from "./citations";
import { buildRagContext } from "./context";
import { getPrompts } from "./ai-prompts";
import type { OpenAICompatibleClient } from "./openai-client";

export interface RagConfiguration {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class RagService {
  constructor(private readonly client: OpenAICompatibleClient) {}

  async answer(
    question: string,
    results: SearchResult[],
    configuration: RagConfiguration | undefined,
    online: boolean,
    history: ChatMessage[] = [],
    offlineText?: string,
    locale?: string,
  ): Promise<RagAnswer> {
    const prompts = getPrompts(locale);
    const context = buildRagContext(results);
    if (!online || !configuration) {
      const prefix = offlineText ?? prompts.offlinePrefix;
      return {
        text:
          prefix + "\n\n" +
          results
            .slice(0, 5)
            .map((result, index) => `[${index + 1}] ${result.snippet}`)
            .join("\n\n"),
        sources: context.sources,
        offline: true,
        missingApiKey: !configuration,
      };
    }

    const userContent = prompts.ragUser
      .replace("{context}", context.text)
      .replace("{question}", question);
    const messages: ChatMessage[] = [
      { role: "system", content: prompts.ragSystem },
      ...history,
      { role: "user", content: userContent },
    ];

    const text = await this.client.chat({
      baseUrl: configuration.baseUrl,
      apiKey: configuration.apiKey,
      model: configuration.model,
      messages,
    });
    return {
      text,
      sources: resolveCitations(text, context.sources),
      offline: false,
    };
  }
}
