// Discriminative whole-movement recognition for side-view drills.
// Every attempt is compared with the templates of ALL continuous drills (strikes and footwork share
// one candidate pool), using time-invariant matching: the trajectory is re-sampled by path length
// (pauses and tempo disappear) and aligned with banded DTW. The selected drill is accepted only when
// it is the nearest drill, within the acceptance distance, and ahead of the runner-up by a margin.
// All channels are screen-plane coordinates normalised by torso length; MediaPipe depth is never used.

export const CHANNELS = [
  "hand_x", "hand_y", "hand_over_head", "forearm_cos", "forearm_sin", "elbow_angle", "shoulder_offset",
  "wrist_cross_x", "wrist_cross_y", "left_ankle_x", "right_ankle_x", "left_ankle_y", "right_ankle_y",
  "root_dx", "torso_angle", "hand_dir_x", "hand_dir_y", "hand_share",
] as const;
// Channels expressed as displacement from the attempt start: stance width, foot height and torso posture differ
// between bodies far more than between drills, so only their change during the movement is compared.
const RELATIVE_CHANNELS = [6, 9, 10, 11, 12, 13, 14];
// Channels that define path length (and therefore the time-invariant parameterisation).
const PATH_CHANNELS = [0, 1, 9, 10, 13];
// hand_share (channel 17): share of the hand path in hand + feet path travelled so far. Strikes are mostly hand path,
// footwork mostly feet path whether the sword is carried or not - a body-size and guard-height independent cue.
const HAND_PATH = [0, 1], FEET_PATH = [9, 10, 13], HAND_SHARE = 17;

export interface RecognitionTemplate { drill: string; body: string; level: string; durationMs: number; seq: (number | null)[][] }
export interface RecognitionModel {
  version: 2; channels: readonly string[]; weights: number[]; scales: number[];
  /** Scales of the path-length parameterisation (overall channel spread). */
  pathScales: number[];
  points: number; band: number; acceptDistance: number; margin: number;
  /** Optional per-drill acceptance distances (fallback: acceptDistance). */
  acceptByDrill?: Record<string, number>;
  /** Per-drill distance = mean of the k nearest templates (default 1). */
  k?: number;
  /** Median path length (sequencePath) of the training templates per drill. */
  typicalPath?: Record<string, number>;
  /** Completion check: an attempt shorter than this fraction of typicalPath is not accepted (strikes stopped half-way). */
  minPathRatio?: Record<string, number>;
  /** End-stance check (advance/retreat): final foot spacing / starting foot spacing must reach this ratio, so a
   *  passing step paused at the crossing (feet together) is not accepted as a simple step. */
  minEndStance?: Record<string, number>;
  /** Median active duration (activeDurationMs) of the training attempts per drill (for the tempo note). */
  typicalMs: Record<string, number>;
  templates: RecognitionTemplate[];
}
export interface TimedFeatures { timeMs: number; features?: Record<string, number> }
export interface Recognition {
  distances: Record<string, number>; best: string; bestDistance: number; runnerUp: string; runnerUpDistance: number;
}

