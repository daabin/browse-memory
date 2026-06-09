# BrowseMemory Phase 1 MVP Design

## 1. Goal

Build a Chrome-only browser extension that proves the complete BrowseMemory
loop:

1. Observe eligible browsing activity.
2. Extract and store readable page content and reading duration locally.
3. Index stored pages with a local BM25 engine.
4. Search browsing memory without a network connection.
5. Ask a single-turn question whose answer uses the top local results and an
   OpenAI-compatible chat API.
6. Configure the API and capture rules from an options page.

The MVP must remain useful when no API key is configured: collection, local
storage, statistics, and BM25 search continue to work.

## 2. Scope

### Included

- WXT, React, TypeScript, Tailwind CSS, and shadcn-style primitives.
- Chrome Manifest V3 background service worker.
- Chrome Side Panel entry point.
- Options page.
- Active-tab reading session tracking.
- Readability extraction with title-and-URL fallback.
- SPA navigation detection through history events, `popstate`, and title
  observation.
- Default and user-defined domain blacklist rules.
- Five-second minimum reading threshold.
- Ten-minute same-URL deduplication window.
- IndexedDB stores for pages and BM25 index data.
- English and Chinese tokenization with `Intl.Segmenter`.
- Local BM25 search, snippets, and highlighted matches.
- Single-turn RAG answers with inline source links.
- OpenAI-compatible chat configuration.
- API-key encryption using Web Crypto and a non-exportable IndexedDB key.
- Loading, empty, offline, missing-configuration, and API-error states.

### Excluded

- Remote embeddings, vectors, RRF, and semantic search.
- Automatic summaries and daily, weekly, or monthly reports.
- Multi-turn chat and query rewriting.
- Firefox support.
- Local HTTP backup service and SQLite.
- Chrome Built-in AI.
- Advanced charts, export, cloud sync, and store submission.

## 3. Product Experience

### Visual Direction

The approved direction combines the soft material language of **Quiet Glass**
with the AI-first two-mode navigation of **Memory Lens**. The visual reference
is [phase-1-visual-reference.png](../../design/phase-1-visual-reference.png).

Implementation rules:

- Use a warm off-white base and cool translucent surfaces.
- Prefer spacing, typography, grouping, and hairline separators over borders.
- Use system blue only for selection, links, focus, and primary actions.
- Use the system font stack and Lucide icons.
- Keep body text at 14px or above and touch targets at least 36px high.
- Use 12px to 16px radii and very restrained shadows.
- Do not nest cards or turn every list item into a card.
- Support 320px to 480px side-panel widths without horizontal scrolling.
- Respect reduced-motion and system light/dark preferences.

### Side Panel Structure

The side panel has a fixed utility header and a fixed bottom mode switch.

**Memory mode**

- Today's page count, reading minutes, deep-read count, and top domain.
- Command-style search field with a 300ms debounce.
- Search result list containing favicon, title, domain, duration, visit date,
  and a highlighted content snippet.
- A compact question prompt that can move the user into Conversation mode with
  the current text.

**Conversation mode**

- One question composer.
- Suggested questions derived from static templates, not generated insights.
- Streaming or progressively displayed answer text.
- Inline numbered source links to the retrieved pages.
- A compact list of the source pages used in the answer.
- A clear message when no API configuration exists.
- Offline fallback that returns the top five BM25 snippets with an explicit
  offline label.

The visual reference shows an answer preview on Memory mode. In Phase 1 this is
displayed only after the user has asked a question during the current side-panel
session; it is not an automatically generated daily insight.

### Options Page

The options page contains:

- API base URL, API key, and model.
- Connection test.
- Minimum reading duration.
- Blacklist editor with default sensitive-domain patterns.
- Read-only local storage usage.
- Clear-all-data action with confirmation.

The default chat values are:

- Base URL: `https://api.deepseek.com`
- Model: `deepseek-v4-flash`

No key is supplied by default.

## 4. Architecture

### Entrypoints

- `entrypoints/background.ts`: service worker registration and orchestration.
- `entrypoints/content.ts`: page extraction and SPA navigation observation.
- `entrypoints/sidepanel/`: React side-panel application.
- `entrypoints/options/`: React options application.

### Core Modules

- `src/capture/`: active reading-session state and capture policy.
- `src/extraction/`: Readability adapter and fallback extraction.
- `src/storage/`: IndexedDB schema, repositories, migrations, and key storage.
- `src/search/`: tokenization, BM25 indexing, ranking, and snippets.
- `src/ai/`: OpenAI-compatible client and RAG prompt assembly.
- `src/security/`: API-key encryption and decryption.
- `src/messaging/`: typed messages between UI, content script, and background.
- `src/shared/`: shared types, constants, URL rules, and utilities.
- `src/ui/`: shared visual primitives and design tokens.

Business logic remains framework-independent so it can be unit tested without
Chrome or React.

## 5. Data Model

### `pages`

```ts
interface PageRecord {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  domain: string;
  content: string;
  contentHash: string;
  durationSeconds: number;
  visitDate: string;
  createdAt: number;
  updatedAt: number;
}
```

Indexes:

