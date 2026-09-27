import { describe, expect, it } from "vitest";
import { checkpointConstraints, matchCheckpoint } from "./checkpointMatcher";
import type { Checkpoint } from "./types";

const checkpoint: Checkpoint = {
  id: "stance",
  title: "Стойка",
  holdMs: 300,
  constraints: {
    foot_distance: { target: 0.8, tolerance: 0.1 },
    pelvis_height: { min: 0.9, max: 1.1 },
  },
};

describe("checkpoint constraints", () => {
  it("passes inside a target tolerance and a min/max range", () => {
    const result = matchCheckpoint({ foot_distance: 0.84, pelvis_height: 1 }, checkpoint, { validSince: 0 }, 300, true);
    expect(result.match.features.foot_distance.passed).toBe(true);
    expect(result.match.features.pelvis_height.passed).toBe(true);
    expect(result.match.passScore).toBe(1);
    expect(result.match.passed).toBe(true);
  });

  it("fails outside the target tolerance when too few conditions pass", () => {
    const result = matchCheckpoint({ foot_distance: 1.2, pelvis_height: 1 }, checkpoint, { validSince: null }, 0, true);
    expect(result.match.features.foot_distance.passed).toBe(false);
    expect(result.match.passScore).toBe(0.5);
    expect(result.match.passed).toBe(false);
  });

  it("does not pass before holdMs", () => {
    const started = matchCheckpoint({ foot_distance: 0.8, pelvis_height: 1 }, checkpoint, { validSince: null }, 1000, true);
    expect(started.match.passed).toBe(false);
    expect(started.state.validSince).toBe(1000);
    const early = matchCheckpoint({ foot_distance: 0.8, pelvis_height: 1 }, checkpoint, started.state, 1299, true);
    expect(early.match.passed).toBe(false);
    const ready = matchCheckpoint({ foot_distance: 0.8, pelvis_height: 1 }, checkpoint, started.state, 1300, true);
    expect(ready.match.passed).toBe(true);
  });

  it("derives machine constraints from the same pose preset used by the target image", () => {
    const target: Checkpoint = {
      id: "guard",
      title: "Vom Tag",
      holdMs: 100,
      targetPoseId: "vom-tag",
      featureTolerances: {
        hand_center_y: 0.2,
        foot_distance: 0.25,
      },
    };
    const constraints = checkpointConstraints(target);
    expect("target" in constraints.hand_center_y).toBe(true);
    expect("target" in constraints.foot_distance).toBe(true);
  });

  it("keeps confidence non-zero at a valid tolerance boundary", () => {
    const result = matchCheckpoint({ foot_distance: 0.9, pelvis_height: 1 }, checkpoint, { validSince: 0 }, 300, true);
    expect(result.match.features.foot_distance.passed).toBe(true);
    expect(result.match.confidence).toBeGreaterThan(0);
  });

  it("allows a forgiving beginner checkpoint when enough weighted conditions pass", () => {
    const forgiving: Checkpoint = {
      id: "guard",
      title: "guard",
      holdMs: 0,
      passThreshold: 0.6,
      constraints: {
        hand_center_y: { target: 1, tolerance: 0.2 },
        torso_angle: { target: 0, tolerance: 10 },
        left_elbow_angle: { target: 120, tolerance: 20 },
      },
    };
    const result = matchCheckpoint(
      { hand_center_y: 1.05, torso_angle: 2, left_elbow_angle: 170 },
      forgiving,
      { validSince: 0 },
      1,
      true,
    );
    expect(result.match.passScore).toBeCloseTo(2 / 3, 5);
    expect(result.match.passed).toBe(true);
  });

  it("never ignores a required feature even when overall pass score is high", () => {
    const required: Checkpoint = {
      id: "guard",
      title: "guard",
      holdMs: 0,
      passThreshold: 0.5,
      requiredFeatures: ["hand_center_y"],
      constraints: {
        hand_center_y: { target: 1, tolerance: 0.1 },
        torso_angle: { target: 0, tolerance: 10 },
        left_elbow_angle: { target: 120, tolerance: 20 },
      },
    };
    const result = matchCheckpoint(
      { hand_center_y: 1.5, torso_angle: 2, left_elbow_angle: 118 },
      required,
      { validSince: 0 },
      1,
      true,
    );
    expect(result.match.passScore).toBeGreaterThan(0.5);
    expect(result.match.passed).toBe(false);
  });
});
