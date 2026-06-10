export interface EncryptedSecret {
  iv: string;
  ciphertext: string;
}

export interface AppSettings {
  chatBaseUrl: string;
  encryptedApiKey?: EncryptedSecret;
  chatModel: string;
  minimumReadSeconds: number;
  blacklistPatterns: string[];
  retentionDays: number;
  // Phase 2
  embeddingEnabled: boolean;
  embeddingBaseUrl: string;
  encryptedEmbeddingApiKey?: EncryptedSecret;
  embeddingModel: string;
  embeddingReuseChatKey: boolean;
  reportDailyHour: number;
}

export interface PageCapture {
  url: string;
  title: string;
  content: string;
  durationSeconds: number;
  capturedAt: number;
}

export interface PageRecord extends PageCapture {
  id: string;
  normalizedUrl: string;
  domain: string;
  contentHash: string;
  visitDate: string;
  createdAt: number;
  updatedAt: number;
  summary?: string;
}

export interface HighlightRange {
  start: number;
  end: number;
}

export interface SearchResult {
  page: PageRecord;
  score: number;
  snippet: string;
  highlights: HighlightRange[];
}

export interface TodaySnapshot {
  pageCount: number;
  readingMinutes: number;
  deepReadCount: number;
  topDomain?: string;
}

export interface DomainGroup {
  domain: string;
  pages: SearchResult[];
  totalDurationSeconds: number;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  sources?: RagSource[];
  offline?: boolean;
  createdAt: number;
}

export interface RagSource {
  index: number;
  title: string;
  url: string;
}

export interface RagAnswer {
  text: string;
  sources: RagSource[];
  offline: boolean;
}

// Phase 2: Embedding
export interface EmbeddingRecord {
  pageId: string;
  vector: number[];
  model: string;
  createdAt: number;
}

// Phase 2: Task Queue
export type TaskType =
  | "embed"
  | "summarize"
  | "report_daily"
  | "report_weekly"
  | "report_monthly";
export type TaskStatus = "pending" | "processing" | "done" | "failed";

export interface TaskRecord {
  id: string;
  type: TaskType;
  status: TaskStatus;
  payload: unknown;
  retries: number;
  createdAt: number;
  updatedAt: number;
}

// Phase 2: Reports
export type ReportType = "daily" | "weekly" | "monthly";

export interface ReportRecord {
  id: string;
  type: ReportType;
  date: string;
  title: string;
  content: string;
  topics: string[];
  pageCount: number;
  createdAt: number;
}
