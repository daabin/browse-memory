import type { RagSource, SearchResult } from "../shared/types";

export interface RagContext {
  text: string;
  sources: RagSource[];
}

const MAX_CONTENT_PER_SOURCE = 2_000;

function truncateContent(content: string, limit: number): string {
  if (content.length <= limit) {
    return content;
  }
  return content.slice(0, limit) + "…";
}

export function buildRagContext(
  results: SearchResult[],
  maximumCharacters = 12_000,
): RagContext {
  const selected = results.slice(0, 5);
  const sources = selected.map(({ page }, index) => ({
    index: index + 1,
    title: page.title,
    url: page.url,
  }));
  const blocks = selected.map(
    ({ page }, index) =>
      `[${index + 1}] ${page.title}\nURL: ${page.url}\n日期: ${page.visitDate} | 阅读: ${Math.max(1, Math.round(page.durationSeconds / 60))} 分钟\n${truncateContent(page.content, MAX_CONTENT_PER_SOURCE)}`,
  );

  return {
    text: blocks.join("\n\n").slice(0, maximumCharacters),
    sources,
  };
}
