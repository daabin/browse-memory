import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../entrypoints/sidepanel/App";
import type { SidePanelClient } from "@/ui/runtime-client";

const TODAY = "2026-06-09";

const samplePages = [
  {
    score: 0,
    snippet: "recent snippet",
    highlights: [],
    page: {
      id: "recent-1",
      url: "https://example.com/page-a",
      normalizedUrl: "https://example.com/page-a",
      title: "Page A on example",
      domain: "example.com",
      content: "recent snippet",
      contentHash: "hash",
      durationSeconds: 60,
      visitDate: TODAY,
      capturedAt: 0,
      createdAt: 0,
      updatedAt: 0,
    },
  },
  {
    score: 0,
    snippet: "second snippet",
    highlights: [],
    page: {
      id: "recent-2",
      url: "https://example.com/page-b",
      normalizedUrl: "https://example.com/page-b",
      title: "Page B on example",
      domain: "example.com",
      content: "second snippet",
      contentHash: "hash2",
      durationSeconds: 120,
      visitDate: TODAY,
      capturedAt: 0,
      createdAt: 0,
      updatedAt: 1,
    },
  },
  {
    score: 0,
    snippet: "other domain snippet",
    highlights: [],
    page: {
      id: "recent-3",
      url: "https://other.org/article",
      normalizedUrl: "https://other.org/article",
      title: "Article on other",
      domain: "other.org",
      content: "other domain snippet",
      contentHash: "hash3",
      durationSeconds: 90,
      visitDate: TODAY,
      capturedAt: 0,
      createdAt: 0,
      updatedAt: 2,
    },
  },
];

function createClient(): SidePanelClient {
  return {
    getSnapshot: vi.fn().mockResolvedValue({
      pageCount: 18,
      readingMinutes: 62,
      deepReadCount: 6,
      topDomain: "example.com",
    }),
    getSettings: vi.fn().mockResolvedValue({ hasApiKey: false }),
    getRecent: vi.fn().mockResolvedValue(samplePages),
    getDistinctDates: vi.fn().mockResolvedValue([TODAY]),
    getRecordsByDate: vi.fn().mockResolvedValue(samplePages),
    search: vi.fn().mockResolvedValue([]),
    ask: vi.fn().mockResolvedValue({
      text: "当前为离线模式。",
      sources: [],
      offline: true,
    }),
    listChatSessions: vi.fn().mockResolvedValue([]),
    getChatSession: vi.fn().mockResolvedValue({ session: { id: "s1", title: "test", createdAt: 0, updatedAt: 0 }, messages: [] }),
    createChatSession: vi.fn().mockResolvedValue({ id: "s1", title: "test", createdAt: 0, updatedAt: 0 }),
    addChatMessage: vi.fn().mockResolvedValue({ id: "m1", sessionId: "s1", role: "user", content: "hi", createdAt: 0 }),
    openUrl: vi.fn(),
    openOptions: vi.fn(),
  };
}

describe("side panel App", () => {
  it("renders the compact today snapshot", async () => {
    render(<App client={createClient()} />);

    expect(await screen.findByText("18")).toBeInTheDocument();
    expect(screen.getByText("62 分钟")).toBeInTheDocument();
    expect(screen.getAllByText("example.com").length).toBeGreaterThanOrEqual(1);
  });

  it("groups pages by domain within a date section", async () => {
    render(<App client={createClient()} />);

    // Date header should be visible
    expect(await screen.findByText("今天")).toBeInTheDocument();
    expect(screen.getByText("other.org")).toBeInTheDocument();

    // Page count per domain
    expect(screen.getByText("2 页 · 3 分钟")).toBeInTheDocument();
    expect(screen.getByText("1 页 · 2 分钟")).toBeInTheDocument();

    // Pages should NOT be visible initially (collapsed)
    expect(screen.queryByText("Page A on example")).not.toBeInTheDocument();
    expect(screen.queryByText("Article on other")).not.toBeInTheDocument();
  });

  it("expands a domain group on click", async () => {
    render(<App client={createClient()} />);

    await screen.findByText("other.org");
    const headers = await screen.findAllByText("example.com");
    const domainHeader = headers.find((el) => el.tagName === "STRONG" && el.closest(".domain-header"))!;
    fireEvent.click(domainHeader.closest(".domain-header")!);

    expect(await screen.findByText("Page A on example")).toBeInTheDocument();
    expect(screen.getByText("Page B on example")).toBeInTheDocument();
    expect(screen.queryByText("Article on other")).not.toBeInTheDocument();

    fireEvent.click(domainHeader.closest(".domain-header")!);
    expect(screen.queryByText("Page A on example")).not.toBeInTheDocument();
  });

  it("does not show ask card in memory tab", async () => {
    render(<App client={createClient()} />);
    await screen.findByText("18");
    // The ask card heading should not be present
    expect(screen.queryByText("问问浏览记录")).not.toBeInTheDocument();
  });

  it("switches to conversation mode and shows session list", async () => {
    render(<App client={createClient()} />);
    await screen.findByText("18");
    fireEvent.click(screen.getByRole("button", { name: "对话" }));

    expect(await screen.findByText("对话记录")).toBeInTheDocument();
    expect(screen.getByText("基于本地 BM25 检索的问答历史")).toBeInTheDocument();
  });

  it("debounces search input", async () => {
    vi.useFakeTimers();
    const client = createClient();
    render(<App client={client} />);
    fireEvent.change(screen.getByPlaceholderText("搜索浏览记录…"), {
      target: { value: "browser rag" },
    });

    expect(client.search).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(client.search).toHaveBeenCalledWith("browser rag");
    vi.useRealTimers();
  });

  it("shows search results grouped by domain", async () => {
    vi.useFakeTimers();
    const client = createClient();
    client.search = vi.fn().mockResolvedValue([
      {
        score: 1,
        snippet: "search hit",
        highlights: [],
        page: {
          id: "s1",
          url: "https://example.com/hit",
          normalizedUrl: "https://example.com/hit",
          title: "Search hit page",
          domain: "example.com",
          content: "search hit",
          contentHash: "h",
          durationSeconds: 30,
          visitDate: TODAY,
          capturedAt: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);
    render(<App client={client} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    fireEvent.change(screen.getByPlaceholderText("搜索浏览记录…"), {
      target: { value: "search" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    // Search results are grouped by domain - domain header should be visible
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    const headers = screen.getAllByText("example.com");
    const domainEl = headers.find((el) => el.closest(".domain-header"))!;
    fireEvent.click(domainEl.closest(".domain-header")!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText("Search hit page")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
