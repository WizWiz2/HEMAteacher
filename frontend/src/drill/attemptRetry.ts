import type { DrillState } from "./types";

export const ATTEMPT_RETRY_DELAY_MS = 3000;

// Schedule once on entering failure, rather than restarting on every camera frame.
export function scheduleAttemptRetry(state: DrillState, retry: () => void): () => void {
  if (state !== "failed") return () => {};
  const timer = globalThis.setTimeout(retry, ATTEMPT_RETRY_DELAY_MS);
  return () => globalThis.clearTimeout(timer);
}
