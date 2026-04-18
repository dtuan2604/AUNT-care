import { NativeModules, Platform } from 'react-native';

import {
  BUNDLED_MODEL_ASSET_NAME,
  generateLocalAssistantReply,
  getLocalModelSnapshot,
  loadBundledModelAsset,
  loadLocalModel,
  unloadLocalModel,
} from '../src/ai/localLlmRuntime';
import { analyzeTriage, starterMessage } from '../src/models/appState';

describe('localLlmRuntime', () => {
  const getRuntimeInfoMock = NativeModules.BundledModelResolver
    .getRuntimeInfo as jest.Mock;
  const resolveBundledModelMock = NativeModules.BundledModelResolver
    .resolveModel as jest.Mock;
  const routineMessages = [
    {
      id: 'assistant-1',
      role: 'assistant' as const,
      text: starterMessage,
    },
    {
      id: 'user-1',
      role: 'user' as const,
      text: 'I have a mild cough and a sore throat since yesterday.',
    },
  ];

  beforeEach(async () => {
    getRuntimeInfoMock.mockResolvedValue({
      isSimulator: false,
    });
    getRuntimeInfoMock.mockClear();
    resolveBundledModelMock.mockClear();
    await unloadLocalModel();
  });

  afterEach(async () => {
    await unloadLocalModel();
  });

  test('rejects invalid model URIs', async () => {
    await expect(loadLocalModel('/tmp/not-a-uri.gguf')).rejects.toThrow(
      'file://',
    );
    await expect(
      loadLocalModel('file:///tmp/not-a-model.bin'),
    ).rejects.toThrow('GGUF');
  });

  test('loads and unloads a local GGUF model', async () => {
    const progressValues: number[] = [];
    const snapshot = await loadLocalModel(
      'file:///tmp/auntcare-medical.gguf',
      progress => {
        progressValues.push(progress);
      },
    );

    expect(progressValues).toContain(0);
    expect(progressValues).toContain(50);
    expect(progressValues.at(-1)).toBe(100);
    expect(snapshot.isLoaded).toBe(true);
    expect(snapshot.modelUri).toBe('file:///tmp/auntcare-medical.gguf');
    expect(snapshot.modelLabel).toBe('llama');
    expect(getLocalModelSnapshot().isLoaded).toBe(true);

    await unloadLocalModel();

    expect(getLocalModelSnapshot()).toEqual({
      gpuEnabled: false,
      isLoaded: false,
      modelLabel: '',
      modelUri: '',
    });
  });

  test('loads a bundled GGUF model asset', async () => {
    const snapshot = await loadBundledModelAsset(BUNDLED_MODEL_ASSET_NAME);

    expect(snapshot.isLoaded).toBe(true);
    if (Platform.OS === 'ios') {
      expect(resolveBundledModelMock).toHaveBeenCalledWith(
        BUNDLED_MODEL_ASSET_NAME,
      );
      expect(snapshot.modelUri).toBe(
        `file:///bundle/${BUNDLED_MODEL_ASSET_NAME}`,
      );
      expect(snapshot.modelLabel).toBe('llama');
    } else {
      expect(snapshot.modelUri).toBe(BUNDLED_MODEL_ASSET_NAME);
      expect(snapshot.modelLabel).toBe('llama');
    }
  });

  test('rejects model loading on iOS simulator', async () => {
    if (Platform.OS !== 'ios') {
      return;
    }

    getRuntimeInfoMock.mockResolvedValue({
      isSimulator: true,
    });

    await expect(
      loadLocalModel('file:///tmp/auntcare-medical.gguf'),
    ).rejects.toThrow('iOS Simulator');
  });

  test('streams and returns a local assistant reply', async () => {
    const triage = analyzeTriage(routineMessages);
    const partialUpdates: string[] = [];

    await loadLocalModel('file:///tmp/auntcare-medical.gguf');

    const reply = await generateLocalAssistantReply({
      messages: routineMessages,
      triage,
      onToken: partialText => {
        partialUpdates.push(partialText);
      },
    });

    expect(reply).toBe('*giggles*');
    expect(partialUpdates.at(-1)).toBe('*giggles*');
  });
});
