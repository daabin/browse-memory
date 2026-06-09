import {
  BrainCircuit,
  ChevronRight,
  Clock3,
  Eye,
  Globe2,
  LoaderCircle,
  Search,
  Send,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  RagAnswer,
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

const SUGGESTIONS = [
  "我今天研究了哪些主题？",
  "最近看过哪些 RAG 方案？",
  "总结我浏览过的关键观点",
];

export function App({
  client = runtimeClient,
}: {
  client?: SidePanelClient;
}) {
  const [mode, setMode] = useState<PanelMode>("memory");
  const [snapshot, setSnapshot] = useState<TodaySnapshot>();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RagAnswer>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([client.getSnapshot(), client.getSettings()])
      .then(([nextSnapshot, settings]) => {
        setSnapshot(nextSnapshot);
        setHasApiKey(settings.hasApiKey);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : "加载数据失败。",
        );
      });
  }, [client]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setBusy(true);
      setError("");
      void client
        .search(trimmed)
        .then(setResults)
        .catch((searchError: unknown) => {
          setError(
            searchError instanceof Error ? searchError.message : "搜索失败。",
          );
        })
        .finally(() => setBusy(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [client, query]);

  const ask = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    setQuestion(trimmed);
    setMode("conversation");
    setBusy(true);
    setError("");
    try {
      setAnswer(await client.ask(trimmed));
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "问答失败。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="utility-header">
        <div className="brand-mark" aria-hidden="true">
          <BrainCircuit size={19} />
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
          onClick={client.openOptions}
          type="button"
        >
          <Settings size={19} />
        </button>
      </header>

      <main>
        {mode === "memory" ? (
          <>
            <GlassSurface className="snapshot-grid">
              <Metric
                icon={<Eye size={16} />}
                label="浏览"
                value={snapshot ? String(snapshot.pageCount) : "—"}
                suffix="页"
              />
              <Metric
                icon={<Clock3 size={16} />}
                label="阅读时长"
                value={snapshot ? `${snapshot.readingMinutes} 分钟` : "—"}
              />
              <Metric
                icon={<Sparkles size={16} />}
                label="深度阅读"
                value={snapshot ? String(snapshot.deepReadCount) : "—"}
                suffix="页"
              />
              <Metric
                icon={<Globe2 size={16} />}
                label="最常访问"
                value={snapshot?.topDomain ?? "暂无"}
                compact
              />
            </GlassSurface>

            <div className="search-field">
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索浏览记忆…"
                aria-label="搜索浏览记忆"
              />
              {busy ? <LoaderCircle className="spin" size={17} /> : <kbd>⌘ K</kbd>}
            </div>

            <GlassSurface className="ask-card">
              <div className="section-heading">
                <span className="sparkle-icon">
                  <Sparkles size={17} />
                </span>
                <div>
                  <strong>问问今天的浏览记忆</strong>
                  <small>
                    {hasApiKey ? "使用本地记忆生成回答" : "未配置 API 时返回本地结果"}
                  </small>
                </div>
                <button
                  className="send-button"
                  aria-label="进入对话"
                  onClick={() => setMode("conversation")}
                  type="button"
                >
                  <Send size={17} />
                </button>
              </div>
              <div className="suggestion-row">
                {SUGGESTIONS.slice(0, 2).map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => void ask(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              {answer ? <Answer answer={answer} client={client} /> : null}
            </GlassSurface>

            <section className="memory-section">
              <div className="list-heading">
                <h2>{query ? "搜索结果" : "相关记忆"}</h2>
                <span>{results.length > 0 ? `${results.length} 条` : ""}</span>
              </div>
              <ResultList
                query={query}
                results={results}
                onOpen={client.openUrl}
              />
            </section>
          </>
        ) : (
          <section className="conversation-view">
            <div className="conversation-heading">
              <span className="sparkle-icon">
                <Sparkles size={18} />
              </span>
              <div>
                <h1>浏览记忆对话</h1>
                <p>基于本地 BM25 检索的单轮回答</p>
              </div>
            </div>
            <div className="suggestion-grid">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => void ask(suggestion)}
                >
                  {suggestion}
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
            {answer ? <Answer answer={answer} client={client} /> : null}
            <GlassSurface className="composer">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="问问你的浏览记忆…"
                rows={3}
              />
              <div>
                <span>
                  {!hasApiKey
                    ? "可在设置中配置 AI 服务"
                    : navigator.onLine
                      ? "在线"
                      : "离线"}
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
          </section>
        )}

        {error ? <div className="error-banner">{error}</div> : null}
      </main>

      <footer>
        <div className="local-status">
          <i className="status-dot" />
          记忆已安全存储在本地
        </div>
        <ModeSwitch mode={mode} onChange={setMode} />
      </footer>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  suffix,
  compact = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <div className="metric">
      <span>{icon} {label}</span>
      <strong className={compact ? "compact" : ""}>
        {value} {suffix ? <small>{suffix}</small> : null}
      </strong>
    </div>
  );
}

function ResultList({
  results,
  query,
  onOpen,
}: {
  results: SearchResult[];
  query: string;
  onOpen(url: string): void;
}) {
  if (!query.trim()) {
    return (
      <div className="empty-state">
        <Search size={20} />
        <p>输入关键词，搜索已保存的页面正文。</p>
      </div>
    );
  }
  if (results.length === 0) {
    return <div className="empty-state"><p>没有找到相关浏览记忆。</p></div>;
  }
  return (
    <GlassSurface className="result-list">
      {results.map((result) => (
        <button
          className="result-row"
          type="button"
          key={result.page.id}
          onClick={() => onOpen(result.page.url)}
        >
          <span className="domain-icon">
            <Globe2 size={17} />
          </span>
          <span className="result-copy">
            <strong>{result.page.title}</strong>
            <small>
              {result.page.domain} · {Math.max(1, Math.round(result.page.durationSeconds / 60))} 分钟
            </small>
            <span>{result.snippet}</span>
          </span>
          <ChevronRight size={16} />
        </button>
      ))}
    </GlassSurface>
  );
}

function Answer({
  answer,
  client,
}: {
  answer: RagAnswer;
  client: SidePanelClient;
}) {
  return (
    <div className="answer-block">
      {answer.offline ? <span className="offline-label">离线模式</span> : null}
      <p>{answer.text}</p>
      {answer.sources.length > 0 ? (
        <div className="sources">
          {answer.sources.map((source) => (
            <button
              type="button"
              key={source.index}
              onClick={() => client.openUrl(source.url)}
            >
              {source.index} {source.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
