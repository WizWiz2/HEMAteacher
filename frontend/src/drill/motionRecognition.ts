// Discriminative whole-movement recognition for side-view drills.
// Every attempt is compared with the templates of ALL continuous drills (strikes and footwork share
// one candidate pool), using time-invariant matching: the trajectory is re-sampled by path length
// (pauses and tempo disappear) and aligned with banded DTW. The selected drill is accepted only when
// it is the nearest drill, within the acceptance distance, and ahead of the runner-up by a margin.
// All channels are screen-plane coordinates normalised by torso length; MediaPipe depth is never used.

export const CHANNELS = [
  "hand_x", "hand_y", "hand_over_head", "forearm_cos", "forearm_sin", "elbow_angle", "shoulder_offset",
  "wrist_cross_x", "wrist_cross_y", "left_ankle_x", "right_ankle_x", "left_ankle_y", "right_ankle_y",
  "root_dx", "torso_angle", "hand_dir_x", "hand_dir_y",
] as const;
// Channels that define path length (and therefore the time-invariant parameterisation).
const PATH_CHANNELS = [0, 1, 9, 10, 13];

export interface RecognitionTemplate { drill: string; body: string; level: string; durationMs: number; seq: (number | null)[][] }
export interface RecognitionModel {
  version: 2; channels: readonly string[]; weights: number[]; scales: number[];
  points: number; band: number; acceptDistance: number; margin: number;
  /** Median duration of the training attempts per drill (for the tempo note). */
  typicalMs: Record<string, number>;
  templates: RecognitionTemplate[];
}
export interface TimedFeatures { timeMs: number; features?: Record<string, number> }
export interface Recognition {
  distances: Record<string, number>; best: string; bestDistance: number; runnerUp: string; runnerUpDistance: number;
}

const finite = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Per-frame channels (NaN where a landmark is not observed). root_dx is filled in relative to the attempt start. */
export function frameChannels(f: Record<string, number> = {}): number[] {
  const right = finite(f.right_wrist_x);
  const hx = f.action_hand_x, hy = f.action_hand_y;
  const ex = right ? f.right_elbow_x : f.left_elbow_x, ey = right ? f.right_elbow_y : f.left_elbow_y;
  const wx = right ? f.right_wrist_x : f.left_wrist_x, wy = right ? f.right_wrist_y : f.left_wrist_y;
  let fc = NaN, fs = NaN;
  if (finite(ex) && finite(ey) && finite(wx) && finite(wy)) {
    const l = Math.hypot(wx - ex, wy - ey); if (l > 1e-3) { fc = (wx - ex) / l; fs = (wy - ey) / l; }
  }
  const elbow = right ? f.right_elbow_angle : f.left_elbow_angle;
  const v = (x: number | undefined) => (finite(x) ? x : NaN);
  return [
    v(hx), v(hy), finite(hy) && finite(f.nose_y) ? hy - f.nose_y : NaN, fc, fs, finite(elbow) ? elbow / 180 : NaN,
    finite(f.right_shoulder_x) && finite(f.left_shoulder_x) ? f.right_shoulder_x - f.left_shoulder_x : NaN,
    finite(f.left_wrist_x) && finite(f.right_wrist_x) ? f.left_wrist_x - f.right_wrist_x : NaN,
    finite(f.left_wrist_y) && finite(f.right_wrist_y) ? f.left_wrist_y - f.right_wrist_y : NaN,
    v(f.left_ankle_x), v(f.right_ankle_x), v(f.left_ankle_y), v(f.right_ankle_y),
    v(f.root_x), finite(f.torso_angle) ? f.torso_angle / 45 : NaN, NaN, NaN,
  ];
}

