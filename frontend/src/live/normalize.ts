import type { LandmarkMap, RawPose, Vec3 } from "./landmarks";

export type Facing = "right" | "left";
export type CameraView = "side" | "front";

const MIN_VISIBILITY = 0.5;

/** Медиана длины корпуса за последние кадры, чтобы масштаб не прыгал каждый кадр. */
export class TorsoScale {
  private samples: number[] = [];

  push(pixels: number | null): number | null {
    if (pixels == null || !Number.isFinite(pixels) || pixels < 1e-3) {
      return this.current();
    }
    this.samples.push(pixels);
    if (this.samples.length > 30) this.samples.shift();
    return this.current();
  }

  current(): number | null {
    if (this.samples.length === 0) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) / 2)];
  }
}

export function torsoPixels(pose: RawPose, minVisibility = MIN_VISIBILITY): number | null {
  const leftHip = visible(pose.landmarks.left_hip, minVisibility);
  const rightHip = visible(pose.landmarks.right_hip, minVisibility);
  const leftShoulder = visible(pose.landmarks.left_shoulder, minVisibility);
  const rightShoulder = visible(pose.landmarks.right_shoulder, minVisibility);
  if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return null;
  const hip = midpoint(toPixels(leftHip, pose), toPixels(rightHip, pose));
  const shoulder = midpoint(toPixels(leftShoulder, pose), toPixels(rightShoulder, pose));
  const length = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y);
  return length > 1e-3 ? length : null;
}

export function normalizePose(pose: RawPose, facing: Facing, scale: number, minVisibility = MIN_VISIBILITY, cameraView: CameraView = "side"): RawPose | null {
  const leftHip = visible(pose.landmarks.left_hip, minVisibility);
  const rightHip = visible(pose.landmarks.right_hip, minVisibility);
  if (!leftHip || !rightHip || !Number.isFinite(scale) || scale <= 1e-3) return null;
  const root = midpoint(toPixels(leftHip, pose), toPixels(rightHip, pose));
  const face = facing === "right" ? 1 : -1;
  const landmarks: LandmarkMap = {};
  for (const [name, landmark] of Object.entries(pose.landmarks)) {
    if (!visible(landmark, minVisibility)) continue;
    const point = toPixels(landmark, pose);
    const screenX = (point.x - root.x) / scale;
    const depth = (point.z - root.z) / scale;
    landmarks[name] = cameraView === "front"
      ? {
          // Front camera: MediaPipe depth becomes the canonical fore/aft axis.
          // Screen horizontal becomes the body's lateral axis.
          x: -depth,
          y: -((point.y - root.y) / scale),
          z: -screenX,
          visibility: landmark.visibility,
        }
      : {
          x: screenX * face,
          y: -((point.y - root.y) / scale),
          z: depth,
          visibility: landmark.visibility,
        };
  }
  return { ...pose, landmarks };
}

function visible(landmark: Vec3 | undefined, minVisibility: number): Vec3 | null {
  if (!landmark || landmark.visibility < minVisibility) return null;
  return landmark;
}

function toPixels(landmark: Vec3, pose: RawPose): Vec3 {
  return {
    x: landmark.x * pose.width,
    y: landmark.y * pose.height,
    z: landmark.z * pose.width,
    visibility: landmark.visibility,
  };
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}
