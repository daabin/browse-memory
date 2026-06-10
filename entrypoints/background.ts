import { BrowseMemoryApplication } from "../src/background/application";
import { createMessageHandler } from "../src/background/message-handler";
import {
  SessionCoordinator,
  type ActiveTab,
} from "../src/background/session-coordinator";
import {
  EMBEDDING_ALARM,
  HEARTBEAT_ALARM,
  PURGE_ALARM,
  REPORT_ALARM_PREFIX,
  SESSION_STORAGE_KEY,
} from "../src/shared/constants";
import type { RuntimeRequest } from "../src/shared/messages";
import type { TaskType } from "../src/shared/types";
import { EmbeddingClient } from "../src/ai/embedding-client";
import { SummaryService } from "../src/ai/summary-service";
import { TaskQueue } from "../src/queue/task-queue";
import { TaskRunner } from "../src/queue/task-runner";
import { ReportService } from "../src/reports/report-service";
import { EmbeddingRepository } from "../src/storage/embedding-repository";
import { PageRepository } from "../src/storage/page-repository";
import { ReportRepository } from "../src/storage/report-repository";
import { SettingsRepository } from "../src/storage/settings-repository";
import { database } from "../src/storage/database";

function toActiveTab(tab: Browser.tabs.Tab): ActiveTab | undefined {
  if (tab.id === undefined || !tab.url) {
    return undefined;
  }
  return {
    tabId: tab.id,
    url: tab.url,
    title: tab.title ?? tab.url,
    incognito: tab.incognito,
  };
}

