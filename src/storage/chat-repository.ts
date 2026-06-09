import type {
  ChatMessageRecord,
  ChatSessionRecord,
} from "../shared/types";

import type { BrowseMemoryDatabase } from "./database";

export class ChatRepository {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async createSession(title: string): Promise<ChatSessionRecord> {
    const now = Date.now();
    const session: ChatSessionRecord = {
      id: crypto.randomUUID(),
      title: title.slice(0, 30),
      createdAt: now,
      updatedAt: now,
    };
    await this.database.chatSessions.add(session);
    return session;
  }

  async addMessage(
    sessionId: string,
    message: Omit<ChatMessageRecord, "id" | "sessionId" | "createdAt">,
  ): Promise<ChatMessageRecord> {
    const now = Date.now();
    const record: ChatMessageRecord = {
      ...message,
      id: crypto.randomUUID(),
      sessionId,
      createdAt: now,
    };
    await this.database.chatMessages.add(record);
    await this.database.chatSessions.update(sessionId, { updatedAt: now });
    return record;
  }

  async listSessions(): Promise<ChatSessionRecord[]> {
    return this.database.chatSessions
      .orderBy("updatedAt")
      .reverse()
      .toArray();
  }

  async getSession(sessionId: string): Promise<{
    session: ChatSessionRecord;
    messages: ChatMessageRecord[];
  }> {
    const session = await this.database.chatSessions.get(sessionId);
    if (!session) {
      throw new Error("会话不存在。");
    }
    const messages = await this.database.chatMessages
      .where("sessionId")
      .equals(sessionId)
      .sortBy("createdAt");
    return { session, messages };
  }
}
