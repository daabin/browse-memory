import type { ChatMessage, OpenAICompatibleClient } from "./openai-client";
import type { RagConfiguration } from "./rag-service";

const REWRITE_PROMPT =
  "你是一个查询改写助手。根据对话历史，将用户的最新问题改写为一个独立的、完整的查询，使其可以直接用于搜索。" +
  "如果问题已经足够明确，直接输出原始问题。只输出改写后的查询，不要添加任何解释。" +
  "例如：历史讨论了 RAG 架构，用户问「它的优点是什么？」→ 改写为「RAG 架构的优点是什么？」";

export class QueryRewriter {
  constructor(private readonly client: OpenAICompatibleClient) {}

  async rewrite(
    question: string,
    history: ChatMessage[],
    config: RagConfiguration,
  ): Promise<string> {
    // No history means no pronouns to resolve
    if (history.length === 0) {
      return question;
    }

    // Only include the last 4 messages for context (2 turns)
    const recentHistory = history.slice(-4);
    const historyText = recentHistory
      .map(
        (m) =>
          `${m.role === "user" ? "用户" : "助手"}：${m.content.slice(0, 200)}`,
      )
      .join("\n");

    const userInput = `对话历史：\n${historyText}\n\n用户最新问题：${question}\n\n改写后的独立查询：`;

    const rewritten = await this.client.chat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        { role: "system", content: REWRITE_PROMPT },
        { role: "user", content: userInput },
      ],
    });

    const result = rewritten.trim();
    // Safety: if the rewrite is empty or too short, fall back to original
    return result.length > 2 ? result : question;
  }
}
