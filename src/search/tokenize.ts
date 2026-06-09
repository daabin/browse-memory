const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "了",
  "和",
  "是",
  "的",
  "在",
]);

const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("zh-CN", { granularity: "word" })
    : undefined;

function fallbackSegments(text: string): string[] {
  return text.match(/[\p{Script=Han}]+|[\p{L}\p{N}]+/gu) ?? [];
}

export function tokenize(value: string): string[] {
  const normalized = value.normalize("NFKC").toLowerCase();
  const candidates = segmenter
    ? [...segmenter.segment(normalized)]
        .filter((part) => part.isWordLike)
        .map((part) => part.segment)
    : fallbackSegments(normalized);
  const chinesePhrases = normalized.match(/[\p{Script=Han}]{2,}/gu) ?? [];

  return [...candidates, ...chinesePhrases]
    .flatMap((candidate) => candidate.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}
