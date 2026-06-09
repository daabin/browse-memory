import { tokenize } from "./tokenize";

export interface Bm25InputDocument {
  pageId: string;
  title: string;
  content: string;
}

interface IndexedDocument {
  pageId: string;
  length: number;
  frequencies: Map<string, number>;
}

export interface Bm25Index {
  documents: Map<string, IndexedDocument>;
  documentFrequency: Map<string, number>;
  totalLength: number;
}

export interface Bm25Result {
  pageId: string;
  score: number;
}

export interface Bm25StoredDocument {
  pageId: string;
  length: number;
  frequencies: Record<string, number>;
}

export interface Bm25StoredTerm {
  term: string;
  documentFrequency: number;
  postings: Array<{ pageId: string; termFrequency: number }>;
}

export function createBm25Index(): Bm25Index {
  return {
    documents: new Map(),
    documentFrequency: new Map(),
    totalLength: 0,
  };
}

export function loadStoredIndex(
  storedDocuments: Bm25StoredDocument[],
  storedTerms: Bm25StoredTerm[],
): Bm25Index {
  const index = createBm25Index();
  let totalLength = 0;

  for (const doc of storedDocuments) {
    const frequencies = new Map(Object.entries(doc.frequencies));
    index.documents.set(doc.pageId, {
      pageId: doc.pageId,
      length: doc.length,
      frequencies,
    });
    totalLength += doc.length;
  }

  for (const term of storedTerms) {
    index.documentFrequency.set(term.term, term.documentFrequency);
  }

  index.totalLength = totalLength;
  return index;
}

function frequenciesFor(document: Bm25InputDocument): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokenize(document.content)) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  for (const token of tokenize(document.title)) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 2);
  }
  return frequencies;
}

export function removeDocument(index: Bm25Index, pageId: string): void {
  const previous = index.documents.get(pageId);
  if (!previous) {
    return;
  }

  index.documents.delete(pageId);
  index.totalLength -= previous.length;
  for (const term of previous.frequencies.keys()) {
    const nextFrequency = (index.documentFrequency.get(term) ?? 1) - 1;
    if (nextFrequency === 0) {
      index.documentFrequency.delete(term);
    } else {
      index.documentFrequency.set(term, nextFrequency);
    }
  }
}

export function upsertDocument(
  index: Bm25Index,
  document: Bm25InputDocument,
): void {
  removeDocument(index, document.pageId);
  const frequencies = frequenciesFor(document);
  const length = [...frequencies.values()].reduce(
    (total, frequency) => total + frequency,
    0,
  );

  index.documents.set(document.pageId, {
    pageId: document.pageId,
    length,
    frequencies,
  });
  index.totalLength += length;
  for (const term of frequencies.keys()) {
    index.documentFrequency.set(
      term,
      (index.documentFrequency.get(term) ?? 0) + 1,
    );
  }
}

export function searchIndex(
  index: Bm25Index,
  query: string,
  limit = 20,
): Bm25Result[] {
  const queryTerms = [...new Set(tokenize(query))];
  const documentCount = index.documents.size;
  if (queryTerms.length === 0 || documentCount === 0) {
    return [];
  }

  const averageLength = index.totalLength / documentCount || 1;
  const k1 = 1.2;
  const b = 0.75;
  const results: Bm25Result[] = [];

  for (const document of index.documents.values()) {
    let score = 0;
    for (const term of queryTerms) {
      const termFrequency = document.frequencies.get(term) ?? 0;
      if (termFrequency === 0) {
        continue;
      }
      const documentFrequency = index.documentFrequency.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(
        1 + (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5),
      );
      const denominator =
        termFrequency +
        k1 * (1 - b + b * (document.length / averageLength));
      score +=
        inverseDocumentFrequency *
        ((termFrequency * (k1 + 1)) / denominator);
    }
    if (score > 0) {
      results.push({ pageId: document.pageId, score });
    }
  }

  return results.sort((a, bResult) => bResult.score - a.score).slice(0, limit);
}
