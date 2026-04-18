import { Platform } from 'react-native';
import {
  initLlama,
  loadLlamaModelInfo,
  releaseAllLlama,
} from 'llama.rn';
import type { LlamaContext } from 'llama.rn';

import type { Message, TriageAssessment } from '../models/appState';

export type LocalModelSnapshot = {
  isLoaded: boolean;
  modelUri: string;
  modelLabel: string;
  gpuEnabled: boolean;
};

export const BUNDLED_MODEL_ASSET_NAME = 'auntcare-default-model.gguf';

type GenerateReplyArgs = {
  messages: Message[];
  triage: TriageAssessment;
  onToken?: (text: string) => void;
};

let activeContext: LlamaContext | null = null;
let activeModelUri = '';
let activeModelLabel = '';
let activeGpuEnabled = false;
let activeModelIsAsset = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeModelUri(modelUri: string) {
  const trimmed = modelUri.trim();
  if (!trimmed.startsWith('file://')) {
    throw new Error('Model path must be a local file URI that starts with file://');
  }

  if (!trimmed.endsWith('.gguf')) {
    throw new Error('The selected model must be a GGUF file.');
  }

  return trimmed;
}

function normalizeAssetModelName(modelName: string) {
  const trimmed = modelName.trim();
  if (!trimmed) {
    throw new Error('Bundled model asset name is required.');
  }

  if (trimmed.startsWith('file://')) {
    throw new Error('Bundled model assets should use the asset name, not a file:// URI.');
  }

  if (!trimmed.endsWith('.gguf')) {
    throw new Error('The bundled model asset must be a GGUF file.');
  }

  return trimmed;
}

function deriveModelLabel(modelInfo: unknown, fallbackLabel = 'Local GGUF model') {
  if (!isRecord(modelInfo)) {
    return fallbackLabel;
  }

  const metadata = isRecord(modelInfo.metadata) ? modelInfo.metadata : null;
  const preferredName =
    metadata && typeof metadata['general.name'] === 'string'
      ? metadata['general.name']
      : null;
  const architecture =
    metadata && typeof metadata['general.architecture'] === 'string'
      ? metadata['general.architecture']
      : null;

  return preferredName ?? architecture ?? fallbackLabel;
}

function buildSystemPrompt(triage: TriageAssessment) {
  return [
    'You are AUNT Care, an offline health support assistant running entirely on-device.',
    'You are not a substitute for emergency care or a clinician.',
    'Keep the answer brief, calm, and conversational.',
    'Use plain language.',
    'Ask at most one follow-up question.',
    'Do not claim certainty or give a final diagnosis.',
    `Current triage level: ${triage.level}.`,
    `Required recommendation: ${triage.recommendation}`,
  ].join(' ');
}

function buildPrompt(messages: Message[], triage: TriageAssessment) {
  const transcript = messages
    .map(message => {
      const speaker = message.role === 'assistant' ? 'Assistant' : 'User';
      return `${speaker}: ${message.text}`;
    })
    .join('\n');

  return `${buildSystemPrompt(triage)}\n\n${transcript}\nAssistant:`;
}

function normalizeGeneratedText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function getLocalModelSnapshot(): LocalModelSnapshot {
  return {
    isLoaded: activeContext !== null,
    modelUri: activeModelUri,
    modelLabel: activeModelLabel,
    gpuEnabled: activeGpuEnabled,
  };
}

async function loadModel(
  modelIdentifier: string,
  isModelAsset: boolean,
  onProgress?: (progress: number) => void,
): Promise<LocalModelSnapshot> {
  const normalizedIdentifier = isModelAsset
    ? normalizeAssetModelName(modelIdentifier)
    : normalizeModelUri(modelIdentifier);

  if (
    activeContext &&
    activeModelUri === normalizedIdentifier &&
    activeModelIsAsset === isModelAsset
  ) {
    return getLocalModelSnapshot();
  }

  await unloadLocalModel();

  const modelInfo = isModelAsset
    ? null
    : await loadLlamaModelInfo(normalizedIdentifier);
  const context = await initLlama(
    {
      model: normalizedIdentifier,
      is_model_asset: isModelAsset,
      use_mmap: true,
      use_mlock: false,
      n_ctx: 2048,
      n_batch: 256,
      n_threads: 4,
      n_gpu_layers: Platform.OS === 'ios' ? 0 : 0,
      n_parallel: 1,
      ctx_shift: true,
    },
    onProgress,
  );

  activeContext = context;
  activeModelUri = normalizedIdentifier;
  activeModelLabel = deriveModelLabel(
    isModelAsset ? context.model : modelInfo,
    isModelAsset ? normalizedIdentifier : 'Local GGUF model',
  );
  activeGpuEnabled = context.gpu;
  activeModelIsAsset = isModelAsset;

  return getLocalModelSnapshot();
}

export async function loadLocalModel(
  modelUri: string,
  onProgress?: (progress: number) => void,
): Promise<LocalModelSnapshot> {
  return loadModel(modelUri, false, onProgress);
}

export async function loadBundledModelAsset(
  assetName: string = BUNDLED_MODEL_ASSET_NAME,
  onProgress?: (progress: number) => void,
): Promise<LocalModelSnapshot> {
  return loadModel(assetName, true, onProgress);
}

export async function unloadLocalModel() {
  if (activeContext) {
    await activeContext.release();
  }

  activeContext = null;
  activeModelUri = '';
  activeModelLabel = '';
  activeGpuEnabled = false;
  activeModelIsAsset = false;

  await releaseAllLlama().catch(() => undefined);
}

export async function generateLocalAssistantReply({
  messages,
  triage,
  onToken,
}: GenerateReplyArgs) {
  if (!activeContext) {
    throw new Error('Local model is not loaded.');
  }

  await activeContext.clearCache(false);

  let partialText = '';
  const result = await activeContext.completion(
    {
      prompt: buildPrompt(messages, triage),
      temperature: 0.35,
      top_p: 0.9,
      n_predict: 160,
      stop: [
        '</s>',
        '<|eot_id|>',
        '<|end|>',
        '<|end_of_text|>',
        '<|im_end|>',
      ],
    },
    data => {
      partialText = normalizeGeneratedText(
        data.accumulated_text ?? data.content ?? `${partialText}${data.token}`,
      );
      if (partialText) {
        onToken?.(partialText);
      }
    },
  );

  const finalText = normalizeGeneratedText(result.text ?? partialText);
  if (!finalText) {
    throw new Error('The local model returned an empty response.');
  }

  return finalText;
}
