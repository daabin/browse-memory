# BrowseMemory Phase 1 Completeness Fixes Design

## Goal

Close the gaps found in the Phase 1 audit without changing the product's
existing architecture or expanding into Phase 2 features.

## Scope

### Private favicon rendering

The side panel must not contact a third-party favicon service with browsing
domains. Domain rows will use a deterministic local icon derived from the
domain name. No browser history data leaves the extension merely by opening
the side panel.

### Data-minimized RAG context

RAG requests will use the bounded search snippet already produced locally,
plus title, URL, date, and reading duration. They will not include arbitrary
leading sections of the stored page body. At most five sources and 12,000
characters remain allowed.

### Local calendar dates

Visit dates, today's snapshot, and side-panel day labels will use the user's
local calendar date instead of UTC ISO dates. A shared helper will make the
behavior explicit and testable around timezone boundaries.

### Search shortcut

`Meta+K` on macOS and `Ctrl+K` elsewhere will focus and select the side-panel
search input. The handler will prevent the browser's default action and will
be removed when the component unmounts.

### Retention behavior

Records older than the configured retention period keep metadata: URL, title,
domain, reading duration, and dates. Their `content` is cleared and the page's
BM25 document and term postings are removed, so expired body text is no longer
searchable. Running cleanup repeatedly is idempotent.

### Quality gate

All ESLint errors will be fixed. React Fast Refresh warnings from the mixed
i18n module will be removed by disabling that development-only rule for the
provider module, keeping runtime behavior unchanged.

## Testing

- Unit tests cover local-date formatting at a UTC/local-day boundary.
- RAG context tests prove snippets are sent and hidden body text is excluded.
- Retention tests prove metadata remains while content and index entries are
  removed.
- Side-panel tests cover `Meta+K`, `Ctrl+K`, and local favicon rendering.
- Existing tests, TypeScript, ESLint, production build, and 320/420px browser
  previews must pass.

## Out Of Scope

Tailwind/shadcn migration, `webNavigation`, Embedding, reports, Firefox, and
cloud sync remain outside this repair because the existing implementation
already satisfies the Phase 1 behavioral boundary without those substitutions.
