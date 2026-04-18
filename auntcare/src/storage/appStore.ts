import { createMMKV } from 'react-native-mmkv';

import type { AppState, Conversation, Message } from '../models/appState';
import { buildConversation, createInitialAppState } from '../models/appState';

const storage = createMMKV({
  id: 'auntcare-storage',
});

const APP_STATE_KEY = 'auntcare.app-state';
const APP_STATE_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeMessage(value: unknown): Message | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, role, text } = value;
  if (
    typeof id !== 'string' ||
    (role !== 'assistant' && role !== 'user') ||
    typeof text !== 'string'
  ) {
    return null;
  }

  return {
    id,
    role,
    text,
  };
}

function sanitizeConversation(value: unknown): Conversation | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, title, updatedAt, messages } = value;
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof updatedAt !== 'number' ||
    !Array.isArray(messages)
  ) {
    return null;
  }

  const nextMessages = messages
    .map(sanitizeMessage)
    .filter((message): message is Message => message !== null);

  return buildConversation({
    id,
    title,
    updatedAt,
    messages: nextMessages,
  });
}

function sanitizeDrafts(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((drafts, entry) => {
    const [conversationId, draft] = entry;
    if (typeof draft === 'string') {
      drafts[conversationId] = draft;
    }
    return drafts;
  }, {});
}

function sanitizeSettings(
  value: unknown,
): AppState['settings'] {
  if (!isRecord(value)) {
    return createInitialAppState().settings;
  }

  return {
    modelFileUri:
      typeof value.modelFileUri === 'string' ? value.modelFileUri : '',
    modelFileName:
      typeof value.modelFileName === 'string' ? value.modelFileName : '',
  };
}

export function loadAppState(): AppState {
  const fallbackState = createInitialAppState();
  const rawState = storage.getString(APP_STATE_KEY);

  if (!rawState) {
    return fallbackState;
  }

  try {
    const parsed = JSON.parse(rawState);
    if (!isRecord(parsed) || parsed.schemaVersion !== APP_STATE_SCHEMA_VERSION) {
      return fallbackState;
    }

    const conversations = Array.isArray(parsed.conversations)
      ? parsed.conversations
          .map(sanitizeConversation)
          .filter(
            (conversation): conversation is Conversation => conversation !== null,
          )
      : fallbackState.conversations;

    return {
      schemaVersion: APP_STATE_SCHEMA_VERSION,
      conversations,
      draftsByConversationId: sanitizeDrafts(parsed.draftsByConversationId),
      settings: sanitizeSettings(parsed.settings),
    };
  } catch {
    return fallbackState;
  }
}

export function saveAppState(state: AppState) {
  storage.set(APP_STATE_KEY, JSON.stringify(state));
}

export function clearAppState() {
  storage.remove(APP_STATE_KEY);
}
