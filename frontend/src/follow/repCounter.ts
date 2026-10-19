// Follow-along mode: movement-based repetition counting and soft similarity, independent of the
// accept/reject recogniser. A repetition is a burst of movement between two settled poses; a burst that
// brings the body back to where the previous repetition started is the return to guard and is not counted.
// Similarity is the DTW distance to the selected drill's templates only (no competition between drills),
// mapped to 0..100: the score is feedback on how close the movement is, never a verdict on which drill it was.
import { activeDurationMs, dtwDistance, prepareSequence, sequencePath, type TimedFeatures } from "../drill/motionRecognition";
import { motionPatternFor, recognitionModel, type MotionView } from "../drill/continuousMotion";

export interface FollowSample { timeMs: number; features: Record<string, number> | null }
export interface FollowRep {
  index: number;
  startMs: number;
  endMs: number;
  /** 0..100, closeness to the drill templates. */
  similarity: number;
  /** Raw DTW distance to the nearest template (for tests and diagnostics). */
  distance: number;
  /** Active duration / typical duration of the drill. */
  tempo: number;
  hint: string | null;
  /** 0..100, closeness to the previous repetition (how repeatable the movement is); null for the first one. */
  consistency: number | null;
  /** Path-resampled movement (kept for the consistency comparison). */
  seq?: number[][];
}
export type CounterPhase = "waiting" | "ready" | "moving";

export const FOLLOW_SETTINGS = {
  /** Pose counted as settled when it stays within this fraction of the drill's extent (with a noise floor). */
  stillExtent: 0.12,
  stillFloor: 0.02,
  /** A settled pose must last this long to become the guard (strikes) or to end a step. */
  settleMs: 220,
  /** Movement starts once the pose has left the rest pose by this fraction of the drill's extent (with a noise floor). */
  onsetExtent: 0.25,
  onsetFloor: 0.03,
  /** A repetition must travel at least this fraction of the drill's extent. */
  minExtent: 0.45,
  /** Frontal strikes that never reach the references' end-of-cut zone must travel this much to count. */
  minExtentNoCut: 0.7,
  /** Frontal strikes: a pose held in the references' end-of-cut zone at least this far from the guard is the end of a
   *  (short) cut, whatever its amplitude. */
  minExtentHeld: 0.2,
  /** Frontal strikes that never reach the end-of-cut zone must spend this long beyond half of their excursion. */
  minAwayMs: 200,
  /** Strikes: back within this fraction of the strike's excursion from the guard = back in guard. */
  homeRadius: 0.35,
  homeFloor: 0.08,
  minDurationMs: 200,
  maxDurationMs: 10000,
  preRollMs: 250,
  /** Longer gaps between pose frames (tracking lost) restart the counter. */
  maxGapMs: 700,
  /** Strikes: a movement scoring this much better played backwards is a return, not a repetition. */
  returnMargin: 15,
  /** Frontal strikes (returns retrace the cut closely in the image plane): a smaller margin is enough. */
  returnMarginFront: 5,
  /** Frontal strikes: a stop this far (fraction of the wind-up's rise) below the top of the wind-up ends the cut. */
  earlyDrop: 0.6,
  /** Strikes: a guard-like pose held this long after the cut ends the repetition even away from where it started. */
  guardHoldMs: 700,
};

const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)] ?? 0; };
export const isStrike = (drill: string) => drill.endsWith("hau");

/** Feature channels the counter tracks: hands for strikes (the guard is where the hands rest), feet and the body's
 *  fore/aft position for footwork. */
export function counterFeatures(drill: string, view: MotionView): string[] {
  const pattern = motionPatternFor(drill, view);
  if (!pattern) return [];
  return isStrike(drill) ? pattern.features.filter(f => f.startsWith("action_hand")) : pattern.features;
}