const finite = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Per-frame channels (NaN where a landmark is not observed). RELATIVE_CHANNELS become relative to the attempt start. */
export function frameChannels(f: Record<string, number> = {}): number[] {
  const right = finite(f.right_wrist_x);
  const hx = f.action_hand_x, hy = f.action_hand_y;
  const ex = right ? f.right_elbow_x : f.left_elbow_x, ey = right ? f.right_elbow_y : f.left_elbow_y;
  const wx = right ? f.right_wrist_x : f.left_wrist_x, wy = right ? f.right_wrist_y : f.left_wrist_y;
  let fc = NaN, fs = NaN;
  if (finite(ex) && finite(ey) && finite(wx) && finite(wy)) {
    const l = Math.hypot(wx - ex, wy - ey); if (l > 1e-3) { fc = (wx - ex) / l; fs = (wy - ey) / l; }
  }
  // elbow angle in the screen plane (the live *_elbow_angle features include MediaPipe depth)
  const sx = right ? f.right_shoulder_x : f.left_shoulder_x, sy = right ? f.right_shoulder_y : f.left_shoulder_y;
  let elbow = NaN;
  if (finite(sx) && finite(sy) && finite(ex) && finite(ey) && finite(wx) && finite(wy)) {
    const ax = sx - ex, ay = sy - ey, bx = wx - ex, by = wy - ey, d = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (d > 1e-8) elbow = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / d))) * 180 / Math.PI;
  }
  const v = (x: number | undefined) => (finite(x) ? x : NaN);
  return [
    v(hx), v(hy), finite(hy) && finite(f.nose_y) ? hy - f.nose_y : NaN, fc, fs, finite(elbow) ? elbow / 180 : NaN,
    finite(f.right_shoulder_x) && finite(f.left_shoulder_x) ? f.right_shoulder_x - f.left_shoulder_x : NaN,
    finite(f.left_wrist_x) && finite(f.right_wrist_x) ? f.left_wrist_x - f.right_wrist_x : NaN,
    finite(f.left_wrist_y) && finite(f.right_wrist_y) ? f.left_wrist_y - f.right_wrist_y : NaN,
    v(f.left_ankle_x), v(f.right_ankle_x), v(f.left_ankle_y), v(f.right_ankle_y),
    v(f.root_x), finite(f.torso_angle) ? f.torso_angle / 45 : NaN, NaN, NaN, NaN,
  ];
}

/** Guard-invariant arm representation: hand position, hand height over the head (unless keepAbsHoh), wrist crossing and
 *  elbow angle become displacements from the attempt's start pose, and the forearm direction is rotated by its start
 *  angle, so the trajectory is compared and not how high / at what angle the guard is held (real Vom Tag is held lower
 *  than the rendered one). Positions are already normalised by torso length (body scale). */
export const ARM_REL = { on: true, keepAbsHoh: true };
const ARM_REL_CHANNELS = [0, 1, 2, 5, 7, 8];
const startMedian = (rows: number[][], j: number) => {
  const v = rows.slice(0, 5).map(r => r[j]).filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : rows.map(r => r[j]).find(Number.isFinite) ?? NaN;
};
function armRelative(rows: number[][]): number[][] {
  const js = ARM_REL_CHANNELS.filter(j => !(j === 2 && ARM_REL.keepAbsHoh));
  const s0 = js.map(j => startMedian(rows, j));
  const a0 = Math.atan2(startMedian(rows, 4), startMedian(rows, 3));
  return rows.map(r => { const c = [...r]; js.forEach((j, k) => { c[j] = c[j] - s0[k]; });
    if (Number.isFinite(a0) && Number.isFinite(c[3]) && Number.isFinite(c[4])) { const a = Math.atan2(c[4], c[3]) - a0; c[3] = Math.cos(a); c[4] = Math.sin(a); }
    return c; });
}

/** Smoothed channels and cumulative (scaled) path length of an attempt. */
function pathProfile(samples: TimedFeatures[], pathScales: number[]) {
  let rows = samples.map(s => frameChannels(s.features));
  const start = RELATIVE_CHANNELS.map(j => {
    const v = rows.slice(0, 5).map(r => r[j]).filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? v[Math.floor((v.length - 1) / 2)] : rows.map(r => r[j]).find(Number.isFinite) ?? NaN;
  });
  rows = rows.map(r => { const c = [...r]; RELATIVE_CHANNELS.forEach((j, k) => { c[j] = c[j] - start[k]; }); return c; });
  if (ARM_REL.on) rows = armRelative(rows);
  // centred moving average (NaN-aware) suppresses per-frame landmark jitter before measuring path length
  const smooth = rows.map((_, i) => rows[0].map((__, j) => {
    const w = rows.slice(Math.max(0, i - 2), i + 3).map(r => r[j]).filter(Number.isFinite);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : NaN;
  }));
  const cum = [0], cumHand = [0], cumFeet = [0];
  const part = (i: number, js: number[]) => { let s = 0, n = 0;
    for (const j of js) { const d = (smooth[i][j] - smooth[i - 1][j]) / pathScales[j]; if (Number.isFinite(d)) { s += d * d; n++; } }
    return n ? Math.sqrt(s / n) : 0; };
  for (let i = 1; i < smooth.length; i++) {
    cum.push(cum[i - 1] + part(i, PATH_CHANNELS));
    cumHand.push(cumHand[i - 1] + part(i, HAND_PATH)); cumFeet.push(cumFeet[i - 1] + part(i, FEET_PATH));
  }
  return { smooth, cum, cumHand, cumFeet };
}

