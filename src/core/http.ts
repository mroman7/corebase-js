import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import type { ResolvedConfig } from "./config";
import { AUTH_SCHEME, HEADERS } from "./constants";
import { safe, type Result } from "./result";
import type { TokenStore } from "./token-store";

/** Shared axios instance: base URL, api key, and auto-attached auth token. */
export function createHttp(config: ResolvedConfig, tokens: TokenStore): AxiosInstance {
  const http = axios.create({
    baseURL: config.url,
    timeout: config.timeout,
    headers: {
      [HEADERS.apiKey]: config.apiKey,
      ...(config.origin && { [HEADERS.origin]: config.origin }),
    },
  });

  http.interceptors.request.use(async (req) => {
    await tokens.ready;
    const token = tokens.get();
    if (token) req.headers.set(HEADERS.authorization, `${AUTH_SCHEME} ${token}`);
    return req;
  });

  return http;
}

/** One-liner for "make a request, return { data, error }". */
export const send = <T = unknown>(http: AxiosInstance, config: AxiosRequestConfig): Promise<Result<T>> =>
  safe(async () => (await http.request<T>(config)).data);
