import {
  deriveModelFileName,
  normalizePickedModelFile,
  pickLocalModelFile,
} from '../src/ai/modelImport';

describe('modelImport', () => {
  const documentPickerModule = jest.requireMock('react-native-document-picker') as {
    pickSingle: jest.Mock;
  };

  beforeEach(() => {
    documentPickerModule.pickSingle.mockReset();
  });

  test('derives a readable file name from a model URI', () => {
    expect(
      deriveModelFileName('file:///tmp/models/auntcare-medical-v1.gguf'),
    ).toBe('auntcare-medical-v1.gguf');
  });

  test('normalizes a picked model using the copied local URI', () => {
    expect(
      normalizePickedModelFile({
        fileCopyUri: 'file:///documents/auntcare-medical.gguf',
        name: 'auntcare-medical.gguf',
        size: 2048,
        uri: 'content://provider/model/1',
      }),
    ).toEqual({
      modelFileName: 'auntcare-medical.gguf',
      modelUri: 'file:///documents/auntcare-medical.gguf',
      sizeInBytes: 2048,
    });
  });

  test('rejects non-gguf selections', () => {
    expect(() =>
      normalizePickedModelFile({
        fileCopyUri: 'file:///documents/not-a-model.txt',
        name: 'not-a-model.txt',
        size: 512,
        uri: 'file:///documents/not-a-model.txt',
      }),
    ).toThrow('GGUF');
  });

  test('returns null when the picker is cancelled', async () => {
    documentPickerModule.pickSingle.mockRejectedValue({
      code: 'DOCUMENT_PICKER_CANCELED',
    });

    await expect(pickLocalModelFile()).resolves.toBeNull();
  });

  test('returns the selected GGUF file from the picker', async () => {
    documentPickerModule.pickSingle.mockResolvedValue({
      fileCopyUri: 'file:///documents/auntcare-medical.gguf',
      name: 'auntcare-medical.gguf',
      size: 4096,
      uri: 'content://provider/model/2',
    });

    await expect(pickLocalModelFile()).resolves.toEqual({
      modelFileName: 'auntcare-medical.gguf',
      modelUri: 'file:///documents/auntcare-medical.gguf',
      sizeInBytes: 4096,
    });
  });
});
