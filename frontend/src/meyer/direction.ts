import type { RawPose } from "../live/landmarks";
import { SECTORS, type Sector } from "./exercise";

export interface MotionVector {dx: number; dy: number; onsetAt: number; endAt: number}
export type DirectionCalibration = Partial<Record<Sector, MotionVector>>;
type Point = {x: number; y: number; t: number};
const cosine = (a: MotionVector, b: MotionVector) =>
  (a.dx * b.dx + a.dy * b.dy) / (Math.hypot(a.dx, a.dy) * Math.hypot(b.dx, b.dy));

export function distinctDirection(calibration: DirectionCalibration, vector: MotionVector): boolean {
  return Object.values(calibration).every(other => cosine(other, vector) < .8);
}
export function classifyDirection(calibration: DirectionCalibration, vector: MotionVector): Sector | null {
  if (!SECTORS.every(s => calibration[s])) return null;
  const scores = SECTORS.map(sector => ({sector, score: cosine(calibration[sector]!, vector)})).sort((a, b) => b.score - a.score);
  return scores[0].score >= .82 && scores[0].score - scores[1].score >= .18 ? scores[0].sector : null;
}

// Experimental wrist-path segmentation, NOT a blade/target-hit detector.
// Coordinates use shoulder-width units and a fixed origin/scale per attempt.
// Reversals finish the preceding swing, allowing continuous opposite cuts.
export class HandDirectionDetector {
  private last: Point | null = null;
  private start: Point | null = null;
  private origin: {x: number; y: number; scale: number} | null = null;
  private path = 0;
  private quietAt: number | null = null;
  reset() {this.last = null; this.start = null; this.origin = null; this.path = 0; this.quietAt = null;}

  push(raw: RawPose): MotionVector | null {
    const p = raw.landmarks;
    const names = ["left_wrist", "right_wrist", "left_shoulder", "right_shoulder"];
    if (names.some(n => !p[n] || p[n].visibility < .65 || !Number.isFinite(p[n].x + p[n].y))) {this.reset(); return null;}
    const aspect = raw.width / raw.height;
    const scale = Math.hypot((p.left_shoulder.x - p.right_shoulder.x) * aspect, p.left_shoulder.y - p.right_shoulder.y);
    if (!(scale > .09) || !Number.isFinite(aspect)) {this.reset(); return null;}
    const shoulder = {x: (p.left_shoulder.x + p.right_shoulder.x) / 2 * aspect, y: (p.left_shoulder.y + p.right_shoulder.y) / 2};
    const origin = this.origin ?? {...shoulder, scale};
    if (Math.abs(scale - origin.scale) > origin.scale * .25) {this.reset(); return null;}
    const point = {x: ((p.left_wrist.x + p.right_wrist.x) / 2 * aspect - shoulder.x) / origin.scale,
      y: ((p.left_wrist.y + p.right_wrist.y) / 2 - shoulder.y) / origin.scale, t: raw.timestampMs};
    const last = this.last;
    if (!last) {this.origin = origin; this.last = point; return null;}
    const dt = point.t - last.t;
    if (dt <= 0 || dt > 180) {this.reset(); return null;}
    const vx = point.x - last.x, vy = point.y - last.y;
    const distance = Math.hypot(vx, vy), speed = distance * 1000 / dt;
    // Reject tracking jumps, rather than interpreting them as very fast strikes.
    if (distance > .8 || speed > 15) {this.reset(); return null;}
    if (!this.start && speed > .8) {this.start = last; this.path = 0;}
    let event: MotionVector | null = null;
    if (this.start) {
      const dx = last.x - this.start.x, dy = last.y - this.start.y;
      const reversed = Math.hypot(dx, dy) > .4 && speed > .8 && dx * vx + dy * vy < -.003;
      if (reversed) {
        event = this.finish(last);
        this.start = last; this.path = distance; this.quietAt = null;
      } else {
        this.path += distance;
        if (speed < .4) this.quietAt ??= point.t;
        else this.quietAt = null;
        if (this.quietAt !== null && point.t - this.quietAt >= 120) {
          event = this.finish(point);
          this.start = null; this.path = 0; this.quietAt = null;
        } else if (point.t - this.start.t > 2000) {this.reset(); return null;}
      }
    }
    this.last = point;
    return event;
  }
  private finish(end: Point): MotionVector | null {
    const start = this.start!;
    const dx = end.x - start.x, dy = end.y - start.y, distance = Math.hypot(dx, dy);
    const duration = end.t - start.t;
    return duration >= 100 && duration <= 2000 && distance >= .45 && distance / Math.max(this.path, .001) >= .65
      ? {dx, dy, onsetAt: start.t, endAt: end.t} : null;
  }
}
