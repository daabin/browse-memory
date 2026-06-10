import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../entrypoints/options/App";
import { I18nProvider } from "@/i18n";
import type { OptionsClient } from "@/ui/options-client";

function createClient(): OptionsClient {
  return {
    getSettings: vi.fn().mockResolvedValue({
      settings: {
        chatBaseUrl: "https://api.deepseek.com",
        chatModel: "deepseek-v4-flash",
        minimumReadSeconds: 5,
        blacklistPatterns: ["*.bank.com"],
        retentionDays: 90,
        embeddingEnabled: false,
        embeddingBaseUrl: "https://api.siliconflow.cn",
        embeddingModel: "BAAI/bge-m3",
        embeddingReuseChatKey: true,
        reportDailyHour: 3,
      },
      hasApiKey: true,
    }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue(undefined),
    testEmbeddingConnection: vi.fn().mockResolvedValue(undefined),
    getEmbeddingStatus: vi.fn().mockResolvedValue({ enabled: false, indexedCount: 0, totalCount: 0 }),
    triggerEmbeddingBackfill: vi.fn().mockResolvedValue(undefined),
    getStorageUsage: vi.fn().mockResolvedValue(1_048_576),
    clearAllData: vi.fn().mockResolvedValue(undefined),
  };
}

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider locale="zh_CN">{ui}</I18nProvider>);
}

describe("options App", () => {
  it("loads configured values and masks the existing key", async () => {
    renderWithI18n(<App client={createClient()} />);

    expect(await screen.findByDisplayValue("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByText("API Key 已安全保存")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
  });

  it("validates the base URL before saving", async () => {
    const client = createClient();
    renderWithI18n(<App client={client} />);
    const input = await screen.findByLabelText("API 地址");
    fireEvent.change(input, { target: { value: "not-a-url" } });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    expect(await screen.findByText("请输入有效的 HTTPS API 地址。")).toBeInTheDocument();
    expect(client.saveSettings).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before clearing data", async () => {
    const client = createClient();
    renderWithI18n(<App client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "清除所有数据" }));
    expect(client.clearAllData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认清除" }));
    await waitFor(() => expect(client.clearAllData).toHaveBeenCalled());
  });
});
