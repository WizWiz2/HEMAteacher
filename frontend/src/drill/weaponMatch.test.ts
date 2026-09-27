import { describe, expect, it } from "vitest";
import { matchWeaponAngle } from "./weaponMatch";
import type { TargetPose, WeaponMarkers } from "./types";

const pose: TargetPose = {
  landmarks: {},
  sword: {
    grip: { x: 0, y: 0 },
    tip: { x: 1, y: 0 },
  },
};

describe("weapon angle matcher", () => {
  it("matches a horizontal marked weapon", () => {
    const markers: WeaponMarkers = {
      detected: true,
      grip: { x: 0.2, y: 0.5, confidence: 1 },
      tip: { x: 0.8, y: 0.5, confidence: 1 },
    };
    const result = matchWeaponAngle(markers, pose, "right", 20);
    expect(result.available).toBe(true);
    expect(result.passed).toBe(true);
    expect(Math.abs(result.deltaDeg ?? 999)).toBeLessThan(1);
  });

  it("refuses to invent a weapon result without both markers", () => {
    const result = matchWeaponAngle({ detected: false }, pose, "right");
    expect(result.available).toBe(false);
    expect(result.passed).toBe(false);
  });
});
