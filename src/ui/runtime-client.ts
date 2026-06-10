import type { RuntimeResponse } from "../shared/messages";
import type {
  ChatMessageRecord,
  ChatSessionRecord,
  RagAnswer,
  SearchResult,
  TodaySnapshot,
} from "../shared/types";

async function send(message: unknown): Promise<RuntimeResponse> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse;
  if (!response.ok) {
    throw new Error(response.message);
  }
  return response;
}

export interface SidePanelClient {
  getSnapshot(): Promise<TodaySnapshot>;
  getSettings(): Promise<{ hasApiKey: boolean }>;
  getRecent(): Promise<SearchResult[]>;
  getDistinctDates(): Promise<string[]>;
  getRecordsByDate(date: string): Promise<SearchResult[]>;
  search(query: string): Promise<SearchResult[]>;
  ask(question: string, sessionId?: string): Promise<RagAnswer>;
  listChatSessions(): Promise<ChatSessionRecord[]>;
  getChatSession(id: string): Promise<{ session: ChatSessionRecord; messages: ChatMessageRecord[] }>;
  createChatSession(title: string): Promise<ChatSessionRecord>;
  addChatMessage(sessionId: string, message: Omit<ChatMessageRecord, "id" | "sessionId" | "createdAt">): Promise<ChatMessageRecord>;
  deleteChatSession(sessionId: string): Promise<void>;
  openUrl(url: string): void;
  openOptions(): void;
}

export const runtimeClient: SidePanelClient = {
  async getSnapshot() {
    const response = await send({ type: "GET_TODAY_SNAPSHOT" });
    if ("snapshot" in response) {
      return response.snapshot;
    }
    throw new Error("无法读取今日数据。");
  },
  async getSettings() {
    const response = await send({ type: "GET_SETTINGS" });
    if ("hasApiKey" in response) {
      return { hasApiKey: response.hasApiKey };
    }
    throw new Error("无法读取设置。");
  },
  async getRecent() {
    const response = await send({ type: "GET_RECENT" });
    if ("results" in response) {
      return response.results;
    }
    throw new Error("无法读取最近记录。");
  },
  async getDistinctDates() {
    const response = await send({ type: "GET_DISTINCT_DATES" });
    if ("dates" in response) {
      return response.dates;
    }
    throw new Error("无法读取日期列表。");
  },
  async getRecordsByDate(date) {
    const response = await send({ type: "GET_RECORDS_BY_DATE", date });
    if ("results" in response) {
      return response.results;
    }
    throw new Error("无法读取该日期记录。");
  },
  async search(query) {
    const response = await send({ type: "SEARCH", query });
    if ("results" in response) {
      return response.results;
    }
    throw new Error("搜索失败。");
  },
  async ask(question, sessionId) {
    const response = await send({
      type: "ASK",
      question,
      online: navigator.onLine,
      sessionId,
    });
    if ("answer" in response) {
      return response.answer;
    }
    throw new Error("问答失败。");
  },
  async listChatSessions() {
    const response = await send({ type: "LIST_CHAT_SESSIONS" });
    if ("sessions" in response) {
      return response.sessions;
    }
    throw new Error("无法读取会话列表。");
  },
  async getChatSession(id) {
    const response = await send({ type: "GET_CHAT_SESSION", sessionId: id });
    if ("session" in response && "messages" in response) {
      return { session: response.session, messages: response.messages };
    }
    throw new Error("无法读取会话详情。");
  },
  async createChatSession(title) {
    const response = await send({ type: "CREATE_CHAT_SESSION", title });
    if ("session" in response) {
      return response.session;
    }
    throw new Error("无法创建会话。");
  },
  async addChatMessage(sessionId, message) {
    const response = await send({ type: "ADD_CHAT_MESSAGE", sessionId, message });
    if ("message" in response && typeof response.message !== "string") {
      return response.message;
    }
    throw new Error("无法保存消息。");
  },
  async deleteChatSession(sessionId) {
    await send({ type: "DELETE_CHAT_SESSION", sessionId });
  },
  openUrl(url) {
    void chrome.tabs.create({ url });
  },
  openOptions() {
    void chrome.runtime.openOptionsPage();
  },
};
