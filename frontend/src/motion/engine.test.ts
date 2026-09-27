import { describe, expect, it } from "vitest";
import type { Landmark, PoseSequence } from "../types";
import { analyzeSequences } from "./engine";
import type { AnalysisProfile } from "./types";
import { normalizeSequence } from "./normalize";

function p(x:number,y:number,z=0):Landmark{return{x,y,z,visibility:1};}

function normalizedSequence(offset=0):PoseSequence{
  const frames=Array.from({length:12},(_,index)=>{
    const phase=index/11;
    const leftX=-.45+phase*.18+offset;
    const rightX=.45+phase*.18;
    return {
      timestamp_ms:index*67,
      landmarks:{
        nose:p(.08,1.35),
        left_shoulder:p(0,1,-.1),right_shoulder:p(0,1,.1),
        left_hip:p(0,0,-.08),right_hip:p(0,0,.08),
        left_knee:p(leftX*.55,-.5,-.08),right_knee:p(rightX*.55,-.5,.08),
        left_ankle:p(leftX,-1,-.08),right_ankle:p(rightX,-1,.08),
        left_heel:p(leftX-.05,-1.02,-.08),right_heel:p(rightX-.05,-1.02,.08),
        left_foot_index:p(leftX+.12,-1.02,-.08),right_foot_index:p(rightX+.12,-1.02,.08),
      },
    };
  });
  return {fps:15,duration_ms:737,space:"normalized",width:1,height:1,frames};
}

const PROFILE:AnalysisProfile={
  id:"test",scale_strategy:"torso_length",scale_scope:"sequence",
  dtw_features:["left_ankle_x","right_ankle_x","foot_distance","pelvis_height"],
  phases:{preparation:"Начало",stride:"Шаг",landing:"Приземление",completion:"Завершение",overall:"Всё движение"},
  features:{
    foot_distance:{weight:1,warning_threshold:.12,major_threshold:.22,unit:"torso_lengths",label:"расстояние стоп"},
    left_ankle_x:{weight:1,warning_threshold:.12,major_threshold:.22,unit:"torso_lengths",label:"левая стопа"},
    right_ankle_x:{weight:1,warning_threshold:.12,major_threshold:.22,unit:"torso_lengths",label:"правая стопа"},
    pelvis_height:{weight:.7,warning_threshold:.08,major_threshold:.14,unit:"torso_lengths",label:"таз"},
  },
};

describe("browser motion engine",()=>{
  it("gives an identical sequence near-perfect similarity",()=>{
    const seq=normalizedSequence();
    const result=analyzeSequences("advance",seq,seq,PROFILE).result;
    expect(result.reliable).toBe(true);
    expect(result.similarity).toBeCloseTo(100,4);
    expect(result.alignment.length).toBe(seq.frames.length);
  });

  it("detects a deliberately shifted foot",()=>{
    const result=analyzeSequences("advance",normalizedSequence(),normalizedSequence(.4),PROFILE).result;
    expect(result.similarity ?? 100).toBeLessThan(100);
    expect(result.feedback.length).toBeGreaterThan(0);
  });

  it("normalizes image coordinates around the hips using one sequence scale",()=>{
    const seq=normalizedSequence();
    const image:PoseSequence={
      ...seq,space:"image",width:1000,height:700,
      frames:seq.frames.map(frame=>({
        ...frame,
        landmarks:Object.fromEntries(Object.entries(frame.landmarks).map(([name,lm])=>[
          name,{...lm,x:.5+lm.x*.08,y:.55-lm.y*.08,z:lm.z*.08},
        ])),
      })),
    };
    const norm=normalizeSequence(image);
    expect(norm.space).toBe("normalized");
    expect(norm.frames[0].landmarks.left_hip.x).toBeCloseTo(0,1);
    expect(norm.frames[0].landmarks.left_shoulder.y).toBeGreaterThan(.8);
  });
});
