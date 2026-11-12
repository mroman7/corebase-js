import { createAuthClient } from "better-auth/client";
import type { ResolvedConfig } from "../core/config";
import { HEADERS, TOKEN_RESPONSE_HEADER } from "../core/constants";
import { CorebaseError, toCorebaseError } from "../core/errors";
import type { Result } from "../core/result";
import type { TokenStore } from "../core/token-store";

export interface SignUpInput { name: string; email: string; password: string }
export interface SignInInput { email: string; password: string }

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  role?: string | null;
  [key: string]: any;
}
export interface AuthSession {
  session: { id: string; expiresAt: string | Date; [key: string]: any };
  user: AuthUser;
}

export type AuthChangeEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT";
export type AuthListener = (event: AuthChangeEvent, session: AuthSession | null) => void;

/**
 * Authentication: corebase.auth.*  (Supabase-style API, powered by better-auth, scoped to this project)
 *
 *   await corebase.auth.signUp({ name, email, password })
 *   await corebase.auth.signInWithPassword({ email, password })
 *   const { data } = await corebase.auth.getSession()
 *   const { data: { subscription } } = corebase.auth.onAuthStateChange((event, session) => {})
 *   await corebase.auth.signOut()
 */
export class CorebaseAuth {
  /** Raw better-auth client — escape hatch for plugins and advanced calls. */
  readonly client: ReturnType<typeof createAuthClient>;

  private readonly listeners = new Set<AuthListener>();
  private headerTokenSaved = false;

  constructor(config: ResolvedConfig, private readonly tokens: TokenStore) {
    this.client = createAuthClient({
      baseURL: `${config.url}/${config.projectId}/auth`,
      fetchOptions: {
        headers: {
          [HEADERS.apiKey]: config.apiKey,
          ...(config.origin && { [HEADERS.origin]: config.origin }),
        },
        auth: { type: "Bearer", token: () => this.tokens.get() ?? undefined },
        onSuccess: async (ctx) => {
          const token = ctx.response.headers.get(TOKEN_RESPONSE_HEADER);
          if (token) {
            await this.tokens.set(token);
            this.headerTokenSaved = true;
          }
        },
      },
    });
  }

  /* ---------------- sign up / in / out ---------------- */

  async signUp(input: SignUpInput) {
    const res = await this.call<{ token?: string | null; user: AuthUser }>(
      () => this.client.signUp.email(input),
      true,
    );
    if (res.data) await this.emitSignedIn();
    return res;
  }

  async signInWithPassword(input: SignInInput) {
    const res = await this.call<{ token?: string | null; user: AuthUser }>(
      () => this.client.signIn.email(input),
      true,
    );
    if (res.data) await this.emitSignedIn();
    return res;
  }

  /** Alias of signInWithPassword. */
  signIn(input: SignInInput) {
    return this.signInWithPassword(input);
  }

  async signOut() {
    const res = await this.call<{ success: boolean }>(() => this.client.signOut());
    await this.tokens.clear(); // always drop the local token, even if the request failed
    this.emit("SIGNED_OUT", null);
    return res;
  }

  /* ---------------- session / user ---------------- */

  /** Signed out is NOT an error: resolves { data: null, error: null }. */
  async getSession(): Promise<Result<AuthSession | null>> {
    try {
      await this.tokens.ready;
      if (!this.tokens.get()) return { data: null, error: null };

      const { data, error } = (await this.client.getSession()) as {
        data: AuthSession | null;
        error: { message?: string; status?: number } | null;
      };
      if (error) return { data: null, error: new CorebaseError(error.message ?? "Failed to get session", error.status, error) };
      return { data: data ?? null, error: null };
    } catch (err) {
      return { data: null, error: toCorebaseError(err) };
    }
  }

  async getUser(): Promise<Result<AuthUser | null>> {
    const res = await this.getSession();
    if (res.error) return { data: null, error: res.error };
    return { data: res.data?.user ?? null, error: null };
  }

  /** Current token (sync). Null when signed out. */
  getToken() {
    return this.tokens.get();
  }

  /* ---------------- subscribe ---------------- */

  /**
   * Like supabase.auth.onAuthStateChange. Fires INITIAL_SESSION once on subscribe,
   * then SIGNED_IN / SIGNED_OUT. Call `subscription.unsubscribe()` on cleanup.
   */
  onAuthStateChange(callback: AuthListener) {
    this.listeners.add(callback);
    void this.getSession().then(({ data }) => {
      if (this.listeners.has(callback)) callback("INITIAL_SESSION", data);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => { this.listeners.delete(callback); },
        },
      },
    };
  }

  /* ---------------- internals ---------------- */

  private emit(event: AuthChangeEvent, session: AuthSession | null) {
    this.listeners.forEach((l) => {
      try { l(event, session); } catch { /* listener errors must not break auth */ }
    });
  }

  private async emitSignedIn() {
    if (!this.listeners.size) return; // skip the extra request when nobody listens
    const { data } = await this.getSession();
    this.emit("SIGNED_IN", data);
  }

  /** Normalises better-auth responses into our Result shape and persists tokens. */
  private async call<T>(fn: () => Promise<any>, saveBodyToken = false): Promise<Result<T>> {
    try {
      await this.tokens.ready;
      this.headerTokenSaved = false;

      const { data, error } = (await fn()) as {
        data: any;
        error: { message?: string; status?: number } | null;
      };

      if (error || data == null) {
        return { data: null, error: new CorebaseError(error?.message ?? "Auth request failed", error?.status, error) };
      }

      // The signed `set-auth-token` header wins; body token is only a fallback.
      const bodyToken = (data as { token?: string }).token;
      if (saveBodyToken && bodyToken && !this.headerTokenSaved) await this.tokens.set(bodyToken);

      return { data: data as T, error: null };
    } catch (err) {
      return { data: null, error: toCorebaseError(err) };
    }
  }
}