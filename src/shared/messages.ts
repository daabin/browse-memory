import type {
  AppSettings,
  ChatMessageRecord,
  ChatSessionRecord,
  PageCapture,
  RagAnswer,
  SearchResult,
  TodaySnapshot,
} from "./types";

export type RuntimeRequest =
  | {
      type: "PAGE_CHANGED";
      page: { url: string; title: string; content: string };
    }
  | { type: "STORE_CAPTURE"; capture: PageCapture }
  | { type: "GET_RECENT" }
  | { type: "SEARCH"; query: string }
  | { type: "GET_TODAY_SNAPSHOT" }
  | { type: "GET_DISTINCT_DATES" }
  | { type: "GET_RECORDS_BY_DATE"; date: string }
  | { type: "ASK"; question: string; online: boolean; sessionId?: string }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: Partial<AppSettings>; apiKey?: string }
  | { type: "TEST_CONNECTION"; settings: Partial<AppSettings>; apiKey?: string }
  | { type: "GET_STORAGE_USAGE" }
  | { type: "CLEAR_ALL_DATA" }
  | { type: "LIST_CHAT_SESSIONS" }
  | { type: "GET_CHAT_SESSION"; sessionId: string }
  | { type: "CREATE_CHAT_SESSION"; title: string }
  | { type: "ADD_CHAT_MESSAGE"; sessionId: string; message: Omit<ChatMessageRecord, "id" | "sessionId" | "createdAt"> }
  | { type: "DELETE_CHAT_SESSION"; sessionId: string };

export type RuntimeResponse =
  | { ok: true; results: SearchResult[] }
  | { ok: true; snapshot: TodaySnapshot }
  | { ok: true; dates: string[] }
  | { ok: true; answer: RagAnswer }
  | { ok: true; settings: AppSettings; hasApiKey: boolean }
  | { ok: true; bytes: number }
  | { ok: true; sessions: ChatSessionRecord[] }
  | { ok: true; session: ChatSessionRecord; messages: ChatMessageRecord[] }
  | { ok: true; session: ChatSessionRecord }
  | { ok: true; message: ChatMessageRecord }
  | { ok: true }
  | { ok: false; code: string; message: string };
