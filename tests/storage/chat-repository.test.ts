import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChatRepository } from "@/storage/chat-repository";
import { BrowseMemoryDatabase } from "@/storage/database";

describe("ChatRepository", () => {
  let database: BrowseMemoryDatabase;
  let repo: ChatRepository;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`chat-${crypto.randomUUID()}`);
    repo = new ChatRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("creates a session with truncated title", async () => {
    const session = await repo.createSession("A very long question that should be truncated at thirty chars");
    expect(session.title).toBe("A very long question that shou");
    expect(session.id).toBeTruthy();
    expect(session.createdAt).toBeGreaterThan(0);
  });

  it("lists sessions ordered by updatedAt descending", async () => {
    await repo.createSession("First");
    await repo.createSession("Second");

    const sessions = await repo.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].title).toBe("Second");
    expect(sessions[1].title).toBe("First");
  });

  it("adds messages to a session and retrieves them", async () => {
    const session = await repo.createSession("Test");

    await repo.addMessage(session.id, { role: "user", content: "Hello?" });
    await repo.addMessage(session.id, {
      role: "assistant",
      content: "Hi there!",
      sources: [{ index: 1, title: "Source", url: "https://example.com" }],
      offline: false,
    });

    const { session: s, messages } = await repo.getSession(session.id);
    expect(s.id).toBe(session.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].sources).toHaveLength(1);
  });

  it("throws when getting a non-existent session", async () => {
    await expect(repo.getSession("nonexistent")).rejects.toThrow("会话不存在");
  });

  describe("purgeExpired", () => {
    const DAY = 86_400_000;
    const NOW = 1_700_000_000_000;

    it("deletes sessions and messages older than retentionDays", async () => {
      // Create a session manually with a past timestamp
      const oldSession = {
        id: crypto.randomUUID(),
        title: "Old chat",
        createdAt: NOW - 10 * DAY,
        updatedAt: NOW - 10 * DAY,
      };
      await database.chatSessions.add(oldSession);
      await database.chatMessages.add({
        id: crypto.randomUUID(),
        sessionId: oldSession.id,
        role: "user" as const,
        content: "Old message",
        createdAt: NOW - 10 * DAY,
      });

      // Create a fresh session
      const freshSession = await repo.createSession("Fresh chat");
      await repo.addMessage(freshSession.id, { role: "user", content: "New message" });

      expect(await database.chatSessions.count()).toBe(2);
      expect(await database.chatMessages.count()).toBe(2);

      const purged = await repo.purgeExpired(7, NOW);
      expect(purged).toBe(1);
      expect(await database.chatSessions.count()).toBe(1);
      expect(await database.chatMessages.count()).toBe(1);
    });

    it("returns 0 when no sessions are expired", async () => {
      await repo.createSession("Recent");
      const purged = await repo.purgeExpired(7, NOW);
      expect(purged).toBe(0);
    });
  });
});
