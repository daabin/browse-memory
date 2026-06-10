import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../entrypoints/options/App";
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
      },
      hasApiKey: true,
    }),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue(undefined),
    getStorageUsage: vi.fn().mockResolvedValue(1_048_576),
    clearAllData: vi.fn().mockResolvedValue(undefined),
  };
}

describe("options App", () => {
  it("loads configured values and masks the existing key", async () => {
    render(<App client={createClient()} />);

    expect(await screen.findByDisplayValue("deepseek-v4-flash")).toBeInTheDocument();
    expect(screen.getByText("API Key 已安全保存")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
  });

  it("validates the base URL before saving", async () => {
    const client = createClient();
    render(<App client={client} />);
    const input = await screen.findByLabelText("API 地址");
    fireEvent.change(input, { target: { value: "not-a-url" } });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    expect(await screen.findByText("请输入有效的 HTTPS API 地址。")).toBeInTheDocument();
    expect(client.saveSettings).not.toHaveBeenCalled();
  });

  it("requires explicit confirmation before clearing data", async () => {
    const client = createClient();
    render(<App client={client} />);
    fireEvent.click(await screen.findByRole("button", { name: "清除所有数据" }));
    expect(client.clearAllData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认清除" }));
    await waitFor(() => expect(client.clearAllData).toHaveBeenCalled());
  });
});
