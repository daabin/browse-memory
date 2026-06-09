import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  Globe2,
  LoaderCircle,
  MessageCircle,
  Search,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ChatMessageRecord,
  ChatSessionRecord,
  DomainGroup,
  RagAnswer,
  RagSource,
  SearchResult,
  TodaySnapshot,
} from "../../src/shared/types";
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

const SUGGESTIONS = [
  "我今天研究了哪些主题？",
  "最近看过哪些 RAG 方案？",
  "总结我浏览过的关键观点",
];

type ChatView = "list" | "detail" | "new";

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr === today) return "今天";
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dateStr === yesterday) return "昨天";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
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
  const [mode, setMode] = useState<PanelMode>("memory");
  const [snapshot, setSnapshot] = useState<TodaySnapshot>();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [query, setQuery] = useState("");
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
  const [answer, setAnswer] = useState<RagAnswer>();
  const [showSettings, setShowSettings] = useState(false);

  // Initial load
  useEffect(() => {
    void Promise.all([
      client.getSnapshot(),
      client.getSettings(),
      client.getDistinctDates(),
    ])
      .then(([nextSnapshot, settings, dates]) => {
        setSnapshot(nextSnapshot);
        setHasApiKey(settings.hasApiKey);
        setAllDates(dates);
        // Load first day
        if (dates.length > 0) {
          void client.getRecordsByDate(dates[0]).then((results) => {
            setLoadedDates([dates[0]]);
            setDateRecords(new Map([[dates[0], results]]));
          });
        }
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "加载数据失败。");
      });
  }, [client]);

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
          setError(searchError instanceof Error ? searchError.message : "搜索失败。");
        })
        .finally(() => setBusy(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [client, query]);

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
    setQuestion(trimmed);
    setMode("conversation");
    setBusy(true);
    setError("");
    try {
      const ragAnswer = await client.ask(trimmed);
      setAnswer(ragAnswer);

      // Persist session
      if (!currentSession) {
        const session = await client.createChatSession(trimmed);
        setCurrentSession(session);
        await client.addChatMessage(session.id, { role: "user", content: trimmed });
        await client.addChatMessage(session.id, {
          role: "assistant",
          content: ragAnswer.text,
          sources: ragAnswer.sources,
          offline: ragAnswer.offline,
        });
        setChatMessages([
          { id: "tmp-u", sessionId: session.id, role: "user", content: trimmed, createdAt: Date.now() },
          { id: "tmp-a", sessionId: session.id, role: "assistant", content: ragAnswer.text, sources: ragAnswer.sources, offline: ragAnswer.offline, createdAt: Date.now() + 1 },
        ]);
        setChatView("detail");
      } else {
        await client.addChatMessage(currentSession.id, { role: "user", content: trimmed });
        await client.addChatMessage(currentSession.id, {
          role: "assistant",
          content: ragAnswer.text,
          sources: ragAnswer.sources,
          offline: ragAnswer.offline,
        });
        setChatMessages((prev) => [
          ...prev,
          { id: "tmp-u2", sessionId: currentSession.id, role: "user", content: trimmed, createdAt: Date.now() },
          { id: "tmp-a2", sessionId: currentSession.id, role: "assistant", content: ragAnswer.text, sources: ragAnswer.sources, offline: ragAnswer.offline, createdAt: Date.now() + 1 },
        ]);
      }
      // Clear input on success
      setQuestion("");
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "问答失败。");
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
      setError("无法加载会话详情。");
    }
  };

  const startNewChat = () => {
    setCurrentSession(null);
    setChatMessages([]);
    setAnswer(undefined);
    setQuestion("");
    setChatView("new");
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
            <i className="status-dot" /> 今天
          </span>
        </div>
        <button
          className="icon-button"
          aria-label="打开设置"
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
              <Metric icon={<Eye size={16} />} label="浏览" value={snapshot ? String(snapshot.pageCount) : "—"} suffix="页" />
              <Metric icon={<Clock3 size={16} />} label="阅读时长" value={snapshot ? `${snapshot.readingMinutes} 分钟` : "—"} />
              <Metric icon={<Sparkles size={16} />} label="深度阅读" value={snapshot ? String(snapshot.deepReadCount) : "—"} suffix="页" />
              <Metric icon={<Globe2 size={16} />} label="最常访问" value={snapshot?.topDomain ?? "暂无"} compact />
            </GlassSurface>

            <div className="search-field">
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索浏览记录…"
                aria-label="搜索浏览记录"
              />
              {busy ? <LoaderCircle className="spin" size={17} /> : <kbd>⌘ K</kbd>}
            </div>

            <section className="memory-section">
              <div className="list-heading">
                <h2>{query ? "搜索结果" : "最近记录"}</h2>
                <span>
                  {searchResults
                    ? `${searchResults.length} 条`
                    : allDates.length > 0
                      ? `${loadedDates.length} / ${allDates.length} 天`
                      : ""}
                </span>
              </div>
              {query.trim() ? (
                <SearchResultList
                  results={searchResults ?? []}
                  expandedDomains={expandedDomains}
                  onToggleDomain={toggleDomain}
                  onOpen={client.openUrl}
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
                    <h1>对话记录</h1>
                    <p>基于本地 BM25 检索的问答历史</p>
                  </div>
                  <button className="send-button" aria-label="新建对话" onClick={startNewChat} type="button">
                    <Send size={17} />
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div className="empty-state">
                    <MessageCircle size={20} />
                    <p>还没有对话记录，切换到记录页开始提问。</p>
                  </div>
                ) : (
                  <GlassSurface className="result-list session-list">
                    {sessions.map((session) => (
                      <button
                        className="result-row session-row"
                        type="button"
                        key={session.id}
                        onClick={() => void openSession(session)}
                      >
                        <MessageCircle size={16} style={{ flex: "0 0 auto", marginTop: 13, color: "var(--blue)" }} />
                        <span className="result-copy">
                          <strong>{session.title}</strong>
                          <small>{formatTime(session.updatedAt)}</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </GlassSurface>
                )}
              </>
            ) : (
              <>
                <div className="conversation-heading">
                  <button className="icon-button" aria-label="返回列表" onClick={() => { setChatView("list"); setCurrentSession(null); }} type="button">
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h1>{currentSession?.title ?? "新对话"}</h1>
                    <p>{currentSession ? formatTime(currentSession.createdAt) : "输入问题开始对话"}</p>
                  </div>
                </div>
                {chatMessages.length > 0 ? (
                  <div className="chat-history">
                    {chatMessages.map((msg) => (
                      <ChatBubble key={msg.id} message={msg} client={client} />
                    ))}
                  </div>
                ) : null}
                {answer && chatView === "new" ? <AnswerBlock answer={answer} client={client} /> : null}
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
                    placeholder="问问浏览记录…"
                    rows={3}
                  />
                  <div>
                    <span>
                      {!hasApiKey ? "可在设置中配置 AI 服务" : navigator.onLine ? "在线" : "离线"}
                    </span>
                    <button
                      type="button"
                      aria-label="发送问题"
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
      </main>

      {showSettings ? (
        <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="设置">
          <div className="settings-overlay-header">
            <h2>设置</h2>
            <button className="icon-button" aria-label="关闭设置" onClick={() => setShowSettings(false)} type="button">
              <X size={18} />
            </button>
          </div>
          <iframe
            className="settings-overlay-frame"
            src={chrome.runtime.getURL("options.html")}
            title="BrowseMemory 设置"
          />
        </div>
      ) : null}

      <footer>
        <div className="local-status">
          <i className="status-dot" />
          记录已安全存储在本地
        </div>
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
}: {
  loadedDates: string[];
  dateRecords: Map<string, SearchResult[]>;
  expandedDomains: Set<string>;
  onToggleDomain(domain: string): void;
  onOpen(url: string): void;
  hasMore: boolean;
  sentinelRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  if (loadedDates.length === 0) {
    return (
      <div className="empty-state">
        <Search size={20} />
        <p>浏览几篇网页后，最近记录会出现在这里。</p>
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
              <span>{formatDateLabel(date)}</span>
              <small>{results.length} 条</small>
            </div>
            <GlassSurface className="result-list domain-group-list">
              {groups.map((group) => (
                <DomainGroupItem
                  key={group.domain}
                  group={group}
                  expanded={expandedDomains.has(group.domain)}
                  onToggle={() => onToggleDomain(group.domain)}
                  onOpen={onOpen}
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
}: {
  results: SearchResult[];
  expandedDomains: Set<string>;
  onToggleDomain(domain: string): void;
  onOpen(url: string): void;
}) {
  const groups = useMemo(() => groupByDomain(results), [results]);
  if (results.length === 0) {
    return <div className="empty-state"><p>没有找到相关浏览记录。</p></div>;
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
        />
      ))}
    </GlassSurface>
  );
}

function DomainGroupItem({ group, expanded, onToggle, onOpen }: { group: DomainGroup; expanded: boolean; onToggle(): void; onOpen(url: string): void }) {
  return (
    <div className="domain-group">
      <button className="domain-header" type="button" onClick={onToggle}>
        <span className="domain-icon">
          <img
            src={`https://www.google.com/s2/favicons?domain=${group.domain}&sz=32`}
            alt="" width={17} height={17}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style"); }}
            onLoad={(e) => { (e.target as HTMLImageElement).nextElementSibling?.setAttribute("style", "display:none"); }}
          />
          <Globe2 size={17} />
        </span>
        <span className="domain-header-copy">
          <strong>{group.domain}</strong>
          <small>{group.pages.length} 页 · {Math.max(1, Math.round(group.totalDurationSeconds / 60))} 分钟</small>
        </span>
        <ChevronDown size={16} className={`domain-chevron${expanded ? " expanded" : ""}`} />
      </button>
      {expanded ? (
        <div className="domain-children">
          {group.pages.map((result) => (
            <PageRow key={result.page.id} result={result} onOpen={onOpen} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PageRow({ result, onOpen }: { result: SearchResult; onOpen(url: string): void }) {
  return (
    <button className="result-row" type="button" onClick={() => onOpen(result.page.url)}>
      <span className="page-dot" />
      <span className="result-copy">
        <strong>{result.page.title}</strong>
        <small>{Math.max(1, Math.round(result.page.durationSeconds / 60))} 分钟</small>
        <span>{result.snippet}</span>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}

function ChatBubble({ message, client }: { message: ChatMessageRecord; client: SidePanelClient }) {
  const isUser = message.role === "user";
  return (
    <div className={`chat-bubble ${isUser ? "user" : "assistant"}`}>
      {isUser ? (
        <p className="chat-text">{message.content}</p>
      ) : (
        <AnswerInline text={message.content} sources={message.sources ?? []} offline={message.offline ?? false} client={client} />
      )}
    </div>
  );
}

function AnswerInline({ text, sources, offline, client }: { text: string; sources: RagSource[]; offline: boolean; client: SidePanelClient }) {
  const sourceMap = new Map(sources.map((s) => [s.index, s.url]));
  const handleCitation = (index: number) => {
    const url = sourceMap.get(index);
    if (url) client.openUrl(url);
  };
  return (
    <div className="answer-block">
      {offline ? <span className="offline-label">离线模式</span> : null}
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

function AnswerBlock({ answer, client }: { answer: RagAnswer; client: SidePanelClient }) {
  return <AnswerInline text={answer.text} sources={answer.sources} offline={answer.offline} client={client} />;
}