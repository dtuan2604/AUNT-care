import { mkdir, readFile, writeFile } from "node:fs/promises";

import pdf from "pdf-parse";

import {
  AI_DATA_DIR,
  CHUNK_MAX_WORDS,
  CHUNK_MIN_WORDS,
  CHUNK_OVERLAP_WORDS,
  CHUNK_TARGET_WORDS,
  CHUNKS_PATH,
  DEFAULT_WHO_TITLE,
  WHO_SOURCE_PATH,
} from "../config.js";
import type { MedicalChunk } from "../types.js";

interface Section {
  heading: string;
  text: string;
}

interface SentenceUnit {
  heading: string;
  text: string;
  words: number;
}

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "among",
  "around",
  "because",
  "being",
  "between",
  "could",
  "does",
  "from",
  "have",
  "into",
  "more",
  "must",
  "only",
  "other",
  "same",
  "such",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "your",
  "health",
  "care",
  "self",
  "interventions",
  "intervention",
  "guideline",
  "guidelines",
  "recommendation",
  "recommendations",
  "women",
  "people",
  "person",
]);

const NOISE_PATTERNS = [
  /creative commons/i,
  /cataloguing-in-publication/i,
  /sales, rights and licensing/i,
  /third-party materials/i,
  /general disclaimers/i,
  /suggested citation/i,
  /this work is available under/i,
  /the use of the who logo is not permitted/i,
  /copyright/i,
];

function countWords(text: string) {
  const matches = text.match(/\b[\p{L}\p{N}'/-]+\b/gu);
  return matches?.length ?? 0;
}

function normalizeSpace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function slugIndex(index: number) {
  return String(index).padStart(4, "0");
}

function isLikelyHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120 || trimmed.length < 4) {
    return false;
  }

  if (/[.!?]$/.test(trimmed)) {
    return false;
  }

  if (/^\d+$/.test(trimmed)) {
    return false;
  }

  const words = trimmed.split(/\s+/);
  if (words.length > 14) {
    return false;
  }

  const alphaChars = trimmed.replace(/[^A-Za-z]/g, "");
  if (alphaChars.length < 4) {
    return false;
  }

  const uppercaseRatio =
    alphaChars.split("").filter((char) => char === char.toUpperCase()).length /
    alphaChars.length;

  const titleCaseRatio =
    words.filter((word) => /^[A-Z][A-Za-z0-9/-]*$/.test(word)).length / words.length;

  return uppercaseRatio > 0.8 || titleCaseRatio > 0.6;
}

function shouldDropLine(line: string, repeatedLines: Set<string>) {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  if (/^\d+$/.test(trimmed)) {
    return true;
  }

  if (/^page \d+$/i.test(trimmed)) {
    return true;
  }

  if (/^who\b/i.test(trimmed) && trimmed.length < 90 && repeatedLines.has(trimmed)) {
    return true;
  }

  if (repeatedLines.has(trimmed) && trimmed.length < 90) {
    return true;
  }

  return false;
}

function splitIntoSentences(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map((sentence) => normalizeSpace(sentence))
    .filter(Boolean);

  return sentences.length > 0 ? sentences : [normalizeSpace(text)];
}

function isLikelyNoiseBlock(block: string) {
  const normalized = normalizeSpace(block);
  if (!normalized) {
    return true;
  }

  const sectionNumberMatches = normalized.match(/\b\d+(?:\.\d+)+\b/g) ?? [];

  if (normalized === "## Contents") {
    return true;
  }

  if (/^##\s+isbn/i.test(normalized)) {
    return true;
  }

  if (
    normalized.startsWith("WHO guideline on self-care interventions for health and well-being, 2022 revision ISBN")
  ) {
    return true;
  }

  if (/photographer credits/i.test(normalized)) {
    return true;
  }

  if (
    sectionNumberMatches.length >= 8 ||
    (/foreword/i.test(normalized) &&
      /preface/i.test(normalized) &&
      /acknowledgements/i.test(normalized))
  ) {
    return true;
  }

  return NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildRepeatedLineSet(lines: string[]) {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const trimmed = normalizeSpace(line);
    if (!trimmed || trimmed.length > 90 || trimmed.length < 5) {
      continue;
    }
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count >= 4)
      .map(([line]) => line),
  );
}

