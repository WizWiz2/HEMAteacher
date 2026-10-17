import { describe, expect, it } from "vitest";
import data from "./referenceClips.json";
import { CONTINUOUS_DRILLS } from "../drill/motionTraining";
import { clipDurationMs, loopProgress, placePose, poseAt, referenceKey, type ReferenceSet } from "./reference";

const set = data as unknown as ReferenceSet;

describe("follow-along reference skeletons", () => {
  it("has a front and a side reference for every drill", () => {
    for (const view of ["front", "side"] as const) for (const drill of CONTINUOUS_DRILLS) {
      const clip = set.clips[referenceKey(view, drill)];
      expect(clip, `${view}:${drill}`).toBeTruthy();
      expect(clipDurationMs(clip)).toBeGreaterThan(1500);
    }
  });

  it("starts at the hip centre and loops at the selected tempo", () => {
    const clip = set.clips["front:zornhau"];
    const first = poseAt(set, clip, 0);
    const hip = [(first.left_hip[0] + first.right_hip[0]) / 2, (first.left_hip[1] + first.right_hip[1]) / 2];
    expect(Math.abs(hip[0])).toBeLessThan(0.01);
    expect(Math.abs(hip[1])).toBeLessThan(0.01);
    const d = clipDurationMs(clip);
    expect(poseAt(set, clip, d * 2 + 100).left_wrist).toEqual(poseAt(set, clip, 100).left_wrist);
    expect(poseAt(set, clip, 200, 0.5).left_wrist).toEqual(poseAt(set, clip, 100, 1).left_wrist);
    expect(loopProgress(clip, d / 2)).toBeCloseTo(0.5, 5);
  });

  it("places and mirrors a pose on screen", () => {
    const pose = { a: [1, 2] as [number, number] };
    expect(placePose(pose, [100, 50], 10)).toEqual({ a: [110, 70] });
    expect(placePose(pose, [100, 50], 10, true)).toEqual({ a: [90, 70] });
  });
});
