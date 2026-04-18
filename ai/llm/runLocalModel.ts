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
    "-p",
    prompt,
    "-n",
    String(MAX_OUTPUT_TOKENS),
    "-c",
    "4096",
    "--temp",
    "0.2",
    "--top-p",
    "0.9",
    "--seed",
    "42",
  ];
}

async function runPrompt(
  prompt: string,
  onToken?: (token: string) => void,
) {
  await ensureLocalLlmAssets();

  return new Promise<string>((resolve, reject) => {
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
      const text = chunk.toString("utf8");
      stdout += text;
      onToken?.(text);
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

export async function streamResponse(
  prompt: string,
  onToken?: (token: string) => void,
) {
  return runPrompt(prompt, onToken);
}
