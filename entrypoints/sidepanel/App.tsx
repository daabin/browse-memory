import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  Globe2,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useT } from "../../src/i18n";
import { toLocalDateKey } from "../../src/shared/local-date";
import type {
  ChatMessageRecord,
  ChatSessionRecord,
  DomainGroup,
  RagSource,
  SearchResult,
  TodaySnapshot,
} from "../../src/shared/types";
import { DomainIcon } from "../../src/ui/DomainIcon";
import { GlassSurface } from "../../src/ui/GlassSurface";
import {
  ModeSwitch,
  type PanelMode,
} from "../../src/ui/ModeSwitch";
import {
  runtimeClient,
  type SidePanelClient,
} from "../../src/ui/runtime-client";
import { MarkdownContent } from "../../src/ui/MarkdownContent";

type ChatView = "list" | "detail" | "new";

function formatDateLabel(dateStr: string, t: ReturnType<typeof useT>): string {
  const today = toLocalDateKey();
  if (dateStr === today) return t("header.today");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === toLocalDateKey(yesterday)) {
    // Use a locale-aware "yesterday" or just show date
    const y = new Date(dateStr + "T00:00:00");
    return `${y.getMonth() + 1}/${y.getDate()}`;
  }
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function App({
  client = runtimeClient,
}: {
  client?: SidePanelClient;
}) {
  const t = useT();
  const [mode, setMode] = useState<PanelMode>("memory");
  const [snapshot, setSnapshot] = useState<TodaySnapshot>();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Day-based lazy loading
  const [allDates, setAllDates] = useState<string[]>([]);
  const [loadedDates, setLoadedDates] = useState<string[]>([]);
  const [dateRecords, setDateRecords] = useState<Map<string, SearchResult[]>>(new Map());
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Domain expansion
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  // Chat state
  const [chatView, setChatView] = useState<ChatView>("list");
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSessionRecord | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageRecord[]>([]);
  const [question, setQuestion] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dashboardFrameRef = useRef<HTMLIFrameElement>(null);

  // Dashboard postMessage bridge: proxy iframe requests through runtimeClient
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.__bm !== "dashboard-request") return;

      // Fire-and-forget (openUrl, openOptions)
      if (data.method === "openUrl") {
        client.openUrl(data.args[0] as string);
        return;
      }
      if (data.method === "openOptions") {
        setShowDashboard(false);
        setShowSettings(true);
        return;
      }

      const frame = dashboardFrameRef.current;
      if (!frame?.contentWindow) return;

      try {
        let result: unknown;
        switch (data.method) {
          case "getReports":
            result = await client.getReports(data.args[0] as import("../../src/shared/types").ReportType | undefined);
            break;
          case "getReport":
            result = await client.getReport(data.args[0] as string);
            break;
          case "generateReport":
            result = await client.generateReport(
              data.args[0] as import("../../src/shared/types").ReportType,
              data.args[1] as string | undefined,
              data.args[2] as string | undefined,
            );
            break;
          default:
            throw new Error(`Unknown dashboard method: ${data.method}`);
        }
        frame.contentWindow.postMessage(
          { __bm: "dashboard-response", id: data.id, ok: true, data: result },
          "*",
        );
      } catch (err) {
        frame.contentWindow.postMessage(
          {
            __bm: "dashboard-response",
            id: data.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            errorCode: (err as { code?: string }).code,
          },
          "*",
        );
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [client]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey) ||
        event.altKey
      ) {
        return;
      }
      const input = searchInputRef.current;
      if (!input) {
        return;
      }
      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  // Reload data helper
  const reloadData = useCallback(() => {
    void Promise.all([
      client.getSnapshot(),
      client.getSettings(),
      client.getDistinctDates(),
    ])
      .then(([nextSnapshot, settingsResult, dates]) => {
        setSnapshot(nextSnapshot);
        setHasApiKey(settingsResult.hasApiKey);
        setAllDates(dates);
        if (dates.length > 0) {
          void client.getRecordsByDate(dates[0]).then((results) => {
            setLoadedDates([dates[0]]);
            setDateRecords(new Map([[dates[0], results]]));
          });
        }
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : t("sidepanel.loadFailed"));
      });
  }, [client, t]);

  // Initial load
  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Listen for DATA_CHANGED from background (new capture stored)
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return;
    }
    const listener = (message: { type?: string }) => {
      if (message?.type === "DATA_CHANGED") {
        reloadData();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [reloadData]);

  // Load chat sessions when switching to conversation mode
  useEffect(() => {
    if (mode === "conversation" && chatView === "list") {
      void client.listChatSessions().then(setSessions).catch(() => {});
    }
  }, [client, mode, chatView]);

  // Load more days on scroll
  const loadNextDay = useCallback(() => {
    if (loadedDates.length >= allDates.length) return;
    const nextDate = allDates[loadedDates.length];
    void client.getRecordsByDate(nextDate).then((results) => {
      setLoadedDates((prev) => [...prev, nextDate]);
      setDateRecords((prev) => {
        const next = new Map(prev);
        next.set(nextDate, results);
        return next;
      });
    });
  }, [client, allDates, loadedDates]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || query.trim()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextDay();
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextDay, query]);

  // Search debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError("");
      void client
        .search(trimmed)
        .then(setSearchResults)
        .catch((searchError: unknown) => {
          setError(searchError instanceof Error ? searchError.message : t("sidepanel.searchFailed"));
        })
        .finally(() => setBusy(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [client, query, t]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const ask = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setMode("conversation");
    setBusy(true);
    setError("");
    setQuestion("");

    // Optimistic user message
    const optimisticUserMsg: ChatMessageRecord = {
      id: `opt-u-${Date.now()}`,
      sessionId: currentSession?.id ?? "",
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    setChatMessages((prev) => [...prev, optimisticUserMsg]);
    if (chatView === "new") setChatView("detail");

    try {
      // Create session on first message
      let sessionId = currentSession?.id;
      if (!sessionId) {
        const session = await client.createChatSession(trimmed);
        setCurrentSession(session);
        sessionId = session.id;
        optimisticUserMsg.sessionId = sessionId;
      }

      // Get AI answer with conversation history context
      const ragAnswer = await client.ask(trimmed, sessionId);

      // Persist user message + assistant message
      await client.addChatMessage(sessionId, { role: "user", content: trimmed });
      const assistantMsg = await client.addChatMessage(sessionId, {
        role: "assistant",
        content: ragAnswer.text,
        sources: ragAnswer.sources,
        offline: ragAnswer.offline,
        missingApiKey: ragAnswer.missingApiKey,
      });

      // Replace optimistic user msg + append real assistant msg
      setChatMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticUserMsg.id);
        return [
          ...withoutOptimistic,
          { ...optimisticUserMsg, id: crypto.randomUUID() },
          assistantMsg,
        ];
      });
    } catch (askError) {
      // Remove optimistic message on failure
      setChatMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      setError(askError instanceof Error ? askError.message : t("sidepanel.askFailed"));
    } finally {
      setBusy(false);
    }
  };

  const openSession = async (session: ChatSessionRecord) => {
    try {
      const { session: s, messages } = await client.getChatSession(session.id);
      setCurrentSession(s);
      setChatMessages(messages);
      setChatView("detail");
    } catch {
      setError(t("sidepanel.sessionLoadFailed"));
    }
  };

  const startNewChat = () => {
    setCurrentSession(null);
    setChatMessages([]);
    setQuestion("");
    setChatView("new");
  };

  const deleteSession = async (session: ChatSessionRecord, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await client.deleteChatSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      // If deleting the current open session, go back to list
      if (currentSession?.id === session.id) {
        setCurrentSession(null);
        setChatMessages([]);
        setChatView("list");
      }
    } catch {
      setError(t("sidepanel.deleteFailed"));
    }
  };

  return (
    <div className="app-shell">
      <header className="utility-header">
        <div aria-hidden="true">
          <img src="/icon128.png" alt="" width={30} height={30} style={{ borderRadius: 4 }} />
        </div>
        <div className="brand-copy">
          <strong>BrowseMemory</strong>
          <span>
            <i className="status-dot" /> {t("header.today")}
          </span>
        </div>
        <button
          className="icon-button"
          aria-label={t("sidepanel.refresh")}
          onClick={reloadData}
          type="button"
        >
          <RefreshCw size={17} />
        </button>
        <button
          className="icon-button"
          aria-label={t("sidepanel.openSettings")}
          onClick={() => setShowSettings(true)}
          type="button"
        >
          <Settings size={19} />
        </button>
      </header>

      <main>
        {mode === "memory" ? (
          <>
            <GlassSurface className="snapshot-grid">
              <Metric icon={<Eye size={16} />} label={t("sidepanel.browse")} value={snapshot ? String(snapshot.pageCount) : "—"} suffix={t("sidepanel.pages")} />
              <Metric icon={<Clock3 size={16} />} label={t("sidepanel.readingTime")} value={snapshot ? t("sidepanel.minutes", { n: snapshot.readingMinutes }) : "—"} />
              <Metric icon={<Sparkles size={16} />} label={t("sidepanel.deepReading")} value={snapshot ? String(snapshot.deepReadCount) : "—"} suffix={t("sidepanel.pages")} />
              <Metric icon={<Globe2 size={16} />} label={t("sidepanel.topDomain")} value={snapshot?.topDomain ?? t("sidepanel.noData")} compact />
            </GlassSurface>

            <button
              className="view-reports-button"
              type="button"
              onClick={() => setShowDashboard(true)}
            >
              <BarChart3 size={15} />
              {t("sidepanel.viewReports")}
            </button>

            <div className="search-field">
              <Search size={19} />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("sidepanel.searchPlaceholder")}
                aria-label={t("sidepanel.searchLabel")}
              />
              {busy ? <LoaderCircle className="spin" size={17} /> : <kbd>⌘ K</kbd>}
            </div>

            <section className="memory-section">
              <div className="list-heading">
                <h2>{query ? t("sidepanel.searchResults") : t("sidepanel.recentRecords")}</h2>
                <span>
                  {searchResults
                    ? t("sidepanel.resultCount", { n: searchResults.length })
                    : allDates.length > 0
                      ? t("sidepanel.dayProgress", { loaded: loadedDates.length, total: allDates.length })
                      : ""}
                </span>
              </div>
              {query.trim() ? (
                <SearchResultList
                  results={searchResults ?? []}
                  expandedDomains={expandedDomains}
                  onToggleDomain={toggleDomain}
                  onOpen={client.openUrl}
                  t={t}
                />
              ) : (
                <DayGroupedList
                  loadedDates={loadedDates}
                  dateRecords={dateRecords}
                  expandedDomains={expandedDomains}
                  onToggleDomain={toggleDomain}
                  onOpen={client.openUrl}
                  hasMore={loadedDates.length < allDates.length}
                  sentinelRef={sentinelRef}
                  t={t}
                />
              )}
            </section>
          </>
        ) : (
          <section className="conversation-view">
            {chatView === "list" ? (
              <>
                <div className="conversation-heading">
                  <span className="sparkle-icon"><Sparkles size={18} /></span>
                  <div>
                    <h1>{t("sidepanel.chatHistory")}</h1>
                    <p>{t("sidepanel.chatHistoryDesc")}</p>
                  </div>
                  <button className="new-chat-button" aria-label={t("sidepanel.newChat")} onClick={startNewChat} type="button">
                    <Send size={17} />
                    {t("sidepanel.newChat")}
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div className="empty-state">
                    <MessageCircle size={20} />
                    <p>{t("sidepanel.noChats")}</p>
                  </div>
                ) : (
                  <GlassSurface className="result-list session-list">
                    {sessions.map((session) => (
                      <div
                        className="result-row session-row"
                        key={session.id}
                      >
                        <button
                          className="session-open-button"
                          type="button"
                          onClick={() => void openSession(session)}
                        >
                          <MessageCircle size={16} />
                          <span className="result-copy">
                            <strong>{session.title}</strong>
                            <small>{formatTime(session.updatedAt)}</small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                        <button
                          className="icon-button delete-session-btn"
                          type="button"
                          aria-label={t("sidepanel.deleteChat")}
                          onClick={(e) => void deleteSession(session, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </GlassSurface>
                )}
              </>
            ) : (
              <>
                <div className="conversation-heading">
                  <button className="icon-button" aria-label={t("sidepanel.backToList")} onClick={() => { setChatView("list"); setCurrentSession(null); }} type="button">
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h1>{currentSession?.title ?? t("sidepanel.newChat")}</h1>
                    <p>{currentSession ? formatTime(currentSession.createdAt) : t("sidepanel.startChat")}</p>
                  </div>
                </div>
                {chatMessages.length > 0 ? (
                  <div className="chat-history">
                    {chatMessages.map((msg) => (
                      <ChatBubble key={msg.id} message={msg} client={client} onOpenSettings={() => setShowSettings(true)} />
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                ) : null}
                <GlassSurface className="composer">
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (!busy && question.trim()) void ask();
                      }
                    }}
                    placeholder={t("sidepanel.inputPlaceholder")}
                    rows={3}
                  />
                  <div>
                    <span>
                      {!hasApiKey ? t("sidepanel.configureAi") : navigator.onLine ? t("sidepanel.online") : t("sidepanel.offline")}
                    </span>
                    <button
                      type="button"
                      aria-label={t("sidepanel.sendQuestion")}
                      disabled={busy || !question.trim()}
                      onClick={() => void ask()}
                    >
                      {busy ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
                    </button>
                  </div>
                </GlassSurface>
              </>
            )}
          </section>
        )}

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="local-status">
          <i className="status-dot" />
          {t("sidepanel.footer")}
        </div>
      </main>

      {showSettings ? (
        <div className="settings-overlay" role="dialog" aria-modal="true" aria-label={t("settings.title")}>
          <div className="settings-overlay-header">
            <h2>{t("settings.title")}</h2>
            <button className="icon-button" aria-label={t("sidepanel.closeSettings")} onClick={() => setShowSettings(false)} type="button">
              <X size={18} />
            </button>
          </div>
          <iframe
            className="settings-overlay-frame"
            src={chrome.runtime.getURL("options.html")}
            title={t("sidepanel.settingsTitle")}
          />
        </div>
      ) : null}

      {showDashboard ? (
        <div className="settings-overlay" role="dialog" aria-modal="true" aria-label={t("dashboard.title")}>
          <div className="settings-overlay-header">
            <h2>{t("dashboard.title")}</h2>
            <button className="icon-button" aria-label={t("common.close")} onClick={() => setShowDashboard(false)} type="button">
              <X size={18} />
            </button>
          </div>
          <iframe
            ref={dashboardFrameRef}
            className="settings-overlay-frame"
            src={chrome.runtime.getURL("dashboard.html")}
            title={t("dashboard.title")}
          />
        </div>
      ) : null}

      <footer>
        <ModeSwitch mode={mode} onChange={setMode} />
      </footer>
    </div>
  );
}

function Metric({ icon, label, value, suffix, compact = false }: { icon: React.ReactNode; label: string; value: string; suffix?: string; compact?: boolean }) {
  return (
    <div className="metric">
      <span>{icon} {label}</span>
      <strong className={compact ? "compact" : ""}>{value} {suffix ? <small>{suffix}</small> : null}</strong>
    </div>
  );
}

function groupByDomain(results: SearchResult[]): DomainGroup[] {
  const map = new Map<string, SearchResult[]>();
  for (const result of results) {
    const pages = map.get(result.page.domain) ?? [];
    pages.push(result);
    map.set(result.page.domain, pages);
  }
  return [...map.entries()].map(([domain, pages]) => ({
    domain,
    pages,
    totalDurationSeconds: pages.reduce((t, r) => t + r.page.durationSeconds, 0),
  }));
}

function DayGroupedList({
  loadedDates,
  dateRecords,
  expandedDomains,
  onToggleDomain,
  onOpen,
  hasMore,
  sentinelRef,
  t,
}: {
  loadedDates: string[];
  dateRecords: Map<string, SearchResult[]>;
  expandedDomains: Set<string>;
  onToggleDomain(domain: string): void;
  onOpen(url: string): void;
  hasMore: boolean;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
  t: ReturnType<typeof useT>;
}) {
  if (loadedDates.length === 0) {
    return (
      <div className="empty-state">
        <Search size={20} />
        <p>{t("sidepanel.emptyRecords")}</p>
      </div>
    );
  }
  return (
    <>
      {loadedDates.map((date) => {
        const results = dateRecords.get(date) ?? [];
        if (results.length === 0) return null;
        const groups = groupByDomain(results);
        return (
          <div className="date-section" key={date}>
            <div className="date-header">
              <span>{formatDateLabel(date, t)}</span>
              <small>{t("sidepanel.resultCount", { n: results.length })}</small>
            </div>
            <GlassSurface className="result-list domain-group-list">
              {groups.map((group) => (
                <DomainGroupItem
                  key={group.domain}
                  group={group}
                  expanded={expandedDomains.has(group.domain)}
                  onToggle={() => onToggleDomain(group.domain)}
                  onOpen={onOpen}
                  t={t}
                />
              ))}
            </GlassSurface>
          </div>
        );
      })}
      {hasMore ? (
        <div ref={sentinelRef} className="load-more-sentinel">
          <LoaderCircle className="spin" size={16} />
        </div>
      ) : null}
    </>
  );
}

function SearchResultList({
  results,
  expandedDomains,
  onToggleDomain,
  onOpen,
  t,
}: {
  results: SearchResult[];
  expandedDomains: Set<string>;
  onToggleDomain(domain: string): void;
  onOpen(url: string): void;
  t: ReturnType<typeof useT>;
}) {
  const groups = useMemo(() => groupByDomain(results), [results]);
  if (results.length === 0) {
    return <div className="empty-state"><p>{t("sidepanel.noResults")}</p></div>;
  }
  return (
    <GlassSurface className="result-list domain-group-list">
      {groups.map((group) => (
        <DomainGroupItem
          key={group.domain}
          group={group}
          expanded={expandedDomains.has(group.domain)}
          onToggle={() => onToggleDomain(group.domain)}
          onOpen={onOpen}
          t={t}
        />
      ))}
    </GlassSurface>
  );
}

function DomainGroupItem({ group, expanded, onToggle, onOpen, t }: { group: DomainGroup; expanded: boolean; onToggle(): void; onOpen(url: string): void; t: ReturnType<typeof useT> }) {
  return (
    <div className="domain-group">
      <button className="domain-header" type="button" onClick={onToggle}>
        <span className="domain-icon">
          <DomainIcon domain={group.domain} />
        </span>
        <span className="domain-header-copy">
          <strong>{group.domain}</strong>
          <small>{group.pages.length} {t("sidepanel.pages")} · {t("sidepanel.minutes", { n: Math.max(1, Math.round(group.totalDurationSeconds / 60)) })}</small>
        </span>
        <ChevronDown size={16} className={`domain-chevron${expanded ? " expanded" : ""}`} />
      </button>
      {expanded ? (
        <div className="domain-children">
          {group.pages.map((result) => (
            <PageRow key={result.page.id} result={result} onOpen={onOpen} t={t} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PageRow({ result, onOpen, t }: { result: SearchResult; onOpen(url: string): void; t: ReturnType<typeof useT> }) {
  return (
    <button className="result-row" type="button" onClick={() => onOpen(result.page.url)}>
      <span className="page-dot" />
      <span className="result-copy">
        <strong>{result.page.title}</strong>
        <small>{t("sidepanel.minutes", { n: Math.max(1, Math.round(result.page.durationSeconds / 60)) })}</small>
        <span>{result.snippet}</span>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}

function ChatBubble({ message, client, onOpenSettings }: { message: ChatMessageRecord; client: SidePanelClient; onOpenSettings: () => void }) {
  const t = useT();
  const isUser = message.role === "user";
  return (
    <div className={`chat-bubble ${isUser ? "user" : "assistant"}`}>
      {isUser ? (
        <p className="chat-text">{message.content}</p>
      ) : (
        <>
          {message.missingApiKey ? (
            <div className="api-key-warning">
              <span>{t("sidepanel.apiKeyMissingHint")}</span>
              <button className="go-settings-btn" type="button" onClick={onOpenSettings}>
                {t("common.goToSettings")}
              </button>
            </div>
          ) : null}
          <AnswerInline text={message.content} sources={message.sources ?? []} offline={message.offline ?? false} client={client} />
        </>
      )}
    </div>
  );
}

function AnswerInline({ text, sources, offline, client }: { text: string; sources: RagSource[]; offline: boolean; client: SidePanelClient }) {
  const t = useT();
  const sourceMap = new Map(sources.map((s) => [s.index, s.url]));
  const handleCitation = (index: number) => {
    const url = sourceMap.get(index);
    if (url) client.openUrl(url);
  };
  return (
    <div className="answer-block">
      {offline ? <span className="offline-label">{t("sidepanel.offlineMode")}</span> : null}
      <MarkdownContent text={text} onCitation={handleCitation} />
      {sources.length > 0 ? (
        <div className="sources">
          {sources.map((source) => (
            <button type="button" key={source.index} onClick={() => client.openUrl(source.url)}>
              {source.index} {source.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
