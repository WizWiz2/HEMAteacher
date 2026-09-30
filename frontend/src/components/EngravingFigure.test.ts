import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { engravingJoints } from "./EngravingFigure";
import { TargetPose } from "./TargetPose";
import { POSE_PRESETS } from "../drill/posePresets";
import { retargetPose, type BodyProfile } from "../live/anatomy";

const profile: BodyProfile = { version: 1, updatedAt: "2026-09-28", samples: 90,
  shoulderWidth: .85, hipWidth: .6, leftUpperArm: .55, rightUpperArm: .55,
  leftForearm: .5, rightForearm: .5, leftThigh: .9, rightThigh: .9, leftShin: .9, rightShin: .9 };

describe("personalized frontal engraving", () => {
  it("aligns the rendered shoulder-guard hilt with both wrists in each view", () => {
    const pose = POSE_PRESETS["vom-tag"];
    for (const cameraView of ["front", "side"] as const) for (const facing of ["left", "right"] as const) {
      const joints = engravingJoints(pose, cameraView, facing);
      const html = renderToStaticMarkup(createElement(TargetPose, {
        checkpoint: { id: "guard", title: "Vom Tag", targetPose: pose, holdMs: 350 }, cameraView, facing,
      }));
      const angle = Number(html.match(/class="target-sword"[^>]*rotate\(([-\d.e]+)\)/)![1]) * Math.PI / 180;
      const dx = joints.right_wrist[0] - joints.left_wrist[0];
      const dy = joints.right_wrist[1] - joints.left_wrist[1];
      // The local vertical hilt axis must pass through both hand centres.
      expect(Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle))).toBeLessThan(1e-8);
    }
  });
  it("keeps anatomical arm lengths and a shared grip across calibration and facing", () => {
    for (const preset of Object.values(POSE_PRESETS))
      for (const pose of [preset, retargetPose(preset, profile)])
        for (const view of ["front", "side"] as const)
          for (const facing of ["left", "right"] as const) {
            const p = engravingJoints(pose, view, facing);
            const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
            if (pose.illustration === "right-shoulder-guard") {
              // Equal spatial bones foreshorten in each projection.
              for (const side of ["left", "right"]) {
                expect(distance(p[`${side}_shoulder`], p[`${side}_elbow`])).toBeLessThanOrEqual(49.501);
                expect(distance(p[`${side}_elbow`], p[`${side}_wrist`])).toBeLessThanOrEqual(45.001);
              }
              expect(distance(p.left_elbow, p.right_elbow)).toBeGreaterThan(20);
              expect(distance(p.left_wrist, p.right_wrist)).toBeLessThan(25);
              continue;
            }
            for (const side of ["left", "right"]) {
              expect(distance(p[`${side}_shoulder`], p[`${side}_elbow`])).toBeCloseTo(42, 4);
              expect(distance(p[`${side}_elbow`], p[`${side}_wrist`])).toBeCloseTo(37, 4);
            }
            if (pose.sword) expect(distance(p.left_wrist, p.right_wrist)).toBeLessThanOrEqual(10.0001);
          }
  });
  it("attaches calibrated limbs to the doublet without changing the analysis pose", () => {
    for (const preset of Object.values(POSE_PRESETS)) {
      const pose = retargetPose(preset, profile), original = JSON.stringify(pose);
      const p = engravingJoints(pose, "front", "right");
      expect(p.left_shoulder[0]).toBeCloseTo(207);
      expect(p.right_shoulder[0]).toBeCloseTo(153);
      expect(p.left_hip[0]).toBeCloseTo(198);
      expect(p.right_hip[0]).toBeCloseTo(162);
      expect(JSON.stringify(pose)).toBe(original);
    }
  });
  it("keeps feet above captions and renders each optional sword in both views", () => {
    for (const preset of Object.values(POSE_PRESETS)) for (const view of ["front", "side"] as const) {
      const pose = retargetPose(preset, profile);
      const p = engravingJoints(pose, view, "right");
      const html = renderToStaticMarkup(createElement(TargetPose, {
        checkpoint: { id: "test", title: "Старт", targetPose: pose, holdMs: 500 },
        facing: "right", cameraView: view, calibrating: true,
      }));
      const match = html.match(/class="fitted-engraving" transform="translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)"/)!;
      expect(match).not.toBeNull();
      expect(Math.max(p.left_ankle[1], p.right_ankle[1]) * Number(match[3]) + Number(match[2]) + 12 * Number(match[3])).toBeLessThan(373);
      expect(html).not.toContain("NaN");
      expect(html.includes('class="target-sword"')).toBe(Boolean(preset.sword));
    }
  });
});
