/** Header names used by the Corebase backend. */
export const HEADERS = {
  apiKey: "apikey",
  authorization: "Authorization",
  origin: "Origin",
} as const;

/** Prefix for the Authorization header value: `Bearer <token>`. */
export const AUTH_SCHEME = "Bearer";

/** Header better-auth's bearer plugin uses to return a session token. */
export const TOKEN_RESPONSE_HEADER = "set-auth-token";

export const DEFAULT_TIMEOUT_MS = 30_000;

export const tokenStorageKey = (projectId: string) => `corebase.${projectId}.token`;
