import type { TargetLandmark } from "./types";

// Intersect two bone-length spheres, selecting the elbow toward a pole point.
export function solveElbow(shoulder: TargetLandmark, wrist: TargetLandmark, pole: TargetLandmark,
  upper = .55, lower = .5): TargetLandmark {
  const d = [wrist.x - shoulder.x, wrist.y - shoulder.y, wrist.z - shoulder.z];
  const distance = Math.hypot(...d);
  if (distance < Math.abs(upper - lower) || distance > upper + lower) throw new Error("Unreachable arm grip");
  const axis = d.map(v => v / distance);
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const radius = Math.sqrt(Math.max(0, upper * upper - along * along));
  const offset = [pole.x - shoulder.x, pole.y - shoulder.y, pole.z - shoulder.z];
  const dot = offset.reduce((s, v, i) => s + v * axis[i], 0);
  let bend = offset.map((v, i) => v - dot * axis[i]);
  if (Math.hypot(...bend) < 1e-8) {
    const fallback = Math.abs(axis[1]) < .9 ? [0, -1, 0] : [1, 0, 0];
    const projection = fallback.reduce((s, v, i) => s + v * axis[i], 0);
    bend = fallback.map((v, i) => v - projection * axis[i]);
  }
  const length = Math.hypot(...bend);
  const p = [shoulder.x, shoulder.y, shoulder.z].map((v, i) => v + axis[i] * along + bend[i] / length * radius);
  return { x: p[0], y: p[1], z: p[2], visibility: 1 };
}