/** Typical spatial extent of a drill in the counter's channels: median over templates of the largest excursion from the start pose. */
export function drillExtent(drill: string, view: MotionView): number {
  const pattern = motionPatternFor(drill, view);
  if (!pattern) return 0.3;
  const idx = counterFeatures(drill, view).map(f => pattern.features.indexOf(f));
  const pick = (v: number[]) => idx.map(i => v[i]);
  return median(pattern.templates.map(t => Math.max(...t.frames.map(v => dist(pick(v), pick(t.frames[0]))))));
}

/** Distance at which the similarity is 50. Calibrated on the fixture (DTW to the nearest template of the drill,
 *  leave-one-body-out): synthetic held-out bodies ~0.6-0.85 (score ~75-85), another drill of the same kind ~1.4
 *  (~50), real frontal reps of unseen people ~1.7 (~45). */
export const SIMILARITY_HALF = 1.5;
/** Map a template distance to 0..100: 100 at zero distance, 50 at SIMILARITY_HALF, smoothly falling. */
export function similarityScore(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  const r = distance / SIMILARITY_HALF;
  return Math.round(100 / (1 + r * r));
}

/** Strikes: each template's start pose (the guard) and its last pose (where the cut ends; a wind-up can reach farther), in the counter's channels. */
export function strikeEnds(drill: string, view: MotionView): { guard: number[]; end: number[] }[] {
  const pattern = motionPatternFor(drill, view);
  // Only facing the camera do the hands clearly separate guard and end of the cut (they cross the body); in profile
  // a high guard and an extended cut overlap too much across bodies and camera angles to tell apart reliably.
  if (!pattern || !isStrike(drill) || view !== "front") return [];
  const idx = counterFeatures(drill, view).map(f => pattern.features.indexOf(f));
  const pick = (v: number[]) => idx.map(i => v[i]);
  // Every reference counts, including one cutting from the other side (zwerchhau can be cut from either side).
  return pattern.templates.map(t => {
    const guard = pick(t.frames[0]);
    const end = pick(t.frames[t.frames.length - 1]);
    return { guard, end };
  });
}

/** Strikes: is a held pose the guard (nearer to some template's start pose than to any template's end pose)? A pose held at
 *  the end of the cut must not become the guard, or every later "repetition" would be return + guard + cut. */
export function looksLikeGuard(v: number[], ends: { guard: number[]; end: number[] }[]): boolean {
  if (!ends.length) return true;
  return Math.min(...ends.map(e => dist(v, e.guard))) <= Math.min(...ends.map(e => dist(v, e.end)));
}

/** Strikes: has the cut arrived (within 0.4 of a template's reach of its end of the cut, and nearer to it than to any
 *  guard)? The top of a wind-up is away from the guard too, but not there yet. */
export function inEndZone(v: number[], shapes: { guard: number[]; end: number[] }[]): boolean {
  const toGuard = Math.min(...shapes.map(e => dist(v, e.guard)));
  return shapes.some(e => { const d = dist(v, e.end); return d < toGuard && d < 0.4 * dist(e.end, e.guard); });
}

export interface RepScore { similarity: number; distance: number; tempo: number; hint: string | null; seq: number[][] }

