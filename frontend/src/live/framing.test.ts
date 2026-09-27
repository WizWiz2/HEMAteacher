import { describe, expect, it } from "vitest";
import { assessFraming } from "./framing";
import type { RawPose, Vec3 } from "./landmarks";

function p(x:number,y:number,visibility=1): Vec3 { return {x,y,z:0,visibility}; }

function pose(includeFeet = true): RawPose {
  const landmarks: Record<string, Vec3> = {
    nose:p(.5,.12),
    left_shoulder:p(.43,.28), right_shoulder:p(.57,.28),
    left_elbow:p(.37,.39), right_elbow:p(.63,.39),
    left_wrist:p(.34,.5), right_wrist:p(.66,.5),
    left_hip:p(.45,.56), right_hip:p(.55,.56),
    left_knee:p(.44,.72), right_knee:p(.56,.72),
  };
  if (includeFeet) {
    landmarks.left_ankle=p(.43,.91);
    landmarks.right_ankle=p(.57,.91);
  }
  return { timestampMs:0,width:1280,height:720,landmarks };
}

describe("camera framing", () => {
  it("allows upper-body drills without feet", () => {
    expect(assessFraming(pose(false), "upper_body").ready).toBe(true);
  });

  it("asks for feet on full-body drills", () => {
    const result = assessFraming(pose(false), "full_body");
    expect(result.ready).toBe(false);
    expect(result.message).toContain("СТОПЫ");
  });
});
