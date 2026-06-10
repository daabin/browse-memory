import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpenAICompatibleClient } from "@/ai/openai-client";
import type { RagConfiguration } from "@/ai/rag-service";
import { ReportService } from "@/reports/report-service";
import { BrowseMemoryDatabase } from "@/storage/database";
import { PageRepository } from "@/storage/page-repository";
import { ReportRepository } from "@/storage/report-repository";

const chatMock = vi.fn();
const mockClient = { chat: chatMock } as unknown as OpenAICompatibleClient;

const config: RagConfiguration = {
  baseUrl: "https://api.test.com",
  apiKey: "sk-test",
  model: "test-model",
};

function todayDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function todayWeekId(): string {
  const today = new Date();
  const year = today.getFullYear();
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function todayMonthId(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

describe("ReportService", () => {
  let database: BrowseMemoryDatabase;
  let pages: PageRepository;
  let reports: ReportRepository;
  let service: ReportService;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`rpt-svc-${crypto.randomUUID()}`);
    pages = new PageRepository(database);
    reports = new ReportRepository(database);
    service = new ReportService(pages, reports, mockClient);
    chatMock.mockReset();
  });

  afterEach(async () => {
    await database.delete();
  });

  it("generates a daily report with pages", async () => {
    const now = Date.now();
    await pages.upsertCapture(
      { url: "https://a.com", title: "Page A", content: "Content A", durationSeconds: 300, capturedAt: now - 1000 },
      now,
    );
    await pages.upsertCapture(
      { url: "https://b.com", title: "Page B", content: "Content B", durationSeconds: 600, capturedAt: now },
      now,
    );

    chatMock.mockResolvedValue("## 主题一\n内容\n## 主题二\n更多内容");

    const report = await service.generateDaily(todayDate(), config);

    expect(report.type).toBe("daily");
    expect(report.pageCount).toBe(2);
    expect(report.topics).toContain("主题一");
    expect(report.topics).toContain("主题二");
    expect(chatMock).toHaveBeenCalledOnce();
  });

  it("returns existing report without regenerating", async () => {
    const now = Date.now();
    await pages.upsertCapture(
      { url: "https://a.com", title: "Page A", content: "Content A", durationSeconds: 300, capturedAt: now },
      now,
    );

    chatMock.mockResolvedValue("## Existing\nContent");

    const date = todayDate();
    await service.generateDaily(date, config);
    const report2 = await service.generateDaily(date, config);

    expect(chatMock).toHaveBeenCalledOnce();
    expect(report2.content).toBe("## Existing\nContent");
  });

  it("generates empty daily report when no pages", async () => {
    const report = await service.generateDaily("2026-01-01", config);

    expect(report.pageCount).toBe(0);
    expect(report.content).toBe("当天没有浏览记录。");
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("generates weekly report", async () => {
    const now = Date.now();
    await pages.upsertCapture(
      { url: "https://a.com", title: "Page A", content: "Content A", durationSeconds: 300, capturedAt: now },
      now,
    );

    chatMock.mockResolvedValue("## 周主题\n本周研究内容");

    const report = await service.generateWeekly(todayWeekId(), config);
    expect(report.type).toBe("weekly");
    expect(chatMock).toHaveBeenCalledOnce();
  });

  it("generates monthly report", async () => {
    const now = Date.now();
    await pages.upsertCapture(
      { url: "https://a.com", title: "Page A", content: "Content A", durationSeconds: 300, capturedAt: now },
      now,
    );

    chatMock.mockResolvedValue("## 月报主题\n本月研究趋势");

    const report = await service.generateMonthly(todayMonthId(), config);
    expect(report.type).toBe("monthly");
    expect(chatMock).toHaveBeenCalledOnce();
  });
});
