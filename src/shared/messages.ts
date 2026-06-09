import type {
  AppSettings,
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
  | { type: "SEARCH"; query: string }
  | { type: "GET_TODAY_SNAPSHOT" }
  | { type: "ASK"; question: string; online: boolean }
  | { type: "GET_SETTINGS" }
  | { type: "SAVE_SETTINGS"; settings: Partial<AppSettings>; apiKey?: string }
  | { type: "TEST_CONNECTION"; settings: Partial<AppSettings>; apiKey?: string }
  | { type: "GET_STORAGE_USAGE" }
  | { type: "CLEAR_ALL_DATA" };

export type RuntimeResponse =
  | { ok: true; results: SearchResult[] }
  | { ok: true; snapshot: TodaySnapshot }
  | { ok: true; answer: RagAnswer }
  | { ok: true; settings: AppSettings; hasApiKey: boolean }
  | { ok: true; bytes: number }
  | { ok: true }
  | { ok: false; code: string; message: string };
