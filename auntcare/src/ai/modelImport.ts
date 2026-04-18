import { isCancel, pickSingle, types } from 'react-native-document-picker';

export type PickedModelFile = {
  modelFileName: string;
  modelUri: string;
  sizeInBytes: number | null;
};

type PickResult = {
  fileCopyUri: string | null;
  name: string | null;
  size: number | null;
  uri: string;
};

function normalizeFileUri(uri: string) {
  const trimmed = uri.trim();
  if (!trimmed.startsWith('file://')) {
    throw new Error(
      'The selected file is not available as a local file:// URI. Try importing from local device storage.',
    );
  }

  return trimmed;
}

export function deriveModelFileName(modelUri: string) {
  const [cleanUri] = modelUri.split(/[?#]/);
  const segments = cleanUri.split('/');
  const lastSegment = segments.at(-1);

  return lastSegment ? decodeURIComponent(lastSegment) : 'local-model.gguf';
}

export function normalizePickedModelFile(result: PickResult): PickedModelFile {
  const modelUri = normalizeFileUri(result.fileCopyUri ?? result.uri);
  const modelFileName = result.name ?? deriveModelFileName(modelUri);

  if (
    !modelFileName.toLowerCase().endsWith('.gguf') &&
    !modelUri.toLowerCase().endsWith('.gguf')
  ) {
    throw new Error('Pick a GGUF model file.');
  }

  return {
    modelFileName,
    modelUri,
    sizeInBytes: result.size,
  };
}

export async function pickLocalModelFile(): Promise<PickedModelFile | null> {
  try {
    const result = await pickSingle({
      copyTo: 'documentDirectory',
      type: [types.allFiles],
    });

    return normalizePickedModelFile(result);
  } catch (error) {
    if (isCancel(error)) {
      return null;
    }

    throw error;
  }
}