/** Attempt samples -> path-length re-sampled sequence of `points` x CHANNELS (null for unobserved). */
export function prepareSequence(samples: TimedFeatures[], scales: number[], points: number): number[][] | null {
  if (samples.length < 3) return null;
  let rows = samples.map(s => frameChannels(s.features));
  const root0 = rows.map(r => r[13]).find(Number.isFinite);
  rows = rows.map(r => { const c = [...r]; c[13] = Number.isFinite(root0!) ? c[13] - root0! : NaN; return c; });
  // centred moving average (NaN-aware) suppresses per-frame landmark jitter before measuring path length
  const smooth = rows.map((_, i) => rows[0].map((__, j) => {
    const w = rows.slice(Math.max(0, i - 2), i + 3).map(r => r[j]).filter(Number.isFinite);
    return w.length ? w.reduce((a, b) => a + b, 0) / w.length : NaN;
  }));
  const cum = [0];
  for (let i = 1; i < smooth.length; i++) {
    let s = 0, n = 0;
    for (const j of PATH_CHANNELS) { const d = (smooth[i][j] - smooth[i - 1][j]) / scales[j]; if (Number.isFinite(d)) { s += d * d; n++; } }
    cum.push(cum[i - 1] + (n ? Math.sqrt(s / n) : 0));
  }
  const total = cum.at(-1)!;
  if (!(total > 1e-6)) return null;
  const out: number[][] = [];
  let k = 0;
  for (let p = 0; p < points; p++) {
    const target = total * p / (points - 1);
    while (k < cum.length - 2 && cum[k + 1] < target) k++;
    const span = cum[k + 1] - cum[k], r = span > 0 ? (target - cum[k]) / span : 0;
    out.push(smooth[k].map((a, j) => { const b = smooth[k + 1][j]; return Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * r : Number.isFinite(a) ? a : b; }));
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

export function recognize(seq: number[][], m: RecognitionModel, templates = m.templates): Recognition | null {
  const distances: Record<string, number> = {};
  for (const t of templates) {
    const d = dtwDistance(seq, t.seq, m);
    if (!(t.drill in distances) || d < distances[t.drill]) distances[t.drill] = d;
  }
  const ranked = Object.entries(distances).sort((x, y) => x[1] - y[1]);
  if (ranked.length < 1) return null;
  const [best, bestDistance] = ranked[0];
  const [runnerUp, runnerUpDistance] = ranked[1] ?? ["", Infinity];
  return { distances, best, bestDistance, runnerUp, runnerUpDistance };
}

export type Decision =
  | { kind: "accepted"; distance: number; similarity: number; slow: boolean; tempo: number }
  | { kind: "other"; drill: string }
  | { kind: "unknown" };

/** Decide for the drill the user selected. */
export function decide(selected: string, samples: TimedFeatures[], m: RecognitionModel): Decision {
  const seq = prepareSequence(samples, m.scales, m.points);
  const r = seq && recognize(seq, m);
  if (!r) return { kind: "unknown" };
  const own = r.distances[selected] ?? Infinity;
  const rival = Math.min(...Object.entries(r.distances).filter(([d]) => d !== selected).map(([, v]) => v));
  if (r.best === selected && own <= m.acceptDistance && rival >= own * m.margin) {
    const durationMs = samples.at(-1)!.timeMs - samples[0].timeMs;
    const tempo = m.typicalMs[selected] ? durationMs / m.typicalMs[selected] : 1;
    const masters = m.templates.filter(t => t.drill === selected && t.level === "master");
    const quality = masters.length ? Math.min(...masters.map(t => dtwDistance(seq!, t.seq, m))) : own;
    let similarity = 100 * (1 - 0.5 * quality / m.acceptDistance);
    if (tempo > 1.4) similarity -= Math.min(20, 25 * (tempo - 1.4));
    return { kind: "accepted", distance: own, similarity: Math.round(Math.max(0, Math.min(100, similarity))), slow: tempo > 1.6, tempo };
  }
  if (r.best !== selected && r.bestDistance <= m.acceptDistance && own >= r.bestDistance * m.margin) return { kind: "other", drill: r.best };
  return { kind: "unknown" };
}