/** Path length of a re-sampled sequence over the path channels (same metric as the path-length parameterisation). */
export function sequencePath(seq: (number | null)[][], pathScales: number[]): number {
  let total = 0;
  for (let i = 1; i < seq.length; i++) {
    let s = 0, n = 0;
    for (const j of PATH_CHANNELS) {
      const a = seq[i][j], b = seq[i - 1][j];
      if (a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b)) { s += ((a - b) / pathScales[j]) ** 2; n++; }
    }
    total += n ? Math.sqrt(s / n) : 0;
  }
  return total;
}

/** Duration of the active part of the movement: from 5% to 95% of its path length (holds before/after excluded). */
export function activeDurationMs(samples: TimedFeatures[], pathScales: number[]): number {
  if (samples.length < 3) return 0;
  const { cum } = pathProfile(samples, pathScales), total = cum.at(-1)!;
  if (!(total > 1e-6)) return 0;
  const at = (f: number) => samples[cum.findIndex(c => c >= total * f)].timeMs;
  return at(.95) - at(.05);
}

/** Attempt samples -> path-length re-sampled sequence of `points` x CHANNELS (null for unobserved). */
export function prepareSequence(samples: TimedFeatures[], pathScales: number[], points: number): number[][] | null {
  if (samples.length < 3) return null;
  const { smooth, cum, cumHand, cumFeet } = pathProfile(samples, pathScales);
  const total = cum.at(-1)!;
  if (!(total > 1e-6)) return null;
  const out: number[][] = [];
  let k = 0;
  for (let p = 0; p < points; p++) {
    const target = total * p / (points - 1);
    while (k < cum.length - 2 && cum[k + 1] < target) k++;
    const span = cum[k + 1] - cum[k], r = span > 0 ? (target - cum[k]) / span : 0;
    out.push(smooth[k].map((a, j) => { const b = smooth[k + 1][j]; return Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * r : Number.isFinite(a) ? a : b; }));
    const h = cumHand[k] + (cumHand[k + 1] - cumHand[k]) * r, f = cumFeet[k] + (cumFeet[k + 1] - cumFeet[k]) * r;
    out[p][HAND_SHARE] = h + f > 1e-6 ? h / (h + f) : NaN;
  }
  // hand path direction along the re-sampled path (vertical vs horizontal vs diagonal strokes)
  for (let p = 0; p < points; p++) {
    const a = out[Math.max(0, p - 1)], b = out[Math.min(points - 1, p + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    out[p][15] = l > 1e-4 ? dx / l : NaN; out[p][16] = l > 1e-4 ? dy / l : NaN;
  }
  return out;
}

function frameDistance(a: (number | null)[], b: (number | null)[], m: RecognitionModel): number {
  let s = 0, w = 0;
  for (let j = 0; j < a.length; j++) {
    const x = a[j], y = b[j];
    if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const d = (x - y) / m.scales[j]; s += m.weights[j] * d * d; w += m.weights[j];
  }
  return w > 0 ? Math.sqrt(s / w) : Infinity;
}

/** Banded DTW with anchored ends, mean cost per aligned step. */
export function dtwDistance(a: (number | null)[][], b: (number | null)[][], m: RecognitionModel): number {
  const n = a.length, band = m.band;
  const cost = Array.from({ length: n + 1 }, () => new Float64Array(n + 1).fill(Infinity));
  const steps = Array.from({ length: n + 1 }, () => new Int32Array(n + 1));
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++) for (let j = Math.max(1, i - band); j <= Math.min(n, i + band); j++) {
    const d = frameDistance(a[i - 1], b[j - 1], m);
    let best = cost[i - 1][j - 1], st = steps[i - 1][j - 1];
    if (cost[i - 1][j] < best) { best = cost[i - 1][j]; st = steps[i - 1][j]; }
    if (cost[i][j - 1] < best) { best = cost[i][j - 1]; st = steps[i][j - 1]; }
    cost[i][j] = best + d; steps[i][j] = st + 1;
  }
  return cost[n][n] / Math.max(1, steps[n][n]);
}

/** Mean of the k smallest distances (k-nearest templates of one drill). */
export function kNearestMean(v: number[], k: number): number {
  const s = [...v].sort((a, b) => a - b).slice(0, Math.max(1, Math.min(k, v.length)));
  return s.reduce((a, b) => a + b, 0) / s.length;
}

export function recognize(seq: number[][], m: RecognitionModel, templates = m.templates): Recognition | null {
  const all: Record<string, number[]> = {};
  for (const t of templates) (all[t.drill] ??= []).push(dtwDistance(seq, t.seq, m));
  const distances = Object.fromEntries(Object.entries(all).map(([d, v]) => [d, kNearestMean(v, m.k ?? 1)]));
  const ranked = Object.entries(distances).sort((x, y) => x[1] - y[1]);
  if (ranked.length < 1) return null;
  const [best, bestDistance] = ranked[0];
  const [runnerUp, runnerUpDistance] = ranked[1] ?? ["", Infinity];
  return { distances, best, bestDistance, runnerUp, runnerUpDistance };
}

export type Decision =
  | { kind: "accepted"; distance: number; similarity: number; slow: boolean; tempo: number }
  | { kind: "other"; drill: string }
  /** complete: the selected drill was nearest, within the accept distance and its whole path was there (ambiguous only). */
  | { kind: "unknown"; complete?: boolean; incomplete?: "path" | "stance"; ignored?: boolean };

/** Final / starting foot spacing (medians of the first and last 5 observed frames); NaN without ankles. */
export function endStanceRatio(samples: TimedFeatures[]): number {
  const fd = samples.map(x => x.features?.foot_distance).filter((x): x is number => finite(x));
  if (fd.length < 3) return NaN;
  const med = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor((v.length - 1) / 2)];
  const start = med(fd.slice(0, 5));
  return start > 1e-6 ? med(fd.slice(-5)) / start : NaN;
}

