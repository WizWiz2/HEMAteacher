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

describe("temporal median", () => {
  it("ignores a single noisy frame", () => {
    const history: TimedSample[] = [0, 40, 80, 120, 160].map((timeMs, index) => ({
      timeMs,
      features: index === 3 ? { ...stable, foot_distance: 9 } : { ...stable },
    }));
    const smoothed = smoothFeatures(history, 160, 300, 4);
    expect(smoothed.enough).toBe(true);
    expect(smoothed.features?.foot_distance).toBeCloseTo(0.8, 5);
  });

  it("does not treat one good frame as a stable pose", () => {
    const history: TimedSample[] = [
      { timeMs: 0, features: null },
      { timeMs: 30, features: { ...stable } },
      { timeMs: 60, features: null },
    ];
    expect(smoothFeatures(history, 60, 300, 4).enough).toBe(false);
  });
});
