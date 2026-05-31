let memoryStore: Record<string, string> = {};

/**
 * Highly resilient AsyncStorage wrapper that falls back to memory variables and localStorage (on Web)
 * if AsyncStorage is not fully linked, throws permissions error, or fails to install.
 */
class ResilientStorage {
  private hasAsyncStorage = false;
  private AsyncStorageInstance: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Dynamic import to prevent crash if not installed
      const AS = require('@react-native-async-storage/async-storage');
      if (AS && AS.default) {
        this.AsyncStorageInstance = AS.default;
        this.hasAsyncStorage = true;
        console.log('[Storage] AsyncStorage loaded successfully!');
      }
    } catch (e) {
      console.warn('[Storage] AsyncStorage package not loaded. Falling back to local/memory storage.', e);
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (this.hasAsyncStorage && this.AsyncStorageInstance) {
      try {
        return await this.AsyncStorageInstance.getItem(key);
      } catch (e) {
        console.warn(`[Storage] Failed to read key "${key}" from AsyncStorage:`, e);
      }
    }

    // Web LocalStorage fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {}
    }

    // Memory fallback
    return memoryStore[key] || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.hasAsyncStorage && this.AsyncStorageInstance) {
      try {
        await this.AsyncStorageInstance.setItem(key, value);
        return;
      } catch (e) {
        console.warn(`[Storage] Failed to write key "${key}" to AsyncStorage:`, e);
      }
    }

    // Web LocalStorage fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {}
    }

    // Memory fallback
    memoryStore[key] = value;
  }

  async removeItem(key: string): Promise<void> {
    if (this.hasAsyncStorage && this.AsyncStorageInstance) {
      try {
        await this.AsyncStorageInstance.removeItem(key);
        return;
      } catch (e) {
        console.warn(`[Storage] Failed to remove key "${key}" from AsyncStorage:`, e);
      }
    }

    // Web LocalStorage fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {}
    }

    // Memory fallback
    delete memoryStore[key];
  }

  async clear(): Promise<void> {
    if (this.hasAsyncStorage && this.AsyncStorageInstance) {
      try {
        await this.AsyncStorageInstance.clear();
        return;
      } catch (e) {
        console.warn('[Storage] Failed to clear AsyncStorage:', e);
      }
    }

    // Web LocalStorage fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.clear();
        return;
      } catch {}
    }

    // Memory fallback
    memoryStore = {};
  }
}

export const SafeStorage = new ResilientStorage();
