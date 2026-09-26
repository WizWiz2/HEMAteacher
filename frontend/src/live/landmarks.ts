export const LANDMARK_NAMES = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type LandmarkMap = Record<string, Vec3>;

export interface RawPose {
  timestampMs: number;
  width: number;
  height: number;
  landmarks: LandmarkMap;
}

export function angleDegrees(a: Vec3, b: Vec3, c: Vec3): number {
  const ba = [a.x - b.x, a.y - b.y, a.z - b.z];
  const bc = [c.x - b.x, c.y - b.y, c.z - b.z];
  const denom = Math.hypot(ba[0], ba[1], ba[2]) * Math.hypot(bc[0], bc[1], bc[2]);
  if (denom < 1e-8) return Number.NaN;
  const cosine = Math.min(1, Math.max(-1, (ba[0] * bc[0] + ba[1] * bc[1] + ba[2] * bc[2]) / denom));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function xyDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
