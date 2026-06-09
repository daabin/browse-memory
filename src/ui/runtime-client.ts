import type { RuntimeResponse } from "../shared/messages";
import type {
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
  search(query: string): Promise<SearchResult[]>;
  ask(question: string): Promise<RagAnswer>;
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
    throw new Error("无法读取最近记忆。");
  },
  async search(query) {
    const response = await send({ type: "SEARCH", query });
    if ("results" in response) {
      return response.results;
    }
    throw new Error("搜索失败。");
  },
  async ask(question) {
    const response = await send({
      type: "ASK",
      question,
      online: navigator.onLine,
    });
    if ("answer" in response) {
      return response.answer;
    }
    throw new Error("问答失败。");
  },
  openUrl(url) {
    void chrome.tabs.create({ url });
  },
  openOptions() {
    void chrome.runtime.openOptionsPage();
  },
};