/** Score one segment against the selected drill (best over the whole segment and its strike-only part). */
export function scoreSegment(drill: string, samples: TimedFeatures[], view: MotionView, excludeBody?: string): RepScore | null {
  const model = recognitionModel(view);
  // excludeBody: leave-one-body-out scoring in tests (a clip must not be compared with its own template).
  const own = model.templates.filter(t => t.drill === drill && t.body !== excludeBody);
  if (!own.length || samples.length < 4) return null;
  // The recogniser smooths over 5 frames; at a low camera frame rate that would blur a half-second strike, so the
  // segment is first brought to the rate the templates were built at.
  const candidates = [resampleTimed(samples, 1000 / 30)];
  let bestScore: { d: number; seq: number[][]; part: TimedFeatures[] } | null = null;
  for (const part of candidates) {
    const seq = prepareSequence(part, model.pathScales, model.points);
    if (!seq) continue;
    const d = Math.min(...own.map(t => dtwDistance(seq, t.seq, model)));
    if (!bestScore || d < bestScore.d) bestScore = { d, seq, part };
  }
  if (!bestScore) return null;
  // Tempo against the side-view training durations (frontal renders have noisier typical durations).
  const typical = recognitionModel("side").typicalMs[drill] ?? model.typicalMs[drill];
  const duration = activeDurationMs(bestScore.part, model.pathScales);
  const tempo = typical ? duration / typical : 1;
  const pathRatio = model.typicalPath?.[drill] ? sequencePath(bestScore.seq, model.pathScales) / model.typicalPath[drill] : NaN;
  let hint: string | null = null;
  if (pathRatio < 0.45) hint = drill.endsWith("hau") ? "Движение короче, чем у эталона: доводи удар до конца" : "Шаг короче, чем у эталона";
  else if (tempo > 2.2) hint = "Медленнее эталона: попробуй слитно, без пауз";
  return { similarity: similarityScore(bestScore.d), distance: bestScore.d, tempo, hint, seq: bestScore.seq };
}

/** Linear re-sampling of feature samples onto a regular time grid (features missing on either side stay missing). */
export function resampleTimed(samples: TimedFeatures[], stepMs: number): TimedFeatures[] {
  if (samples.length < 2) return samples;
  const t0 = samples[0].timeMs, t1 = samples.at(-1)!.timeMs;
  const median = [...samples.slice(1).map((s, i) => s.timeMs - samples[i].timeMs)].sort((a, b) => a - b)[Math.floor((samples.length - 2) / 2)];
  if (!(median > stepMs * 1.5)) return samples;
  const out: TimedFeatures[] = [];
  let k = 0;
  for (let t = t0; t <= t1 + 1e-6; t += stepMs) {
    while (k < samples.length - 2 && samples[k + 1].timeMs < t) k++;
    const a = samples[k], b = samples[k + 1];
    const r = b.timeMs > a.timeMs ? Math.min(1, Math.max(0, (t - a.timeMs) / (b.timeMs - a.timeMs))) : 0;
    const fa = a.features, fb = b.features;
    let features: Record<string, number> | undefined;
    if (fa && fb) {
      features = {};
      for (const key of Object.keys(fa)) if (Number.isFinite(fa[key]) && Number.isFinite(fb[key])) features[key] = fa[key] + (fb[key] - fa[key]) * r;
    } else features = r < 0.5 ? fa : fb;
    out.push({ timeMs: Math.round(t), features });
  }
  return out;
}

interface Burst { startMs: number; baseline: number[]; samples: FollowSample[]; vectors: number[][]; far: number; /** Strikes: has reached the end-of-cut zone. */ cut: boolean; /** Strikes: has left the guard zone or travelled minExtentNoCut. */ left: boolean; dir?: { key: number; forward: number; backward: number }; /** Highest hand point so far (strikes). */ peak?: number; /** Stop already checked for an early credit (its settle start). */ stopChecked?: number }

export class RepCounter {
  readonly drill: string;
  readonly view: MotionView;
  phase: CounterPhase = "waiting";
  reps: FollowRep[] = [];
  /** Movements not counted: steps back to the start (footwork) or strikes abandoned before reaching full extent. */
  returns = 0;
  private features: string[];
  private extent: number;
  private strike: boolean;
  private history: { s: FollowSample; v: number[] }[] = [];
  private settledSince: number | null = null;
  /** Strikes: the guard pose. Footwork: the stance the current step starts from. */
  private rest: number[] | null = null;
  private burst: Burst | null = null;
  /** Passing steps: fore/aft order of the feet in the last clearly split stance (+1/-1, 0 = not seen yet). */
  private footOrder = 0;
  private ends: { guard: number[]; end: number[] }[];
  /** Strikes: how long the current guard was held when it was taken. */
  private restHeldMs = 0;

