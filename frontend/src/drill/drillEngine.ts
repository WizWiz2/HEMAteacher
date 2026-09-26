import { matchCheckpoint } from "./checkpointMatcher";
import type { Drill, DrillRuntime } from "./types";

export type DrillEvent =
  | { type: "quality"; ok: boolean }
  | { type: "sample"; timeMs: number; features: Record<string, number> | null; enoughSamples: boolean }
  | { type: "retry" };

export function createDrillRuntime(): DrillRuntime {
  return { state: "calibrating", checkpointIndex: 0, validSince: null, match: null };
}

export function stepDrill(runtime: DrillRuntime, drill: Drill, event: DrillEvent): DrillRuntime {
  if (event.type === "retry") {
    return { state: "ready", checkpointIndex: 0, validSince: null, match: null };
  }
  if (runtime.state === "calibrating") {
    if (event.type === "quality" && event.ok) {
      return { ...runtime, state: "ready", checkpointIndex: 0 };
    }
    return runtime;
  }
  if (runtime.state === "completed" || event.type !== "sample") return runtime;
  const checkpoint = drill.checkpoints[runtime.checkpointIndex];
  if (!checkpoint) return runtime;
  const matched = matchCheckpoint(
    event.features,
    checkpoint,
    { validSince: runtime.validSince },
    event.timeMs,
    event.enoughSamples,
  );
  if (!matched.match.passed) {
    return { ...runtime, match: matched.match, validSince: matched.state.validSince };
  }
  const startedAt = runtime.startedAt ?? event.timeMs;
  const nextIndex = runtime.checkpointIndex + 1;
  if (nextIndex >= drill.checkpoints.length) {
    return {
      state: "completed",
      checkpointIndex: runtime.checkpointIndex,
      startedAt,
      finishedAt: event.timeMs,
      validSince: null,
      match: matched.match,
    };
  }
  return {
    state: "running",
    checkpointIndex: nextIndex,
    startedAt,
    validSince: null,
    match: null,
  };
}
