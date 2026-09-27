import { describe, expect, it } from "vitest";
import type { FeatureMap } from "./features";
import { smoothFeatures, type TimedSample } from "./smoothing";

const stable: FeatureMap = {
  left_ankle_x: 0.2,
  right_ankle_x: -0.3,
  pelvis_height: 1,
  torso_angle: 4,
  foot_distance: 0.8,
};

const upper: FeatureMap = {
  torso_angle: 2,
  hand_center_x: 0.2,
  hand_center_y: 1.1,
  left_elbow_angle: 110,
  right_elbow_angle: 118,
};

describe("temporal median", () => {
  it("ignores a single noisy frame", () => {
    const history: TimedSample[] = [0, 25, 50, 75, 100].map((timeMs, index) => ({
      timeMs,
      features: index === 3 ? { ...stable, foot_distance: 9 } : { ...stable },
    }));
    const smoothed = smoothFeatures(history, 100, 100, 3);
    expect(smoothed.enough).toBe(true);
    expect(smoothed.features?.foot_distance).toBeCloseTo(0.8, 5);
  });

  it("does not treat one good frame as a stable pose", () => {
    const history: TimedSample[] = [
      { timeMs: 0, features: null },
      { timeMs: 30, features: { ...stable } },
      { timeMs: 60, features: null },
    ];
    expect(smoothFeatures(history, 60, 100, 3).enough).toBe(false);
  });

  it("keeps a brief dynamic checkpoint visible instead of averaging it away", () => {
    const phaseA = { ...stable, foot_distance: 0.9 };
    const phaseB = { ...stable, foot_distance: 0.2 };
    const history: TimedSample[] = [
      { timeMs: 0, features: phaseA },
      { timeMs: 30, features: phaseA },
      { timeMs: 60, features: phaseB },
      { timeMs: 90, features: phaseB },
      { timeMs: 120, features: phaseB },
    ];
    const smoothed = smoothFeatures(history, 120, 80, 3);
    expect(smoothed.enough).toBe(true);
    expect(smoothed.features?.foot_distance).toBeCloseTo(0.2, 5);
  });

  it("supports an upper-body drill when feet are not visible", () => {
    const history: TimedSample[] = [0, 30, 60].map((timeMs) => ({ timeMs, features: { ...upper } }));
    expect(smoothFeatures(history, 60, 100, 3, "upper_body").enough).toBe(true);
    expect(smoothFeatures(history, 60, 100, 3, "full_body").enough).toBe(false);
  });
});
