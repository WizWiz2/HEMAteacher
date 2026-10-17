// Experimental blade detector (feature flag, off by default; docs/blade-tracking.md).
// Classical, CPU-only, no model download: the blade is a thin straight line that starts at the hands. For every ray
// direction from the hand centre we measure a "thin ridge" response (centre pixel differs from BOTH sides, which
// rejects the step edges of arms and torso) along the part of the ray where the blade must lie, and pick the best
// direction. The tip is where the ridge response fades along that ray. Low-contrast frames (motion blur in the fast
// part of a strike) return null; the matcher simply skips the blade channels there.

export interface GrayImage { data: ArrayLike<number>; width: number; height: number }
export interface BladeDetection {
  /** normalised image coordinates (0..1, y down), like MediaPipe landmarks */
  guard: [number, number]; tip: [number, number];
  /** best-direction response / best competing direction (> 20 degrees away) */
  contrast: number;
}
export interface BladeOptions {
  angleSteps: number; nearFrom: number; nearTo: number; farTo: number; offsetPx: number; minContrast: number;
  /** typical 2D blade length, torso units (train renders: median 2.0) */
  bladeLength: number;
  /** short-segment search for foreshortened blades: segment end (torso units) and weight (0 = off) */
  shortTo: number; shortWeight: number;
  /** directions passing within bodyClearance (torso units) of a body landmark are multiplied by bodyPenalty */
  bodyClearance: number; bodyPenalty: number; bodyAngle: number;
  /** sideways line shifts tried around the hand centre: +-shift in steps of shiftStep (torso units) */
  shift: number; shiftStep: number;
  /** backward cone (degrees, 0 = off) suppressed when the hands are >= backExtension torso from the shoulder centre */
  backCone: number; backExtension: number;
  /** guard distance from the hand centre along the blade, torso units (train renders: median 0.31) */
  guardOffset: number;
}
export const BLADE_DETECTOR_DEFAULTS: BladeOptions = {
  angleSteps: 120, nearFrom: .45, nearTo: 1.3, farTo: 2.6, offsetPx: 2.5, minContrast: 1.6, guardOffset: .31,
  bladeLength: 2, shortTo: .8, shortWeight: 0, bodyClearance: .2, bodyPenalty: .3, bodyAngle: 15, shift: .15, shiftStep: .03, backCone: 80, backExtension: .5,
};

function sampler(img: GrayImage) {
  const { data, width: w, height: h } = img;
  return (x: number, y: number) => {
    if (x < 0 || y < 0 || x > w - 2 || y > h - 2) return NaN;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (data[i] * (1 - fx) + data[i + 1] * fx) * (1 - fy) + (data[i + w] * (1 - fx) + data[i + w + 1] * fx) * fy;
  };
}

/** Signed thin-ridge terms at (x, y) for a line with unit direction (dx, dy): centre minus mean of both sides, and the
 *  side difference (a step edge such as an arm or torso outline has a large, consistent side difference). */
