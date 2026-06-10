import type { ChatMessage } from "./openai-client";
import type { RagAnswer, SearchResult } from "../shared/types";

import { resolveCitations } from "./citations";
import { buildRagContext } from "./context";
import type { OpenAICompatibleClient } from "./openai-client";

const SYSTEM_PROMPT =
  "你是 BrowseMemory 助手。只能根据提供的浏览记录回答。使用 [1]、[2] 格式标注来源；没有依据时明确说明。";

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
  ): Promise<RagAnswer> {
    const context = buildRagContext(results);
    if (!online || !configuration) {
      const prefix = offlineText ?? "当前为离线模式。以下是本地检索到的相关记录：";
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

    const userContent = `浏览记录：\n${context.text}\n\n问题：${question}`;
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
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
