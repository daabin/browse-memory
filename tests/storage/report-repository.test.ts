import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrowseMemoryDatabase } from "@/storage/database";
import { ReportRepository } from "@/storage/report-repository";
import type { ReportRecord } from "@/shared/types";

function makeReport(overrides: Partial<ReportRecord> = {}): ReportRecord {
  return {
    id: crypto.randomUUID(),
    type: "daily",
    date: "2026-06-09",
    title: "Test Report",
    content: "# Report\nContent here",
    topics: ["tech", "ai"],
    pageCount: 5,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("ReportRepository", () => {
  let database: BrowseMemoryDatabase;
  let repo: ReportRepository;

  beforeEach(() => {
    database = new BrowseMemoryDatabase(`rpt-${crypto.randomUUID()}`);
    repo = new ReportRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("saves and retrieves a report", async () => {
    const report = makeReport();
    await repo.save(report);

    const retrieved = await repo.get(report.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.title).toBe("Test Report");
  });

  it("lists reports by type", async () => {
    await repo.save(makeReport({ type: "daily" }));
    await repo.save(makeReport({ type: "weekly" }));
    await repo.save(makeReport({ type: "daily" }));

    const daily = await repo.list("daily");
    expect(daily).toHaveLength(2);

    const all = await repo.list();
    expect(all).toHaveLength(3);
  });

  it("gets report by date", async () => {
    await repo.save(makeReport({ date: "2026-06-09" }));
    await repo.save(makeReport({ date: "2026-06-10" }));

    const report = await repo.getByDate("2026-06-09");
    expect(report).toBeDefined();
    expect(report!.date).toBe("2026-06-09");
  });

  it("deletes a report", async () => {
    const report = makeReport();
    await repo.save(report);
    await repo.delete(report.id);
    expect(await repo.get(report.id)).toBeUndefined();
  });

  it("purges expired reports", async () => {
    const old = makeReport({ createdAt: Date.now() - 100 * 86_400_000 });
    const fresh = makeReport({ createdAt: Date.now() });
    await repo.save(old);
    await repo.save(fresh);

    const purged = await repo.purgeExpired(90);
    expect(purged).toBe(1);
    expect(await repo.get(fresh.id)).toBeDefined();
  });
});
