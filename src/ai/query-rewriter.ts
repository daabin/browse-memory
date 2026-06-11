import type { ChatMessage, OpenAICompatibleClient } from "./openai-client";
import type { RagConfiguration } from "./rag-service";
import { getPrompts } from "./ai-prompts";

export class QueryRewriter {
  constructor(private readonly client: OpenAICompatibleClient) {}

  async rewrite(
    question: string,
    history: ChatMessage[],
    config: RagConfiguration,
    locale?: string,
  ): Promise<string> {
    // No history means no pronouns to resolve
    if (history.length === 0) {
      return question;
    }

    const prompts = getPrompts(locale);

    // Only include the last 4 messages for context (2 turns)
    const recentHistory = history.slice(-4);
    const historyText = recentHistory
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 200)}`,
      )
      .join("\n");

    const userInput = prompts.rewriteUser
      .replace("{history}", historyText)
      .replace("{question}", question);

    const rewritten = await this.client.chat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        {
          role: "system",
          content: `${prompts.rewriteSystem}\n${prompts.rewriteExample}`,
        },
        { role: "user", content: userInput },
      ],
    });

    const result = rewritten.trim();
    // Safety: if the rewrite is empty or too short, fall back to original
    return result.length > 2 ? result : question;
  }
}
