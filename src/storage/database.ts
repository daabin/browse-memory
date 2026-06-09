import Dexie, { type EntityTable } from "dexie";

import type { ChatMessageRecord, ChatSessionRecord, PageRecord } from "../shared/types";

export interface Bm25TermRecord {
  term: string;
  documentFrequency: number;
  postings: Array<{ pageId: string; termFrequency: number }>;
}

export interface Bm25DocumentRecord {
  pageId: string;
  length: number;
  frequencies: Record<string, number>;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export interface CryptoKeyRecord {
  id: string;
  key: CryptoKey;
}

export class BrowseMemoryDatabase extends Dexie {
  pages!: EntityTable<PageRecord, "id">;
  bm25Terms!: EntityTable<Bm25TermRecord, "term">;
  bm25Documents!: EntityTable<Bm25DocumentRecord, "pageId">;
  settings!: EntityTable<SettingRecord, "key">;
  cryptoKeys!: EntityTable<CryptoKeyRecord, "id">;
  chatSessions!: EntityTable<ChatSessionRecord, "id">;
  chatMessages!: EntityTable<ChatMessageRecord, "id">;

  constructor(name = "browse-memory") {
    super(name);
    this.version(1).stores({
      pages: "id, normalizedUrl, visitDate, domain, updatedAt",
      bm25Terms: "term",
      bm25Documents: "pageId",
      settings: "key",
      cryptoKeys: "id",
    });
    this.version(2).stores({
      pages: "id, normalizedUrl, visitDate, domain, updatedAt",
      bm25Terms: "term",
      bm25Documents: "pageId",
      settings: "key",
      cryptoKeys: "id",
      chatSessions: "id, createdAt, updatedAt",
      chatMessages: "id, sessionId, createdAt",
    });
  }
}

export const database = new BrowseMemoryDatabase();
