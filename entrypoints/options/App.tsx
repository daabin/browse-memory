import {
  BrainCircuit,
  CheckCircle2,
  Database,
  KeyRound,
  LoaderCircle,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { AppSettings } from "../../src/shared/types";
import {
  optionsClient,
  type OptionsClient,
} from "../../src/ui/options-client";

type PublicSettings = Omit<AppSettings, "encryptedApiKey">;

const EMPTY_SETTINGS: PublicSettings = {
  chatBaseUrl: "https://api.deepseek.com",
  chatModel: "deepseek-v4-flash",
  minimumReadSeconds: 5,
  blacklistPatterns: [],
  retentionDays: 90,
};

export function App({
  client = optionsClient,
}: {
  client?: OptionsClient;
}) {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [storageBytes, setStorageBytes] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    void Promise.all([client.getSettings(), client.getStorageUsage()])
      .then(([stored, bytes]) => {
        setSettings(stored.settings);
        setHasApiKey(stored.hasApiKey);
        setStorageBytes(bytes);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : "读取设置失败。",
        );
      });
  }, [client]);

  const validate = (): boolean => {
    try {
      const url = new URL(settings.chatBaseUrl);
      if (url.protocol !== "https:") {
        throw new Error();
      }
    } catch {
      setError("请输入有效的 HTTPS API 地址。");
      return false;
    }
    if (!settings.chatModel.trim()) {
      setError("请输入对话模型名称。");
      return false;
    }
    if (
      !Number.isFinite(settings.minimumReadSeconds) ||
      settings.minimumReadSeconds < 1
    ) {
      setError("最低阅读时长必须大于 0 秒。");
      return false;
    }
    if (
      !Number.isFinite(settings.retentionDays) ||
      settings.retentionDays < 1
    ) {
      setError("数据保留天数必须大于 0 天。");
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
          : "操作失败，请重试。",
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
      await client.saveSettings(settings, apiKey || undefined);
      if (apiKey) {
        setHasApiKey(true);
        setApiKey("");
      }
    }, "设置已保存。");
  };

  const testConnection = () => {
    if (!validate()) {
      return;
    }
    void run(
      () => client.testConnection(settings, apiKey || undefined),
      "连接成功。",
    );
  };

  const clearData = () => {
    void run(async () => {
      await client.clearAllData();
      setStorageBytes(0);
      setHasApiKey(false);
      setConfirmClear(false);
    }, "本地数据已清除。");
  };

  return (
    <div className="options-shell">
      <header>
         <div aria-hidden="true">
          <img src="/icon128.png" alt="" width={30} height={30} style={{ borderRadius: 4 }} />
        </div>
        <div>
          <h1>BrowseMemory</h1>
          <p>设置与隐私</p>
        </div>
        <span className="privacy-pill"><ShieldCheck size={14} /> 本地优先</span>
      </header>

      <main>
        <section className="settings-card ai-card">
          <div className="card-heading">
            <span><KeyRound size={18} /></span>
            <div><h2>AI 服务</h2><p>兼容 OpenAI Chat Completions 接口</p></div>
          </div>
          <div className="form-grid">
            <label className="wide">
              <span>API 地址</span>
              <input
                aria-label="API 地址"
                value={settings.chatBaseUrl}
                onChange={(event) =>
                  setSettings({ ...settings, chatBaseUrl: event.target.value })
                }
              />
            </label>
            <label>
              <span>对话模型</span>
              <input
                value={settings.chatModel}
                onChange={(event) =>
                  setSettings({ ...settings, chatModel: event.target.value })
                }
              />
            </label>
            <label>
              <span>API Key</span>
              <input
                type="password"
                value={apiKey}
                placeholder={hasApiKey ? "留空以保留现有 Key" : "sk-…"}
                onChange={(event) => setApiKey(event.target.value)}
              />
              {hasApiKey ? <small><CheckCircle2 size={12} /> API Key 已安全保存</small> : null}
            </label>
          </div>
          <div className="action-row">
            <button className="secondary" type="button" onClick={testConnection} disabled={busy}>
              测试连接
            </button>
            <button className="primary" type="button" onClick={save} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              保存设置
            </button>
          </div>
        </section>

        <section className="settings-card">
          <div className="card-heading">
            <span><ShieldCheck size={18} /></span>
            <div><h2>采集规则</h2><p>控制哪些页面进入本地记录</p></div>
          </div>
          <div className="form-grid">
            <label>
              <span>最低阅读时长（秒）</span>
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
              <span>黑名单域名</span>
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
              <small>每行一个域名，支持 *.example.com 通配符。</small>
            </label>
          </div>
        </section>

        <section className="settings-card storage-card">
          <div className="card-heading">
            <span><Database size={18} /></span>
            <div><h2>本地存储</h2><p>正文、索引和设置仅保存在当前浏览器</p></div>
          </div>
          <div className="form-grid">
            <label>
              <span>数据保留天数</span>
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
              <small>超过该天数的浏览记录和对话将自动清理（每天执行一次）。</small>
            </label>
          </div>
          <div className="storage-summary">
            <div><span>当前占用</span><strong>{formatBytes(storageBytes)}</strong></div>
            <button className="danger" type="button" onClick={() => setConfirmClear(true)}>
              <Trash2 size={15} /> 清除所有数据
            </button>
          </div>
        </section>

        {message ? <div className="notice success">{message}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}
      </main>

      {confirmClear ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-title">
            <button className="dialog-close" aria-label="关闭" type="button" onClick={() => setConfirmClear(false)}><X size={17} /></button>
            <div className="danger-icon"><Trash2 size={19} /></div>
            <h2 id="clear-title">清除所有本地数据？</h2>
            <p>浏览记录、BM25 索引、API 设置和加密密钥都会永久删除，此操作无法撤销。</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setConfirmClear(false)}>取消</button>
              <button className="danger-solid" type="button" onClick={clearData}>确认清除</button>
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
