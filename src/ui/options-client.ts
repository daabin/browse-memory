import type { RuntimeResponse } from "@/shared/messages";
import type { AppSettings } from "@/shared/types";

type PublicSettings = Omit<AppSettings, "encryptedApiKey">;

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
  }>;
  saveSettings(settings: Partial<PublicSettings>, apiKey?: string): Promise<void>;
  testConnection(
    settings: Partial<PublicSettings>,
    apiKey?: string,
  ): Promise<void>;
  getStorageUsage(): Promise<number>;
  clearAllData(): Promise<void>;
}

export const optionsClient: OptionsClient = {
  async getSettings() {
    const response = await send({ type: "GET_SETTINGS" });
    if ("settings" in response) {
      const { encryptedApiKey: _encryptedApiKey, ...settings } =
        response.settings;
      return { settings, hasApiKey: response.hasApiKey };
    }
    throw new Error("无法读取设置。");
  },
  async saveSettings(settings, apiKey) {
    await send({ type: "SAVE_SETTINGS", settings, apiKey });
  },
  async testConnection(settings, apiKey) {
    await send({ type: "TEST_CONNECTION", settings, apiKey });
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
