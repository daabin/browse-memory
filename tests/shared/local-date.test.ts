import { describe, expect, it, vi } from "vitest";

import { toLocalDateKey } from "@/shared/local-date";

describe("toLocalDateKey", () => {
  it("uses local calendar fields instead of the UTC date", () => {
    const date = new Date("2026-06-09T16:30:00.000Z");
    vi.spyOn(date, "getFullYear").mockReturnValue(2026);
    vi.spyOn(date, "getMonth").mockReturnValue(5);
    vi.spyOn(date, "getDate").mockReturnValue(10);

    expect(toLocalDateKey(date)).toBe("2026-06-10");
  });
});
