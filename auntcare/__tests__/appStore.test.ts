import {
  buildConversation,
  createInitialAppState,
} from '../src/models/appState';
import { clearAppState, loadAppState, saveAppState } from '../src/storage/appStore';

describe('appStore', () => {
  beforeEach(() => {
    clearAppState();
  });

  afterEach(() => {
    clearAppState();
  });

  test('returns the default app state when storage is empty', () => {
    const state = loadAppState();

    expect(state.schemaVersion).toBe(1);
    expect(state.conversations).toHaveLength(2);
    expect(state.draftsByConversationId).toEqual({});
    expect(state.settings).toEqual({
      modelFileUri: '',
      modelFileName: '',
    });
  });

  test('persists conversations, drafts, and reports locally', () => {
    const baseState = createInitialAppState();
    const updatedConversation = {
      ...baseState.conversations[0],
      messages: [
        ...baseState.conversations[0].messages,
        {
          id: 'user-1',
          role: 'user' as const,
          text: 'I have had chest pain since this morning.',
        },
      ],
    };
    const nextState = {
      ...baseState,
      conversations: [
        buildConversation(updatedConversation),
        ...baseState.conversations.slice(1),
      ],
      draftsByConversationId: {
        [updatedConversation.id]: 'It gets worse when I walk upstairs.',
      },
      settings: {
        modelFileUri: 'file:///tmp/auntcare-medical.gguf',
        modelFileName: 'auntcare-medical.gguf',
      },
    };

    saveAppState(nextState);

    expect(loadAppState()).toEqual(nextState);
  });
});
