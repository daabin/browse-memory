import type { EmbeddingRecord } from "../shared/types";
import type { BrowseMemoryDatabase } from "./database";

export class EmbeddingRepository {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async get(pageId: string): Promise<EmbeddingRecord | undefined> {
    return this.database.embeddings.get(pageId);
  }

  async put(record: EmbeddingRecord): Promise<void> {
    await this.database.embeddings.put(record);
  }

  async delete(pageId: string): Promise<void> {
    await this.database.embeddings.delete(pageId);
  }

  async getAll(): Promise<EmbeddingRecord[]> {
    return this.database.embeddings.toArray();
  }

  async count(): Promise<number> {
    return this.database.embeddings.count();
  }

  async getUnembeddedPageIds(): Promise<string[]> {
    const [pageIds, embeddedIds] = await Promise.all([
      this.database.pages.toCollection().keys(),
      this.database.embeddings.toCollection().keys(),
    ]);
    const embedded = new Set(embeddedIds as string[]);
    return (pageIds as string[]).filter((id) => !embedded.has(id));
  }
}
