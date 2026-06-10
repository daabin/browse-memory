import type { ChatMessage } from "../ai/openai-client";
import { OpenAICompatibleClient } from "../ai/openai-client";
import { EmbeddingClient } from "../ai/embedding-client";
import { QueryRewriter } from "../ai/query-rewriter";
import { RagService } from "../ai/rag-service";
import type { RagConfiguration } from "../ai/rag-service";
import { SummaryService } from "../ai/summary-service";
import { SecretStore } from "../security/secret-store";
import type {
  RuntimeRequest,
  RuntimeResponse,
} from "../shared/messages";
import type { AppSettings, ReportType } from "../shared/types";
import type { BrowseMemoryDatabase } from "../storage/database";
import { ChatRepository } from "../storage/chat-repository";
import { EmbeddingRepository } from "../storage/embedding-repository";
import { PageRepository } from "../storage/page-repository";
import { ReportRepository } from "../storage/report-repository";
import { SearchRepository } from "../storage/search-repository";
import { SettingsRepository } from "../storage/settings-repository";
import { TaskQueue } from "../queue/task-queue";
import { ReportService } from "../reports/report-service";

type Fetcher = typeof fetch;

/** Service Worker 安全的 fetch 包装，避免 Illegal invocation */
const safeFetch: Fetcher = (url, init) => self.fetch(url, init);

export class BrowseMemoryApplication {
  readonly pages: PageRepository;
  readonly search: SearchRepository;
  readonly settings: SettingsRepository;
  readonly secrets: SecretStore;
  readonly chat: ChatRepository;
  readonly client: OpenAICompatibleClient;
  readonly rag: RagService;
  // Phase 2
  readonly embeddingRepo: EmbeddingRepository;
  readonly reportRepo: ReportRepository;
  readonly taskQueue: TaskQueue;
  readonly embeddingClient: EmbeddingClient;
  readonly summaryService: SummaryService;
  readonly reportService: ReportService;
  readonly queryRewriter: QueryRewriter;

  constructor(database: BrowseMemoryDatabase, fetcher?: Fetcher) {
    const f = fetcher ?? safeFetch;
    this.pages = new PageRepository(database);
    this.search = new SearchRepository(database);
    this.settings = new SettingsRepository(database);
    this.secrets = new SecretStore(database);
    this.chat = new ChatRepository(database);
    this.client = new OpenAICompatibleClient(f);
    this.rag = new RagService(this.client);
    // Phase 2
    this.embeddingRepo = new EmbeddingRepository(database);
    this.reportRepo = new ReportRepository(database);
    this.taskQueue = new TaskQueue(database);
    this.embeddingClient = new EmbeddingClient(f);
    this.summaryService = new SummaryService(this.client);
    this.reportService = new ReportService(this.pages, this.reportRepo, this.client);
    this.queryRewriter = new QueryRewriter(this.client);
  }

  async purgeExpired(): Promise<void> {
    const settings = await this.settings.get();
    await Promise.all([
      this.pages.purgeExpired(settings.retentionDays),
      this.chat.purgeExpired(settings.retentionDays),
      this.reportRepo.purgeExpired(settings.retentionDays),
    ]);
  }

