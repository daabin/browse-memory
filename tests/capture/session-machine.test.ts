import { describe, expect, it } from "vitest";

import {
  createSession,
  transitionSession,
} from "@/capture/session-machine";

describe("reading session", () => {
  it("accrues time while active and stops while hidden", () => {
    const started = createSession(
      1,
      "https://example.com",
      "Example",
      0,
    );
    const ticked = transitionSession(started, { type: "TICK", at: 8_000 });
    const hidden = transitionSession(ticked, {
      type: "SET_ACTIVE",
      active: false,
      at: 10_000,
    });
    const later = transitionSession(hidden, { type: "TICK", at: 20_000 });

    expect(later.durationSeconds).toBe(10);
  });

  it("changes page without carrying previous duration", () => {
    const started = createSession(
      1,
      "https://example.com/a",
      "A",
      0,
    );
    const changed = transitionSession(started, {
      type: "NAVIGATE",
      url: "https://example.com/b",
      title: "B",
      at: 5_000,
    });

    expect(changed).toMatchObject({
      url: "https://example.com/b",
      durationSeconds: 0,
    });
  });
});
