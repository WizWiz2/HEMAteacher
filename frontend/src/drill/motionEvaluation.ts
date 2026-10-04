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
  protocol: "lobo" | "before" | "test"; clip: string; source: string; variant: string; body: string; level: string;
  azimuth: number; selected: string; completed: boolean; completedWithRetry: boolean; similarity?: number; tempo?: number;
  message?: string; lookedLike?: string; feedback?: string[];
}

/** Camera azimuth of a clip in degrees (+ = toward the front, - = behind profile). */
export const azimuthOf = (c: FixtureClip) => c.camera?.azimuth_deg ?? (c.variant === "heldout:camrear25" ? -25 : 0);
/** Reserved test clips (docs/bodies-angles-split.md): bodies/angles test renders and the earlier held-out clips. */
export const isTestClip = (c: FixtureClip) => c.variant === "ba:test" || c.variant.startsWith("heldout");
/** Model of PR #16 (before the bodies/angles data): main clips, master + experienced, two bodies at profile. */
export const isLegacyTrainClip = (c: FixtureClip) => c.variant === "main" && (c.level === "master" || c.level === "experienced") && CONTINUOUS_DRILLS.includes(c.drill);

/** Honest protocols. lobo: leave-one-body-out over the TRAIN bodies (templates from the other train bodies'
 *  master+experienced clips; every clip of the left-out body tested). before / test: the PR #16 model and the shipped
 *  model on the reserved TEST clips. Every clip is tested against every continuous drill. */
export function evaluateProtocols(fx: Fixture, drills: Drill[], protocols: EvalRow["protocol"][] = ["lobo", "before", "test"]): EvalRow[] {
  const rows: EvalRow[] = [];
  for (const _ of evaluationSteps(fx, drills, protocols, rows)) { /* run to completion */ }
  return rows;
}

/** Same as evaluateProtocols, but yields to the event loop after every clip (long runs inside a vitest worker must not
 *  block its RPC channel, which times out after 60 s). */
export async function evaluateProtocolsAsync(fx: Fixture, drills: Drill[], protocols: EvalRow["protocol"][] = ["lobo", "before", "test"]): Promise<EvalRow[]> {
  const rows: EvalRow[] = [];
  for (const _ of evaluationSteps(fx, drills, protocols, rows)) await new Promise(resolve => setTimeout(resolve, 0));
  return rows;
}

function* evaluationSteps(fx: Fixture, drills: Drill[], protocols: EvalRow["protocol"][], rows: EvalRow[]): Generator<void> {
  const previous = recognitionModel();
  function* run(protocol: EvalRow["protocol"], model: RecognitionModel, tests: FixtureClip[]) {
    setRecognitionModel(model);
    for (const c of tests) { for (const d of CONTINUOUS_DRILLS) {
      const base = drills.find(x => x.id === d)!, r = streamClip(c, fx.names, base);
      const retried = d === c.drill && !r.completed ? streamClip(c, fx.names, base, true) : r;
      rows.push({ protocol, clip: c.id, source: c.drill, variant: c.variant, body: c.body, level: c.level, azimuth: azimuthOf(c),
        selected: d, completed: r.completed, completedWithRetry: retried.completed, similarity: r.similarity, tempo: r.tempo,
        message: r.message, lookedLike: r.lookedLike, feedback: r.feedback });
    } yield; }
  }
  try {
    const trainPool = fx.clips.filter(c => (c.variant === "main" || c.variant === "ba:train") && CONTINUOUS_DRILLS.includes(c.drill));
    const tests = fx.clips.filter(c => isTestClip(c) && CONTINUOUS_DRILLS.includes(c.drill));
    if (protocols.includes("lobo"))
      for (const body of [...new Set(trainPool.map(c => c.body))])
        yield* run("lobo", buildModel(fx.clips.filter(c => isTrainClip(c) && c.body !== body), fx.names), trainPool.filter(c => c.body === body));
    if (protocols.includes("before")) yield* run("before", buildModel(fx.clips.filter(isLegacyTrainClip), fx.names), tests);
    if (protocols.includes("test")) yield* run("test", buildModel(fx.clips.filter(isTrainClip), fx.names), tests);
  } finally { setRecognitionModel(previous); }
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
export type Mutation = "reversed" | "frozen" | "slow4x" | "slow12x" | "fast" | "fps10" | "truncated" | "gap";
/** Programmatic scenario on a recorded clip. Positives: fast (0.6x time), fps10 (every 3rd frame), slow4x.
 * Negatives: reversed movement, frozen pose, slow12x (beyond the 10 s bound), truncated (pose frozen from the middle of
 * the labelled movement), gap (500 ms tracking dropout from 30% of the labelled movement, above the 400 ms gap limit). */
export function mutate(clip: FixtureClip, kind: Mutation): FixtureClip {
  if (kind === "fast") return { ...clip, id: clip.id + "#fast", t: clip.t.map(t => clip.t[0] + (t - clip.t[0]) * 0.6) };
  if (kind === "fps10") { const keep = clip.t.map((_, i) => i).filter(i => i % 3 === 0);
    return { ...clip, id: clip.id + "#fps10", t: keep.map(i => clip.t[i]), p: keep.map(i => clip.p[i]) }; }
  if (kind === "truncated" || kind === "gap") {
    const [a, b] = clip.move!, from = a + (b - a) * (kind === "truncated" ? 0.5 : 0.3);
    const k = clip.t.findIndex(t => t >= from);
    if (kind === "truncated") return { ...clip, id: clip.id + "#truncated", move: null, p: clip.p.map((p, i) => (i < k ? p : clip.p[k])) };
    return { ...clip, id: clip.id + "#gap", move: null, p: clip.p.map((p, i) => (clip.t[i] >= clip.t[k] && clip.t[i] < clip.t[k] + 500 ? [] : p)) };
  }
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
