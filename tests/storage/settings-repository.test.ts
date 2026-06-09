import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrowseMemoryDatabase } from "@/storage/database";
import { SettingsRepository } from "@/storage/settings-repository";

describe("SettingsRepository", () => {
  let database: BrowseMemoryDatabase;
  let settings: SettingsRepository;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`settings-${crypto.randomUUID()}`);
    settings = new SettingsRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("merges stored values with defaults", async () => {
    await settings.save({ minimumReadSeconds: 12 });

    expect(await settings.get()).toMatchObject({
      chatBaseUrl: "https://api.deepseek.com",
      chatModel: "deepseek-v4-flash",
      minimumReadSeconds: 12,
    });
  });

  it("clears all persisted application data", async () => {
    await settings.save({ chatModel: "custom" });
    await settings.clearAll();

    expect((await settings.get()).chatModel).toBe("deepseek-v4-flash");
  });
});
