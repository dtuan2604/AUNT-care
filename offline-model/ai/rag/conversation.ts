import {
  DEFAULT_WHO_TITLE,
  MAX_CONTEXT_CHARS,
  MAX_HISTORY_MESSAGES,
} from "../config.js";
import { LocalLlmError, generateResponse } from "../llm/runLocalModel.js";
import type {
  ConversationMessage,
  ConversationResponse,
  ConversationTurnInput,
  ConversationTurnResult,
  RetrievedChunk,
} from "../types.js";
import { retrieveTopChunks } from "./retrieveContext.js";

const PARSE_FAILURE_FALLBACK: ConversationResponse = {
  assistant_message:
    "I couldn't format a reliable answer just now. Please restate your main symptom and how long it has been going on. If the symptoms are severe, getting worse quickly, or feel urgent, please seek urgent medical care now.",
  follow_up_questions: [
    "What is the main symptom you are dealing with right now?",
    "How long has this been going on, and have you noticed any warning signs getting worse?",
  ],
  urgency: "medium",
  reasoning:
    "The local model response was not valid JSON, so a conservative fallback was returned.",
};

function trimHistory(history: ConversationMessage[]) {
  return history.slice(-MAX_HISTORY_MESSAGES);
}

function formatHistory(history: ConversationMessage[]) {
  if (history.length === 0) {
    return "No prior conversation.";
  }

  return trimHistory(history)
    .map((message) =>
      `${message.role === "user" ? "User" : "Assistant"}: ${message.message}`,
    )
    .join("\n");
}

function formatRetrievedChunks(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) {
    return "";
  }

  const sections: string[] = [];
  let currentLength = 0;

  for (const [index, chunk] of chunks.entries()) {
    const formatted = [
      `Chunk ${index + 1}`,
      `Source: ${chunk.source}`,
      `Title: ${chunk.title || DEFAULT_WHO_TITLE}`,
      `Relevance: ${chunk.similarity.toFixed(3)}`,
      chunk.text,
    ].join("\n");

    if (currentLength + formatted.length > MAX_CONTEXT_CHARS && sections.length > 0) {
      break;
    }

    sections.push(formatted);
    currentLength += formatted.length;
  }

  return sections.join("\n\n");
}

function buildPrompt(
  retrievedChunks: RetrievedChunk[],
  history: ConversationMessage[],
  userInput: string,
) {
  return `You are a conversational health assistant focused on pre-screening and early guidance.

Your behavior:
- Speak naturally and calmly like a helpful assistant
- Start conversations normally and greet the user when appropriate
- Ask follow-up questions to understand symptoms better
- When medical context is provided, use it to give grounded guidance
- If no context is available, continue asking questions and guiding the user
- Estimate urgency (low, medium, high) based on symptoms
- If symptoms sound serious, clearly suggest seeking medical help
- If the user says something vague like "hello" or "hi", respond conversationally and ask what is bothering them today
- If retrieved context looks generic or not clearly related, do not force it into the answer

Constraints:
- Do not make definitive diagnoses
- Do not prescribe medications like a doctor
- You may suggest general care steps if appropriate
- Keep responses simple and human-like
- Keep assistant_message concise, calm, and useful
- Return only valid JSON with no markdown fences or extra text

Context (may be empty):
${formatRetrievedChunks(retrievedChunks)}

Conversation history:
${formatHistory(history)}

User:
${userInput}

Return ONLY valid JSON:
{
  "assistant_message": "...",
  "follow_up_questions": ["...", "..."],
  "urgency": "low" | "medium" | "high",
  "reasoning": "short explanation"
}`;
}

function extractJsonSubstring(rawOutput: string) {
  const firstBrace = rawOutput.indexOf("{");
  const lastBrace = rawOutput.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return rawOutput.slice(firstBrace, lastBrace + 1);
}

function repairJsonString(rawJson: string) {
  return rawJson
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([}"\]])\s*("([A-Za-z_][A-Za-z0-9_]*)"\s*:)/g, "$1,\n$2");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateConversationResponse(value: unknown): ConversationResponse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const assistantMessage = candidate.assistant_message;
  const followUpQuestions = candidate.follow_up_questions;
  const urgency = candidate.urgency;
  const reasoning = candidate.reasoning;

  if (
    typeof assistantMessage !== "string" ||
    !isStringArray(followUpQuestions) ||
    typeof reasoning !== "string"
  ) {
    return null;
  }

  const normalizedUrgency =
    typeof urgency === "string" ? urgency.toLowerCase() : "";
  if (
    normalizedUrgency !== "low" &&
    normalizedUrgency !== "medium" &&
    normalizedUrgency !== "high"
  ) {
    return null;
  }

  return {
    assistant_message: assistantMessage.trim(),
    follow_up_questions: followUpQuestions.map((question) => question.trim()).filter(Boolean).slice(0, 3),
    urgency: normalizedUrgency,
    reasoning: reasoning.trim(),
  };
}

function parseResponseJson(rawOutput: string) {
  const extracted = extractJsonSubstring(rawOutput);
  const attempts = [rawOutput, extracted, extracted ? repairJsonString(extracted) : null].filter(
    (value): value is string => Boolean(value),
  );

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      const validated = validateConversationResponse(parsed);
      if (validated) {
        return validated;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function buildModelFailureFallback(reason: string): ConversationResponse {
  return {
    ...PARSE_FAILURE_FALLBACK,
    reasoning: reason,
  };
}

export async function runConversationTurnDetailed(
  input: ConversationTurnInput,
): Promise<ConversationTurnResult> {
  const retrievedChunks = await retrieveTopChunks(input.userInput);

  const prompt = buildPrompt(retrievedChunks, input.history, input.userInput);

  let rawModelOutput: string;
  try {
    rawModelOutput = await generateResponse(prompt);
  } catch (error: unknown) {
    const reason =
      error instanceof LocalLlmError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      response: buildModelFailureFallback(
        `The local model could not produce a usable response, so a conservative fallback was returned. ${reason}`,
      ),
      retrievedChunks,
      rawModelOutput: null,
    };
  }

  const parsed = parseResponseJson(rawModelOutput);

  return {
    response: parsed ?? PARSE_FAILURE_FALLBACK,
    retrievedChunks,
    rawModelOutput,
  };
}

export async function runConversationTurn(input: ConversationTurnInput) {
  const result = await runConversationTurnDetailed(input);
  return result.response;
}