  constructor(drill: string, view: MotionView = "front", private settings = FOLLOW_SETTINGS) {
    this.drill = drill;
    this.view = view;
    this.features = counterFeatures(drill, view);
    if (!this.features.length) throw new Error(`no motion pattern for ${drill}`);
    this.extent = drillExtent(drill, view);
    this.strike = isStrike(drill);
    this.ends = strikeEnds(drill, view);
  }

  reset() {
    this.phase = "waiting"; this.reps = []; this.returns = 0; this.history = []; this.settledSince = null;
    this.rest = null; this.burst = null; this.footOrder = 0;
  }

  /** Feed one pose sample; returns the repetition completed by this sample, if any. */
  push(sample: FollowSample): FollowRep | null {
    const st = this.settings;
    const v = this.features.map(n => sample.features?.[n] ?? NaN);
    const last = this.history.at(-1);
    if (last && sample.timeMs <= last.s.timeMs) return null;
    if (last && sample.timeMs - last.s.timeMs > st.maxGapMs) this.lose();
    if (!v.every(Number.isFinite)) return null;
    this.history.push({ s: sample, v });
    while (this.history.length > 2 && this.history[0].s.timeMs < sample.timeMs - 1500) this.history.shift();
    // Stillness relative to the drill's size: every pose of the last settleMs stays within a small radius of the
    // current one (front-view steps move the feet only a few hundredths of a torso length per frame).
    const stillRadius = Math.max(st.stillFloor, this.extent * st.stillExtent);
    // The window reaches back to the last pose older than settleMs, so a low frame rate (a slow phone) still settles.
    let from = -1;
    for (let i = this.history.length - 1; i >= 0; i--) if (this.history[i].s.timeMs <= sample.timeMs - st.settleMs) { from = i; break; }
    const window = from < 0 ? [] : this.history.slice(from);
    const still = window.length >= 2 && window.every(h => dist(h.v, v) < stillRadius);
    this.settledSince = still ? (this.settledSince ?? sample.timeMs) : null;
    const settled = still;
    const heldMs = this.settledSince === null ? 0 : sample.timeMs - this.settledSince + st.settleMs;

    if (!this.burst) {
      // Strikes keep the first guard until a repetition ends (a pause mid-strike must not become the new guard).
      if (settled && !this.strike) this.rest = v;
      // Strikes: the guard is the first held pose that looks like a guard; a pose held at the end of the cut
      // (counting started mid-movement, or a long hold before the return) is skipped.
      if (settled && this.strike && !this.rest && looksLikeGuard(v, this.ends)) { this.rest = v; this.restHeldMs = heldMs; }
      if (settled && !this.strike && this.order(v)) this.footOrder = this.order(v);
      if (!this.rest) { this.phase = "waiting"; return null; }
      this.phase = "ready";
      // Frontal strikes: a small cut can end closer to the guard than the onset distance; arriving in the end-of-cut
      // zone starts the repetition too.
      const heldCut = Math.max(this.extent * st.minExtentHeld, 1.5 * stillRadius);
      if (dist(v, this.rest) > Math.max(st.onsetFloor, this.extent * st.onsetExtent) || (this.ends.length > 0 && dist(v, this.rest) >= heldCut && inEndZone(v, this.ends))) {
        // The repetition starts where the pose left the rest pose (the onset threshold is crossed only part-way into
        // the windup), at least preRollMs back.
        const rest = this.rest;
        let from = this.history.length - 1;
        while (from > 0 && (dist(this.history[from - 1].v, rest) >= stillRadius || this.history[from - 1].s.timeMs >= sample.timeMs - st.preRollMs)) from--;
        const pre = this.history.slice(Math.max(0, from - 1));
        this.burst = { startMs: pre[0].s.timeMs, baseline: this.rest, samples: pre.map(h => h.s), vectors: pre.map(h => h.v), far: 0, cut: false, left: false };
        this.phase = "moving";
      } else if (settled && this.strike && (!this.ends.length || (looksLikeGuard(v, this.ends) && dist(v, this.rest) < stillRadius))) { this.rest = v; this.restHeldMs = Math.max(this.restHeldMs, heldMs); } // slow drift of the guard while standing in it (frontal: not into the start of the cut)
      return null;
    }
    const b = this.burst;
    b.samples.push(sample); b.vectors.push(v);
    b.far = Math.max(b.far, dist(v, b.baseline));
    if (this.strike) b.peak = Math.max(b.peak ?? -Infinity, v[1]);
    if (sample.timeMs - b.startMs > st.maxDurationMs) {
      // Away from the start for too long: the guard / stance has changed; start over from the current pose.
      this.burst = null; this.rest = null; this.phase = "waiting"; return null;
    }
    if (this.strike && this.ends.length) {
      if (!b.cut && dist(v, b.baseline) >= this.extent * st.minExtent && inEndZone(v, this.ends)) b.cut = true;
      // A small body / short cut: stopping in the end-of-cut zone counts as arriving, even below minExtent.
      if (!b.cut && settled && inEndZone(v, this.ends) && dist(v, b.baseline) >= Math.max(this.extent * st.minExtentHeld, 1.5 * stillRadius)) b.cut = true; // same as heldCut
      if (!b.left && (!looksLikeGuard(v, this.ends) || dist(v, b.baseline) >= this.extent * st.minExtentNoCut)) b.left = true;
      // Before the movement has got anywhere, a guard held longer than the one this burst started from is the real
      // guard: the burst started from a stop on the way (back from a cut, or a pause in the wind-up). Start over there.
      if (!b.cut && settled && heldMs > this.restHeldMs && dist(v, b.baseline) > stillRadius && looksLikeGuard(v, this.ends)) {
        // ...unless the movement so far was a whole cut and its way back (a body whose end of the cut lies close to its
        // guard never enters the end zone): count it and take this guard for the next one.
        if (b.far >= this.extent * st.minExtent && this.direction(b).forward >= this.direction(b).backward + st.returnMarginFront) return this.endStrike(b, v, sample, true);
        this.burst = null; this.rest = v; this.restHeldMs = heldMs; this.phase = "ready"; return null;
      }
      // Credit the cut where it stops, instead of after the return and a new guard: stopped well below the top of
      // the wind-up after a real excursion, and the movement so far plays forwards (a return over the head plays
      // backwards). A pause at the top of a wind-up (zwerchhau) is not low enough.
      if (settled && this.settledSince !== null && b.stopChecked !== this.settledSince && b.far >= this.extent * st.minExtent && b.peak !== undefined) {
        b.stopChecked = this.settledSince;
        const rise = b.peak - b.baseline[1];
        if (rise > 0 && b.peak - v[1] >= st.earlyDrop * rise && sample.timeMs - b.startMs >= st.minDurationMs) {
          const { forward, backward } = this.direction(b);
          if (forward >= backward + st.returnMarginFront) return this.endStrike(b, v, sample, true);
        }
      }
      // Passing back through the guard before the cut has arrived (krumphau, zwerchhau wind-ups) does not end the
      // strike; stopping there does (a cut that ends away from the references' end poses still counts).
      if (!b.cut && dist(v, b.baseline) <= Math.max(st.homeFloor, b.far * st.homeRadius)) {
        if (!settled) return null;
        // Stopped back in guard without reaching the end of a cut, leaving the guard zone or travelling most of a typical
        // strike: shuffling or tracking noise, not a strike.
        if (!b.left || b.far < this.extent * st.minExtent) { this.burst = null; this.rest = v; this.restHeldMs = heldMs; this.phase = "ready"; return null; }
      }
      return this.endStrike(b, v, sample, settled && heldMs >= st.guardHoldMs && b.cut && looksLikeGuard(v, this.ends));
    }
    return this.strike ? this.endStrike(b, v, sample, false) : this.endStep(b, v, sample, settled);
  }

