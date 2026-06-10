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
};

export const SESSION_STORAGE_KEY = "browseMemory.activeSession";
export const HEARTBEAT_ALARM = "browseMemory.heartbeat";
export const PURGE_ALARM = "browseMemory.purge";
