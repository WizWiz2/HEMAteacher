import type { CameraView, Facing } from "./normalize";
import type { RawPose } from "./landmarks";
import type { TargetPose } from "../drill/types";

export type ScreenPoint = [number, number];

export interface TargetGhostProjection {
  points: Record<string, ScreenPoint>;
  sword?: { grip: ScreenPoint; tip: ScreenPoint };
}

export function projectTargetGhost(
  raw: RawPose,
  target: TargetPose,
  facing: Facing,
  torsoScalePx: number,
  box: { x: number; y: number; w: number; h: number },
  cameraView: CameraView = "side",
): TargetGhostProjection | null {
  const leftHip = raw.landmarks.left_hip;
  const rightHip = raw.landmarks.right_hip;
  if (!leftHip || !rightHip || leftHip.visibility < 0.35 || rightHip.visibility < 0.35) return null;
  if (!Number.isFinite(torsoScalePx) || torsoScalePx <= 1) return null;

  const rootX = ((leftHip.x + rightHip.x) / 2) * raw.width;
  const rootY = ((leftHip.y + rightHip.y) / 2) * raw.height;
  const face = facing === "right" ? 1 : -1;

  const project = (x: number, y: number, z = 0): ScreenPoint => {
    const horizontal = cameraView === "front" ? -z : x * face;
    const px = rootX + horizontal * torsoScalePx;
    const py = rootY - y * torsoScalePx;
    return [
      box.x + (px / raw.width) * box.w,
      box.y + (py / raw.height) * box.h,
    ];
  };

  const points: Record<string, ScreenPoint> = {};
  for (const [name, point] of Object.entries(target.landmarks)) {
    points[name] = project(point.x, point.y, point.z);
  }

  return {
    points,
    sword: target.sword && cameraView === "side"
      ? {
          grip: project(target.sword.grip.x, target.sword.grip.y),
          tip: project(target.sword.tip.x, target.sword.tip.y),
        }
      : undefined,
  };
}
