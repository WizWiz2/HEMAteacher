// Streams a fixture clip through the same pipeline as the app (LiveSampleProcessor -> CalibrationGate ->
// personalizeDrill/adaptDrillForCameraView -> stepDrill), for the fixture regression test and evaluation scripts.
import { LiveSampleProcessor } from "../live/sampleProcessor";
import { CalibrationGate } from "../live/calibrationGate";
import { createDrillRuntime, stepDrill } from "./drillEngine";
import { personalizeDrill } from "./personalize";
import { adaptDrillForCameraView } from "./cameraView";
import { motionPatternFor, recognitionModel, setRecognitionModel } from "./continuousMotion";
import { buildModel, CONTINUOUS_DRILLS, isTrainClip, rawFrames, type Fixture, type FixtureClip } from "./motionTraining";
import type { RecognitionModel } from "./motionRecognition";
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

export interface EvalRow {
  protocol: "lobo" | "split" | "heldout"; clip: string; source: string; variant: string; body: string; level: string;
  selected: string; completed: boolean; completedWithRetry: boolean; similarity?: number; tempo?: number; message?: string;
  lookedLike?: string; feedback?: string[];
}

/** Honest protocols. lobo: templates from one body's master+experienced main clips, every main clip of the other body
 *  tested. split: shipped model (both bodies' master+experienced) on the main beginner clips. heldout: shipped model on
 *  the held-out camera-angle / new-body clips. Every clip is tested against every continuous drill. */
export function evaluateProtocols(fx: Fixture, drills: Drill[]): EvalRow[] {
  const rows: EvalRow[] = [];
  const previous = recognitionModel();
  const run = (protocol: EvalRow["protocol"], model: RecognitionModel, tests: FixtureClip[]) => {
    setRecognitionModel(model);
    for (const c of tests) for (const d of CONTINUOUS_DRILLS) {
      const base = drills.find(x => x.id === d)!, r = streamClip(c, fx.names, base);
      const retried = d === c.drill && !r.completed ? streamClip(c, fx.names, base, true) : r;
      rows.push({ protocol, clip: c.id, source: c.drill, variant: c.variant, body: c.body, level: c.level, selected: d,
        completed: r.completed, completedWithRetry: retried.completed, similarity: r.similarity, tempo: r.tempo,
        message: r.message, lookedLike: r.lookedLike, feedback: r.feedback });
    }
  };
  try {
    const main = fx.clips.filter(c => c.variant === "main" && CONTINUOUS_DRILLS.includes(c.drill));
    for (const body of [...new Set(main.map(c => c.body))])
      run("lobo", buildModel(fx.clips.filter(c => isTrainClip(c) && c.body !== body), fx.names), main.filter(c => c.body === body));
    const shipped = buildModel(fx.clips.filter(isTrainClip), fx.names);
    run("split", shipped, main.filter(c => c.level === "beginner"));
    run("heldout", shipped, fx.clips.filter(c => c.variant.startsWith("heldout")));
  } finally { setRecognitionModel(previous); }
  return rows;
}

export function confusion(rows: EvalRow[]) {
  const own = rows.filter(r => r.source === r.selected), other = rows.filter(r => r.source !== r.selected);
  const table = CONTINUOUS_DRILLS.filter(s => rows.some(r => r.source === s)).map(s =>
    s.padEnd(22) + CONTINUOUS_DRILLS.map(d => { const x = rows.filter(r => r.source === s && r.selected === d);
      return `${x.filter(r => r.completed).length}/${x.length}`.padStart(6); }).join(" "));
  return { own: own.filter(r => r.completed).length, ownTotal: own.length, other: other.filter(r => r.completed).length,
    otherTotal: other.length, text: ["source\\selected".padEnd(22) + CONTINUOUS_DRILLS.map(d => d.slice(0, 6).padStart(6)).join(" "), ...table].join("\n") };
}

/** Programmatic mutations of a fixture clip. reversed: guard hold, then the labelled movement played backwards
 *  (finish -> guard), then a hold; frozen: the first pose for the whole clip; slowNx: timestamps stretched N times. */
export function mutate(clip: FixtureClip, kind: "reversed" | "frozen" | "slow4x" | "slow12x"): FixtureClip {
  if (kind === "frozen") return { ...clip, id: clip.id + "#frozen", p: clip.p.map(() => clip.p.find(p => p.length) ?? []) };
  if (kind === "reversed") {
    const [a, b] = clip.move!, idx = clip.t.map((t, i) => [t, i]).filter(([t]) => t >= a && t <= b).map(([, i]) => i);
    const dt = clip.t[1] - clip.t[0], hold = Math.round(1500 / dt);
    const end = clip.p[idx.at(-1)!], start = clip.p[idx[0]];
    const p = [...Array(hold).fill(end), ...idx.reverse().map(i => clip.p[i]), ...Array(hold).fill(start)];
    return { ...clip, id: clip.id + "#reversed", move: null, p, t: p.map((_, i) => clip.t[0] + i * dt) };
  }
  const k = kind === "slow4x" ? 4 : 12;
  return { ...clip, id: clip.id + "#" + kind, t: clip.t.map(t => clip.t[0] + (t - clip.t[0]) * k) };
}