  private endStrike(b: Burst, v: number[], sample: FollowSample, newGuard: boolean): FollowRep | null {
    const st = this.settings;
    const home = Math.max(st.homeFloor, b.far * st.homeRadius);
    // Back in guard: where the repetition started, or (after the cut) any guard held for guardHoldMs: the strike
    // started from a stop inside the movement, or the user changed guard.
    if (dist(v, b.baseline) > home && !newGuard) return null;
    // Back in guard. The next repetition starts from the guard the body settles into now (re-established on the
    // next pause), so the tail of the return cannot start a new repetition.
    this.burst = null; this.rest = null; this.phase = "waiting";
    if ((!b.cut && b.far < this.extent * st.minExtent) || sample.timeMs - b.startMs < st.minDurationMs) return null;
    if (!b.cut && this.ends.length) {
      // Frontal strike that never arrived at an end of cut: it must have been away from the guard for a while (a
      // tracking spike of a few frames is not a strike).
      let awayMs = 0;
      for (let i = 1; i < b.samples.length; i++) if (dist(b.vectors[i], b.baseline) > b.far / 2) awayMs += b.samples[i].timeMs - b.samples[i - 1].timeMs;
      if (awayMs < st.minAwayMs) return null;
    }
    // Strike part: from leaving the guard to the farthest point (+ a little), where the cut ends.
    const farIndex = b.vectors.reduce((best, x, i) => (dist(x, b.baseline) > dist(b.vectors[best], b.baseline) ? i : best), 0);
    const farTime = b.samples[farIndex].timeMs;
    const strikePart = b.samples.filter(x => x.timeMs <= farTime + 150);
    // A way back that retraces the cut (krumphau, zwerchhau returns go back up over the head) matches the references
    // far better played backwards: it is the return to a guard the counter had not seen, not a repetition.
    const { forward, backward } = this.direction(b, strikePart);
    if (backward >= forward + (this.ends.length ? st.returnMarginFront : st.returnMargin)) { this.returns++; return null; }
    return this.record(b, sample, [strikePart, b.samples]);
  }