/** Share of the selected drill's typical path covered by the attempt (NaN when the model has no typicalPath). */
export const COMPLETE_PATH_RATIO = 0.85;

/** Decide for the drill the user selected. tempoSamples: the part of the attempt the tempo is measured on (default:
 *  all samples), e.g. up to the settle at which the whole movement was already observed. */
/** Strike segmentation: keep the part of an attempt where the hands travel (HAND_TRIM.lo..hi of the hand path, padded),
 *  dropping a footwork-only lead-in / lead-out (stepping into the guard, walking back) that otherwise dominates the
 *  path-length parameterisation of real attempts. */
export const HAND_TRIM = { on: true, lo: 0.05, hi: 0.95, padMs: 150, mode: "span" as "span" | "burst", thr: 0.3, mergeMs: 250, burstPadMs: 250 };
/** Strike scoring: when a strike is selected, the feet channels (ankles, root) weigh `feet` x their model weight for
 *  every drill's templates, so a hand-dominant attempt is judged on the hands (real strikes carry a different amount of
 *  footwork than the renders). 1 = off. */
export const STRIKE_SCORING = { feet: 0 };
const FEET_CHANNELS = [9, 10, 11, 12, 13];
const strikeModel = (m: RecognitionModel): RecognitionModel => STRIKE_SCORING.feet === 1 ? m
  : { ...m, weights: m.weights.map((w, j) => FEET_CHANNELS.includes(j) ? w * STRIKE_SCORING.feet : w) };
