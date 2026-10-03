// Template building and offline evaluation for motionRecognition (used by scripts/build-motion-patterns.mjs
// and by the fixture regression test). Input: the compact pose fixture (test-fixtures/motion-poses.json.gz).
import { LiveSampleProcessor } from "../live/sampleProcessor";
import type { RawPose } from "../live/landmarks";
import { CHANNELS, activeDurationMs, kNearestMean, prepareSequence, frameChannels, dtwDistance, type RecognitionModel, type TimedFeatures } from "./motionRecognition";

export interface FixtureClip {
  id: string; drill: string; variant: string; body: string; level: string; width: number; height: number;
  move: [number, number] | null; t: number[]; p: number[][];
  camera?: { azimuth_deg: number; height_m: number; distance_m: number; lens_mm: number };
  degradation?: { downscale_width: number; noise_sigma: number; crf: number; drop_fraction: number };
}
export interface Fixture { version: number; names: string[]; clips: FixtureClip[] }

export const CONTINUOUS_DRILLS = ["zornhau", "scheitelhau", "krumphau", "zwerchhau", "schielhau",
  "advance", "retreat", "passing-step-forward", "passing-step-backward"];

/** A priori channel weights (not fitted): hand path and feet dominate, posture details refine. */
export const WEIGHTS: Record<(typeof CHANNELS)[number], number> = {
  hand_x: 1, hand_y: 1, hand_over_head: .7, forearm_cos: .7, forearm_sin: .7, elbow_angle: .5, shoulder_offset: .5,
  wrist_cross_x: .4, wrist_cross_y: .4, left_ankle_x: 1, right_ankle_x: 1, left_ankle_y: .5, right_ankle_y: .5,
  root_dx: 1, torso_angle: .5, hand_dir_x: .5, hand_dir_y: .5,
};
export const POINTS = 32, BAND = 6, MARGIN = 1.15;
/** Model-building options (defaults = shipped). Exposed so design experiments can vary them on train-body LOBO only. */
export const TRAINING = { margin: MARGIN, perDrillAccept: false, acceptFloor: 0.75, acceptFactor: 1.5, fisherWeights: false, fisherGamma: 1, k: 1 };

export function rawFrames(clip: FixtureClip, names: string[]): RawPose[] {
  return clip.t.map((timestampMs, i) => {
    const p = clip.p[i], landmarks: RawPose["landmarks"] = {};
    if (p.length) names.forEach((n, k) => { landmarks[n] = { x: p[3 * k] / 1e4, y: p[3 * k + 1] / 1e4, z: 0, visibility: p[3 * k + 2] / 100 }; });
    return { timestampMs, width: clip.width, height: clip.height, landmarks };
  });
}

/** Live features exactly as the app computes them (side view, facing right). */
export function clipFeatures(clip: FixtureClip, names: string[]): TimedFeatures[] {
  const processor = new LiveSampleProcessor();
  return rawFrames(clip, names).map(raw => {
    const s = processor.process(raw, "right", "full_body", "side");
    return { timeMs: s.timeMs, features: s.features ?? undefined };
  });
}

