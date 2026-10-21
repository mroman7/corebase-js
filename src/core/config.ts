import { DEFAULT_TIMEOUT_MS } from "./constants";
import { CorebaseError } from "./errors";
import type { StorageAdapter } from "./types";

export interface CorebaseConfig {
  /** Backend base URL, e.g. https://api.corebase.dev */
  url: string;
  /** Project this client is bound to. */
  projectId: string;
  /** Project secret / API key (sent as the `apikey` header). */
  apiKey: string;
  /** Where the auth token is persisted. Defaults to localStorage, then memory. Pass AsyncStorage on React Native. */
  storage?: StorageAdapter;
  /** Sent as the `Origin` header — needed on React Native, where no Origin exists. */
  origin?: string;
  /** Request timeout in ms. */
  timeout?: number;
}

export type ResolvedConfig = Omit<CorebaseConfig, "timeout"> & { timeout: number };

export function resolveConfig(config: CorebaseConfig): ResolvedConfig {
  const missing = (["url", "projectId", "apiKey"] as const).filter((k) => !config?.[k]);
  if (missing.length) {
    throw new CorebaseError(`createClient: missing required option(s): ${missing.join(", ")}`);
  }
  return {
    ...config,
    url: config.url.replace(/\/+$/, ""),
    timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
  };
}
