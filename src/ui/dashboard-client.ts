import type { ReportRecord, ReportType } from "../shared/types";

const DASHBOARD_MSG_PREFIX = "bm-dashboard-";

/* ------------------------------------------------------------------ */
/*  postMessage bridge (used when chrome.runtime is not available)     */
/* ------------------------------------------------------------------ */

interface BridgeRequest {
  __bm: "dashboard-request";
  id: string;
  method: string;
  args: unknown[];
}

interface BridgeResponse {
  __bm: "dashboard-response";
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

let bridgeId = 0;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function setupBridge() {
  window.addEventListener("message", (event: MessageEvent<BridgeResponse>) => {
    const data = event.data;
    if (!data || data.__bm !== "dashboard-response") return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) {
      entry.resolve(data.data);
    } else {
      entry.reject(new Error(data.error ?? "Unknown error"));
    }
  });
}

function bridgeCall(method: string, args: unknown[] = []): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = `${DASHBOARD_MSG_PREFIX}${++bridgeId}`;
    pending.set(id, { resolve, reject });
    const request: BridgeRequest = { __bm: "dashboard-request", id, method, args };
    window.parent.postMessage(request, "*");
    // Timeout after 30s
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("Bridge request timed out"));
      }
    }, 30_000);
  });
}

/* ------------------------------------------------------------------ */
/*  Direct chrome.runtime bridge (fallback)                           */
/* ------------------------------------------------------------------ */

async function sendDirect(message: unknown): Promise<Record<string, unknown>> {
  const response = (await chrome.runtime.sendMessage(message)) as Record<string, unknown>;
  if (!(response as { ok: boolean }).ok) {
    throw new Error(((response as { message?: string }).message) ?? "Unknown error");
  }
  return response;
}

/* ------------------------------------------------------------------ */
/*  Detect if chrome.runtime is available                              */
/* ------------------------------------------------------------------ */

function hasChromeRuntime(): boolean {
  try {
    return typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined" && typeof chrome.runtime.sendMessage === "function";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Public interface                                                   */
/* ------------------------------------------------------------------ */

export interface DashboardClient {
  getReports(type?: ReportType): Promise<ReportRecord[]>;
  getReport(id: string): Promise<ReportRecord>;
  generateReport(type: ReportType, date?: string): Promise<ReportRecord>;
  openUrl(url: string): void;
}

export const dashboardClient: DashboardClient = {
  async getReports(type) {
    if (hasChromeRuntime()) {
      const response = await sendDirect({ type: "GET_REPORTS", reportType: type });
      if ("reports" in response) return response.reports as ReportRecord[];
      throw new Error("无法读取报告列表。");
    }
    const reports = (await bridgeCall("getReports", [type])) as ReportRecord[];
    return reports;
  },

  async getReport(id) {
    if (hasChromeRuntime()) {
      const response = await sendDirect({ type: "GET_REPORT", reportId: id });
      if ("report" in response) return response.report as ReportRecord;
      throw new Error("无法读取报告详情。");
    }
    const report = (await bridgeCall("getReport", [id])) as ReportRecord;
    return report;
  },

  async generateReport(type, date) {
    if (hasChromeRuntime()) {
      const response = await sendDirect({ type: "GENERATE_REPORT", reportType: type, date });
      if ("report" in response) return response.report as ReportRecord;
      throw new Error("无法生成报告。");
    }
    const report = (await bridgeCall("generateReport", [type, date])) as ReportRecord;
    return report;
  },

  openUrl(url) {
    if (hasChromeRuntime()) {
      void chrome.tabs.create({ url });
    } else {
      window.parent.postMessage({ __bm: "dashboard-request", id: "", method: "openUrl", args: [url] }, "*");
    }
  },
};

// Setup the bridge listener on module load
if (typeof window !== "undefined") {
  setupBridge();
}