function cleanPdfText(rawText: string) {
  const normalized = rawText
    .replace(/\r/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/\u00a0/g, " ");

  const rawLines = normalized.split("\n").map((line) => line.replace(/\s+/g, " ").trim());
  const repeatedLines = buildRepeatedLineSet(rawLines);

  const cleanedLines = rawLines.filter((line) => !shouldDropLine(line, repeatedLines));

  const blocks: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) {
      return;
    }

    const paragraph = normalizeSpace(paragraphBuffer.join(" "))
      .replace(/\[\d+(?:,\s*\d+)*\]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/©[^.]+/g, "")
      .replace(/\s{2,}/g, " ");

    if (countWords(paragraph) >= 5) {
      blocks.push(paragraph);
    }

    paragraphBuffer = [];
  };

  for (const line of cleanedLines) {
    if (!line) {
      flushParagraph();
      continue;
    }

    if (isLikelyHeading(line)) {
      flushParagraph();
      blocks.push(`## ${line}`);
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks.filter((block) => !isLikelyNoiseBlock(block));
}

function buildSections(blocks: string[]) {
  const sections: Section[] = [];
  let currentHeading = DEFAULT_WHO_TITLE;

  for (const block of blocks) {
    if (block.startsWith("## ")) {
      currentHeading = block.slice(3).trim() || DEFAULT_WHO_TITLE;
      continue;
    }

    sections.push({
      heading: currentHeading,
      text: block,
    });
  }

  return sections;
}

function toSentenceUnits(sections: Section[]) {
  const units: SentenceUnit[] = [];

  for (const section of sections) {
    const sentences = splitIntoSentences(section.text);
    for (const sentence of sentences) {
      const words = countWords(sentence);
      if (words === 0) {
        continue;
      }
      units.push({
        heading: section.heading,
        text: sentence,
        words,
      });
    }
  }

  return units;
}

function inferTags(title: string, text: string) {
  const tokenCounts = new Map<string, number>();
  const tokens = `${title} ${text}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    if (token.length < 4 || STOPWORDS.has(token)) {
      continue;
    }

    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }

  return Array.from(tokenCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([token]) => token);
}

function takeOverlapUnits(units: SentenceUnit[]) {
  const overlap: SentenceUnit[] = [];
  let accumulatedWords = 0;

  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];
    if (!unit) {
      continue;
    }

    overlap.unshift(unit);
    accumulatedWords += unit.words;
    if (accumulatedWords >= CHUNK_OVERLAP_WORDS) {
      break;
    }
  }

  return overlap;
}

function createChunk(units: SentenceUnit[], index: number): MedicalChunk {
  const title = units.at(-1)?.heading ?? DEFAULT_WHO_TITLE;
  const text = normalizeSpace(units.map((unit) => unit.text).join(" "));

  return {
    id: `who-${slugIndex(index)}`,
    source: "WHO",
    title,
    text,
    tags: inferTags(title, text),
  };
}

function buildChunks(units: SentenceUnit[]) {
  const chunks: MedicalChunk[] = [];
  let currentUnits: SentenceUnit[] = [];
  let currentWordCount = 0;

  const pushChunk = () => {
    if (currentUnits.length === 0) {
      return;
    }

    chunks.push(createChunk(currentUnits, chunks.length + 1));
    currentUnits = takeOverlapUnits(currentUnits);
    currentWordCount = currentUnits.reduce((sum, unit) => sum + unit.words, 0);
  };

  for (const unit of units) {
    if (
      currentWordCount >= CHUNK_MIN_WORDS &&
      currentWordCount + unit.words > CHUNK_MAX_WORDS
    ) {
      pushChunk();
    }

    currentUnits.push(unit);
    currentWordCount += unit.words;

    if (currentWordCount >= CHUNK_TARGET_WORDS) {
      pushChunk();
    }
  }

  if (currentUnits.length > 0) {
    const remainder = createChunk(currentUnits, chunks.length + 1);
    if (
      chunks.length > 0 &&
      countWords(remainder.text) < CHUNK_MIN_WORDS
    ) {
      const previousChunk = chunks[chunks.length - 1];
      if (!previousChunk) {
        chunks.push(remainder);
      } else {
        previousChunk.text = normalizeSpace(`${previousChunk.text} ${remainder.text}`);
        previousChunk.tags = inferTags(previousChunk.title, previousChunk.text);
      }
    } else {
      chunks.push(remainder);
    }
  }

  return chunks;
}

async function main() {
  const pdfBuffer = await readFile(WHO_SOURCE_PATH);
  const parsed = await pdf(pdfBuffer);
  const blocks = cleanPdfText(parsed.text ?? "");
  const sections = buildSections(blocks);
  const chunks = buildChunks(toSentenceUnits(sections));

  await mkdir(AI_DATA_DIR, { recursive: true });
  await writeFile(CHUNKS_PATH, JSON.stringify(chunks, null, 2), "utf8");

  console.log(
    `Saved ${chunks.length} WHO chunks to ${CHUNKS_PATH}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to process WHO medical data: ${message}`);
  process.exitCode = 1;
});
