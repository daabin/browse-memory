import {
  loadStoredIndex,
  searchIndex,
} from "../search/bm25";
import { buildSnippet } from "../search/snippet";
import { tokenize } from "../search/tokenize";
import type { SearchResult } from "../shared/types";

import type { BrowseMemoryDatabase } from "./database";

export class SearchRepository {
  constructor(private readonly database: BrowseMemoryDatabase) {}

  async recent(limit = 6): Promise<SearchResult[]> {
    const pages = await this.database.pages
      .orderBy("updatedAt")
      .reverse()
      .limit(limit)
      .toArray();
    return pages.map((page) => {
      const snippet = buildSnippet(`${page.title}\n${page.content}`, [], 180);
      return {
        page,
        score: 0,
        snippet: snippet.text,
        highlights: [],
      };
    });
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const [documents, matchingTerms] = await Promise.all([
      this.database.bm25Documents.toArray(),
      this.database.bm25Terms
        .where("term")
        .anyOf(queryTokens)
        .toArray(),
    ]);

    if (documents.length === 0) {
      return [];
    }

    const index = loadStoredIndex(documents, matchingTerms);
    const ranked = searchIndex(index, query, limit);
    if (ranked.length === 0) {
      return [];
    }

    const pageIds = ranked.map((r) => r.pageId);
    const pages = await this.database.pages
      .where("id")
      .anyOf(pageIds)
      .toArray();
    const pageMap = new Map(pages.map((page) => [page.id, page]));

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
