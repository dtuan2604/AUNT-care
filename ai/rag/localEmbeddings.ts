import { access, readdir } from "node:fs/promises";
import path from "node:path";

import { env, pipeline } from "@huggingface/transformers";

import {
  EMBEDDING_MODEL_DIR,
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_MISSING_MESSAGE,
  EMBEDDING_MODEL_ROOT,
  EMBEDDING_WASM_DIR,
  EMBEDDING_WASM_MISSING_MESSAGE,
} from "../config.js";

export class LocalEmbeddingAssetsError extends Error {}

let extractorPromise: Promise<any> | null = null;

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureLocalEmbeddingAssets() {
  const hasModelConfig = await pathExists(path.join(EMBEDDING_MODEL_DIR, "config.json"));
  const hasOnnxWeights =
    (await pathExists(path.join(EMBEDDING_MODEL_DIR, "onnx", "model.onnx"))) ||
    (await pathExists(path.join(EMBEDDING_MODEL_DIR, "onnx", "model_quantized.onnx"))) ||
    (await pathExists(path.join(EMBEDDING_MODEL_DIR, "model.onnx")));

  if (!hasModelConfig || !hasOnnxWeights) {
    throw new LocalEmbeddingAssetsError(EMBEDDING_MODEL_MISSING_MESSAGE);
  }

  let wasmFiles: string[] = [];
  try {
    wasmFiles = await readdir(EMBEDDING_WASM_DIR);
  } catch {
    wasmFiles = [];
  }

  const hasWasm = wasmFiles.some((fileName) => fileName.endsWith(".wasm"));
  if (!hasWasm) {
    throw new LocalEmbeddingAssetsError(EMBEDDING_WASM_MISSING_MESSAGE);
  }
}

export function configureEmbeddingEnvironment() {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = EMBEDDING_MODEL_ROOT;
  env.useFS = true;
  const onnxBackend = env.backends.onnx as { wasm?: { wasmPaths?: string } };
  onnxBackend.wasm ??= {};
  onnxBackend.wasm.wasmPaths = `${EMBEDDING_WASM_DIR}${path.sep}`;
}

export async function loadEmbeddingExtractor() {
  await ensureLocalEmbeddingAssets();
  configureEmbeddingEnvironment();

  extractorPromise ??= pipeline("feature-extraction", EMBEDDING_MODEL_ID);
  return extractorPromise;
}

function normalizeVector(values: number[]) {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    return values;
  }

  return values.map((value) => value / norm);
}

function toVectorList(output: any): number[][] {
  if (typeof output?.tolist === "function") {
    const asList = output.tolist();
    if (Array.isArray(asList) && Array.isArray(asList[0])) {
      return asList.map((row: unknown) => {
        if (!Array.isArray(row)) {
          return [];
        }

        return row.map((value) => Number(value));
      });
    }

    if (Array.isArray(asList)) {
      return [asList.map((value) => Number(value))];
    }
  }

  if (Array.isArray(output)) {
    if (Array.isArray(output[0])) {
      return output.map((row: unknown) =>
        Array.isArray(row) ? row.map((value: unknown) => Number(value)) : [],
      );
    }
    return [output.map((value: unknown) => Number(value))];
  }

  if (output?.data && Array.isArray(output?.dims)) {
    const data = Array.from(output.data as Iterable<number>);
    if (output.dims.length === 2) {
      const [, width] = output.dims;
      const rows: number[][] = [];
      for (let index = 0; index < data.length; index += width) {
        rows.push(data.slice(index, index + width));
      }
      return rows;
    }
    return [data];
  }

  throw new Error("Unexpected embedding output format.");
}

export async function embedTexts(texts: string[]) {
  const cleaned = texts.map((text) => text.trim());
  if (cleaned.length === 0) {
    return [];
  }

  const extractor = await loadEmbeddingExtractor();
  const output = await extractor(cleaned, {
    pooling: "mean",
    normalize: true,
  });

  return toVectorList(output).map((vector) => normalizeVector(vector));
}

export async function embedText(text: string) {
  const [embedding] = await embedTexts([text]);
  if (!embedding) {
    throw new Error("Failed to create embedding for input text.");
  }

  return embedding;
}
