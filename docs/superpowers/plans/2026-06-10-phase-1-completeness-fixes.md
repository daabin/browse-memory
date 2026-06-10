# BrowseMemory Phase 1 Completeness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the remaining Phase 1 privacy, date, retention, interaction, and quality-gate defects while preserving the existing Chrome MV3 architecture.

**Architecture:** Add small pure helpers for local calendar dates and private domain icons, then consume them from storage and UI code. Keep RAG and retention changes inside their existing service/repository boundaries, with behavior locked by focused regression tests.

**Tech Stack:** WXT, React 18, TypeScript, Dexie, Vitest, Testing Library, ESLint.

---

## File Map

- Create `src/shared/local-date.ts`: local calendar-date formatting.
- Create `src/ui/DomainIcon.tsx`: deterministic local domain icon.
- Modify `src/storage/page-repository.ts`: local dates and metadata-preserving cleanup.
- Modify `src/ai/context.ts`: snippet-only RAG context.
- Modify `entrypoints/sidepanel/App.tsx`: local dates, private icons, search shortcut.
- Modify `src/ui/MarkdownContent.tsx`, `entrypoints/options/App.tsx`,
  `src/i18n/index.tsx`: lint cleanup.
- Modify focused tests under `tests/shared`, `tests/storage`, `tests/ai`, and
  `tests/sidepanel`.

### Task 1: Local Calendar Dates

**Files:**
- Create: `src/shared/local-date.ts`
- Create: `tests/shared/local-date.test.ts`
- Modify: `src/storage/page-repository.ts`
- Modify: `entrypoints/sidepanel/App.tsx`

- [ ] Write a failing test that formats a `Date` from local year, month, and
  day methods and proves no UTC ISO conversion is used.
- [ ] Run `pnpm vitest run tests/shared/local-date.test.ts` and verify RED.
- [ ] Implement `toLocalDateKey(date: Date): string` returning `YYYY-MM-DD`.
- [ ] Replace visit-date, today-snapshot, and side-panel today/yesterday ISO
  conversions with the helper.
- [ ] Run the focused test and existing page/side-panel tests; verify GREEN.

### Task 2: Data-Minimized RAG Context

**Files:**
- Modify: `tests/ai/context.test.ts`
- Modify: `src/ai/context.ts`

- [ ] Add a failing test whose page body contains a secret absent from the
  search snippet.
- [ ] Verify the generated context currently leaks the secret.
- [ ] Build each context block from `result.snippet`, title, URL, date, and
  duration while retaining the existing source and total-size limits.
- [ ] Run `pnpm vitest run tests/ai/context.test.ts tests/ai/rag-service.test.ts`.

### Task 3: Metadata-Preserving Retention

**Files:**
- Modify: `tests/storage/page-repository.test.ts`
- Modify: `src/storage/page-repository.ts`

- [ ] Change retention tests to require the expired page to remain with empty
  content while its BM25 document and unique term postings are removed.
- [ ] Run the repository test and verify RED against the current full-delete
  behavior.
- [ ] Update expired records in place with `content: ""` and a new content
  hash, then remove only their search-index records.
- [ ] Ensure already-cleared pages are skipped so repeated cleanup returns
  zero.
- [ ] Run storage and application tests; verify GREEN.

### Task 4: Private Domain Icons

**Files:**
- Create: `src/ui/DomainIcon.tsx`
- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `tests/sidepanel/App.test.tsx`

- [ ] Add a failing side-panel assertion that no image references
  `google.com/s2/favicons`.
- [ ] Implement a local circular monogram using a stable domain hash for its
  background hue.
- [ ] Replace the external favicon image and fallback globe with `DomainIcon`.
- [ ] Run the side-panel tests; verify GREEN.

### Task 5: Search Shortcut

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `tests/sidepanel/App.test.tsx`

- [ ] Add failing tests for both `Meta+K` and `Ctrl+K` focusing and selecting
  the search input.
- [ ] Add an input ref and a window `keydown` listener with cleanup and
  `preventDefault`.
- [ ] Run the side-panel tests; verify GREEN.

### Task 6: Clean Quality Gate

**Files:**
- Modify: `entrypoints/options/App.tsx`
- Modify: `src/ui/MarkdownContent.tsx`
- Modify: `src/i18n/index.tsx`

- [ ] Remove unused imports from the options app.
- [ ] Replace unnecessary regex character-class escapes.
- [ ] Add a file-level Fast Refresh rule exception to the mixed i18n provider
  module.
- [ ] Run `pnpm lint` and require zero errors and warnings.

### Task 7: Full Verification

**Files:**
- Modify documentation only if behavior text is stale.

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build` and verify total size remains below 500 KB.
- [ ] Run `git diff --check`.
- [ ] Preview the side panel at 320px and 420px, verify no horizontal overflow,
  private icons render, and the search shortcut focuses the field.
- [ ] Commit all implementation changes to `main`.
