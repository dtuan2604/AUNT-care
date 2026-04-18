import { access } from "node:fs/promises";
import { spawn } from "node:child_process";

import {
  GGUF_MODEL_PATH,
  LLAMA_CPP_BIN,
  LOCAL_LLM_BINARY_MISSING_MESSAGE,
  LOCAL_LLM_MISSING_MESSAGE,
  MAX_OUTPUT_TOKENS,
} from "../config.js";

export class LocalLlmError extends Error {}

async function ensureLocalLlmAssets() {
  try {
    await access(GGUF_MODEL_PATH);
  } catch {
    throw new LocalLlmError(LOCAL_LLM_MISSING_MESSAGE);
  }
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}

function buildArgs(prompt: string) {
  return [
    "-m",
    GGUF_MODEL_PATH,
    "--device",
    "none",
    "-ngl",
    "0",
    "--simple-io",
    "--no-display-prompt",
    "-p",
    prompt,
    "-n",
    String(MAX_OUTPUT_TOKENS),
    "-c",
    "4096",
    "--temp",
    "0.3",
    "--top-p",
    "0.9",
    "--seed",
    "42",
  ];
}

async function runPrompt(prompt: string): Promise<string> {
  await ensureLocalLlmAssets();

  return new Promise((resolve, reject) => {
    const child = spawn(LLAMA_CPP_BIN, buildArgs(prompt), {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new LocalLlmError(LOCAL_LLM_BINARY_MISSING_MESSAGE));
        return;
      }

      reject(error);
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new LocalLlmError(
            stripAnsi(stderr.trim()) || `llama-cli exited with code ${code}`,
          ),
        );
        return;
      }

      resolve(stripAnsi(stdout).trim());
    });
  });
}

export async function generateResponse(prompt: string) {
  return runPrompt(prompt);
}

// Optional: fake streaming (for UI compatibility)
export async function streamResponse(
  prompt: string,
  onToken?: (token: string) => void,
) {
  const full = await runPrompt(prompt);

  if (onToken) {
    const tokens = full.split(" ");
    for (const t of tokens) {
      onToken(t + " ");
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  return full;
}
