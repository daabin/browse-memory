import type { OpenAICompatibleClient } from "../ai/openai-client";
import type { RagConfiguration } from "../ai/rag-service";
import type { PageRecord, ReportRecord, ReportType } from "../shared/types";
import type { PageRepository } from "../storage/page-repository";
import type { ReportRepository } from "../storage/report-repository";

const MAX_INPUT_PAGES = 200;
const MAX_INPUT_CHARS = 8000;
const MAX_OUTPUT_TOKENS = 2048;

const DEFAULT_LOCALE = "zh_CN";

/** Maps locale code to the natural-language name used in AI prompts. */
const LOCALE_LANGUAGE_MAP: Record<string, string> = {
  zh_CN: "简体中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  ar: "العربية",
};

/** Localised strings for titles and empty-state messages. */
const LOCALE_STRINGS: Record<string, { daily: string; weekly: string; monthly: string; noDaily: string; noWeekly: string; noMonthly: string }> = {
  zh_CN: { daily: "日报", weekly: "周报", monthly: "月报", noDaily: "当天没有浏览记录。", noWeekly: "本周没有浏览记录。", noMonthly: "本月没有浏览记录。" },
  en:    { daily: "Daily Report", weekly: "Weekly Report", monthly: "Monthly Report", noDaily: "No browsing records for this day.", noWeekly: "No browsing records for this week.", noMonthly: "No browsing records for this month." },
  ja:    { daily: "日報", weekly: "週報", monthly: "月報", noDaily: "この日の閲覧記録はありません。", noWeekly: "今週の閲覧記録はありません。", noMonthly: "今月の閲覧記録はありません。" },
  ko:    { daily: "일간 보고서", weekly: "주간 보고서", monthly: "월간 보고서", noDaily: "이 날의 브라우징 기록이 없습니다.", noWeekly: "이번 주 브라우징 기록이 없습니다.", noMonthly: "이번 달 브라우징 기록이 없습니다." },
  es:    { daily: "Informe diario", weekly: "Informe semanal", monthly: "Informe mensual", noDaily: "No hay registros de navegación para este día.", noWeekly: "No hay registros de navegación para esta semana.", noMonthly: "No hay registros de navegación para este mes." },
  fr:    { daily: "Rapport quotidien", weekly: "Rapport hebdomadaire", monthly: "Rapport mensuel", noDaily: "Aucun enregistrement de navigation pour ce jour.", noWeekly: "Aucun enregistrement de navigation pour cette semaine.", noMonthly: "Aucun enregistrement de navigation pour ce mois." },
  de:    { daily: "Tagesbericht", weekly: "Wochenbericht", monthly: "Monatsbericht", noDaily: "Keine Browserverläufe für diesen Tag.", noWeekly: "Keine Browserverläufe für diese Woche.", noMonthly: "Keine Browserverläufe für diesen Monat." },
  pt:    { daily: "Relatório diário", weekly: "Relatório semanal", monthly: "Relatório mensal", noDaily: "Nenhum registro de navegação para este dia.", noWeekly: "Nenhum registro de navegação para esta semana.", noMonthly: "Nenhum registro de navegação para este mês." },
  ru:    { daily: "Дневной отчёт", weekly: "Недельный отчёт", monthly: "Месячный отчёт", noDaily: "Нет записей просмотров за этот день.", noWeekly: "Нет записей просмотров за эту неделю.", noMonthly: "Нет записей просмотров за этот месяц." },
  ar:    { daily: "التقرير اليومي", weekly: "التقرير الأسبوعي", monthly: "التقرير الشهري", noDaily: "لا توجد سجلات تصفح لهذا اليوم.", noWeekly: "لا توجد سجلات تصفح لهذا الأسبوع.", noMonthly: "لا توجد سجلات تصفح لهذا الشهر." },
};

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

function getLanguageInstruction(locale: string): string {
  const langName = LOCALE_LANGUAGE_MAP[locale] ?? LOCALE_LANGUAGE_MAP[DEFAULT_LOCALE];
  return `IMPORTANT: Write the entire report in ${langName}. All headings, analysis, and descriptions must be in ${langName}.`;
}

function getStrings(locale: string): typeof LOCALE_STRINGS[string] {
  return LOCALE_STRINGS[locale] ?? LOCALE_STRINGS[DEFAULT_LOCALE];
}

function buildDailyPrompt(pages: PageInfo[], date: string, locale: string): string {
  const sorted = pages.sort((a, b) => b.durationMin - a.durationMin);
  const lines = sorted.map(
    (p, i) =>
      `${i + 1}. "${p.title}" (${p.domain}, ${p.durationMin}min)${p.summary ? ` — ${p.summary}` : ""}`,
  );
  const input = lines.join("\n").slice(0, MAX_INPUT_CHARS);
  const langInstruction = getLanguageInstruction(locale);
  return `You are the BrowseMemory report assistant. Generate a daily report based on browsing records from ${date}.

Requirements:
- Extract 3–5 topic clusters
- Summarise time distribution
- Write a "Today's Discovery" paragraph (~50 words)
- Use Markdown formatting (headings, lists, bold)
- ${langInstruction}

Browsing records:
${input}`;
}

