import type { EmbeddingRecord } from "../shared/types";

export interface VectorResult {
  pageId: string;
  score: number;
}

export interface FusedResult {
  pageId: string;
  score: number;
}

/**
 * Cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Brute-force vector search. Acceptable for < 10K documents.
 */
export function vectorSearch(
  embeddings: EmbeddingRecord[],
  queryVector: number[],
  topK = 10,
): VectorResult[] {
  const results: VectorResult[] = [];
  for (const record of embeddings) {
    const score = cosineSimilarity(queryVector, record.vector);
    if (score > 0) {
      results.push({ pageId: record.pageId, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, topK);
}

/**
 * Reciprocal Rank Fusion (RRF).
 * Merges BM25 and vector results into a unified ranking.
 *
 * RRF score = sum(1 / (k + rank))
 * where rank is 1-based position in each result list.
 */
export function reciprocalRankFusion(
  bm25Results: Array<{ pageId: string }>,
  vectorResults: Array<{ pageId: string }>,
  k = 60,
): FusedResult[] {
  const scores = new Map<string, number>();

  for (let i = 0; i < bm25Results.length; i++) {
    const pageId = bm25Results[i].pageId;
    scores.set(pageId, (scores.get(pageId) ?? 0) + 1 / (k + i + 1));
  }

  for (let i = 0; i < vectorResults.length; i++) {
    const pageId = vectorResults[i].pageId;
    scores.set(pageId, (scores.get(pageId) ?? 0) + 1 / (k + i + 1));
  }

  return [...scores.entries()]
    .map(([pageId, score]) => ({ pageId, score }))
    .sort((a, b) => b.score - a.score);
}