export default defineBackground(() => {
  const application = new BrowseMemoryApplication(database);
  const settings = new SettingsRepository(database);
  const handleMessage = createMessageHandler(application);
  const coordinator = new SessionCoordinator(
    {
      async get() {
        return (await browser.storage.session.get(SESSION_STORAGE_KEY))[
          SESSION_STORAGE_KEY
        ];
      },
      async set(value) {
        await browser.storage.session.set({ [SESSION_STORAGE_KEY]: value });
      },
      async remove() {
        await browser.storage.session.remove(SESSION_STORAGE_KEY);
      },
    },
    async (capture) => application.handle({ type: "STORE_CAPTURE", capture }),
    () => settings.get(),
  );

  // Phase 2: Task Runner setup
  const taskQueue = new TaskQueue(database);
  const pages = new PageRepository(database);
  const embeddingRepo = new EmbeddingRepository(database);
  const reportRepo = new ReportRepository(database);
  const embeddingClient = new EmbeddingClient();
  const summaryService = new SummaryService(application.client);
  const reportService = new ReportService(pages, reportRepo, application.client);

  const handlers = new Map<TaskType, (payload: unknown) => Promise<void>>();
  handlers.set("embed", async (payload) => {
    const { pageId } = payload as { pageId: string };
    const s = await settings.get();
    const apiKey = s.embeddingReuseChatKey
      ? (s.encryptedApiKey ? await application.secrets.decrypt(s.encryptedApiKey) : "")
      : (s.encryptedEmbeddingApiKey ? await application.secrets.decrypt(s.encryptedEmbeddingApiKey) : "");
    if (!apiKey) throw new Error("No embedding API key");
    const allPages = await database.pages.where("id").equals(pageId).toArray();
    const page = allPages[0];
    if (!page) return;
    const input = `${page.title}\n${page.content}`.slice(0, 2000);
    const vector = await embeddingClient.createEmbedding({
      baseUrl: s.embeddingBaseUrl,
      apiKey,
      model: s.embeddingModel,
      input,
    });
    await embeddingRepo.put({
      pageId,
      vector,
      model: s.embeddingModel,
      createdAt: Date.now(),
    });
  });
  handlers.set("summarize", async (payload) => {
    const { pageId } = payload as { pageId: string };
    const s = await settings.get();
    const apiKey = s.encryptedApiKey ? await application.secrets.decrypt(s.encryptedApiKey) : "";
    if (!apiKey) throw new Error("No API key");
    const allPages = await database.pages.where("id").equals(pageId).toArray();
    const page = allPages[0];
    if (!page) return;
    const summary = await summaryService.summarize(page.title, page.content, {
      baseUrl: s.chatBaseUrl,
      apiKey,
      model: s.chatModel,
    });
    await database.pages.update(pageId, { summary });
  });
  handlers.set("report_daily", async (payload) => {
    const { date } = payload as { date: string };
    const s = await settings.get();
    const apiKey = s.encryptedApiKey ? await application.secrets.decrypt(s.encryptedApiKey) : "";
    if (!apiKey) throw new Error("No API key");
    await reportService.generateDaily(date, {
      baseUrl: s.chatBaseUrl,
      apiKey,
      model: s.chatModel,
    });
  });
  handlers.set("report_weekly", async (payload) => {
    const { weekId } = payload as { weekId: string };
    const s = await settings.get();
    const apiKey = s.encryptedApiKey ? await application.secrets.decrypt(s.encryptedApiKey) : "";
    if (!apiKey) throw new Error("No API key");
    await reportService.generateWeekly(weekId, {
      baseUrl: s.chatBaseUrl,
      apiKey,
      model: s.chatModel,
    });
  });
  handlers.set("report_monthly", async (payload) => {
    const { monthId } = payload as { monthId: string };
    const s = await settings.get();
    const apiKey = s.encryptedApiKey ? await application.secrets.decrypt(s.encryptedApiKey) : "";
    if (!apiKey) throw new Error("No API key");
    await reportService.generateMonthly(monthId, {
      baseUrl: s.chatBaseUrl,
      apiKey,
      model: s.chatModel,
    });
  });

  const taskRunner = new TaskRunner(taskQueue, handlers);

  const activateCurrentTab = async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    await coordinator.switchTo(tab ? toActiveTab(tab) : undefined);
  };

  void coordinator.restore().then(async () => {
    if (!coordinator.current()) {
      await activateCurrentTab();
    }
    // Run TTL purge once on startup (fire-and-forget)
    void application.purgeExpired();
  });
  void browser.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
  // Daily purge alarm (every 24 hours)
  void browser.alarms.create(PURGE_ALARM, { periodInMinutes: 1440 });
  // Phase 2: Embedding backfill alarm (every 5 minutes)
  void browser.alarms.create(EMBEDDING_ALARM, { periodInMinutes: 5 });
  // Phase 2: Report alarms
  void browser.alarms.create(REPORT_ALARM_PREFIX + "daily", { periodInMinutes: 1440 });
  void browser.alarms.create(REPORT_ALARM_PREFIX + "weekly", { periodInMinutes: 10080 });
  void browser.alarms.create(REPORT_ALARM_PREFIX + "monthly", { periodInMinutes: 43200 });
  void chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });

  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    await coordinator.switchTo(toActiveTab(await browser.tabs.get(tabId)));
  });
  browser.tabs.onRemoved.addListener(async (tabId) => {
    if (coordinator.current()?.tabId === tabId) {
      await coordinator.switchTo(undefined);
    }
  });
  browser.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      await coordinator.setActive(false);
    } else {
      await activateCurrentTab();
    }
  });
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === HEARTBEAT_ALARM) {
      await coordinator.tick();
    } else if (alarm.name === PURGE_ALARM) {
      await application.purgeExpired();
    } else if (alarm.name === EMBEDDING_ALARM) {
      // Process pending embedding/summarize tasks
      try { await taskRunner.runBatch(10); } catch { /* silent */ }
    } else if (alarm.name.startsWith(REPORT_ALARM_PREFIX)) {
      const reportType = alarm.name.slice(REPORT_ALARM_PREFIX.length);
      const now = new Date();
      try {
        if (reportType === "daily") {
          const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          await taskQueue.enqueue("report_daily", { date });
        } else if (reportType === "weekly") {
          const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
          const dayNum = d.getUTCDay() || 7;
          d.setUTCDate(d.getUTCDate() + 4 - dayNum);
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
          const weekId = `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
          await taskQueue.enqueue("report_weekly", { weekId });
        } else if (reportType === "monthly") {
          const monthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          await taskQueue.enqueue("report_monthly", { monthId });
        }
        await taskRunner.runBatch(3);
      } catch { /* silent */ }
    }
  });
  browser.runtime.onMessage.addListener(
    async (request: RuntimeRequest, sender) => {
      if (request.type === "PAGE_CHANGED" && sender.tab?.id !== undefined) {
        await coordinator.updatePage(sender.tab.id, request.page);
        return { ok: true };
      }
      return handleMessage(request);
    },
  );
});
