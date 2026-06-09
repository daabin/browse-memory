import { describe, expect, it, vi } from "vitest";

import {
  SessionCoordinator,
  type SessionStorageAdapter,
} from "@/background/session-coordinator";
import { DEFAULT_SETTINGS } from "@/shared/constants";

describe("SessionCoordinator", () => {
  it("persists and restores an active session", async () => {
    let stored: unknown;
    const storage: SessionStorageAdapter = {
      get: vi.fn(async () => stored),
      set: vi.fn(async (value) => {
        stored = value;
      }),
      remove: vi.fn(async () => {
        stored = undefined;
      }),
    };
    const sink = vi.fn();
    const first = new SessionCoordinator(
      storage,
      sink,
      async () => DEFAULT_SETTINGS,
    );
    await first.switchTo(
      {
        tabId: 7,
        url: "https://example.com",
        title: "Example",
        incognito: false,
      },
      1_000,
    );

    const restored = new SessionCoordinator(
      storage,
      sink,
      async () => DEFAULT_SETTINGS,
    );
    await restored.restore();

    expect(restored.current()).toMatchObject({
      tabId: 7,
      url: "https://example.com",
    });
  });

  it("finalizes an eligible session when switching tabs", async () => {
    const storage: SessionStorageAdapter = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    const sink = vi.fn();
    const coordinator = new SessionCoordinator(
      storage,
      sink,
      async () => DEFAULT_SETTINGS,
    );
    await coordinator.switchTo(
      {
        tabId: 1,
        url: "https://example.com/a",
        title: "A",
        incognito: false,
      },
      0,
    );
    await coordinator.updatePage(1, {
      url: "https://example.com/a",
      title: "A",
      content: "article",
    });
    await coordinator.tick(6_000);
    await coordinator.switchTo(
      {
        tabId: 2,
        url: "https://example.com/b",
        title: "B",
        incognito: false,
      },
      6_000,
    );

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/a",
        durationSeconds: 6,
        content: "article",
      }),
    );
  });
});
