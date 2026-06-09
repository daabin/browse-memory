import {
  createBm25Index,
  searchIndex,
  upsertDocument,
} from "@/search/bm25";
import { buildSnippet } from "@/search/snippet";
import { tokenize } from "@/search/tokenize";
import type { SearchResult } from "@/shared/types";

import type { BrowseMemoryDatabase } from "./database";

export class SearchRepository {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const pages = await this.database.pages.toArray();
    const index = createBm25Index();
    for (const page of pages) {
      upsertDocument(index, {
        pageId: page.id,
        title: page.title,
        content: page.content,
      });
    }

    const ranked = searchIndex(index, query, limit);
    const pageMap = new Map(pages.map((page) => [page.id, page]));
    const queryTokens = tokenize(query);

    return ranked.flatMap(({ pageId, score }) => {
      const page = pageMap.get(pageId);
      if (!page) {
        return [];
      }
      const snippet = buildSnippet(
        `${page.title}\n${page.content}`,
        queryTokens,
      );
      return [
        {
          page,
          score,
          snippet: snippet.text,
          highlights: snippet.ranges,
        },
      ];
    });
  }
}
