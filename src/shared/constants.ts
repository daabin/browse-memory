import type { AppSettings } from "./types";

export const DEFAULT_BLACKLIST_PATTERNS = [
  "*.bank.com",
  "*.paypal.com",
  "pay.google.com",
  "passwords.google.com",
];

export const DEFAULT_RETENTION_DAYS = 90;

export const DEFAULT_SETTINGS: AppSettings = {
  chatBaseUrl: "https://api.deepseek.com",
  chatModel: "deepseek-v4-flash",
  minimumReadSeconds: 5,
  blacklistPatterns: DEFAULT_BLACKLIST_PATTERNS,
  retentionDays: DEFAULT_RETENTION_DAYS,
  embeddingEnabled: false,
  embeddingBaseUrl: "https://api.siliconflow.cn",
  embeddingModel: "BAAI/bge-m3",
  embeddingReuseChatKey: true,
  reportDailyHour: 3,
};

export const SESSION_STORAGE_KEY = "browseMemory.activeSession";
export const HEARTBEAT_ALARM = "browseMemory.heartbeat";
export const PURGE_ALARM = "browseMemory.purge";
export const EMBEDDING_ALARM = "browseMemory.embedding";
export const REPORT_ALARM_PREFIX = "browseMemory.report.";
export const MAX_TASK_RETRIES = 3;
export const TASK_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000];
