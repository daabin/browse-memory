import { BrowseMemoryApplication } from "../src/background/application";
import { createMessageHandler } from "../src/background/message-handler";
import {
  SessionCoordinator,
  type ActiveTab,
} from "../src/background/session-coordinator";
import {
  HEARTBEAT_ALARM,
  PURGE_ALARM,
  SESSION_STORAGE_KEY,
} from "../src/shared/constants";
import type { RuntimeRequest } from "../src/shared/messages";
import { database } from "../src/storage/database";
import { SettingsRepository } from "../src/storage/settings-repository";

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
