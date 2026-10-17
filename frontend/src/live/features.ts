import { angleDegrees, xyDistance, type LandmarkMap, type Vec3 } from "./landmarks";
import type { TrackingMode } from "../drill/types";

export const LIVE_FEATURES = [
  "root_x", "left_ankle_x", "left_ankle_y", "right_ankle_x", "right_ankle_y",
  "foot_distance", "pelvis_height", "left_knee_angle", "right_knee_angle",
  "torso_angle", "knee_over_foot_left", "knee_over_foot_right",
  "left_wrist_x", "left_wrist_y", "right_wrist_x", "right_wrist_y",
  "hand_center_x", "hand_center_y", "hand_distance", "action_hand_x", "action_hand_y",
  "left_elbow_angle", "right_elbow_angle",
  // Screen-plane coordinates for motion recognition (torso-normalised, never MediaPipe depth).
  "nose_x", "nose_y", "left_shoulder_x", "left_shoulder_y", "right_shoulder_x", "right_shoulder_y",
  "left_elbow_x", "left_elbow_y", "right_elbow_x", "right_elbow_y",
  // Blade points (experimental blade tracking, off by default): crossguard and tip, same normalisation as the joints.
  "blade_guard_x", "blade_guard_y", "blade_tip_x", "blade_tip_y",
] as const;

export type LiveFeatureName = (typeof LIVE_FEATURES)[number];
export type FeatureMap = Partial<Record<LiveFeatureName, number>>;

const MIN_VISIBILITY = 0.42;

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

  const nose = point("nose");
  const features: FeatureMap = {};
  if (nose) { features.nose_x = nose.x; features.nose_y = nose.y; }
  if (leftShoulder) { features.left_shoulder_x = leftShoulder.x; features.left_shoulder_y = leftShoulder.y; }
  if (rightShoulder) { features.right_shoulder_x = rightShoulder.x; features.right_shoulder_y = rightShoulder.y; }
  if (leftElbow) { features.left_elbow_x = leftElbow.x; features.left_elbow_y = leftElbow.y; }
  if (rightElbow) { features.right_elbow_x = rightElbow.x; features.right_elbow_y = rightElbow.y; }
  // The near wrist remains observable when the far hand overlaps it in profile.
  // This proxy is used for movement recognition, never two-hand technique checks.
  const actionHand = rightWrist ?? leftWrist;
  if (actionHand) { features.action_hand_x = actionHand.x; features.action_hand_y = actionHand.y; }
  if (leftAnkle) { features.left_ankle_x = leftAnkle.x; features.left_ankle_y = leftAnkle.y; }
  if (rightAnkle) { features.right_ankle_x = rightAnkle.x; features.right_ankle_y = rightAnkle.y; }
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
  if (leftWrist) { features.left_wrist_x = leftWrist.x; features.left_wrist_y = leftWrist.y; }
  if (rightWrist) { features.right_wrist_x = rightWrist.x; features.right_wrist_y = rightWrist.y; }
  if (leftWrist && rightWrist) {
    features.hand_center_x = (leftWrist.x + rightWrist.x) / 2;
    features.hand_center_y = (leftWrist.y + rightWrist.y) / 2;
    features.hand_distance = Math.hypot(leftWrist.x - rightWrist.x, leftWrist.y - rightWrist.y, leftWrist.z - rightWrist.z);
  }
  const guard = point("blade_guard"), tip = point("blade_tip");
  if (guard && tip) { features.blade_guard_x = guard.x; features.blade_guard_y = guard.y; features.blade_tip_x = tip.x; features.blade_tip_y = tip.y; }
  if (leftShoulder && leftElbow && leftWrist) features.left_elbow_angle = angleDegrees(leftShoulder, leftElbow, leftWrist);
  if (rightShoulder && rightElbow && rightWrist) features.right_elbow_angle = angleDegrees(rightShoulder, rightElbow, rightWrist);
  return features;
}

export function poseUsable(features: FeatureMap | null, mode: TrackingMode = "full_body"): boolean {
  if (!features) return false;
  const required: LiveFeatureName[] = mode === "upper_body"
    ? ["torso_angle", "hand_center_x", "hand_center_y", "left_elbow_angle", "right_elbow_angle"]
    : ["left_ankle_x", "right_ankle_x", "pelvis_height", "torso_angle"];
  return required.every((name) => Number.isFinite(features[name]));
}

function mid(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: 1 };
}
