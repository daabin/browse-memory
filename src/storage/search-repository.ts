import {
  loadStoredIndex,
  searchIndex,
} from "../search/bm25";
import {
  reciprocalRankFusion,
  vectorSearch,
} from "../search/hybrid-search";
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

  async search(
    query: string,
    limit = 10,
    options?: { embeddingQuery?: number[] },
  ): Promise<SearchResult[]> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 && !options?.embeddingQuery) {
      return [];
    }

    // BM25 search (always)
    let bm25Ranked: Array<{ pageId: string; score: number }> = [];
    if (queryTokens.length > 0) {
      const [documents, matchingTerms] = await Promise.all([
        this.database.bm25Documents.toArray(),
        this.database.bm25Terms
          .where("term")
          .anyOf(queryTokens)
          .toArray(),
      ]);

      if (documents.length > 0) {
        const index = loadStoredIndex(documents, matchingTerms);
        bm25Ranked = searchIndex(index, query, limit);
      }
    }

    // Hybrid: fuse BM25 + vector results when embedding query is available
    let ranked: Array<{ pageId: string; score: number }>;
    if (options?.embeddingQuery) {
      const allEmbeddings = await this.database.embeddings.toArray();
      const vectorResults = vectorSearch(
        allEmbeddings,
        options.embeddingQuery,
        limit,
      );
      const fused = reciprocalRankFusion(bm25Ranked, vectorResults);
      ranked = fused
        .slice(0, limit)
        .map((r) => ({ pageId: r.pageId, score: r.score }));
    } else {
      ranked = bm25Ranked;
    }

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