function buildWeeklyPrompt(
  pages: PageInfo[],
  weekId: string,
  dailyCount: number,
  locale: string,
): string {
  const sorted = pages.sort((a, b) => b.durationMin - a.durationMin);
  const top10 = sorted.slice(0, 10);
  const lines = top10.map(
    (p, i) =>
      `${i + 1}. "${p.title}" (${p.domain}, ${p.durationMin}min)${p.summary ? ` — ${p.summary}` : ""}`,
  );
  const domains = [...new Set(pages.map((p) => p.domain))];
  const input = lines.join("\n").slice(0, MAX_INPUT_CHARS);
  const langInstruction = getLanguageInstruction(locale);
  return `You are the BrowseMemory report assistant. Generate a weekly report for week ${weekId}.

Statistics: ${pages.length} pages, ${dailyCount} active days, ${domains.length} domains.
Deep-reading Top 10:
${input}

Requirements:
- Cross-day topic continuity analysis
- Deep-reading Top 10 commentary
- Emerging interest identification
- Use Markdown formatting (headings, lists, bold)
- ${langInstruction}`;
}

function buildMonthlyPrompt(
  pages: PageInfo[],
  monthId: string,
  dailyCount: number,
  locale: string,
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
  const langInstruction = getLanguageInstruction(locale);
  return `You are the BrowseMemory report assistant. Generate a monthly report for ${monthId}.

Statistics: ${pages.length} pages, ${dailyCount} active days, ${domains.length} domains, total reading ${totalMin} minutes.
Deep-reading Top 10:
${input}

Requirements:
- Long-term trend analysis
- Knowledge graph overview (main topic areas)
- Monthly reading efficiency statistics
- Use Markdown formatting (headings, lists, bold)
- ${langInstruction}`;
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
    locale: string = DEFAULT_LOCALE,
    force: boolean = false,
  ): Promise<ReportRecord> {
    const existing = await this.reports.getByDate(date);
    if (existing) {
      if (!force) return existing;
      // Delete existing report so it can be regenerated
      await this.reports.delete(existing.id);
    }

    const strs = getStrings(locale);
    const pageRecords = await this.pages.getByDate(date);
    if (pageRecords.length === 0) {
      const report: ReportRecord = {
        id: crypto.randomUUID(),
        type: "daily",
        date,
        title: `${date} ${strs.daily}`,
        content: strs.noDaily,
        topics: [],
        pageCount: 0,
        createdAt: Date.now(),
      };
      await this.reports.save(report);
      return report;
    }

    const pageInfo = pageRecords.map(toPageInfo);
    const prompt = buildDailyPrompt(pageInfo, date, locale);
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
      title: `${date} ${strs.daily}`,
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
    locale: string = DEFAULT_LOCALE,
    force: boolean = false,
  ): Promise<ReportRecord> {
    const existing = await this.reports.getByDate(weekId);
    if (existing) {
      if (!force) return existing;
      await this.reports.delete(existing.id);
    }

    const strs = getStrings(locale);
    // Collect pages for the week (parse weekId like "2026-W24")
    const pages = await this.collectWeekPages(weekId);
    if (pages.length === 0) {
      const report: ReportRecord = {
        id: crypto.randomUUID(),
        type: "weekly",
        date: weekId,
        title: `${weekId} ${strs.weekly}`,
        content: strs.noWeekly,
        topics: [],
        pageCount: 0,
        createdAt: Date.now(),
      };
      await this.reports.save(report);
      return report;
    }

    const dates = new Set(pages.map((p) => p.visitDate));
    const pageInfo = pages.map(toPageInfo);
    const prompt = buildWeeklyPrompt(pageInfo, weekId, dates.size, locale);
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
      title: `${weekId} ${strs.weekly}`,
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
    locale: string = DEFAULT_LOCALE,
    force: boolean = false,
  ): Promise<ReportRecord> {
    const existing = await this.reports.getByDate(monthId);
    if (existing) {
      if (!force) return existing;
      await this.reports.delete(existing.id);
    }

    const strs = getStrings(locale);
    const pages = await this.collectMonthPages(monthId);
    if (pages.length === 0) {
      const report: ReportRecord = {
        id: crypto.randomUUID(),
        type: "monthly",
        date: monthId,
        title: `${monthId} ${strs.monthly}`,
        content: strs.noMonthly,
        topics: [],
        pageCount: 0,
        createdAt: Date.now(),
      };
      await this.reports.save(report);
      return report;
    }

    const dates = new Set(pages.map((p) => p.visitDate));
    const pageInfo = pages.map(toPageInfo);
    const prompt = buildMonthlyPrompt(pageInfo, monthId, dates.size, locale);
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
      title: `${monthId} ${strs.monthly}`,
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
