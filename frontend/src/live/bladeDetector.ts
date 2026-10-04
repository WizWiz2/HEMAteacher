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
  /** typical 2D blade length, torso units (train renders: median 2.0); used unless walkTip finds the tip */
  bladeLength: number; walkTip: boolean;
  /** directions passing within bodyClearance (torso units) of a body landmark are multiplied by bodyPenalty */
  bodyClearance: number; bodyPenalty: number; bodyAngle: number;
  /** sideways line shifts tried around the hand centre: +-shift in steps of shiftStep (torso units) */
  shift: number; shiftStep: number;
  /** guard distance from the hand centre along the blade, torso units (train renders: median 0.31) */
  guardOffset: number;
}
export const BLADE_DETECTOR_DEFAULTS: BladeOptions = {
  angleSteps: 120, nearFrom: .45, nearTo: 1.3, farTo: 2.6, offsetPx: 2.5, minContrast: 1.6, guardOffset: .31,
  bladeLength: 2, walkTip: false, bodyClearance: .2, bodyPenalty: .3, bodyAngle: 15, shift: .15, shiftStep: .03,
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

/**
 * @param img grayscale frame
 * @param hands hand centre (mean of the wrists) in normalised image coordinates
 * @param torsoPx shoulder-centre to hip-centre distance in pixels of `img`
 * @param body other body landmarks (elbows, shoulders, head, hips; normalised): a direction whose blade segment would
 *   run through them is the outline of the arms or torso, not the blade (the blade cannot pass through the body)
 */
export function detectBlade(img: GrayImage, hands: [number, number], torsoPx: number,
  opt: BladeOptions = BLADE_DETECTOR_DEFAULTS, body: [number, number][] = []): BladeDetection | null {
  if (!(torsoPx > 4)) return null;
  const at = sampler(img), ox = hands[0] * img.width, oy = hands[1] * img.height;
  const off = Math.max(1.5, opt.offsetPx * img.width / 640);
  const step = Math.max(1, torsoPx / 40);
  const scores = new Float64Array(opt.angleSteps), shifts = new Float64Array(opt.angleSteps);
  for (let k = 0; k < opt.angleSteps; k++) {
    const th = 2 * Math.PI * k / opt.angleSteps;
    const dx = Math.cos(th), dy = Math.sin(th);
    // the wrists are not on the blade line (the grip is in the fists): also try lines shifted sideways
    let bestShift = 0;
    scores[k] = 0;
    for (let sh = -opt.shift * torsoPx; sh <= opt.shift * torsoPx + 1e-9; sh += opt.shiftStep * torsoPx) {
      const v = segmentScore(at, ox - dy * sh, oy + dx * sh, dx, dy, opt.nearFrom * torsoPx, opt.nearTo * torsoPx, step, off);
      if (v > scores[k]) { scores[k] = v; bestShift = sh; }
    }
    shifts[k] = bestShift;
    for (const [bx, by] of body) {
      const px = bx * img.width - ox, py = by * img.height - oy, along = px * dx + py * dy;
      if (along < opt.nearFrom * torsoPx * .5 || along > opt.nearTo * torsoPx) continue;
      // within bodyClearance of the segment, or within bodyAngle degrees of the direction to the body point
      const across = Math.abs(px * dy - py * dx);
      if (across < opt.bodyClearance * torsoPx || across < along * Math.tan(opt.bodyAngle * Math.PI / 180)) { scores[k] *= opt.bodyPenalty; break; }
    }
  }
  let best = 0;
  for (let k = 1; k < opt.angleSteps; k++) if (scores[k] > scores[best]) best = k;
  // confidence: best direction vs the best competing direction more than 20 degrees away
  let rival = 0;
  for (let k = 0; k < opt.angleSteps; k++) {
    const d = Math.min(Math.abs(k - best), opt.angleSteps - Math.abs(k - best)) * 360 / opt.angleSteps;
    if (d > 20 && scores[k] > rival) rival = scores[k];
  }
  const contrast = scores[best] / Math.max(.05, rival);
  if (!(scores[best] > 0) || contrast < opt.minContrast) return null;
  // sub-step refinement (parabola through the neighbours)
  const L = opt.angleSteps, a = scores[(best - 1 + L) % L], b = scores[best], c = scores[(best + 1) % L];
  const den = a - 2 * b + c, frac = den < 0 ? Math.max(-.5, Math.min(.5, (a - c) / (2 * den))) : 0;
  const th = 2 * Math.PI * (best + frac) / L, dx = Math.cos(th), dy = Math.sin(th);
  const lx = ox - dy * shifts[best], ly = oy + dx * shifts[best];
  // tip: farthest segment along the ray that still carries the line (blade lengths vary with foreshortening);
  // falls back to the typical blade length when the far part is lost (blur, frame edge)
  const seg = .25 * torsoPx;
  let tipR = opt.bladeLength * torsoPx;
  if (opt.walkTip) {
    tipR = opt.nearTo * torsoPx;
    for (let r = opt.nearTo * torsoPx; r + seg <= opt.farTo * torsoPx; r += seg)
      if (segmentScore(at, lx, ly, dx, dy, r, r + seg, Math.max(1, step / 2), off) >= scores[best] * .5) tipR = r + seg; else break;
  }
  const g = opt.guardOffset * torsoPx;
  return { guard: [(lx + dx * g) / img.width, (ly + dy * g) / img.height],
    tip: [(lx + dx * tipR) / img.width, (ly + dy * tipR) / img.height], contrast };
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
