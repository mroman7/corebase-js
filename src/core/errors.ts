import axios from "axios";

export class CorebaseError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "CorebaseError";
  }
}

/** Converts anything thrown (axios, better-auth, plain Error) into a CorebaseError. */
export function toCorebaseError(err: unknown): CorebaseError {
  if (err instanceof CorebaseError) return err;

  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { message?: string; error?: string } | undefined;
    return new CorebaseError(
      body?.message ?? body?.error ?? err.message,
      err.response?.status,
      body,
    );
  }

  return new CorebaseError(err instanceof Error ? err.message : String(err));
}
