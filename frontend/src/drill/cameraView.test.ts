import { describe, expect, it } from "vitest";
import { adaptDrillForCameraView } from "./cameraView";
import type { Drill } from "./types";

const drill:Drill={
  id:"test",name:"test",description:"test",cameraView:"side",trackingMode:"full_body",
  checkpoints:[{
    id:"p",title:"p",holdMs:100,
    constraints:{hand_center_x:{target:.5,tolerance:.1},hand_center_y:{target:1,tolerance:.1}},
    featureTolerances:{foot_distance:.2,torso_angle:8},
    weights:{hand_center_x:1,hand_center_y:1},
    requiredFeatures:["hand_center_x","hand_center_y"],
  }],
};

describe("front camera adaptation",()=>{
  it("loosens depth-sensitive features without weakening vertical features",()=>{
    const front=adaptDrillForCameraView(drill,"front")!;
    const cp=front.checkpoints[0];
    const x=cp.constraints?.hand_center_x;
    const y=cp.constraints?.hand_center_y;
    expect(x && "target" in x ? x.tolerance : 0).toBeCloseTo(.18,5);
    expect(y && "target" in y ? y.tolerance : 0).toBeCloseTo(.1,5);
    expect(cp.featureTolerances?.foot_distance).toBeCloseTo(.36,5);
    expect(cp.featureTolerances?.torso_angle).toBe(8);
    expect(cp.requiredFeatures).toEqual(["hand_center_y"]);
    expect(cp.weights?.hand_center_x).toBeCloseTo(.55,5);
  });

  it("leaves side-view drill unchanged",()=>{
    expect(adaptDrillForCameraView(drill,"side")).toBe(drill);
  });
});