  async handle(request: RuntimeRequest): Promise<RuntimeResponse> {
    switch (request.type) {
      case "PAGE_CHANGED":
        return { ok: true };
      case "STORE_CAPTURE": {
        const page = await this.pages.upsertCapture(request.capture);
        // Phase 2: enqueue embedding + summarization tasks if enabled
        const settings = await this.settings.get();
        if (settings.embeddingEnabled && (await this.hasEmbeddingApiKey(settings))) {
          await this.taskQueue.enqueue("embed", { pageId: page.id });
          await this.taskQueue.enqueue("summarize", { pageId: page.id });
        }
        return { ok: true };
      }
      case "GET_RECENT":
        return { ok: true, results: await this.search.recent() };
      case "SEARCH":
        return { ok: true, results: await this.search.search(request.query) };
      case "GET_TODAY_SNAPSHOT":
        return { ok: true, snapshot: await this.pages.getTodaySnapshot() };
      case "GET_DISTINCT_DATES":
        return { ok: true, dates: await this.pages.getDistinctDates() };
      case "GET_RECORDS_BY_DATE": {
        const pages = await this.pages.getByDate(request.date);
        const results = pages.map((page) => ({
          page,
          score: 0,
          snippet: `${page.title}\n${page.content}`.slice(0, 180),
          highlights: [],
        }));
        return { ok: true, results };
      }
      case "GET_SETTINGS": {
        const settings = await this.settings.get();
        return {
          ok: true,
          settings: { ...settings, encryptedApiKey: undefined, encryptedEmbeddingApiKey: undefined },
          hasApiKey: settings.encryptedApiKey !== undefined,
          hasEmbeddingApiKey: settings.encryptedEmbeddingApiKey !== undefined,
        };
      }
      case "SAVE_SETTINGS": {
        const updates: Partial<AppSettings> = { ...request.settings };
        if (request.apiKey?.trim()) {
          updates.encryptedApiKey = await this.secrets.encrypt(
            request.apiKey.trim(),
          );
        }
        if (request.embeddingApiKey?.trim()) {
          updates.encryptedEmbeddingApiKey = await this.secrets.encrypt(
            request.embeddingApiKey.trim(),
          );
        }
        await this.settings.save(updates);
        return { ok: true };
      }
      case "TEST_CONNECTION": {
        const settings = { ...(await this.settings.get()), ...request.settings };
        const apiKey =
          request.apiKey?.trim() ||
          (settings.encryptedApiKey
            ? await this.secrets.decrypt(settings.encryptedApiKey)
            : "");
        if (!apiKey) {
          return {
            ok: false,
            code: "missing_api_key",
            message: "请先填写 API Key。",
          };
        }
        await this.client.chat({
          baseUrl: settings.chatBaseUrl,
          apiKey,
          model: settings.chatModel,
          messages: [{ role: "user", content: "Reply with OK." }],
        });
        return { ok: true };
      }
      case "TEST_EMBEDDING_CONNECTION": {
        const settings = { ...(await this.settings.get()), ...request.settings };
        const apiKey =
          request.embeddingApiKey?.trim() ||
          (settings.embeddingReuseChatKey
            ? (settings.encryptedApiKey
              ? await this.secrets.decrypt(settings.encryptedApiKey)
              : "")
            : (settings.encryptedEmbeddingApiKey
              ? await this.secrets.decrypt(settings.encryptedEmbeddingApiKey)
              : ""));
        if (!apiKey) {
          return {
            ok: false,
            code: "missing_api_key",
            message: "请先填写 Embedding API Key。",
          };
        }
        await this.embeddingClient.createEmbedding({
          baseUrl: settings.embeddingBaseUrl,
          apiKey,
          model: settings.embeddingModel,
          input: "test",
        });
        return { ok: true };
      }
      case "ASK": {
        const settings = await this.settings.get();
        const apiKey = settings.encryptedApiKey
          ? await this.secrets.decrypt(settings.encryptedApiKey)
          : undefined;

        // Build conversation history for multi-turn context
        let history: ChatMessage[] = [];
        if (request.sessionId) {
          try {
            const { messages } = await this.chat.getSession(request.sessionId);
            history = messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));
          } catch {
            // session not found, ignore history
          }
        }

        // Phase 2: Query rewriting for multi-turn conversations
        let rewrittenQuestion = request.question;
        const ragConfig: RagConfiguration | undefined = apiKey
          ? { baseUrl: settings.chatBaseUrl, apiKey, model: settings.chatModel }
          : undefined;

        if (history.length > 0 && ragConfig) {
          try {
            rewrittenQuestion = await this.queryRewriter.rewrite(
              request.question,
              history,
              ragConfig,
            );
          } catch {
            // rewriting failure is non-fatal, use original question
          }
        }

        // Phase 2: Hybrid search with optional embedding
        let embeddingQuery: number[] | undefined;
        if (settings.embeddingEnabled && ragConfig) {
          const embeddingApiKey = await this.getEmbeddingApiKey(settings);
          if (embeddingApiKey) {
            try {
              embeddingQuery = await this.embeddingClient.createEmbedding({
                baseUrl: settings.embeddingBaseUrl,
                apiKey: embeddingApiKey,
                model: settings.embeddingModel,
                input: rewrittenQuestion,
              });
            } catch {
              // embedding failure is non-fatal, fall back to BM25 only
            }
          }
        }

        const results = await this.search.search(rewrittenQuestion, 5, {
          embeddingQuery,
        });

        return {
          ok: true,
          answer: await this.rag.answer(
            request.question,
            results,
            ragConfig,
            request.online,
            history,
          ),
        };
      }
      case "GET_STORAGE_USAGE": {
        const estimate = await navigator.storage?.estimate?.();
        return { ok: true, bytes: estimate?.usage ?? 0 };
      }
      case "CLEAR_ALL_DATA":
        await this.settings.clearAll();
        return { ok: true };
      case "LIST_CHAT_SESSIONS":
        return { ok: true, sessions: await this.chat.listSessions() };
      case "GET_CHAT_SESSION": {
        const { session, messages } = await this.chat.getSession(request.sessionId);
        return { ok: true, session, messages };
      }
      case "CREATE_CHAT_SESSION":
        return { ok: true, session: await this.chat.createSession(request.title) };
      case "ADD_CHAT_MESSAGE":
        return {
          ok: true,
          message: await this.chat.addMessage(request.sessionId, request.message),
        };
      case "DELETE_CHAT_SESSION":
        await this.chat.deleteSession(request.sessionId);
        return { ok: true };
      // Phase 2: Reports
      case "GET_REPORTS":
        return { ok: true, reports: await this.reportRepo.list(request.reportType) };
      case "GET_REPORT": {
        const report = await this.reportRepo.get(request.reportId);
        if (!report) {
          return { ok: false, code: "not_found", message: "Report not found." };
        }
        return { ok: true, report };
      }
      case "GENERATE_REPORT": {
        const settings = await this.settings.get();
        const apiKey = settings.encryptedApiKey
          ? await this.secrets.decrypt(settings.encryptedApiKey)
          : undefined;
        if (!apiKey) {
          return { ok: false, code: "missing_api_key", message: "请先配置 AI 服务。" };
        }
        const ragConfig: RagConfiguration = {
          baseUrl: settings.chatBaseUrl,
          apiKey,
          model: settings.chatModel,
        };
        const date = request.date;
        const locale = request.locale ?? "zh_CN";
        // User-triggered: always force regenerate to overwrite stale reports
        const force = true;
        let report;
        switch (request.reportType as ReportType) {
          case "daily":
            report = await this.reportService.generateDaily(date ?? new Date().toISOString().slice(0, 10), ragConfig, locale, force);
            break;
          case "weekly":
            report = await this.reportService.generateWeekly(date ?? getCurrentWeekId(), ragConfig, locale, force);
            break;
          case "monthly":
            report = await this.reportService.generateMonthly(date ?? getCurrentMonthId(), ragConfig, locale, force);
            break;
        }
        return { ok: true, report };
      }
      // Phase 2: Embedding
      case "GET_EMBEDDING_STATUS": {
        const settings = await this.settings.get();
        const [indexedCount, totalCount] = await Promise.all([
          this.embeddingRepo.count(),
          this.pages.count(),
        ]);
        return {
          ok: true,
          embeddingStatus: {
            enabled: settings.embeddingEnabled,
            indexedCount,
            totalCount,
          },
        };
      }
      case "TRIGGER_EMBEDDING_BACKFILL": {
        const settings = await this.settings.get();
        if (!settings.embeddingEnabled) {
          return { ok: false, code: "not_enabled", message: "Embedding is not enabled." };
        }
        const unembeddedIds = await this.embeddingRepo.getUnembeddedPageIds();
        for (const pageId of unembeddedIds) {
          await this.taskQueue.enqueue("embed", { pageId });
        }
        return { ok: true };
      }
      case "GET_QUEUE_STATUS": {
        const [pending, processing, failed] = await Promise.all([
          this.taskQueue.getCountByStatus("pending"),
          this.taskQueue.getCountByStatus("processing"),
          this.taskQueue.getCountByStatus("failed"),
        ]);
        return { ok: true, queueStatus: { pending, processing, failed } };
      }
    }
  }

  private async hasEmbeddingApiKey(settings: AppSettings): Promise<boolean> {
    if (settings.embeddingReuseChatKey) {
      return settings.encryptedApiKey !== undefined;
    }
    return settings.encryptedEmbeddingApiKey !== undefined;
  }

  private async getEmbeddingApiKey(settings: AppSettings): Promise<string | undefined> {
    if (settings.embeddingReuseChatKey) {
      return settings.encryptedApiKey
        ? await this.secrets.decrypt(settings.encryptedApiKey)
        : undefined;
    }
    return settings.encryptedEmbeddingApiKey
      ? await this.secrets.decrypt(settings.encryptedEmbeddingApiKey)
      : undefined;
  }
}

function getCurrentWeekId(): string {
  const today = new Date();
  const year = today.getFullYear();
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getCurrentMonthId(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}
