import path from "node:path";

const cwd = process.cwd();

function resolveFromRepo(...parts: string[]) {
  return path.resolve(cwd, ...parts);
}

function getNumberEnv(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const WHO_SOURCE_PATH = resolveFromRepo(
  process.env.WHO_SOURCE_PATH ?? "model/who_guidelines.pdf",
);
export const AI_DATA_DIR = resolveFromRepo("ai/data");
export const CHUNKS_PATH = resolveFromRepo(
  process.env.CHUNKS_PATH ?? "ai/data/medical_chunks.json",
);
export const EMBEDDINGS_PATH = resolveFromRepo(
  process.env.EMBEDDINGS_PATH ?? "ai/data/embeddings.json",
);

export const EMBEDDING_MODEL_ID =
  process.env.EMBEDDING_MODEL_ID ?? "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_MODEL_ROOT = resolveFromRepo(
  process.env.EMBEDDING_MODEL_ROOT ?? "ai/models/embeddings",
);
export const EMBEDDING_MODEL_DIR = resolveFromRepo(
  process.env.EMBEDDING_MODEL_DIR ??
    path.join("ai/models/embeddings", EMBEDDING_MODEL_ID),
);
export const EMBEDDING_WASM_DIR = resolveFromRepo(
  process.env.EMBEDDING_WASM_DIR ?? "ai/models/embeddings/wasm",
);

export const GGUF_MODEL_PATH = resolveFromRepo(
  process.env.GGUF_MODEL_PATH ?? "ai/models/chat.gguf",
);
export const LLAMA_CPP_BIN = process.env.LLAMA_CPP_BIN ?? "llama-cli";

export const DEFAULT_WHO_TITLE = "WHO Self-care interventions guideline";
export const TOP_K = getNumberEnv("TOP_K", 4);
export const MIN_SIMILARITY = getNumberEnv("MIN_SIMILARITY", 0.2);
export const MAX_CONTEXT_CHARS = getNumberEnv("MAX_CONTEXT_CHARS", 10000);
export const MAX_OUTPUT_TOKENS = getNumberEnv("MAX_OUTPUT_TOKENS", 350);
export const MAX_HISTORY_MESSAGES = getNumberEnv("MAX_HISTORY_MESSAGES", 12);

export const CHUNK_TARGET_WORDS = getNumberEnv("CHUNK_TARGET_WORDS", 520);
export const CHUNK_MIN_WORDS = getNumberEnv("CHUNK_MIN_WORDS", 300);
export const CHUNK_MAX_WORDS = getNumberEnv("CHUNK_MAX_WORDS", 700);
export const CHUNK_OVERLAP_WORDS = getNumberEnv("CHUNK_OVERLAP_WORDS", 80);

export const EMBEDDING_BATCH_SIZE = getNumberEnv("EMBEDDING_BATCH_SIZE", 8);

export const EMBEDDING_MODEL_MISSING_MESSAGE =
  "Embedding model not found. Please place model in ai/models/embeddings/...";
export const EMBEDDING_WASM_MISSING_MESSAGE =
  "Embedding WASM files not found. Please place ONNX WASM assets in ai/models/embeddings/wasm/.";
export const LOCAL_LLM_MISSING_MESSAGE =
  "Local GGUF model not found. Please place your chat model at ai/models/chat.gguf or set GGUF_MODEL_PATH.";
export const LOCAL_LLM_BINARY_MISSING_MESSAGE =
  "llama-cli not found. Please install llama.cpp and ensure LLAMA_CPP_BIN points to the local binary.";
