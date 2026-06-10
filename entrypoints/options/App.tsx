import {
  BarChart3,
  CheckCircle2,
  Database,
  Globe2,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ALL_LOCALES, LOCALE_NAMES, useLocale, useSetLocale } from "../../src/i18n";
import { useT } from "../../src/i18n";
import type { AppSettings } from "../../src/shared/types";
import {
  optionsClient,
  type OptionsClient,
} from "../../src/ui/options-client";

type PublicSettings = Omit<AppSettings, "encryptedApiKey" | "encryptedEmbeddingApiKey">;

const EMPTY_SETTINGS: PublicSettings = {
  chatBaseUrl: "https://api.deepseek.com",
  chatModel: "deepseek-v4-flash",
  minimumReadSeconds: 5,
  blacklistPatterns: [],
  retentionDays: 90,
  embeddingEnabled: false,
  embeddingBaseUrl: "https://api.siliconflow.cn",
  embeddingModel: "BAAI/bge-m3",
  embeddingReuseChatKey: true,
  reportDailyHour: 3,
};

export function App({
  client = optionsClient,
}: {
  client?: OptionsClient;
}) {
  const t = useT();
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [hasEmbeddingApiKey, setHasEmbeddingApiKey] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState<{ enabled: boolean; indexedCount: number; totalCount: number }>({ enabled: false, indexedCount: 0, totalCount: 0 });
  const [storageBytes, setStorageBytes] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void Promise.all([
      client.getSettings(),
      client.getStorageUsage(),
      client.getEmbeddingStatus(),
    ])
      .then(([stored, bytes, embStatus]) => {
        setSettings(stored.settings);
        setHasApiKey(stored.hasApiKey);
        setHasEmbeddingApiKey(stored.hasEmbeddingApiKey);
        setStorageBytes(bytes);
        setEmbeddingStatus(embStatus);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : t("settings.loadFailed"),
        );
      });
  }, [client, t]);

  const validate = (): boolean => {
    try {
      const url = new URL(settings.chatBaseUrl);
      if (url.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      setError(t("settings.invalidUrl"));
      return false;
    }
    if (!settings.chatModel.trim()) {
      setError(t("settings.missingModel"));
      return false;
    }
    if (
      !Number.isFinite(settings.minimumReadSeconds) ||
      settings.minimumReadSeconds < 1
    ) {
      setError(t("settings.invalidReadTime"));
      return false;
    }
    if (
      !Number.isFinite(settings.retentionDays) ||
      settings.retentionDays < 1
    ) {
      setError(t("settings.invalidRetention"));
      return false;
    }
    return true;
  };

  const run = async (operation: () => Promise<void>, success: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
      setMessage(success);
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : t("settings.operationFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!validate()) {
      return;
    }
    void run(async () => {
      await client.saveSettings(settings, apiKey || undefined, embeddingApiKey || undefined);
      if (apiKey) {
        setHasApiKey(true);
        setApiKey("");
      }
      if (embeddingApiKey) {
        setHasEmbeddingApiKey(true);
        setEmbeddingApiKey("");
      }
    }, t("settings.saved"));
  };

  const testConnection = () => {
    if (!validate()) {
      return;
    }
    void run(
      () => client.testConnection(settings, apiKey || undefined),
      t("settings.connected"),
    );
  };

  const testEmbedding = () => {
    void run(
      () => client.testEmbeddingConnection(settings, embeddingApiKey || undefined),
      t("settings.embeddingConnected"),
    );
  };

  const backfill = () => {
    void run(
      () => client.triggerEmbeddingBackfill(),
      t("settings.saved"),
    );
  };

  const clearData = () => {
    void run(async () => {
      await client.clearAllData();
      setStorageBytes(0);
      setHasApiKey(false);
      setHasEmbeddingApiKey(false);
      setConfirmClear(false);
    }, t("settings.cleared"));
  };

  return (
    <div className="options-shell">
      <header>
         <div aria-hidden="true">
          <img src="/icon128.png" alt="" width={30} height={30} style={{ borderRadius: 4 }} />
        </div>
        <div>
          <h1>BrowseMemory</h1>
          <p>{t("header.settingsAndPrivacy")}</p>
        </div>
        <span className="privacy-pill"><ShieldCheck size={14} /> {t("header.localFirst")}</span>
      </header>

      <main>
        <section className="settings-card">
          <div className="card-heading">
            <span><Globe2 size={18} /></span>
            <div><h2>{t("settings.language")}</h2><p>{t("settings.languageDesc")}</p></div>
          </div>
          <LanguageSelector />
        </section>

        <section className="settings-card ai-card">
          <div className="card-heading">
            <span><KeyRound size={18} /></span>
            <div><h2>{t("settings.aiService")}</h2><p>{t("settings.aiServiceDesc")}</p></div>
          </div>
          <div className="form-grid">
            <label className="wide">
              <span>{t("settings.apiAddress")}</span>
              <input
                aria-label={t("settings.apiAddress")}
                value={settings.chatBaseUrl}
                onChange={(event) =>
                  setSettings({ ...settings, chatBaseUrl: event.target.value })
                }
              />
            </label>
            <label>
              <span>{t("settings.chatModel")}</span>
              <input
                value={settings.chatModel}
                onChange={(event) =>
                  setSettings({ ...settings, chatModel: event.target.value })
                }
              />
            </label>
            <label>
              <span>{t("settings.apiKey")}</span>
              <input
                type="password"
                value={apiKey}
                placeholder={hasApiKey ? t("settings.apiKeyPlaceholder") : "sk-…"}
                onChange={(event) => setApiKey(event.target.value)}
              />
              {hasApiKey ? <small><CheckCircle2 size={12} /> {t("settings.apiKeySaved")}</small> : null}
            </label>
          </div>
          <div className="action-row">
            <button className="secondary" type="button" onClick={testConnection} disabled={busy}>
              {t("settings.testConnection")}
            </button>
            <button className="primary" type="button" onClick={save} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              {t("settings.saveSettings")}
            </button>
          </div>
        </section>

        <section className="settings-card embedding-card">
          <div className="card-heading">
            <span><Sparkles size={18} /></span>
            <div><h2>{t("settings.embedding")}</h2><p>{t("settings.embeddingDesc")}</p></div>
          </div>
          <div className="form-grid">
            <label className="wide">
              <span className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.embeddingEnabled}
                  onChange={(event) =>
                    setSettings({ ...settings, embeddingEnabled: event.target.checked })
                  }
                />
                {t("settings.embeddingEnabled")}
              </span>
            </label>
            {settings.embeddingEnabled ? (
              <>
                <label className="wide">
                  <span>{t("settings.embeddingAddress")}</span>
                  <input
                    value={settings.embeddingBaseUrl}
                    onChange={(event) =>
                      setSettings({ ...settings, embeddingBaseUrl: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>{t("settings.embeddingModel")}</span>
                  <input
                    value={settings.embeddingModel}
                    onChange={(event) =>
                      setSettings({ ...settings, embeddingModel: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.embeddingReuseChatKey}
                      onChange={(event) =>
                        setSettings({ ...settings, embeddingReuseChatKey: event.target.checked })
                      }
                    />
                    {t("settings.embeddingKeyReuse")}
                  </span>
                </label>
                {!settings.embeddingReuseChatKey ? (
                  <label>
                    <span>{t("settings.embeddingKey")}</span>
                    <input
                      type="password"
                      value={embeddingApiKey}
                      placeholder={hasEmbeddingApiKey ? t("settings.apiKeyPlaceholder") : t("settings.embeddingKeyPlaceholder")}
                      onChange={(event) => setEmbeddingApiKey(event.target.value)}
                    />
                    {hasEmbeddingApiKey ? <small><CheckCircle2 size={12} /> {t("settings.apiKeySaved")}</small> : null}
                  </label>
                ) : null}
                <div className="wide">
                  <small>{t("settings.embeddingIndexed", { n: embeddingStatus.indexedCount, total: embeddingStatus.totalCount })}</small>
                </div>
              </>
            ) : null}
          </div>
          {settings.embeddingEnabled ? (
            <div className="action-row">
              <button className="secondary" type="button" onClick={testEmbedding} disabled={busy}>
                {t("settings.testEmbedding")}
              </button>
              <button className="secondary" type="button" onClick={backfill} disabled={busy}>
                {t("settings.embeddingBackfill")}
              </button>
            </div>
          ) : null}
        </section>

        <section className="settings-card report-card">
          <div className="card-heading">
            <span><BarChart3 size={18} /></span>
            <div><h2>{t("settings.report")}</h2><p>{t("settings.reportDesc")}</p></div>
          </div>
          <div className="form-grid">
            <label>
              <span>{t("settings.reportDailyHour")}</span>
              <input
                type="number"
                min={0}
                max={23}
                value={settings.reportDailyHour}
                onChange={(event) =>
                  setSettings({ ...settings, reportDailyHour: Number(event.target.value) })
                }
              />
            </label>
          </div>
        </section>

        <section className="settings-card capture-card">
          <div className="card-heading">
            <span><ShieldCheck size={18} /></span>
            <div><h2>{t("settings.captureRules")}</h2><p>{t("settings.captureRulesDesc")}</p></div>
          </div>
          <div className="form-grid">
            <label>
              <span>{t("settings.minReadSeconds")}</span>
              <input
                type="number"
                min={1}
                value={settings.minimumReadSeconds}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    minimumReadSeconds: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="wide">
              <span>{t("settings.blacklist")}</span>
              <textarea
                rows={5}
                value={settings.blacklistPatterns.join("\n")}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    blacklistPatterns: event.target.value
                      .split(/\r?\n/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
              <small>{t("settings.blacklistHint")}</small>
            </label>
          </div>
        </section>

        <section className="settings-card storage-card">
          <div className="card-heading">
            <span><Database size={18} /></span>
            <div><h2>{t("settings.storage")}</h2><p>{t("settings.storageDesc")}</p></div>
          </div>
          <div className="form-grid">
            <label>
              <span>{t("settings.retentionDays")}</span>
              <input
                type="number"
                min={1}
                max={3650}
                value={settings.retentionDays}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    retentionDays: Number(event.target.value),
                  })
                }
              />
              <small>{t("settings.retentionHint")}</small>
            </label>
          </div>
          <div className="storage-summary">
            <div><span>{t("settings.currentUsage")}</span><strong>{formatBytes(storageBytes)}</strong></div>
            <button className="danger" type="button" onClick={() => setConfirmClear(true)}>
              <Trash2 size={15} /> {t("settings.clearAllData")}
            </button>
          </div>
        </section>

        {message ? <div className="notice success">{message}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}
      </main>

      {confirmClear ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title">
            <button className="dialog-close" aria-label={t("common.close")} type="button" onClick={() => setConfirmClear(false)}><X size={17} /></button>
            <div className="danger-icon"><Trash2 size={19} /></div>
            <h2 id="clear-title">{t("settings.clearTitle")}</h2>
            <p>{t("settings.clearDesc")}</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setConfirmClear(false)}>{t("common.cancel")}</button>
              <button className="danger-solid" type="button" onClick={clearData}>{t("settings.confirmClear")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function LanguageSelector() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <div className="language-grid">
      {ALL_LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          className={`language-option${loc === locale ? " active" : ""}`}
          onClick={() => setLocale(loc)}
        >
          {LOCALE_NAMES[loc]}
          {loc === locale ? <CheckCircle2 size={14} /> : null}
        </button>
      ))}
    </div>
  );
}
