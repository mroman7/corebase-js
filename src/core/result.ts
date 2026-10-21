import { CorebaseError, toCorebaseError } from "./errors";

/** Every public async method resolves to this — it never throws. */
export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: CorebaseError };

export async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { data: await fn(), error: null };
  } catch (err) {
    return { data: null, error: toCorebaseError(err) };
  }
}
