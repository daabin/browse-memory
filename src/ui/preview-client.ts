import type { SidePanelClient } from "./runtime-client";

const now = Date.now();

const previewReport = {
  id: "r1",
  type: "daily" as const,
  date: "2026-06-09",
  title: "2026-06-09 日报",
  content: "## 今日研究\n重点研究了 RAG 架构。\n## 技术探索\nMV3 实践。",
  topics: ["RAG", "Chrome 扩展"],
  pageCount: 18,
  createdAt: now,
};

export const previewClient: SidePanelClient = {
  async getSnapshot() {
    return {
      pageCount: 18,
      readingMinutes: 62,
      deepReadCount: 6,
      topDomain: "developer.chrome.com",
    };
  },
  async getSettings() {
    return { hasApiKey: true };
  },
  async getRecent() {
    return [
      {
        score: 3.4,
        snippet:
          "RAG 通过检索增强生成，核心在于检索质量、上下文构建和来源引用。",
        highlights: [],
        page: {
          id: "preview-1",
          url: "https://example.com/rag",
          normalizedUrl: "https://example.com/rag",
          title: "构建生产级 RAG：从原理到实践",
          domain: "example.com",
          content: "RAG 通过检索增强生成。",
          contentHash: "preview",
          durationSeconds: 720,
          visitDate: "2026-06-09",
          capturedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        score: 2.8,
        snippet:
          "Manifest V3 的 Service Worker、Side Panel API 与本地存储实践。",
        highlights: [],
        page: {
          id: "preview-2",
          url: "https://developer.chrome.com/docs/extensions",
          normalizedUrl: "https://developer.chrome.com/docs/extensions",
          title: "Chrome 扩展开发最新 API",
          domain: "developer.chrome.com",
          content: "Manifest V3 Service Worker.",
          contentHash: "preview",
          durationSeconds: 360,
          visitDate: "2026-06-09",
          capturedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      },
    ];
  },
  async search() {
    return this.getRecent();
  },
  async getDistinctDates() {
    return ["2026-06-09"];
  },
  async getRecordsByDate() {
    return this.getRecent();
  },
  async ask() {
    return {
      text: "你今天重点研究了浏览器端 RAG 的检索架构，以及 Manifest V3 下的采集与持久化方案。[1] [2]",
      sources: [
        { index: 1, title: "构建生产级 RAG", url: "https://example.com/rag" },
        {
          index: 2,
          title: "Chrome 扩展开发最新 API",
          url: "https://developer.chrome.com/docs/extensions",
        },
      ],
      offline: false,
    };
  },
  async listChatSessions() {
    return [];
  },
  async getChatSession() {
    return { session: { id: "s1", title: "test", createdAt: now, updatedAt: now }, messages: [] };
  },
  async createChatSession() {
    return { id: "s1", title: "test", createdAt: now, updatedAt: now };
  },
  async addChatMessage() {
    return { id: "m1", sessionId: "s1", role: "user" as const, content: "hi", createdAt: now };
  },
  async deleteChatSession() {},
  // Phase 2 stubs
  async getReports() {
    return [previewReport];
  },
  async getReport() {
    return previewReport;
  },
  async generateReport() {
    return previewReport;
  },
  async getEmbeddingStatus() {
    return { enabled: false, indexedCount: 0, totalCount: 18 };
  },
  async getQueueStatus() {
    return { pending: 0, processing: 0, failed: 0 };
  },
  async triggerEmbeddingBackfill() {},
  openUrl() {},
  openOptions() {},
};
