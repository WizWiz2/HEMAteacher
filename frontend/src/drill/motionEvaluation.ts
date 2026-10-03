// Streams a fixture clip through the same pipeline as the app (LiveSampleProcessor -> CalibrationGate ->
// personalizeDrill/adaptDrillForCameraView -> stepDrill), for the fixture regression test and evaluation scripts.
import { LiveSampleProcessor } from "../live/sampleProcessor";
import { CalibrationGate } from "../live/calibrationGate";
import { createDrillRuntime, stepDrill } from "./drillEngine";
import { personalizeDrill } from "./personalize";
import { adaptDrillForCameraView } from "./cameraView";
import { motionPatternFor } from "./continuousMotion";
import { rawFrames, type FixtureClip } from "./motionTraining";
import type { Drill } from "./types";

export interface StreamResult {
  completed: boolean; state: string; similarity?: number; message?: string; feedback?: string[];
  lookedLike?: string; tempo?: number; failures: string[];
}

/** Result of the first decided attempt (like the regression page). With `retry`, failed attempts are retried like on the
 *  DrillPage; note the mock clips also contain the return movement (e.g. a retreat clip steps back forward), which a
 *  retrying run may legitimately recognise as the inverse drill, so the confusion matrix uses retry = false. */
export function streamClip(clip: FixtureClip, names: string[], base: Drill, retry = false): StreamResult {
  const processor = new LiveSampleProcessor(), calibration = new CalibrationGate();
  const mode = base.trackingMode ?? "full_body";
  let drill = base, runtime = createDrillRuntime();
  const failures: string[] = [];
  for (const raw of rawFrames(clip, names)) {
    const sample = processor.process(raw, "right", mode, "side");
    const ready = calibration.push(sample, mode);
    if (runtime.state === "calibrating" && ready) {
      drill = adaptDrillForCameraView(personalizeDrill(base, calibration.profile) ?? base, "side") ?? base;
      runtime = stepDrill(runtime, drill, { type: "quality", ok: true });
    }
    if (runtime.state === "failed" && !retry) break;
    if (runtime.state === "failed") { failures.push(runtime.motion?.message ?? "failed"); runtime = stepDrill(runtime, drill, { type: "retry" }); }
    const continuous = !!motionPatternFor(drill.id);
    if (runtime.state === "ready" || runtime.state === "running")
      runtime = stepDrill(runtime, drill, { type: "sample", timeMs: sample.timeMs,
        features: continuous ? sample.features : sample.smoothed, enoughSamples: continuous ? sample.motionUsable : sample.enough,
        cameraView: "side", mode: "motion" });
    if (runtime.state === "completed") break;
  }
  if (runtime.state === "failed") failures.push(runtime.motion?.message ?? "failed");
  const m = runtime.motion;
  const lastOther = [...failures].reverse().find(f => f.startsWith("Похоже на"));
  return { completed: runtime.state === "completed", state: runtime.state, similarity: m?.similarity, message: m?.message ?? lastOther,
    feedback: m?.feedback, lookedLike: m?.lookedLike, tempo: m?.tempo, failures };
}