export function handActiveWindow(samples: TimedFeatures[], pathScales: number[]): TimedFeatures[] {
  if (samples.length < 6) return samples;
  const { cumHand } = pathProfile(samples, pathScales), total = cumHand.at(-1)!;
  if (!(total > 1e-6)) return samples;
  const i0 = cumHand.findIndex(c => c >= total * HAND_TRIM.lo), i1 = cumHand.findIndex(c => c >= total * HAND_TRIM.hi);
  const t0 = samples[Math.max(0, i0)].timeMs - HAND_TRIM.padMs, t1 = samples[i1 < 0 ? samples.length - 1 : i1].timeMs + HAND_TRIM.padMs;
  const out = samples.filter(s => s.timeMs >= t0 && s.timeMs <= t1);
  return out.length >= 6 ? out : samples;
}

/** Share of the hand path in hand + feet path over a whole attempt (NaN without movement). */
export function handShareOf(samples: TimedFeatures[], pathScales: number[]): number {
  if (samples.length < 3) return NaN;
  const { cumHand, cumFeet } = pathProfile(samples, pathScales), h = cumHand.at(-1)!, f = cumFeet.at(-1)!;
  return h + f > 1e-6 ? h / (h + f) : NaN;
}
/** Strike attempt gate: with a strike selected, a not-accepted attempt whose (hand-trimmed) movement is mostly footwork
 *  (hand share < maxShare) is not a strike attempt at all (stepping into position, walking back): it is ignored and the
 *  attempt restarts instead of failing as "looks like a step". */
export const STRIKE_GATE = { on: false, maxShare: 0.3 };

/** Burst segmentation (HAND_TRIM.mode "burst"): the fastest hand movement of the attempt - the frames whose smoothed hand
 *  speed stays above thr x its peak around the peak (gaps shorter than mergeMs bridged), padded by burstPadMs. A long
 *  real attempt (stepping in, strike, recovery, next step) is cut down to the strike itself. */
export function handBurstWindow(samples: TimedFeatures[], pathScales: number[]): TimedFeatures[] {
  if (samples.length < 6) return samples;
  const { smooth } = pathProfile(samples, pathScales);
  const sp = smooth.map((r, i) => { if (!i) return 0; let s = 0, n = 0;
    for (const j of HAND_PATH) { const d = (r[j] - smooth[i - 1][j]) / pathScales[j]; if (Number.isFinite(d)) { s += d * d; n++; } }
    const dt = (samples[i].timeMs - samples[i - 1].timeMs) / 1000; return n && dt > 0 ? Math.sqrt(s / n) / dt : 0; });
  const sps = sp.map((_, i) => { const w = sp.slice(Math.max(0, i - 3), i + 4); return w.reduce((a, b) => a + b, 0) / w.length; });
  const peak = sps.indexOf(Math.max(...sps)), thr = HAND_TRIM.thr * sps[peak];
  if (!(sps[peak] > 0)) return samples;
  let a = peak, b = peak;
  for (let i = peak; i >= 0; i--) { if (sps[i] >= thr) a = i; else if (samples[a].timeMs - samples[i].timeMs > HAND_TRIM.mergeMs) break; }
  for (let i = peak; i < sps.length; i++) { if (sps[i] >= thr) b = i; else if (samples[i].timeMs - samples[b].timeMs > HAND_TRIM.mergeMs) break; }
  const t0 = samples[a].timeMs - HAND_TRIM.burstPadMs, t1 = samples[b].timeMs + HAND_TRIM.burstPadMs;
  const out = samples.filter(s => s.timeMs >= t0 && s.timeMs <= t1);
  return out.length >= 6 ? out : samples;
}
export const strikeWindow = (samples: TimedFeatures[], pathScales: number[]) =>
  HAND_TRIM.mode === "burst" ? handBurstWindow(samples, pathScales) : handActiveWindow(samples, pathScales);

