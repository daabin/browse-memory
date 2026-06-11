import type { RuntimeResponse } from "../shared/messages";
import type { AppSettings } from "../shared/types";

type PublicSettings = Omit<AppSettings, "encryptedApiKey" | "encryptedEmbeddingApiKey">;

async function send(message: unknown): Promise<RuntimeResponse> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse;
  if (!response.ok) {
    throw new Error(response.message);
  }
  return response;
}

export interface OptionsClient {
  getSettings(): Promise<{
    settings: PublicSettings;
    hasApiKey: boolean;
    hasEmbeddingApiKey: boolean;
  }>;
  saveSettings(settings: Partial<PublicSettings>, apiKey?: string, embeddingApiKey?: string): Promise<void>;
  testConnection(
    settings: Partial<PublicSettings>,
    apiKey?: string,
  ): Promise<void>;
  testEmbeddingConnection(
    settings: Partial<PublicSettings>,
    embeddingApiKey?: string,
  ): Promise<void>;
  getEmbeddingStatus(): Promise<{ enabled: boolean; indexedCount: number; totalCount: number }>;
  triggerEmbeddingBackfill(): Promise<{ enqueued: number }>;
  getStorageUsage(): Promise<number>;
  clearAllData(): Promise<void>;
}

export const optionsClient: OptionsClient = {
  async getSettings() {
    const response = await send({ type: "GET_SETTINGS" });
    if ("settings" in response) {
      const settings: PublicSettings = {
        chatBaseUrl: response.settings.chatBaseUrl,
        chatModel: response.settings.chatModel,
        minimumReadSeconds: response.settings.minimumReadSeconds,
        blacklistPatterns: response.settings.blacklistPatterns,
        retentionDays: response.settings.retentionDays,
        embeddingEnabled: response.settings.embeddingEnabled,
        embeddingBaseUrl: response.settings.embeddingBaseUrl,
        embeddingModel: response.settings.embeddingModel,
        embeddingReuseChatKey: response.settings.embeddingReuseChatKey,
        reportDailyHour: response.settings.reportDailyHour,
      };
      return { settings, hasApiKey: response.hasApiKey, hasEmbeddingApiKey: response.hasEmbeddingApiKey };
    }
    throw new Error("无法读取设置。");
  },
  async saveSettings(settings, apiKey, embeddingApiKey) {
    await send({ type: "SAVE_SETTINGS", settings, apiKey, embeddingApiKey });
  },
  async testConnection(settings, apiKey) {
    await send({ type: "TEST_CONNECTION", settings, apiKey });
  },
  async testEmbeddingConnection(settings, embeddingApiKey) {
    await send({ type: "TEST_EMBEDDING_CONNECTION", settings, embeddingApiKey });
  },
  async getEmbeddingStatus() {
    const response = await send({ type: "GET_EMBEDDING_STATUS" });
    if ("embeddingStatus" in response) {
      return response.embeddingStatus;
    }
    return { enabled: false, indexedCount: 0, totalCount: 0 };
  },
  async triggerEmbeddingBackfill() {
    const response = await send({ type: "TRIGGER_EMBEDDING_BACKFILL" });
    return { enqueued: ("enqueued" in response ? response.enqueued : 0) as number };
  },
  async getStorageUsage() {
    const response = await send({ type: "GET_STORAGE_USAGE" });
    if ("bytes" in response) {
      return response.bytes;
    }
    return 0;
  },
  async clearAllData() {
    await send({ type: "CLEAR_ALL_DATA" });
  },
};
