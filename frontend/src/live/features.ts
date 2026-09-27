import { angleDegrees, xyDistance, type LandmarkMap, type Vec3 } from "./landmarks";
import type { TrackingMode } from "../drill/types";

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
  "left_wrist_x",
  "left_wrist_y",
  "right_wrist_x",
  "right_wrist_y",
  "hand_center_x",
  "hand_center_y",
  "hand_distance",
  "left_elbow_angle",
  "right_elbow_angle",
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
  const leftElbow = point("left_elbow");
  const rightElbow = point("right_elbow");
  const leftWrist = point("left_wrist");
  const rightWrist = point("right_wrist");

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
  if (leftWrist) {
    features.left_wrist_x = leftWrist.x;
    features.left_wrist_y = leftWrist.y;
  }
  if (rightWrist) {
    features.right_wrist_x = rightWrist.x;
    features.right_wrist_y = rightWrist.y;
  }
  if (leftWrist && rightWrist) {
    features.hand_center_x = (leftWrist.x + rightWrist.x) / 2;
    features.hand_center_y = (leftWrist.y + rightWrist.y) / 2;
    features.hand_distance = Math.hypot(
      leftWrist.x - rightWrist.x,
      leftWrist.y - rightWrist.y,
      leftWrist.z - rightWrist.z,
    );
  }
  if (leftShoulder && leftElbow && leftWrist) {
    features.left_elbow_angle = angleDegrees(leftShoulder, leftElbow, leftWrist);
  }
  if (rightShoulder && rightElbow && rightWrist) {
    features.right_elbow_angle = angleDegrees(rightShoulder, rightElbow, rightWrist);
  }
  return features;
}

export function poseUsable(features: FeatureMap | null, mode: TrackingMode = "full_body"): boolean {
  if (!features) return false;
  const required: LiveFeatureName[] = mode === "upper_body"
    ? ["torso_angle", "hand_center_x", "hand_center_y", "hand_distance", "left_elbow_angle", "right_elbow_angle"]
    : ["left_ankle_x", "right_ankle_x", "pelvis_height", "torso_angle"];
  return required.every((name) => Number.isFinite(features[name]));
}

function mid(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: 1 };
}
