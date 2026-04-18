import { readFile } from "node:fs/promises";

import {
  CHUNKS_PATH,
  EMBEDDINGS_PATH,
  MIN_SIMILARITY,
  TOP_K,
} from "../config.js";
import type { MedicalChunk, RetrievedChunk, StoredEmbedding } from "../types.js";
import { LocalEmbeddingAssetsError, embedText } from "./localEmbeddings.js";

let indexPromise: Promise<Array<{ chunk: MedicalChunk; embedding: number[] }>> | null = null;

async function loadIndex() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const [chunkText, embeddingText] = await Promise.all([
        readFile(CHUNKS_PATH, "utf8"),
        readFile(EMBEDDINGS_PATH, "utf8"),
      ]);

      const chunks = JSON.parse(chunkText) as MedicalChunk[];
      const embeddings = JSON.parse(embeddingText) as StoredEmbedding[];
      const chunkMap = new Map(chunks.map((chunk) => [chunk.id, chunk]));

      return embeddings.flatMap((record) => {
        const chunk = chunkMap.get(record.id);
        if (!chunk) {
          return [];
        }

        return [{ chunk, embedding: record.embedding }];
      });
    })();
  }

  return indexPromise;
}

export async function embedQuery(query: string) {
  return embedText(query);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const aValue = a[index] ?? 0;
    const bValue = b[index] ?? 0;
    dotProduct += aValue * bValue;
    normA += aValue * aValue;
    normB += bValue * bValue;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export async function retrieveTopChunks(query: string, k = TOP_K): Promise<RetrievedChunk[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  try {
    const [queryEmbedding, index] = await Promise.all([
      embedQuery(trimmedQuery),
      loadIndex(),
    ]);

    return index
      .map(({ chunk, embedding }) => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, embedding),
      }))
      .filter((chunk) => chunk.similarity >= MIN_SIMILARITY)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, k);
  } catch (error: unknown) {
    if (error instanceof LocalEmbeddingAssetsError) {
      console.error(error.message);
      return [];
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to retrieve WHO context: ${message}`);
    return [];
  }
}
