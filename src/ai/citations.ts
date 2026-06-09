import type { RagSource } from "../shared/types";

export function resolveCitations(
  answer: string,
  sources: RagSource[],
): RagSource[] {
  const cited = new Set(
    [...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])),
  );
  return sources.filter((source) => cited.has(source.index));
}
