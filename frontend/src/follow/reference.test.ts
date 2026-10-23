import { describe, expect, it } from "vitest";
import data from "./referenceClips.json";
import { CONTINUOUS_DRILLS } from "../drill/motionTraining";
import { clipDurationMs, loopProgress, placePose, poseAt, referenceBounds, referenceKey, withReferenceWeapons, type ReferenceSet } from "./reference";

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

  it("keeps the animated blade attached to the hands and inside the fixed reference bounds", () => {
    const armed = withReferenceWeapons(set);
    for (const [key, clip] of Object.entries(armed.clips)) {
      if (!key.split(":")[1].endsWith("hau")) { expect(clip.weapon).toBeUndefined(); continue; }
      expect(clip.weapon?.length, key).toBe(clip.frames.length);
      const bounds = referenceBounds(armed, clip);
      for (let i = 0; i < clip.frames.length - 1; i++) {
        const pose = poseAt(armed, clip, i * 1000 / clip.fps);
        if (!pose.left_wrist || !pose.right_wrist) continue;
        expect(pose.sword_tip, key).toBeDefined();
        const dx = pose.sword_tip[0] - pose.sword_grip[0], dy = pose.sword_tip[1] - pose.sword_grip[1];
        expect(pose.sword_grip[0] - dx * .1).toBeCloseTo((pose.left_wrist[0] + pose.right_wrist[0]) / 2);
        expect(pose.sword_grip[1] - dy * .1).toBeCloseTo((pose.left_wrist[1] + pose.right_wrist[1]) / 2);
        expect(pose.sword_tip[0]).toBeGreaterThanOrEqual(bounds.x0);
        expect(pose.sword_tip[0]).toBeLessThanOrEqual(bounds.x1);
        expect(pose.sword_tip[1]).toBeGreaterThanOrEqual(bounds.y0);
        expect(pose.sword_tip[1]).toBeLessThanOrEqual(bounds.y1);
        const mirrored = placePose(pose, [100, 80], 10, true);
        expect(mirrored.sword_tip[0]).toBeCloseTo(100 - pose.sword_tip[0] * 10);
      }
    }
  });
});
