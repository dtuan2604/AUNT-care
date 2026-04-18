/* eslint-env jest */

jest.mock('llama.rn', () => require('llama.rn/jest/mock'));
jest.mock('react-native-document-picker', () => {
  const isCancel = jest.fn(
    error =>
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'DOCUMENT_PICKER_CANCELED',
  );
  const pickSingle = jest.fn();

  return {
    __esModule: true,
    default: {
      isCancel,
      pickSingle,
      types: {
        allFiles: '*/*',
      },
    },
    isCancel,
    pickSingle,
    types: {
      allFiles: '*/*',
    },
  };
});

function mockCreateMMKV(config = { id: 'mmkv.default' }) {
  const storage = new Map();
  const listeners = new Set();

  function notifyListeners(key) {
    listeners.forEach(listener => listener(key));
  }

  return {
    id: config.id,
    get length() {
      return storage.size;
    },
    get size() {
      return this.byteSize;
    },
    get byteSize() {
      return JSON.stringify(Array.from(storage.entries())).length;
    },
    isReadOnly: false,
    isEncrypted: false,
    set(key, value) {
      storage.set(key, value);
      notifyListeners(key);
    },
    getString(key) {
      const value = storage.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    getNumber(key) {
      const value = storage.get(key);
      return typeof value === 'number' ? value : undefined;
    },
    getBoolean(key) {
      const value = storage.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    getBuffer(key) {
      const value = storage.get(key);
      return value instanceof ArrayBuffer ? value : undefined;
    },
    contains(key) {
      return storage.has(key);
    },
    remove(key) {
      const deleted = storage.delete(key);
      if (deleted) {
        notifyListeners(key);
      }
      return deleted;
    },
    getAllKeys() {
      return Array.from(storage.keys());
    },
    clearAll() {
      const keys = Array.from(storage.keys());
      storage.clear();
      keys.forEach(notifyListeners);
    },
    recrypt() {},
    encrypt() {},
    decrypt() {},
    trim() {},
    addOnValueChangedListener(listener) {
      listeners.add(listener);
      return {
        remove() {
          listeners.delete(listener);
        },
      };
    },
    importAllFrom(other) {
      return other.getAllKeys().reduce((count, key) => {
        const buffer = other.getBuffer(key);
        if (buffer == null) {
          return count;
        }

        storage.set(key, buffer);
        return count + 1;
      }, 0);
    },
  };
}

jest.mock('react-native-nitro-modules', () => ({}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(config => mockCreateMMKV(config)),
}));
