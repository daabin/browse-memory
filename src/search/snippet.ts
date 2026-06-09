import type { HighlightRange } from "@/shared/types";

export interface Snippet {
  text: string;
  ranges: HighlightRange[];
}

export function buildSnippet(
  content: string,
  queryTokens: string[],
  maximumLength = 180,
): Snippet {
  const normalizedContent = content.replace(/\s+/g, " ").trim();
  const lowerContent = normalizedContent.toLowerCase();
  const matches = queryTokens
    .map((token) => lowerContent.indexOf(token.toLowerCase()))
    .filter((position) => position >= 0);
  const firstMatch = matches.length > 0 ? Math.min(...matches) : 0;
  const halfWindow = Math.floor(maximumLength / 2);
  const start = Math.max(
    0,
    Math.min(
      firstMatch - halfWindow,
      Math.max(0, normalizedContent.length - maximumLength),
    ),
  );
  const rawText = normalizedContent.slice(start, start + maximumLength);
  const prefix = start > 0 ? "…" : "";
  const suffix =
    start + maximumLength < normalizedContent.length ? "…" : "";
  const text = `${prefix}${rawText}${suffix}`;
  const ranges: HighlightRange[] = [];

  for (const token of [...new Set(queryTokens.map((item) => item.toLowerCase()))]) {
    let offset = 0;
    const lowerText = text.toLowerCase();
    while (offset < lowerText.length) {
      const match = lowerText.indexOf(token, offset);
      if (match < 0) {
        break;
      }
      ranges.push({ start: match, end: match + token.length });
      offset = match + token.length;
    }
  }

  return {
    text,
    ranges: ranges.sort((a, b) => a.start - b.start),
  };
}
