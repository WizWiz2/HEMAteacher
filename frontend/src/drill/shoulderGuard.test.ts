import { describe, it, expect } from "vitest";
import { POSE_PRESETS } from "./posePresets";
import { liveFeatures } from "../live/features";
import { matchCheckpoint } from "./checkpointMatcher";
import type { Checkpoint, TargetLandmark } from "./types";
import drills from "../../public/content/drills.json";

describe("right shoulder guard", () => {
  it("has equal arm segments and collinear fists/blade", () => {
    const pose = POSE_PRESETS['vom-tag'], p = pose.landmarks;
    const distance = (a: TargetLandmark, b: TargetLandmark) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
    for (const side of ['left','right']) {
      expect(distance(p[`${side}_shoulder`],p[`${side}_elbow`])).toBeCloseTo(.55, 8);
      expect(distance(p[`${side}_elbow`],p[`${side}_wrist`])).toBeCloseTo(.50, 8);
    }
    expect((p.left_wrist.x+p.right_wrist.x)/2).toBeCloseTo(.66);
    expect((p.left_wrist.y+p.right_wrist.y)/2).toBeCloseTo(1.015);
    const sword=pose.sword!;
    const a=[p.right_wrist.x-p.left_wrist.x,p.right_wrist.y-p.left_wrist.y,p.right_wrist.z-p.left_wrist.z];
    const b=[sword.tip.x-sword.grip.x,sword.tip.y-sword.grip.y,sword.tip.z!-sword.grip.z!];
    expect(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])).toBeLessThan(1e-8);
  });
  it("accepts the supplied report pose and rejects the old face-level pose in all six guards", () => {
    const report = structuredClone(POSE_PRESETS['vom-tag']);
    Object.assign(report.landmarks.left_wrist,{x:.72,y:.87,z:.22});
    Object.assign(report.landmarks.right_wrist,{x:.6,y:1.16,z:.28});
    Object.assign(report.landmarks.left_elbow,{x:.39,y:.78,z:-.01});
    Object.assign(report.landmarks.right_elbow,{x:.39,y:.63,z:.37});
    const old = structuredClone(report);
    Object.assign(old.landmarks.left_wrist,{x:0,y:1.3,z:-.05});
    Object.assign(old.landmarks.right_wrist,{x:.04,y:1.3,z:.05});
    Object.assign(old.landmarks.left_elbow,{x:-.08,y:1.05,z:-.12});
    Object.assign(old.landmarks.right_elbow,{x:.16,y:1.05,z:.12});
    const checkpoints = drills.flatMap<Checkpoint>(d=>d.checkpoints as Checkpoint[]).filter(c=>c.targetPoseId==='vom-tag');
    expect(checkpoints).toHaveLength(6);
    for (const checkpoint of checkpoints) {
      const cp = checkpoint as Checkpoint;
      expect(matchCheckpoint(liveFeatures(report.landmarks,0),cp,{validSince:0},1000,true).match.passed).toBe(true);
      expect(matchCheckpoint(liveFeatures(old.landmarks,0),cp,{validSince:0},1000,true).match.passed).toBe(false);
    }
  });
});
