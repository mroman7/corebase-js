import { createAuthClient } from "better-auth/client";
import type { ResolvedConfig } from "../core/config";
import { HEADERS, TOKEN_RESPONSE_HEADER } from "../core/constants";
import { CorebaseError } from "../core/errors";
import type { Result } from "../core/result";
import type { TokenStore } from "../core/token-store";

type AuthResponse<T> = { data: T | null; error: { message?: string; status?: number } | null };

export interface SignUpInput { name: string; email: string; password: string }
export interface SignInInput { email: string; password: string }

/** Authentication: corebase.auth.*  (powered by better-auth, scoped to this project) */
export class CorebaseAuth {
  /** Raw better-auth client — escape hatch for plugins and advanced calls. */
  readonly client: ReturnType<typeof createAuthClient>;

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
          if (token) await this.tokens.set(token);
        },
      },
    });
  }

  signUp(input: SignUpInput) {
    return this.call(() => this.client.signUp.email(input), true);
  }

  signIn(input: SignInInput) {
    return this.call(() => this.client.signIn.email(input), true);
  }

  async signOut() {
    const result = await this.call(() => this.client.signOut());
    await this.tokens.clear(); // always drop the local token
    return result;
  }

  getSession() {
    return this.call(() => this.client.getSession());
  }

  /** Current token (sync). Null when signed out. */
  getToken() {
    return this.tokens.get();
  }

  /** Normalises better-auth responses into our Result shape and persists tokens. */
  private async call<T>(fn: () => Promise<any>, saveToken = false): Promise<Result<T>> {
    await this.tokens.ready;
    const { data, error } = (await fn()) as AuthResponse<T>;

    if (error || data === null) {
      return {
        data: null,
        error: new CorebaseError(error?.message ?? "Auth request failed", error?.status, error),
      };
    }

    const token = (data as { token?: string }).token;
    if (saveToken && token) await this.tokens.set(token);
    return { data, error: null };
  }
}
