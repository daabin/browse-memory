import { DEFAULT_SETTINGS } from "../shared/constants";
import type { AppSettings } from "../shared/types";

import type { BrowseMemoryDatabase } from "./database";

const SETTINGS_KEY = "application";

export class SettingsRepository {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async get(): Promise<AppSettings> {
    const record = await this.database.settings.get(SETTINGS_KEY);
    return {
      ...DEFAULT_SETTINGS,
      ...(record?.value as Partial<AppSettings> | undefined),
    };
  }

  async save(settings: Partial<AppSettings>): Promise<AppSettings> {
    const next = { ...(await this.get()), ...settings };
    await this.database.settings.put({ key: SETTINGS_KEY, value: next });
    return next;
  }

  async clearAll(): Promise<void> {
    await this.database.transaction(
      "rw",
      [
        this.database.pages,
        this.database.bm25Terms,
        this.database.bm25Documents,
        this.database.settings,
        this.database.cryptoKeys,
        this.database.chatSessions,
        this.database.chatMessages,
      ],
      async () => {
        await Promise.all([
          this.database.pages.clear(),
          this.database.bm25Terms.clear(),
          this.database.bm25Documents.clear(),
          this.database.settings.clear(),
          this.database.cryptoKeys.clear(),
          this.database.chatSessions.clear(),
          this.database.chatMessages.clear(),
        ]);
      },
    );
  }
}
