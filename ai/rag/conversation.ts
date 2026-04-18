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

const NO_CONTEXT_FALLBACK: ConversationResponse = {
  assistant_message:
    "I don't have enough grounded WHO guidance for that yet. Please tell me your main symptom, how long it has been happening, and any warning signs you have noticed.",
  follow_up_questions: [
    "What is the main symptom or concern you want help with?",
    "How long has it been happening, and have you noticed any warning signs like trouble breathing, severe pain, or heavy bleeding?",
  ],
  urgency: "medium",
  reasoning: "Relevant WHO context was not found for the query.",
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
  return `You are a conversational health information assistant using trusted WHO medical guidance.

Your job:
- talk naturally and clearly
- ask useful follow-up questions
- answer only from the provided context
- estimate whether the situation seems low, medium, or high urgency
- if the symptoms sound serious, clearly tell the user to seek urgent medical care
- do not invent facts outside the context
- do not make certain diagnoses unless the context explicitly supports that wording
- do not prescribe medication as a doctor would
- you may mention general care or first-step guidance only if supported by the context
- keep assistant_message in simple English, with a warm calm tone, concise but useful
- return only valid JSON with no markdown fences or extra text

Context:
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
  "reasoning": "brief grounded explanation based on the context"
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
  const attempts = [rawOutput, extractJsonSubstring(rawOutput)].filter(
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

  if (retrievedChunks.length === 0) {
    return {
      response: NO_CONTEXT_FALLBACK,
      retrievedChunks: [],
      rawModelOutput: null,
    };
  }

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
