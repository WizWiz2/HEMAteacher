import { describe, expect, it } from "vitest";
import { liveFeatures } from "./features";
import { angleDegrees, type LandmarkMap, type Vec3 } from "./landmarks";
import { normalizePose, type Facing } from "./normalize";
import type { RawPose } from "./landmarks";

function point(x: number, y: number, z = 0): Vec3 {
  return { x, y, z, visibility: 1 };
}

describe("joint angles and distances", () => {
  it("measures a right angle and a straight knee", () => {
    expect(angleDegrees(point(0, 1), point(0, 0), point(1, 0))).toBeCloseTo(90, 4);
    expect(angleDegrees(point(0, 2), point(0, 1), point(0, 0))).toBeCloseTo(180, 4);
  });

  it("reads foot and arm features from a normalized pose", () => {
    const landmarks: LandmarkMap = {
      left_hip: point(0, 0), right_hip: point(0, 0, 0.1),
      left_shoulder: point(0, 1), right_shoulder: point(0, 1, 0.1),
      left_knee: point(0, -1), left_ankle: point(1, -1),
      right_knee: point(0.2, -0.5), right_ankle: point(-0.4, -1),
      left_elbow: point(0.2, 0.8), right_elbow: point(0.2, 0.8, 0.1),
      left_wrist: point(0.45, 0.6), right_wrist: point(0.49, 0.6, 0.1),
    };
    const features = liveFeatures(landmarks);
    expect(features.left_knee_angle).toBeCloseTo(90, 4);
    expect(features.foot_distance).toBeCloseTo(1.4, 4);
    expect(features.pelvis_height).toBeCloseTo(1, 4);
    expect(features.hand_center_x).toBeCloseTo(0.47, 4);
    expect(features.hand_center_y).toBeCloseTo(0.6, 4);
    expect(features.left_elbow_angle).toBeTypeOf("number");
    expect(features.right_elbow_angle).toBeTypeOf("number");
  });
});

describe("normalization", () => {
  it("removes shift and scale and applies the chosen facing", () => {
    const pose = rawPose({ hipX: 0.4, hipY: 0.5, torso: 0.12, face: "left" });
    const other = rawPose({ hipX: 0.62, hipY: 0.46, torso: 0.2, face: "right" });
    const left = normalizePose(pose, "left", torsoOf(pose))!;
    const right = normalizePose(other, "right", torsoOf(other))!;
    expect(left.landmarks.nose.x).toBeGreaterThan(0.05);
    expect(right.landmarks.nose.x).toBeGreaterThan(0.05);
    expect(left.landmarks.left_ankle.x).toBeCloseTo(right.landmarks.left_ankle.x, 4);
    expect(left.landmarks.left_ankle.y).toBeCloseTo(right.landmarks.left_ankle.y, 4);
  });
});

function torsoOf(pose: RawPose): number {
  const shoulderY = pose.landmarks.left_shoulder.y * pose.height;
  const hipY = pose.landmarks.left_hip.y * pose.height;
  return Math.abs(shoulderY - hipY);
}

function rawPose(input: { hipX: number; hipY: number; torso: number; face: Facing }): RawPose {
  const face = input.face === "right" ? 1 : -1;
  const project = (x: number, y: number, z = 0): Vec3 => ({
    x: input.hipX + face * x * input.torso,
    y: input.hipY - y * input.torso,
    z: z * input.torso,
    visibility: 1,
  });
  return {
    timestampMs: 0, width: 1, height: 1,
    landmarks: {
      left_hip: project(0, 0, -0.1), right_hip: project(0, 0, 0.1),
      left_shoulder: project(0, 1, -0.1), right_shoulder: project(0, 1, 0.1),
      nose: project(0.2, 1.25), left_ankle: project(0.3, -1), right_ankle: project(-0.3, -1),
    },
  };
}
