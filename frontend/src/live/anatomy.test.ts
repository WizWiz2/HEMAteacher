import { describe, expect, it } from "vitest";
import { BodyProfileCalibrator, measureBodyRatios, profileCoverage, retargetPose, type BodyProfile } from "./anatomy";
import type { RawPose } from "./landmarks";
import type { TargetPose } from "../drill/types";

function point(x:number,y:number,z=0,visibility=1){return{x,y,z,visibility};}

function bodyPose(hideRight=false):RawPose{
  return {
    timestampMs:0,width:1,height:1,
    landmarks:{
      left_shoulder:point(-.12,1,-.08),
      right_shoulder:point(.12,1,.08,hideRight?.2:1),
      left_elbow:point(-.42,.8,-.08),
      right_elbow:point(.42,.8,.08,hideRight?.2:1),
      left_wrist:point(-.66,.58,-.08),
      right_wrist:point(.66,.58,.08,hideRight?.2:1),
      left_hip:point(-.08,0,-.06),
      right_hip:point(.08,0,.06,hideRight?.2:1),
      left_knee:point(-.28,-.55,-.06),
      right_knee:point(.28,-.55,.06,hideRight?.2:1),
      left_ankle:point(-.42,-1,-.06),
      right_ankle:point(.42,-1,.06,hideRight?.2:1),
      left_foot_index:point(-.25,-1.03,-.06),
      right_foot_index:point(.59,-1.03,.06,hideRight?.2:1),
    },
  };
}

const target:TargetPose={
  landmarks:{
    left_hip:point(-.08,0,-.06),
    right_hip:point(.08,0,.06),
    left_shoulder:point(-.12,1,-.08),
    right_shoulder:point(.12,1,.08),
    left_elbow:point(-.3,.8,-.08),
    right_elbow:point(.3,.8,.08),
    left_wrist:point(-.45,.65,-.08),
    right_wrist:point(.45,.65,.08),
    left_knee:point(-.25,-.5,-.06),
    right_knee:point(.25,-.5,.06),
    left_ankle:point(-.38,-.95,-.06),
    right_ankle:point(.38,-.95,.06),
    left_foot_index:point(-.2,-.98,-.06),
    right_foot_index:point(.56,-.98,.06),
    nose:point(.04,1.35,0),
  },
  sword:{grip:{x:0,y:.65},tip:{x:.9,y:1.1}},
};

describe("body anatomy calibration",()=>{
  it("ignores unreliable depth and unobservable body widths in side view",()=>{
    const pose=bodyPose();
    const expected=measureBodyRatios(pose,"side");
    for(const [i,p] of Object.values(pose.landmarks).entries()) p.z=i%2 ? 8 : -8;
    const measured=measureBodyRatios(pose,"side");
    expect(measured).toEqual(expected);
    expect(measured.shoulderWidth).toBeUndefined();
    expect(measured.hipWidth).toBeUndefined();
    const calibrator=new BodyProfileCalibrator();
    for(let i=0;i<12;i++) calibrator.push(pose,"side");
    expect(calibrator.ready("full_body")).toBe(true);
    expect(calibrator.build()?.leftUpperArm).toBeLessThan(1);
  });
  it("measures limb lengths in torso-normalized space",()=>{
    const measured=measureBodyRatios(bodyPose());
    expect(measured.leftUpperArm).toBeGreaterThan(.3);
    expect(measured.leftForearm).toBeGreaterThan(.3);
    expect(measured.leftThigh).toBeGreaterThan(.5);
  });

  it("can calibrate from one visible side and mirrors missing limbs",()=>{
    const calibrator=new BodyProfileCalibrator();
    for(let i=0;i<20;i++) calibrator.push(bodyPose(true));
    expect(calibrator.ready("full_body",18)).toBe(true);
    const profile=calibrator.build();
    expect(profileCoverage(profile,"full_body")).toBe(1);
    expect(profile?.rightUpperArm).toBeCloseTo(profile?.leftUpperArm ?? 0,5);
    expect(profile?.rightShin).toBeCloseTo(profile?.leftShin ?? 0,5);
  });

  it("retargets limb lengths while preserving target directions",()=>{
    const profile:BodyProfile={
      version:1,updatedAt:"now",samples:20,
      leftUpperArm:.72,rightUpperArm:.72,leftForearm:.61,rightForearm:.61,
      leftThigh:.9,rightThigh:.9,leftShin:.82,rightShin:.82,
    };
    const personalized=retargetPose(target,profile);
    const upper=distance(personalized.landmarks.left_shoulder,personalized.landmarks.left_elbow);
    const fore=distance(personalized.landmarks.left_elbow,personalized.landmarks.left_wrist);
    expect(upper).toBeCloseTo(.72,5);
    expect(fore).toBeCloseTo(.61,5);

    const sourceDirection=direction(target.landmarks.left_shoulder,target.landmarks.left_elbow);
    const personalizedDirection=direction(personalized.landmarks.left_shoulder,personalized.landmarks.left_elbow);
    expect(personalizedDirection.x).toBeCloseTo(sourceDirection.x,5);
    expect(personalizedDirection.y).toBeCloseTo(sourceDirection.y,5);
  });
});

function distance(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}){
  return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
}
function direction(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}){
  const d=distance(a,b);
  return{x:(b.x-a.x)/d,y:(b.y-a.y)/d,z:(b.z-a.z)/d};
}
