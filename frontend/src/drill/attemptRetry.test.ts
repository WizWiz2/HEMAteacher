import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleAttemptRetry } from "./attemptRetry";
import { stepDrill } from "./drillEngine";
import type { Drill, DrillRuntime } from "./types";

afterEach(() => vi.useRealTimers());

describe("automatic attempt retry", () => {
  it("keeps the correction readable, then clears the failed attempt and resumes recognition", () => {
    vi.useFakeTimers();
    const drill: Drill = { id: "zornhau", name: "", description: "", cameraView: "side", checkpoints: [] };
    let runtime: DrillRuntime = {
      state: "failed", checkpointIndex: 2, validSince: null, match: null,
      startedAt: 100, finishedAt: 900,
      motion: { phase: "failed", message: "Повтори выбранное движение", samples: [], outcome: "other_drill" },
    };
    const retry = vi.fn(() => { runtime = stepDrill(runtime, drill, { type: "retry" }); });
    scheduleAttemptRetry(runtime.state, retry);
    vi.advanceTimersByTime(2999);
    expect(runtime.state).toBe("failed");
    vi.advanceTimersByTime(1);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(runtime).toEqual({ state: "ready", checkpointIndex: 0, validSince: null, match: null });
    runtime = stepDrill(runtime, drill, { type: "sample", timeMs: 4000, features: null, enoughSamples: false });
    expect(runtime.motion?.phase).toBe("position");
    expect(runtime.motion?.message).not.toBe("Повтори выбранное движение");
  });

  it("cancels a pending retry when the user retries, changes exercise or leaves", () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const cancel = scheduleAttemptRetry("failed", retry);
    vi.advanceTimersByTime(1000);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(retry).not.toHaveBeenCalled();
  });

  it.each(["calibrating", "ready", "running", "completed"] as const)("does not reset %s", (state) => {
    vi.useFakeTimers();
    const retry = vi.fn();
    scheduleAttemptRetry(state, retry);
    vi.advanceTimersByTime(5000);
    expect(retry).not.toHaveBeenCalled();
  });
});
