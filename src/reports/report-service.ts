import type { OpenAICompatibleClient } from "../ai/openai-client";
import type { RagConfiguration } from "../ai/rag-service";
import type { PageRecord, ReportRecord, ReportType } from "../shared/types";
import type { PageRepository } from "../storage/page-repository";
import type { ReportRepository } from "../storage/report-repository";

const MAX_INPUT_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 1024;

interface PageInfo {
  title: string;
  url: string;
  domain: string;
  durationMin: number;
  summary?: string;
}

function toPageInfo(page: PageRecord): PageInfo {
  return {
    title: page.title,
    url: page.url,
    domain: page.domain,
    durationMin: Math.round(page.durationSeconds / 60),
    summary: page.summary,
  };
}

function buildDailyPrompt(pages: PageInfo[], date: string): string {
  const sorted = pages.sort((a, b) => b.durationMin - a.durationMin);
  const lines = sorted.map(
    (p, i) =>
      `${i + 1}. "${p.title}" (${p.domain}, ${p.durationMin}min)${p.summary ? ` — ${p.summary}` : ""}`,
  );
  const input = lines.join("\n").slice(0, MAX_INPUT_CHARS);
  return `你是 BrowseMemory 报告助手。根据以下 ${date} 的浏览记录生成一份日报。

要求：
- 提取 3-5 个主题聚类
- 概述时间分布
- 用 50 字写一段"今日发现"
- 使用 Markdown 格式

浏览记录：
${input}`;
}

function buildWeeklyPrompt(
  pages: PageInfo[],
  weekId: string,
  dailyCount: number,
): string {
  const sorted = pages.sort((a, b) => b.durationMin - a.durationMin);
  const top10 = sorted.slice(0, 10);
  const lines = top10.map(
    (p, i) =>
      `${i + 1}. "${p.title}" (${p.domain}, ${p.durationMin}min)${p.summary ? ` — ${p.summary}` : ""}`,
  );
  const domains = [...new Set(pages.map((p) => p.domain))];
  const input = lines.join("\n").slice(0, MAX_INPUT_CHARS);
  return `你是 BrowseMemory 报告助手。根据第 ${weekId} 周的浏览记录生成周报。

统计：共 ${pages.length} 页，${dailyCount} 天活跃，涉及 ${domains.length} 个域名。
深度阅读 Top 10：
${input}

要求：
- 跨天主题连续性分析
- 深度阅读 Top 10 点评
- 新兴兴趣识别
- 使用 Markdown 格式`;
}

function buildMonthlyPrompt(
  pages: PageInfo[],
  monthId: string,
  dailyCount: number,
): string {
  const domains = [...new Set(pages.map((p) => p.domain))];
  const totalMin = pages.reduce((t, p) => t + p.durationMin, 0);
  const sorted = pages.sort((a, b) => b.durationMin - a.durationMin);
  const top10 = sorted.slice(0, 10);
  const lines = top10.map(
    (p, i) =>
      `${i + 1}. "${p.title}" (${p.domain}, ${p.durationMin}min)${p.summary ? ` — ${p.summary}` : ""}`,
  );
  const input = lines.join("\n").slice(0, MAX_INPUT_CHARS);
  return `你是 BrowseMemory 报告助手。根据 ${monthId} 的浏览记录生成月报。

统计：共 ${pages.length} 页，${dailyCount} 天活跃，${domains.length} 个域名，总阅读 ${totalMin} 分钟。
深度阅读 Top 10：
${input}

要求：
- 长期趋势分析
- 知识图谱概览（主要话题域）
- 月度阅读效率统计
- 使用 Markdown 格式`;
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(text)) !== null) {
    const topic = match[1].trim();
    if (topic && topics.length < 10) topics.push(topic);
  }
  return topics;
}

export class ReportService {
  constructor(
    private readonly pages: PageRepository,
    private readonly reports: ReportRepository,
    private readonly client: OpenAICompatibleClient,
  ) {}