export function movementSamples(clip: FixtureClip, names: string[]): TimedFeatures[] {
  const [a, b] = clip.move!;
  return clipFeatures(clip, names).filter(s => s.timeMs >= a - 100 && s.timeMs <= b + 250);
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
const median = (v: number[]) => { const s = [...v].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };

/** Build the recognition model from training clips only. Thresholds come from the training clips themselves
 *  (leave-one-clip-out distances), never from test clips. */
export function buildModel(train: FixtureClip[], names: string[]): RecognitionModel {
  const clips = train.filter(c => c.move && CONTINUOUS_DRILLS.includes(c.drill));
  // scales: spread of each channel over all training movement frames
  const frames = clips.flatMap(c => movementSamples(c, names).map(s => frameChannels(s.features)));
  const scales = CHANNELS.map((_, j) => {
    const v = frames.map(f => f[j]).filter(Number.isFinite);
    if (v.length < 10) return 1;
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.max(.05, Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length));
  });
  scales[15] = scales[16] = .5; // unit direction components
  const model: RecognitionModel = { version: 2, channels: CHANNELS, weights: CHANNELS.map(c => WEIGHTS[c]), scales: [...scales],
    pathScales: scales.map(round4), points: POINTS, band: BAND, acceptDistance: Infinity, margin: MARGIN, typicalMs: {}, templates: [] };
  for (const c of clips) {
    const seq = prepareSequence(movementSamples(c, names), scales, POINTS);
    if (seq) model.templates.push({ drill: c.drill, body: c.body, level: c.level, durationMs: c.move![1] - c.move![0],
      seq: seq.map(r => r.map(v => (Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : null))) });
  }
  // Matching scales: within-drill spread of the training templates (performer/body variation the matcher must
  // tolerate), so channels that differ between bodies but not between drills weigh less. Floor = landmark noise.
  model.scales = CHANNELS.map((_, j) => {
    let s = 0, n = 0;
    for (const d of CONTINUOUS_DRILLS) {
      const ts = model.templates.filter(t => t.drill === d);
      if (ts.length < 2) continue;
      for (let p = 0; p < POINTS; p++) {
        const v = ts.map(t => t.seq[p][j]).filter((x): x is number => x !== null);
        if (v.length < 2) continue;
        const mean = v.reduce((a, b) => a + b, 0) / v.length;
        for (const x of v) { s += (x - mean) ** 2; n++; }
      }
    }
    return n ? round4(Math.max(j >= 15 ? .25 : .03, Math.sqrt(s / n))) : round4(scales[j]);
  });
  if (TRAINING.fisherWeights) {
    // Discriminative channel weights fitted on the training templates only: how far apart the drills' mean
    // trajectories are on a channel, relative to its within-drill spread (body/camera/performer variation).
    const mean = (d: string, p: number, j: number) => {
      const v = model.templates.filter(t => t.drill === d).map(t => t.seq[p][j]).filter((x): x is number => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
    };
    const drills = CONTINUOUS_DRILLS.filter(d => model.templates.some(t => t.drill === d));
    const fisher = CHANNELS.map((_, j) => {
      let s = 0, n = 0;
      for (const [a, b] of drills.flatMap((a, i) => drills.slice(i + 1).map(b => [a, b] as const)))
        for (let p = 0; p < POINTS; p++) { const x = Math.abs(mean(a, p, j) - mean(b, p, j)); if (Number.isFinite(x)) { s += x; n++; } }
      return n ? s / n / model.scales[j] : 0;
    });
    const med = [...fisher].sort((a, b) => a - b)[Math.floor(fisher.length / 2)];
    model.weights = CHANNELS.map((c, j) => round4(WEIGHTS[c] * Math.min(4, Math.max(.25, (fisher[j] / med) ** TRAINING.fisherGamma))));
  }
  for (const d of CONTINUOUS_DRILLS) {
    const ms = clips.filter(c => c.drill === d).map(c => activeDurationMs(movementSamples(c, names), model.pathScales));
    if (ms.length) model.typicalMs[d] = median(ms);
  }
  // acceptance distance: 1.5 x the largest leave-one-out same-drill distance among training templates
  if (TRAINING.k > 1) model.k = TRAINING.k;
  const loo = model.templates.map((t, i) => kNearestMean(model.templates.filter((u, k) => k !== i && u.drill === t.drill)
    .map(u => dtwDistance(t.seq, u.seq, model)), TRAINING.k));
  model.acceptDistance = round4(TRAINING.acceptFactor * Math.max(...loo.filter(Number.isFinite)));
  model.margin = TRAINING.margin;
  if (TRAINING.perDrillAccept) {
    // per-drill acceptance: the drill's own leave-one-out spread, floored so drills with few templates stay usable
    model.acceptByDrill = {};
    for (const d of CONTINUOUS_DRILLS) {
      const v = loo.filter((x, i) => model.templates[i].drill === d && Number.isFinite(x));
      if (v.length) model.acceptByDrill[d] = round4(Math.max(TRAINING.acceptFloor * model.acceptDistance, TRAINING.acceptFactor * Math.max(...v)));
    }
  }
  return model;
}

/** Training split of the shipped model: main mock clips and the bodies/angles TRAIN renders (docs/bodies-angles-split.md),
 *  master and experienced performers only. Reserved TEST bodies and angles are never used. */
export const isTrainClip = (c: FixtureClip) => (c.variant === "main" || c.variant === "ba:train") && (c.level === "master" || c.level === "experienced") && CONTINUOUS_DRILLS.includes(c.drill);