  /** Similarity of the burst played forwards (whole or up to the cut) and backwards. */
  private direction(b: Burst, strikePart?: FollowSample[]): { forward: number; backward: number } {
    const key = b.samples.length * 2 + (strikePart ? 1 : 0);
    if (b.dir?.key === key) return b.dir;
    const timed = (list: FollowSample[]) => list.map(s => ({ timeMs: s.timeMs, features: s.features ?? undefined }));
    const t1 = b.samples.at(-1)!.timeMs;
    const forward = Math.max(...[strikePart ?? [], b.samples].map(p => (p.length >= 4 ? scoreSegment(this.drill, timed(p), this.view)?.similarity ?? 0 : 0)));
    const backward = scoreSegment(this.drill, timed([...b.samples].reverse().map(s => ({ ...s, timeMs: t1 - s.timeMs }))), this.view)?.similarity ?? 0;
    b.dir = { key, forward, backward };
    return b.dir;
  }

  private endStep(b: Burst, v: number[], sample: FollowSample, settled: boolean): FollowRep | null {
    const st = this.settings;
    if (!settled) return null;
    const passing = this.drill.startsWith("passing");
    // Passing steps swap the feet (fore/aft order in profile, image height facing the camera); a pause with the
    // feet still uncrossed keeps the step open.
    // The reference order is the last clearly split stance, so a pause with the feet together does not reset it.
    const order = this.order(v);
    if (!this.footOrder) this.footOrder = this.order(b.baseline);
    const crossed = order !== 0 && this.footOrder !== 0 && order !== this.footOrder;
    if (b.far < this.extent * st.minExtent) {
      // A shuffle or noise: settle into it without counting.
      this.burst = null; this.rest = v; this.phase = "ready"; return null;
    }
    if (passing && !crossed) return null;
    if (!passing) {
      // A simple step ends in the starting stance (feet configuration, not the body's position): a pause after the
      // first foot moved (stance still split) keeps the step open until the other foot follows.
      const stance = this.features.map((f, i) => (f === "root_x" ? -1 : i)).filter(i => i >= 0);
      const pick = (x: number[]) => stance.map(i => x[i]);
      const split = Math.max(...b.vectors.map(x => dist(pick(x), pick(b.baseline))));
      if (dist(pick(v), pick(b.baseline)) > split * 0.5) return null;
    }
    this.burst = null; this.rest = v; this.phase = "ready";
    if (order) this.footOrder = order;
    // Root moves forward for forward drills; a step in the opposite direction brings the body back and is not counted.
    const root = this.features.indexOf("root_x");
    const forward = this.drill === "advance" || this.drill === "passing-step-forward";
    if (root >= 0) {
      const d = v[root] - b.baseline[root];
      if (Math.abs(d) > 0.04 && (d > 0) !== forward) { this.returns++; return null; }
    }
    const settledAt = this.settledSince!;
    return this.record(b, sample, [b.samples.filter(s => s.timeMs <= settledAt)]);
  }

