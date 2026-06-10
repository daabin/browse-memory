import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../entrypoints/dashboard/App";
import { I18nProvider } from "@/i18n";
import type { DashboardClient } from "@/ui/dashboard-client";
import type { ReportRecord } from "@/shared/types";

const sampleReports: ReportRecord[] = [
  {
    id: "r1",
    type: "daily",
    date: "2026-06-09",
    title: "2026-06-09 日报",
    content: "## 今日发现\n\n阅读了 5 篇文章。",
    topics: ["AI", "浏览器"],
    pageCount: 5,
    createdAt: 1000,
  },
  {
    id: "r2",
    type: "daily",
    date: "2026-06-08",
    title: "2026-06-08 日报",
    content: "## 今日发现\n\n阅读了 3 篇文章。",
    topics: ["前端"],
    pageCount: 3,
    createdAt: 500,
  },
];

function createClient(overrides?: Partial<DashboardClient>): DashboardClient {
  return {
    getReports: vi.fn().mockResolvedValue(sampleReports),
    getReport: vi.fn().mockResolvedValue(sampleReports[0]),
    generateReport: vi.fn().mockResolvedValue(sampleReports[0]),
    openUrl: vi.fn(),
    ...overrides,
  };
}

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider locale="zh_CN">{ui}</I18nProvider>);
}

describe("dashboard App", () => {
  it("loads and displays report list on mount", async () => {
    const client = createClient();
    renderWithI18n(<App client={client} />);

    expect(client.getReports).toHaveBeenCalledWith("daily");
    const items = await screen.findAllByText("2026-06-09 日报");
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2026-06-08 日报")).toBeInTheDocument();
  });

  it("auto-selects the first report and renders its content", async () => {
    renderWithI18n(<App client={createClient()} />);

    await screen.findAllByText("2026-06-09 日报");
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("浏览器")).toBeInTheDocument();
    expect(screen.getByText("阅读了 5 篇文章。")).toBeInTheDocument();
  });

  it("switches tabs and reloads reports", async () => {
    const client = createClient({
      getReports: vi.fn()
        .mockResolvedValueOnce(sampleReports)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    });
    renderWithI18n(<App client={client} />);

    await screen.findAllByText("2026-06-09 日报");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "周报" }));
    });

    expect(client.getReports).toHaveBeenCalledWith("weekly");
    const emptyMessages = await screen.findAllByText("暂无报告，点击生成按钮创建。");
    expect(emptyMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("calls generateReport when generate button is clicked", async () => {
    const client = createClient();
    renderWithI18n(<App client={client} />);

    await screen.findAllByText("2026-06-09 日报");
    fireEvent.click(screen.getByRole("button", { name: "立即生成" }));

    await waitFor(() => expect(client.generateReport).toHaveBeenCalledWith("daily"));
  });

  it("displays error message on load failure", async () => {
    const client = createClient({
      getReports: vi.fn().mockRejectedValue(new Error("Network error")),
    });
    renderWithI18n(<App client={client} />);

    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });

  it("selects a different report when clicking a sidebar item", async () => {
    renderWithI18n(<App client={createClient()} />);

    await screen.findAllByText("2026-06-09 日报");
    fireEvent.click(screen.getByRole("button", { name: /2026-06-08 日报/ }));

    expect(await screen.findByText("阅读了 3 篇文章。")).toBeInTheDocument();
    expect(screen.getByText("前端")).toBeInTheDocument();
  });
});
