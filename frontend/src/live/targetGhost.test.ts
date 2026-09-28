import { describe, expect, it } from "vitest";
import { projectTargetGhost } from "./targetGhost";
import type { RawPose } from "./landmarks";
import type { TargetPose } from "../drill/types";

const raw:RawPose={
  timestampMs:0,width:1000,height:500,
  landmarks:{
    left_hip:{x:.48,y:.6,z:0,visibility:1},
    right_hip:{x:.52,y:.6,z:0,visibility:1},
  },
};
const target:TargetPose={
  landmarks:{
    left_hip:{x:0,y:0,z:0,visibility:1},
    right_shoulder:{x:.5,y:1,z:0,visibility:1},
  },
};

describe("target ghost projection",()=>{
  it("anchors target hips to the live pelvis",()=>{
    const result=projectTargetGhost(raw,target,"right",100,{x:0,y:0,w:1000,h:500});
    expect(result?.points.left_hip[0]).toBeCloseTo(500,5);
    expect(result?.points.left_hip[1]).toBeCloseTo(300,5);
  });

  it("mirrors target x when facing left",()=>{
    const right=projectTargetGhost(raw,target,"right",100,{x:0,y:0,w:1000,h:500});
    const left=projectTargetGhost(raw,target,"left",100,{x:0,y:0,w:1000,h:500});
    expect(right?.points.right_shoulder[0]).toBeGreaterThan(500);
    expect(left?.points.right_shoulder[0]).toBeLessThan(500);
  });

  it("uses target z as horizontal screen axis in front view",()=>{
    const frontTarget:TargetPose={
      landmarks:{
        left_hip:{x:0,y:0,z:0,visibility:1},
        left_shoulder:{x:.7,y:1,z:-.35,visibility:1},
        right_shoulder:{x:.7,y:1,z:.35,visibility:1},
      },
    };
    const result=projectTargetGhost(raw,frontTarget,"right",100,{x:0,y:0,w:1000,h:500},"front");
    expect(result?.points.left_shoulder[0]).toBeGreaterThan(500);
    expect(result?.points.right_shoulder[0]).toBeLessThan(500);
    expect(result?.sword).toBeUndefined();
  });
});