- `normalizedUrl`
- `visitDate`
- `domain`
- `updatedAt`

### `bm25_terms`

```ts
interface Bm25TermRecord {
  term: string;
  documentFrequency: number;
  postings: Array<{ pageId: string; termFrequency: number }>;
}
```

### `bm25_documents`

```ts
interface Bm25DocumentRecord {
  pageId: string;
  length: number;
}
```

### `settings`

```ts
interface AppSettings {
  chatBaseUrl: string;
  encryptedApiKey?: EncryptedSecret;
  chatModel: string;
  minimumReadSeconds: number;
  blacklistPatterns: string[];
}
```

### `crypto_keys`

Contains a non-exportable AES-GCM `CryptoKey`, keyed by a fixed application
identifier. The encrypted API key remains in extension-local settings.

## 6. Capture Flow

1. Background listeners observe tab activation, URL changes, window focus, and
   tab closure.
2. The current session is persisted to `chrome.storage.session` after every
   transition.
3. A one-minute `chrome.alarms` heartbeat reconciles the active session after
   service-worker suspension.
4. Content script reports initial load and SPA navigation changes.
5. The capture policy rejects unsupported schemes, incognito contexts, blocked
   domains, and sessions below the configured threshold.
6. Content is extracted through Readability. On failure, only title and URL are
   stored.
7. A visit within ten minutes of the last record for the normalized URL updates
   duration and content instead of creating a new record.
8. The page transaction updates the page record and its BM25 postings together.

Restricted browser pages and pages where content scripts cannot run are ignored
without surfacing noisy errors to the user.

## 7. Search and RAG

### Tokenization

- Normalize Unicode and lowercase Latin text.
- Segment Chinese with `Intl.Segmenter`.
- Split Latin text on punctuation and whitespace.
- Remove a small built-in English and Chinese stop-word set.
- Keep tokens of useful single Chinese characters; discard empty tokens.

### BM25

- Use BM25 parameters `k1 = 1.2` and `b = 0.75`.
- Index title with a weight of 2 and body content with a weight of 1.
- Return the top 20 ranked pages internally.
- Display the top 10 results in search.
- Build snippets around the first dense query-token match.

### Single-Turn RAG

1. Search BM25 with the user's question.
2. Select the top five results.
3. Build a context block from title, URL, date, duration, and bounded content
   excerpts.
4. Keep context under an estimated 3,000 tokens.
5. Put the fixed system prompt first for provider-side prefix caching.
6. Request a concise answer that cites sources as `[1]`, `[2]`, and so on.
7. Convert citations to safe clickable links using the retrieved source map.

The client calls `POST /v1/chat/completions` and handles both normal JSON and
SSE responses. Requests use a bounded timeout and never log the API key or raw
page context.

## 8. Error Handling and Privacy

- Network and provider failures preserve the question and offer retry.
- `401` and `403` errors direct the user to API settings.
- `429` errors show a rate-limit message without automatic retry storms.
- Offline questions fall back to ranked local snippets.
- IndexedDB failures show a persistent local-storage error state.
- All external links open in a new browser tab.
- API calls send only the bounded excerpts selected for the current question.
- Content remains local unless the user explicitly asks a question.
- The extension requests only `tabs`, `activeTab`, `storage`, `alarms`, and
  `sidePanel`, plus the host access needed for capture and user-configured API
  calls.
- No `history`, `cookies`, or `webRequest` permission is requested.

## 9. Testing

### Unit Tests

- URL normalization and blacklist matching.
- Reading-session transitions and deduplication.
- English and Chinese tokenization.
- BM25 indexing, update, removal, ranking, and empty-query behavior.
- Snippet generation and highlighting.
- RAG context truncation and citation mapping.
- API error normalization.
- AES-GCM encryption round trip.

### Component Tests

- Memory and Conversation mode switching.
- Search debounce, loading, empty, and result states.
- Missing API key and offline fallbacks.
- Options validation and destructive-action confirmation.

### Integration Tests

- Content extraction message to persisted page.
- Page update and BM25 index transaction.
- Search request through background messaging.
- RAG request with mocked OpenAI-compatible transport.
- Service-worker session restoration after simulated suspension.

### Browser Verification

- Load the unpacked extension in Chrome.
- Visit a readable page for more than five seconds.
- Confirm one stored page and correct accumulated duration.
- Search Chinese and English terms from the side panel.
- Ask one configured API question and open a cited source.
- Disable the network and confirm local-search fallback.
- Verify layout at 320px, 400px, and 480px widths in light and dark modes.

## 10. Acceptance Criteria

Phase 1 is accepted when:

- The extension builds and loads as an unpacked Chrome MV3 extension.
- Eligible pages are captured after the minimum reading time.
- Same-URL revisits inside ten minutes accumulate duration.
- Captured pages survive browser and service-worker restarts.
- BM25 returns relevant Chinese and English results without network access.
- A configured OpenAI-compatible endpoint can answer one question using local
  sources and expose working source links.
- Missing API configuration and offline operation degrade clearly.
- API keys are not stored in plaintext.
- The approved compact visual direction is recognizable and usable across the
  specified side-panel widths.
- Automated tests, type checking, linting, and production build pass.

