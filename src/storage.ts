/* eslint-disable max-classes-per-file */

function getNormalizedAsyncStorage(asyncStorage: any) {
  // Use default export if it exists, otherwise use object itself
  return asyncStorage.default || asyncStorage;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = getNormalizedAsyncStorage(require('@react-native-async-storage/async-storage'));

interface JSONStorage {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

class InMemoryJSONStorage implements JSONStorage {
  private storage: Record<string, any>;

  constructor() {
    this.storage = {};
  }

  async getItem<T>(key: string): Promise<T | null> {
    const stored = this.storage[key];
    return stored !== undefined ? stored : null;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.storage[key] = value;
  }

  async removeItem(key: string): Promise<void> {
    delete this.storage[key];
  }

  async clear(): Promise<void> {
    this.storage = {};
  }
}

class AsyncStorageJSONWrapper implements JSONStorage {
  private storageKeyPrefix: string;

  constructor(storageKeyPrefix: string) {
    this.storageKeyPrefix = storageKeyPrefix;
  }

  private prefixedKey(key: string) {
    return `${this.storageKeyPrefix}${key}`;
  }

  async getItem<T>(key: string): Promise<T | null> {
    const stored = await AsyncStorage.getItem(this.prefixedKey(key));
    if (stored) {
      return JSON.parse(stored) as T;
    }
    return null;
  }

  setItem<T>(key: string, value: T): Promise<void> {
    return AsyncStorage.setItem(this.prefixedKey(key), JSON.stringify(value));
  }

  removeItem(key: string): Promise<void> {
    return AsyncStorage.removeItem(this.prefixedKey(key));
  }

  // eslint-disable-next-line class-methods-use-this
  async clear(): Promise<void> {
    return AsyncStorage.getAllKeys()
      .then((keys: string[]) => keys.filter((key) => key.startsWith(this.storageKeyPrefix)))
      .then((keysToClear: string[]) => AsyncStorage.multiRemove(keysToClear));
  }
}

export const safeLocalStorage: JSONStorage = new AsyncStorageJSONWrapper('nucleus-');
export const safeSessionStorage: JSONStorage = new InMemoryJSONStorage();
