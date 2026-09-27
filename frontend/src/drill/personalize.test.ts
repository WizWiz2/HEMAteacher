import { describe, expect, it } from "vitest";
import { personalizeDrill } from "./personalize";
import type { Drill } from "./types";
import type { BodyProfile } from "../live/anatomy";

const drill:Drill={
  id:"x",name:"x",description:"x",cameraView:"side",trackingMode:"upper_body",
  checkpoints:[{
    id:"vom",title:"Vom Tag",targetPoseId:"vom-tag",holdMs:100,
    featureTolerances:{hand_center_y:.2},
  }],
};

describe("personalized drill target",()=>{
  it("materializes targetPose and removes preset id",()=>{
    const profile:BodyProfile={
      version:1,updatedAt:"now",samples:20,
      leftUpperArm:.7,rightUpperArm:.7,leftForearm:.6,rightForearm:.6,
    };
    const personalized=personalizeDrill(drill,profile);
    expect(personalized?.checkpoints[0].targetPose).toBeTruthy();
    expect(personalized?.checkpoints[0].targetPoseId).toBeUndefined();
  });
});
