import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../entrypoints/sidepanel/App";
import type { SidePanelClient } from "@/ui/runtime-client";

function createClient(): SidePanelClient {
  return {
    getSnapshot: vi.fn().mockResolvedValue({
      pageCount: 18,
      readingMinutes: 62,
      deepReadCount: 6,
      topDomain: "example.com",
    }),
    getSettings: vi.fn().mockResolvedValue({ hasApiKey: false }),
    getRecent: vi.fn().mockResolvedValue([
      {
        score: 0,
        snippet: "recent snippet",
        highlights: [],
        page: {
          id: "recent",
          url: "https://example.com/recent",
          normalizedUrl: "https://example.com/recent",
          title: "Recent memory",
          domain: "example.com",
          content: "recent snippet",
          contentHash: "hash",
          durationSeconds: 60,
          visitDate: "2026-06-09",
          capturedAt: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]),
    search: vi.fn().mockResolvedValue([]),
    ask: vi.fn().mockResolvedValue({
      text: "当前为离线模式。",
      sources: [],
      offline: true,
    }),
    openUrl: vi.fn(),
    openOptions: vi.fn(),
  };
}

describe("side panel App", () => {
  it("renders the compact today snapshot", async () => {
    render(<App client={createClient()} />);

    expect(await screen.findByText("18")).toBeInTheDocument();
    expect(screen.getByText("62 分钟")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("Recent memory")).toBeInTheDocument();
  });

  it("switches between memory and conversation modes", async () => {
    render(<App client={createClient()} />);
    fireEvent.click(screen.getByRole("button", { name: "对话" }));

    expect(
      await screen.findByPlaceholderText("问问你的浏览记忆…"),
    ).toBeInTheDocument();
  });

  it("debounces search input", async () => {
    vi.useFakeTimers();
    const client = createClient();
    render(<App client={client} />);
    fireEvent.change(screen.getByPlaceholderText("搜索浏览记忆…"), {
      target: { value: "browser rag" },
    });

    expect(client.search).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(client.search).toHaveBeenCalledWith("browser rag");
    vi.useRealTimers();
  });
});
