# Offline WHO Medical RAG Prototype

This prototype ingests the WHO PDF in `model/who_guidelines.pdf`, precomputes embeddings once, retrieves the most relevant WHO chunks at runtime, and sends a grounded prompt to a local GGUF chat model through `llama-cli`.

## Quickest Local Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Download the local embedding model snapshot into:

```text
ai/models/embeddings/Xenova/all-MiniLM-L6-v2/
```

Recommended embedding model:
- `Xenova/all-MiniLM-L6-v2`
- Link: https://huggingface.co/Xenova/all-MiniLM-L6-v2

Example download command:

```bash
huggingface-cli download Xenova/all-MiniLM-L6-v2 --local-dir ai/models/embeddings/Xenova/all-MiniLM-L6-v2 --local-dir-use-symlinks False
```

3. Place local ONNX WASM assets in:

```text
ai/models/embeddings/wasm/
```

The embedding loader is local-only by design. It sets:
- `env.allowRemoteModels = false`
- `env.allowLocalModels = true`
- `env.localModelPath = ai/models/embeddings`
- `env.backends.onnx.wasm.wasmPaths = ai/models/embeddings/wasm`

The quickest way to seed the WASM directory after `npm install` is to copy the local package assets into place:

```bash
mkdir -p ai/models/embeddings/wasm
cp node_modules/@huggingface/transformers/dist/ort-wasm* ai/models/embeddings/wasm/
```

4. Download a local GGUF chat model and place it at:

```text
ai/models/chat.gguf
```

Recommended chat model:
- `Qwen/Qwen2.5-3B-Instruct-GGUF`
- Fast prototype file: `qwen2.5-3b-instruct-q4_k_m.gguf`
- Better quality if memory allows: `qwen2.5-3b-instruct-q5_k_m.gguf`
- Link: https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF

Example download command:

```bash
huggingface-cli download Qwen/Qwen2.5-3B-Instruct-GGUF qwen2.5-3b-instruct-q4_k_m.gguf --local-dir ai/models --local-dir-use-symlinks False
mv ai/models/qwen2.5-3b-instruct-q4_k_m.gguf ai/models/chat.gguf
```

5. Make sure `llama-cli` is installed locally, or set `LLAMA_CPP_BIN` to the full path of your `llama.cpp` binary.

## Run The Prototype

Process the WHO PDF into chunks:

```bash
npm run process:medical
```

Generate embeddings once:

```bash
npm run embed:chunks
```

Run the CLI conversation loop:

```bash
npm run test:conversation
```

Optional debug mode to print retrieved chunk titles and scores:

```bash
npm run test:conversation -- --debug
```

## Important Error Messages

If the embedding model snapshot is missing, the scripts log this exact message and exit cleanly:

```text
Embedding model not found. Please place model in ai/models/embeddings/...
```

If retrieval finds no useful grounded WHO context, the conversation pipeline returns a safe fallback JSON instead of crashing.

If the model returns malformed output, the pipeline:
1. tries `JSON.parse`
2. extracts the JSON object substring and retries
3. returns deterministic fallback JSON if parsing still fails

## Notes

- v1 uses only the WHO PDF.
- MedlinePlus ingestion is intentionally excluded in this prototype.
- Chunk embeddings are precomputed offline into `ai/data/embeddings.json`.
- Query embeddings are generated locally at runtime from the local embedding directory only.
