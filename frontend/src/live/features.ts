import { angleDegrees, xyDistance, type LandmarkMap, type Vec3 } from "./landmarks";

/** Тот же смысл, что у backend/app/services/features/footwork.py. Единица — длина корпуса, +X вперёд, +Y вверх. */
export const LIVE_FEATURES = [
  "left_ankle_x",
  "left_ankle_y",
  "right_ankle_x",
  "right_ankle_y",
  "foot_distance",
  "pelvis_height",
  "left_knee_angle",
  "right_knee_angle",
  "torso_angle",
  "knee_over_foot_left",
  "knee_over_foot_right",
] as const;

export type LiveFeatureName = (typeof LIVE_FEATURES)[number];
export type FeatureMap = Partial<Record<LiveFeatureName, number>>;

const MIN_VISIBILITY = 0.5;

export function liveFeatures(landmarks: LandmarkMap, minVisibility = MIN_VISIBILITY): FeatureMap {
  const point = (name: string) => {
    const landmark = landmarks[name];
    if (!landmark || landmark.visibility < minVisibility) return null;
    return landmark;
  };
  const leftAnkle = point("left_ankle");
  const rightAnkle = point("right_ankle");
  const leftHip = point("left_hip");
  const rightHip = point("right_hip");
  const leftKnee = point("left_knee");
  const rightKnee = point("right_knee");
  const leftShoulder = point("left_shoulder");
  const rightShoulder = point("right_shoulder");

  const features: FeatureMap = {};
  if (leftAnkle) {
    features.left_ankle_x = leftAnkle.x;
    features.left_ankle_y = leftAnkle.y;
  }
  if (rightAnkle) {
    features.right_ankle_x = rightAnkle.x;
    features.right_ankle_y = rightAnkle.y;
  }
  if (leftAnkle && rightAnkle) {
    features.foot_distance = xyDistance(leftAnkle, rightAnkle);
    features.pelvis_height = -0.5 * (leftAnkle.y + rightAnkle.y);
  }
  if (leftHip && leftKnee && leftAnkle) features.left_knee_angle = angleDegrees(leftHip, leftKnee, leftAnkle);
  if (rightHip && rightKnee && rightAnkle) features.right_knee_angle = angleDegrees(rightHip, rightKnee, rightAnkle);
  if (leftKnee && leftAnkle) features.knee_over_foot_left = leftKnee.x - leftAnkle.x;
  if (rightKnee && rightAnkle) features.knee_over_foot_right = rightKnee.x - rightAnkle.x;
  if (leftHip && rightHip && leftShoulder && rightShoulder) {
    const hip = mid(leftHip, rightHip);
    const shoulder = mid(leftShoulder, rightShoulder);
    features.torso_angle = (Math.atan2(shoulder.x - hip.x, shoulder.y - hip.y) * 180) / Math.PI;
  }
  return features;
}

export function poseUsable(features: FeatureMap | null): boolean {
  if (!features) return false;
  return ["left_ankle_x", "right_ankle_x", "pelvis_height", "torso_angle"].every((name) =>
    Number.isFinite(features[name as LiveFeatureName]),
  );
}

function mid(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: 1 };
}
