import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SecretStore } from "@/security/secret-store";
import { BrowseMemoryDatabase } from "@/storage/database";

describe("SecretStore", () => {
  let database: BrowseMemoryDatabase;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`secret-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("round trips a secret with a non-exportable key", async () => {
    const store = new SecretStore(database);
    const encrypted = await store.encrypt("sk-private");

    expect(encrypted.ciphertext).not.toContain("sk-private");
    expect(await store.decrypt(encrypted)).toBe("sk-private");
    const key = (await database.cryptoKeys.get("api-key"))?.key;
    expect(key?.extractable).toBe(false);
  });
});
