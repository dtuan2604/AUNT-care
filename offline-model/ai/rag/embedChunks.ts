import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  AI_DATA_DIR,
  CHUNKS_PATH,
  EMBEDDING_BATCH_SIZE,
  EMBEDDINGS_PATH,
} from "../config.js";
import type { MedicalChunk, StoredEmbedding } from "../types.js";
import { LocalEmbeddingAssetsError, embedTexts } from "./localEmbeddings.js";

function chunkArray<T>(items: T[], batchSize: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

async function main() {
  const rawChunks = await readFile(CHUNKS_PATH, "utf8");
  const medicalChunks = JSON.parse(rawChunks) as MedicalChunk[];

  const embeddingRecords: StoredEmbedding[] = [];
  const chunkBatches = chunkArray(medicalChunks, EMBEDDING_BATCH_SIZE);

  for (let index = 0; index < chunkBatches.length; index += 1) {
    const batch = chunkBatches[index] ?? [];
    if (batch.length === 0) {
      continue;
    }

    const vectors = await embedTexts(batch.map((chunk) => chunk.text));
    for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
      const chunk = batch[itemIndex];
      const vector = vectors[itemIndex];
      if (!chunk || !vector) {
        throw new Error("Embedding batch output did not match input chunk count.");
      }

      embeddingRecords.push({
        id: chunk.id,
        embedding: vector,
      });
    }

    console.log(
      `Embedded batch ${index + 1}/${chunkBatches.length} (${embeddingRecords.length}/${medicalChunks.length})`,
    );
  }

  await mkdir(AI_DATA_DIR, { recursive: true });
  await writeFile(EMBEDDINGS_PATH, JSON.stringify(embeddingRecords), "utf8");

  console.log(`Saved ${embeddingRecords.length} embeddings to ${EMBEDDINGS_PATH}`);
}

main().catch((error: unknown) => {
  if (error instanceof LocalEmbeddingAssetsError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate embeddings: ${message}`);
  process.exitCode = 1;
});
