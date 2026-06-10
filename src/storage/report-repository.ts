import type { ReportRecord, ReportType } from "../shared/types";
import type { BrowseMemoryDatabase } from "./database";

export class ReportRepository {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async list(type?: ReportType): Promise<ReportRecord[]> {
    const collection = type
      ? this.database.reports.where("type").equals(type)
      : this.database.reports.toCollection();
    return collection.reverse().sortBy("createdAt");
  }

  async get(id: string): Promise<ReportRecord | undefined> {
    return this.database.reports.get(id);
  }

  async getByDate(date: string): Promise<ReportRecord | undefined> {
    return this.database.reports.where("date").equals(date).first();
  }

  async save(report: ReportRecord): Promise<void> {
    await this.database.reports.put(report);
  }

  async delete(id: string): Promise<void> {
    await this.database.reports.delete(id);
  }

  async purgeExpired(retentionDays: number, now = Date.now()): Promise<number> {
    const cutoff = now - retentionDays * 86_400_000;
    const expired = await this.database.reports
      .filter((r) => r.createdAt < cutoff)
      .primaryKeys();
    if (expired.length === 0) return 0;
    await this.database.reports.bulkDelete(expired);
    return expired.length;
  }
}
