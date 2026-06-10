import { BarChart3, Calendar, LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useT, useLocale } from "../../src/i18n";
import type { ReportRecord, ReportType } from "../../src/shared/types";
import { MarkdownContent } from "../../src/ui/MarkdownContent";
import { dashboardClient, type DashboardClient } from "../../src/ui/dashboard-client";

const TABS: ReportType[] = ["daily", "weekly", "monthly"];

function tabLabel(type: ReportType, t: ReturnType<typeof useT>): string {
  if (type === "daily") return t("dashboard.daily");
  if (type === "weekly") return t("dashboard.weekly");
  return t("dashboard.monthly");
}

export function App({
  client = dashboardClient,
}: {
  client?: DashboardClient;
}) {
  const t = useT();
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<ReportType>("daily");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [selected, setSelected] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const loadReports = useCallback(
    async (type: ReportType) => {
      setLoading(true);
      setError("");
      try {
        const list = await client.getReports(type);
        setReports(list);
        // Auto-select the first report if none selected or selected is not in list
        if (list.length > 0 && (!selected || !list.some((r) => r.id === selected.id))) {
          setSelected(list[0]);
        } else if (list.length === 0) {
          setSelected(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("dashboard.loadFailed"));
      } finally {
        setLoading(false);
      }
    },
    [client, selected, t],
  );

  useEffect(() => {
    void loadReports(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const report = await client.generateReport(activeTab, undefined, locale);
      await loadReports(activeTab);
      setSelected(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dashboard.generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <img src="/icon128.png" alt="" width={28} height={28} style={{ borderRadius: 6 }} />
          <h1>{t("dashboard.title")}</h1>
        </div>
      </header>

      <nav className="dashboard-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab-button${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabel(tab, t)}
          </button>
        ))}
        <button
          type="button"
          className="generate-button"
          onClick={() => void generate()}
          disabled={generating}
        >
          {generating ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
          {generating ? t("dashboard.generating") : t("dashboard.generateNow")}
        </button>
      </nav>

      <div className="dashboard-body">
        <aside className="report-sidebar">
          {loading ? (
            <div className="sidebar-loading">
              <LoaderCircle className="spin" size={18} />
            </div>
          ) : reports.length === 0 ? (
            <div className="sidebar-empty">
              <Calendar size={18} />
              <p>{t("dashboard.noReports")}</p>
            </div>
          ) : (
            <ul className="report-list">
              {reports.map((report) => (
                <li key={report.id}>
                  <button
                    type="button"
                    className={`report-item${selected?.id === report.id ? " active" : ""}`}
                    onClick={() => setSelected(report)}
                  >
                    <strong>{report.title}</strong>
                    <small>{report.date} · {t("dashboard.pageCount", { n: report.pageCount })}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className="report-content">
          {selected ? (
            <ReportDetail report={selected} t={t} />
          ) : (
            <div className="content-empty">
              <BarChart3 size={32} />
              <p>{t("dashboard.noReports")}</p>
            </div>
          )}
        </main>
      </div>

      {error ? <div className="dashboard-error">{error}</div> : null}
    </div>
  );
}

function ReportDetail({
  report,
  t,
}: {
  report: ReportRecord;
  t: ReturnType<typeof useT>;
}) {
  return (
    <article className="report-article">
      <header className="report-article-header">
        <h2>{report.title}</h2>
        <span className="report-meta">
          {report.date} · {t("dashboard.pageCount", { n: report.pageCount })}
        </span>
      </header>

      {report.topics.length > 0 ? (
        <section className="report-topics">
          <h3>{t("dashboard.topics")}</h3>
          <div className="topic-tags">
            {report.topics.map((topic) => (
              <span key={topic} className="topic-tag">{topic}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="report-body">
        <MarkdownContent text={report.content} />
      </section>
    </article>
  );
}
