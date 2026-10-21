import type { StorageAdapter } from "./types";

const memoryStorage = (): StorageAdapter => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
};

const browserStorage = (): StorageAdapter | undefined => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined; // e.g. blocked by privacy settings
  }
};

/**
 * Holds the auth token. Reads are sync (in-memory cache),
 * persistence is async so it works with AsyncStorage on React Native.
 */
export class TokenStore {
  private token: string | null = null;
  /** Resolves once the persisted token has been loaded. */
  readonly ready: Promise<void>;
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter | undefined, private readonly key: string) {
    this.storage = storage ?? browserStorage() ?? memoryStorage();
    this.ready = this.hydrate();
  }

  private async hydrate() {
    try {
      this.token = (await this.storage.getItem(this.key)) ?? null;
    } catch {
      this.token = null;
    }
  }

  get(): string | null {
    return this.token;
  }

  async set(token: string) {
    this.token = token;
    await this.storage.setItem(this.key, token);
  }

  async clear() {
    this.token = null;
    await this.storage.removeItem(this.key);
  }
}