/** Activity gates (before acceptance): a step attempt whose hand share exceeds stepMax (the hands did most of the
 *  moving: a strike or a weapon adjustment) or a strike attempt (hand-trimmed) below strikeMin (footwork only) is not an
 *  attempt at the selected drill and is ignored. 1 / 0 = off. */
export const ACTIVITY_GATE = { stepMax: .5, strikeMin: .3 };

export function decide(selected: string, samples: TimedFeatures[], m: RecognitionModel, tempoSamples = samples): Decision {
  const strike = selected.endsWith("hau");
  if (strike ? ACTIVITY_GATE.strikeMin > 0 : ACTIVITY_GATE.stepMax < 1) {
    const hs = handShareOf(strike && HAND_TRIM.on ? strikeWindow(samples, m.pathScales) : samples, m.pathScales);
    if (strike ? hs < ACTIVITY_GATE.strikeMin : hs > ACTIVITY_GATE.stepMax) return { kind: "unknown", ignored: true };
  }
  const d = decideInner(selected, samples, m, tempoSamples);
  if (STRIKE_GATE.on && d.kind !== "accepted" && selected.endsWith("hau")) {
    const w = HAND_TRIM.on ? strikeWindow(samples, m.pathScales) : samples;
    if (handShareOf(w, m.pathScales) < STRIKE_GATE.maxShare) return { kind: "unknown", ignored: true };
  }
  return d;
}
function decideInner(selected: string, samples: TimedFeatures[], m: RecognitionModel, tempoSamples = samples): Decision {
  if (HAND_TRIM.on && selected.endsWith("hau")) { samples = strikeWindow(samples, m.pathScales); tempoSamples = strikeWindow(tempoSamples, m.pathScales); }
  if (selected.endsWith("hau")) m = strikeModel(m);
  const seq = prepareSequence(samples, m.pathScales, m.points);
  const r = seq && recognize(seq, m);
  if (!r) return { kind: "unknown" };
  const own = r.distances[selected] ?? Infinity;
  const rival = Math.min(...Object.entries(r.distances).filter(([d]) => d !== selected).map(([, v]) => v));
  const accept = (d: string) => m.acceptByDrill?.[d] ?? m.acceptDistance;
  const pathRatio = m.typicalPath?.[selected] ? sequencePath(seq!, m.pathScales) / m.typicalPath[selected] : NaN;
  const incomplete = pathRatio < (m.minPathRatio?.[selected] ?? 0) ? "path" as const
    : endStanceRatio(samples) < (m.minEndStance?.[selected] ?? 0) ? "stance" as const : undefined;
  if (r.best === selected && own <= accept(selected) && rival >= own * m.margin && !incomplete) {
    const durationMs = activeDurationMs(tempoSamples, m.pathScales);
    const tempo = m.typicalMs[selected] ? durationMs / m.typicalMs[selected] : 1;
    const masters = m.templates.filter(t => t.drill === selected && t.level === "master");
    const quality = masters.length ? Math.min(...masters.map(t => dtwDistance(seq!, t.seq, m))) : own;
    let similarity = 100 * (1 - 0.5 * quality / accept(selected));
    if (tempo > 1.4) similarity -= Math.min(20, 25 * (tempo - 1.4));
    return { kind: "accepted", distance: own, similarity: Math.round(Math.max(0, Math.min(100, similarity))), slow: tempo > 1.6, tempo };
  }
  if (r.best !== selected && r.bestDistance <= accept(r.best) && own >= r.bestDistance * m.margin) return { kind: "other", drill: r.best };
  return { kind: "unknown", incomplete, complete: r.best === selected && own <= accept(selected) && pathRatio >= COMPLETE_PATH_RATIO };
}