  private order(v: number[]): number {
    const [ca, cb] = this.view === "front" ? [2, 3] : [0, 1];
    const d = v[ca] - v[cb];
    return Math.abs(d) > 0.1 ? Math.sign(d) : 0;
  }

  private record(b: Burst, sample: FollowSample, parts: FollowSample[][]): FollowRep {
    const timed = (list: FollowSample[]) => list.map(s => ({ timeMs: s.timeMs, features: s.features ?? undefined }));
    let score: RepScore | null = null;
    for (const p of parts) {
      if (p.length < 4) continue;
      const sc = scoreSegment(this.drill, timed(p), this.view);
      if (sc && (!score || sc.similarity > score.similarity)) score = sc;
    }
    const rep: FollowRep = {
      index: this.reps.length + 1, startMs: b.startMs, endMs: sample.timeMs,
      similarity: score?.similarity ?? 0, distance: score?.distance ?? Infinity, tempo: score?.tempo ?? 1, hint: score?.hint ?? null,
      consistency: null, seq: score?.seq,
    };
    const prev = this.reps.at(-1);
    if (prev?.seq && rep.seq) rep.consistency = similarityScore(dtwDistance(rep.seq, prev.seq, recognitionModel(this.view)));
    this.reps.push(rep);
    return rep;
  }

  private lose() {
    this.history = []; this.settledSince = null; this.burst = null; this.rest = null; this.phase = "waiting";
  }
}

export interface FollowSummary { reps: number; averageSimilarity: number | null; best: number | null; consistency: number | null; hints: string[] }
export function summarize(reps: FollowRep[]): FollowSummary {
  if (!reps.length) return { reps: 0, averageSimilarity: null, best: null, consistency: null, hints: [] };
  const avg = Math.round(reps.reduce((s, r) => s + r.similarity, 0) / reps.length);
  const cons = reps.map(r => r.consistency).filter((c): c is number => c !== null);
  const counts = new Map<string, number>();
  for (const r of reps) if (r.hint) counts.set(r.hint, (counts.get(r.hint) ?? 0) + 1);
  // Only a hint that repeats in at least a third of the repetitions is worth carrying into the summary.
  const hints = [...counts].filter(([, n]) => n >= Math.max(2, reps.length / 3)).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  return { reps: reps.length, averageSimilarity: avg, best: Math.max(...reps.map(r => r.similarity)),
    consistency: cons.length ? Math.round(cons.reduce((a, b) => a + b, 0) / cons.length) : null, hints };
}