  async generateDaily(
    date: string,
    config: RagConfiguration,
  ): Promise<ReportRecord> {
    // Check for existing report
    const existing = await this.reports.getByDate(date);
    if (existing) return existing;

    const pageRecords = await this.pages.getByDate(date);
    if (pageRecords.length === 0) {
      const report: ReportRecord = {
        id: crypto.randomUUID(),
        type: "daily",
        date,
        title: `${date} 日报`,
        content: "当天没有浏览记录。",
        topics: [],
        pageCount: 0,
        createdAt: Date.now(),
      };
      await this.reports.save(report);
      return report;
    }

    const pageInfo = pageRecords.map(toPageInfo);
    const prompt = buildDailyPrompt(pageInfo, date);
    const content = await this.client.chat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [{ role: "user", content: prompt }],
    });

    const report: ReportRecord = {
      id: crypto.randomUUID(),
      type: "daily",
      date,
      title: `${date} 日报`,
      content,
      topics: extractTopics(content),
      pageCount: pageRecords.length,
      createdAt: Date.now(),
    };
    await this.reports.save(report);
    return report;
  }

  async generateWeekly(
    weekId: string,
    config: RagConfiguration,
  ): Promise<ReportRecord> {
    const existing = await this.reports.getByDate(weekId);
    if (existing) return existing;

    // Collect pages for the week (parse weekId like "2026-W24")
    const pages = await this.collectWeekPages(weekId);
    if (pages.length === 0) {
      const report: ReportRecord = {
        id: crypto.randomUUID(),
        type: "weekly",
        date: weekId,
        title: `第 ${weekId} 周报`,
        content: "本周没有浏览记录。",
        topics: [],
        pageCount: 0,
        createdAt: Date.now(),
      };
      await this.reports.save(report);
      return report;
    }

    const dates = new Set(pages.map((p) => p.visitDate));
    const pageInfo = pages.map(toPageInfo);
    const prompt = buildWeeklyPrompt(pageInfo, weekId, dates.size);
    const content = await this.client.chat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [{ role: "user", content: prompt }],
    });

    const report: ReportRecord = {
      id: crypto.randomUUID(),
      type: "weekly",
      date: weekId,
      title: `第 ${weekId} 周报`,
      content,
      topics: extractTopics(content),
      pageCount: pages.length,
      createdAt: Date.now(),
    };
    await this.reports.save(report);
    return report;
  }

  async generateMonthly(
    monthId: string,
    config: RagConfiguration,
  ): Promise<ReportRecord> {
    const existing = await this.reports.getByDate(monthId);
    if (existing) return existing;

    const pages = await this.collectMonthPages(monthId);
    if (pages.length === 0) {
      const report: ReportRecord = {
        id: crypto.randomUUID(),
        type: "monthly",
        date: monthId,
        title: `${monthId} 月报`,
        content: "本月没有浏览记录。",
        topics: [],
        pageCount: 0,
        createdAt: Date.now(),
      };
      await this.reports.save(report);
      return report;
    }

    const dates = new Set(pages.map((p) => p.visitDate));
    const pageInfo = pages.map(toPageInfo);
    const prompt = buildMonthlyPrompt(pageInfo, monthId, dates.size);
    const content = await this.client.chat({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [{ role: "user", content: prompt }],
    });

    const report: ReportRecord = {
      id: crypto.randomUUID(),
      type: "monthly",
      date: monthId,
      title: `${monthId} 月报`,
      content,
      topics: extractTopics(content),
      pageCount: pages.length,
      createdAt: Date.now(),
    };
    await this.reports.save(report);
    return report;
  }

  private async collectWeekPages(weekId: string): Promise<PageRecord[]> {
    // weekId format: "2026-W24" — get all dates, filter by ISO week
    const allDates = await this.pages.getDistinctDates();
    const matchingDates = allDates.filter((date) => {
      const d = new Date(date + "T00:00:00");
      const year = d.getFullYear();
      const week = getISOWeek(d);
      return `${year}-W${String(week).padStart(2, "0")}` === weekId;
    });

    const results: PageRecord[] = [];
    for (const date of matchingDates) {
      const pages = await this.pages.getByDate(date);
      results.push(...pages);
    }
    return results;
  }

  private async collectMonthPages(monthId: string): Promise<PageRecord[]> {
    // monthId format: "2026-06"
    const allDates = await this.pages.getDistinctDates();
    const matchingDates = allDates.filter((date) => date.startsWith(monthId));

    const results: PageRecord[] = [];
    for (const date of matchingDates) {
      const pages = await this.pages.getByDate(date);
      results.push(...pages);
    }
    return results;
  }
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
