import { shouldCapture } from "../capture/capture-policy";
import {
  createSession,
  transitionSession,
  type ReadingSession,
} from "../capture/session-machine";
import type { AppSettings, PageCapture } from "../shared/types";

export interface SessionStorageAdapter {
  get(): Promise<unknown>;
  set(value: unknown): Promise<void>;
  remove(): Promise<void>;
}

export interface ActiveTab {
  tabId: number;
  url: string;
  title: string;
  incognito: boolean;
}

interface PersistedSession {
  session: ReadingSession;
  incognito: boolean;
  page?: { url: string; title: string; content: string };
}

export class SessionCoordinator {
  private state: PersistedSession | undefined;

  constructor(
    private readonly storage: SessionStorageAdapter,
    private readonly captureSink: (capture: PageCapture) => Promise<unknown>,
    private readonly settingsSource: () => Promise<AppSettings>,
  ) {}

  current(): ReadingSession | undefined {
    return this.state?.session;
  }

  async restore(): Promise<void> {
    const restored = await this.storage.get();
    if (restored && typeof restored === "object" && "session" in restored) {
      this.state = restored as PersistedSession;
    }
  }

  async switchTo(tab: ActiveTab | undefined, at = Date.now()): Promise<void> {
    await this.finalize(at);
    if (!tab) {
      await this.storage.remove();
      return;
    }
    this.state = {
      session: createSession(tab.tabId, tab.url, tab.title, at),
      incognito: tab.incognito,
      page: { url: tab.url, title: tab.title, content: "" },
    };
    await this.persist();
  }

  async updatePage(
    tabId: number,
    page: { url: string; title: string; content: string },
    at = Date.now(),
  ): Promise<void> {
    // If no active session for this tab, create one (handles race with tabs.onActivated)
    if (!this.state || this.state.session.tabId !== tabId) {
      if (this.state) {
        await this.finalize(at);
      }
      this.state = {
        session: createSession(tabId, page.url, page.title, at),
        incognito: false,
        page,
      };
      await this.persist();
      return;
    }
    if (this.state.session.url !== page.url) {
      const incognito = this.state.incognito;
      await this.finalize(at);
      this.state = {
        session: createSession(tabId, page.url, page.title, at),
        incognito,
        page,
      };
    } else {
      this.state = {
        ...this.state,
        session: { ...this.state.session, title: page.title },
        page,
      };
    }
    await this.persist();
  }

  async setActive(active: boolean, at = Date.now()): Promise<void> {
    if (!this.state) {
      return;
    }
    this.state = {
      ...this.state,
      session: transitionSession(this.state.session, {
        type: "SET_ACTIVE",
        active,
        at,
      }),
    };
    await this.persist();
  }

  async tick(at = Date.now()): Promise<void> {
    if (!this.state) {
      return;
    }
    this.state = {
      ...this.state,
      session: transitionSession(this.state.session, { type: "TICK", at }),
    };
    await this.persist();
  }

  private async finalize(at: number): Promise<void> {
    if (!this.state) {
      return;
    }
    const session = transitionSession(this.state.session, { type: "TICK", at });
    const settings = await this.settingsSource();
    if (
      shouldCapture(
        {
          url: session.url,
          durationSeconds: session.durationSeconds,
          incognito: this.state.incognito,
        },
        settings,
      )
    ) {
      await this.captureSink({
        url: session.url,
        title: this.state.page?.title || session.title,
        content: this.state.page?.content ?? "",
        durationSeconds: session.durationSeconds,
        capturedAt: at,
      });
    }
    this.state = undefined;
  }

  private async persist(): Promise<void> {
    if (this.state) {
      await this.storage.set(this.state);
    }
  }
}
