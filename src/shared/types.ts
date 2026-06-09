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