function ridge(at: (x: number, y: number) => number, x: number, y: number, dx: number, dy: number, off: number): [number, number] | null {
  const nx = -dy * off, ny = dx * off;
  const c = at(x, y), a = at(x + nx, y + ny), b = at(x - nx, y - ny);
  if (!Number.isFinite(c) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return [c - (a + b) / 2, a - b];
}

/** Line response along a segment: |mean signed ridge| - |mean side difference| / 2. Averaging the SIGNED terms along
 *  the ray cancels sensor noise and compression artefacts (an unsigned per-pixel response would accumulate them). */
function segmentScore(at: (x: number, y: number) => number, ox: number, oy: number, dx: number, dy: number,
  from: number, to: number, step: number, off: number): number {
  let r = 0, e = 0, n = 0;
  for (let t = from; t <= to; t += step) {
    const v = ridge(at, ox + dx * t, oy + dy * t, dx, dy, off); if (v) { r += v[0]; e += v[1]; n++; }
  }
  return n >= 8 ? Math.max(0, Math.abs(r / n) - Math.abs(e / n) / 2) : 0;
}

export interface BladeScan {
  /** line response per ray direction (k * 360 / angleSteps degrees, image y down), after the body exclusion */
  scores: Float64Array; shifts: Float64Array;
  ox: number; oy: number; torsoPx: number; width: number; height: number;
}

/** Line response of every ray direction from the hands over [from, to] torso lengths (best sideways shift). */
function scanSegment(at: (x: number, y: number) => number, ox: number, oy: number, torsoPx: number, from: number, to: number,
  opt: BladeOptions, off: number, step: number, scores: Float64Array, shifts: Float64Array) {
  for (let k = 0; k < opt.angleSteps; k++) {
    const th = 2 * Math.PI * k / opt.angleSteps, dx = Math.cos(th), dy = Math.sin(th);
    // the wrists are not on the blade line (the grip is in the fists): also try lines shifted sideways
    let best = 0, bestShift = 0;
    for (let sh = -opt.shift * torsoPx; sh <= opt.shift * torsoPx + 1e-9; sh += opt.shiftStep * torsoPx) {
      const v = segmentScore(at, ox - dy * sh, oy + dx * sh, dx, dy, from * torsoPx, to * torsoPx, step, off);
      if (v > best) { best = v; bestShift = sh; }
    }
    scores[k] = best; shifts[k] = bestShift;
  }
}

/**
 * Scores every ray direction from the hands.
 * @param img grayscale frame
 * @param hands hand centre (mean of the wrists) in normalised image coordinates
 * @param torsoPx shoulder-centre to hip-centre distance in pixels of `img`
 * @param body other body landmarks (elbows, shoulders, head, hips; normalised): a direction whose blade segment would
 *   run through them is the outline of the arms or torso, not the blade (the blade cannot pass through the body)
 * @param shoulders shoulder centre (normalised): with the arms extended (hands >= backExtension torso from it) the blade
 *   points away from the body, so directions within backCone degrees of hands->shoulders are suppressed (the arm line
 *   otherwise beats a faint forward blade, e.g. the horizontal Zwerchhau finish)
 */
export function scanBlade(img: GrayImage, hands: [number, number], torsoPx: number,
  opt: BladeOptions = BLADE_DETECTOR_DEFAULTS, body: [number, number][] = [], shoulders?: [number, number]): BladeScan | null {
  if (!(torsoPx > 4)) return null;
  const at = sampler(img), ox = hands[0] * img.width, oy = hands[1] * img.height;
  const off = Math.max(1.5, opt.offsetPx * img.width / 640);
  const step = Math.max(1, torsoPx / 40);
  const L = opt.angleSteps, scores = new Float64Array(L), shifts = new Float64Array(L);
  scanSegment(at, ox, oy, torsoPx, opt.nearFrom, opt.nearTo, opt, off, step, scores, shifts);
  if (opt.shortWeight > 0) {
    // foreshortened blades (pointing towards / away from the camera) are short in 2D: a shorter segment, down-weighted
    const s2 = new Float64Array(L), sh2 = new Float64Array(L);
    scanSegment(at, ox, oy, torsoPx, opt.nearFrom * .8, opt.shortTo, opt, off, step, s2, sh2);
    for (let k = 0; k < L; k++) if (s2[k] * opt.shortWeight > scores[k]) { scores[k] = s2[k] * opt.shortWeight; shifts[k] = sh2[k]; }
  }
  let back = NaN;
  if (shoulders && opt.backCone > 0) {
    const sx = shoulders[0] * img.width - ox, sy = shoulders[1] * img.height - oy;
    if (Math.hypot(sx, sy) >= opt.backExtension * torsoPx) back = Math.atan2(sy, sx);
  }
  for (let k = 0; k < L; k++) {
    const th = 2 * Math.PI * k / L, dx = Math.cos(th), dy = Math.sin(th);
    if (Number.isFinite(back) && Math.abs(((th - back) * 180 / Math.PI + 540) % 360 - 180) < opt.backCone) scores[k] *= opt.bodyPenalty;
    for (const [bx, by] of body) {
      const px = bx * img.width - ox, py = by * img.height - oy, along = px * dx + py * dy;
      if (along < opt.nearFrom * torsoPx * .5 || along > opt.nearTo * torsoPx) continue;
      // within bodyClearance of the segment, or within bodyAngle degrees of the direction to the body point
      const across = Math.abs(px * dy - py * dx);
      if (across < opt.bodyClearance * torsoPx || across < along * Math.tan(opt.bodyAngle * Math.PI / 180)) { scores[k] *= opt.bodyPenalty; break; }
    }
  }
  return { scores, shifts, ox, oy, torsoPx, width: img.width, height: img.height };
}

/** Confidence of direction k: its response vs the best direction more than 20 degrees away. */
export function confidenceAt(scan: BladeScan, k: number): number {
  const L = scan.scores.length; let rival = 0;
  for (let j = 0; j < L; j++) {
    const d = Math.min(Math.abs(j - k), L - Math.abs(j - k)) * 360 / L;
    if (d > 20 && scan.scores[j] > rival) rival = scan.scores[j];
  }
  return scan.scores[k] / Math.max(.05, rival);
}

/** Detection along direction index k (sub-step refined), guard and tip at the typical offsets. */
export function detectionAt(scan: BladeScan, k: number, opt: BladeOptions = BLADE_DETECTOR_DEFAULTS, contrast = confidenceAt(scan, k)): BladeDetection {
  const { scores, shifts, ox, oy, torsoPx } = scan, L = scores.length;
  const a = scores[(k - 1 + L) % L], b = scores[k], c = scores[(k + 1) % L];
  const den = a - 2 * b + c, frac = den < 0 ? Math.max(-.5, Math.min(.5, (a - c) / (2 * den))) : 0;
  const th = 2 * Math.PI * (k + frac) / L, dx = Math.cos(th), dy = Math.sin(th);
  const lx = ox - dy * shifts[k], ly = oy + dx * shifts[k];
  const g = opt.guardOffset * torsoPx, tipR = opt.bladeLength * torsoPx;
  return { guard: [(lx + dx * g) / scan.width, (ly + dy * g) / scan.height],
    tip: [(lx + dx * tipR) / scan.width, (ly + dy * tipR) / scan.height], contrast };
}

export function bestIndex(scores: Float64Array): number {
  let best = 0;
  for (let k = 1; k < scores.length; k++) if (scores[k] > scores[best]) best = k;
  return best;
}

/** Single-frame detection: the best direction, if its confidence reaches opt.minContrast. */
export function detectBlade(img: GrayImage, hands: [number, number], torsoPx: number,
  opt: BladeOptions = BLADE_DETECTOR_DEFAULTS, body: [number, number][] = [], shoulders?: [number, number]): BladeDetection | null {
  const scan = scanBlade(img, hands, torsoPx, opt, body, shoulders);
  if (!scan) return null;
  const best = bestIndex(scan.scores), contrast = confidenceAt(scan, best);
  if (!(scan.scores[best] > 0) || contrast < opt.minContrast) return null;
  return detectionAt(scan, best, opt, contrast);
}

type Point = { x: number; y: number; visibility?: number };
const BONES: [string, string][] = [
  ["left_elbow", "left_wrist"], ["right_elbow", "right_wrist"], ["left_shoulder", "left_elbow"], ["right_shoulder", "right_elbow"], ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"], ["left_hip", "right_hip"],
  ["left_hip", "left_knee"], ["right_hip", "right_knee"], ["left_knee", "left_ankle"], ["right_knee", "right_ankle"],
  ["nose", "left_shoulder"], ["nose", "right_shoulder"],
];
/** Body points the blade cannot pass through: joints plus samples along the bones (normalised image coordinates). */
export function bodyPoints(landmarks: Record<string, Point | undefined>, minVisibility = .42): [number, number][] {
  const ok = (n: string) => { const l = landmarks[n]; return l && (l.visibility ?? 1) >= minVisibility ? l : null; };
  const out: [number, number][] = [];
  for (const [a, b] of BONES) {
    const p = ok(a), q = ok(b); if (!p || !q) continue;
    for (const f of [0, .25, .5, .75, 1]) out.push([p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f]);
  }
  return out;
}

/** Shoulder centre (normalised) when both shoulders are visible. */
export function shoulderCentre(landmarks: Record<string, Point | undefined>, minVisibility = .42): [number, number] | undefined {
  const l = landmarks.left_shoulder, r = landmarks.right_shoulder;
  if (!l || !r || (l.visibility ?? 1) < minVisibility || (r.visibility ?? 1) < minVisibility) return undefined;
  return [(l.x + r.x) / 2, (l.y + r.y) / 2];
}

export interface TrackOptions {
  /** confidence that starts / refreshes the track on its own (single-frame detection) */
  high: number;
  /** confidence enough for a direction inside the predicted window of a live track */
  low: number;
  /** window half-width in degrees, plus windowPerS degrees per second since the last accepted frame */
  window: number; windowPerS: number;
  /** the track expires after this long without an accepted frame */
  maxGapMs: number;
  /** clamp of the angular-velocity prediction, degrees per second */
  maxRate: number;
}
export const BLADE_TRACK_DEFAULTS: TrackOptions = { high: 3, low: 1.1, window: 12, windowPerS: 120, maxGapMs: 400, maxRate: 1500 };

/** Temporal blade tracking (causal, per video): a confident frame starts or refreshes the track; between confident
 *  frames, the best direction within a window around the predicted angle (last angle + angular velocity of the last
 *  two accepted frames; the origin follows the hands) is accepted at a lower confidence. */
export class BladeTrack {
  private pts: { t: number; deg: number }[] = [];
  constructor(readonly opt: TrackOptions = BLADE_TRACK_DEFAULTS, readonly detector: BladeOptions = BLADE_DETECTOR_DEFAULTS) {}
  reset() { this.pts = []; }
  update(scan: BladeScan | null, timeMs: number): BladeDetection | null {
    if (!scan) return null;
    const L = scan.scores.length, step = 360 / L, o = this.opt;
    const best = bestIndex(scan.scores), cb = confidenceAt(scan, best);
    if (scan.scores[best] > 0 && cb >= o.high) return this.accept(scan, best, cb, timeMs);
    const last = this.pts.at(-1);
    if (!last || timeMs - last.t > o.maxGapMs) return null;
    let pred = last.deg;
    const prev = this.pts.at(-2);
    if (prev && last.t - prev.t <= 200) {
      const rate = Math.max(-o.maxRate, Math.min(o.maxRate, angleDiff(last.deg, prev.deg) / Math.max(1, last.t - prev.t) * 1000));
      pred += rate * (timeMs - last.t) / 1000;
    }
    const win = o.window + o.windowPerS * (timeMs - last.t) / 1000;
    let k = -1;
    for (let j = 0; j < L; j++) if (Math.abs(angleDiff(j * step, pred)) <= win && (k < 0 || scan.scores[j] > scan.scores[k])) k = j;
    if (k < 0 || !(scan.scores[k] > 0)) return null;
    const ck = confidenceAt(scan, k);
    return ck >= o.low ? this.accept(scan, k, ck, timeMs) : null;
  }
  private accept(scan: BladeScan, k: number, c: number, timeMs: number) {
    this.pts.push({ t: timeMs, deg: k * 360 / scan.scores.length });
    if (this.pts.length > 3) this.pts.shift();
    return detectionAt(scan, k, this.detector, c);
  }
}
const angleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;
