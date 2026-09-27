import type { Landmark, PoseSequence } from "../types";

export const OFFLINE_FEATURES = [
  "left_ankle_x","left_ankle_y","right_ankle_x","right_ankle_y",
  "left_heel_x","left_heel_y","right_heel_x","right_heel_y",
  "left_toe_x","left_toe_y","right_toe_x","right_toe_y",
  "foot_distance","pelvis_height","left_knee_angle","right_knee_angle",
  "left_hip_angle","right_hip_angle","torso_angle","knee_over_foot_left",
  "knee_over_foot_right","left_leg_extension","right_leg_extension",
  "lateral_foot_distance","shoulder_offset",
] as const;

export function extractOfflineFeatures(sequence: PoseSequence): Record<string, number[]> {
  const out: Record<string, number[]> = Object.fromEntries(OFFLINE_FEATURES.map((name)=>[name,[]]));
  for(const frame of sequence.frames){
    const row=frameFeatures(frame.landmarks);
    for(const name of OFFLINE_FEATURES) out[name].push(row[name]);
  }
  return out;
}

function frameFeatures(lm: Record<string, Landmark>): Record<string,number> {
  const p=(name:string)=>lm[name] && lm[name].visibility>=0.5 ? lm[name] : null;
  const la=p("left_ankle"), ra=p("right_ankle"), lh=p("left_hip"), rh=p("right_hip");
  const lk=p("left_knee"), rk=p("right_knee"), ls=p("left_shoulder"), rs=p("right_shoulder");
  const footDistance=la&&ra?dist2(la,ra):NaN;
  const pelvisHeight=la&&ra?-0.5*(la.y+ra.y):NaN;
  let torsoAngle=NaN, shoulderOffset=NaN;
  if(lh&&rh&&ls&&rs){
    const hip=mid(lh,rh), sh=mid(ls,rs);
    torsoAngle=Math.atan2(sh.x-hip.x,sh.y-hip.y)*180/Math.PI;
    shoulderOffset=sh.x-hip.x;
  }
  const coord=(name:string,axis:"x"|"y")=>p(name)?.[axis] ?? NaN;
  return {
    left_ankle_x:coord("left_ankle","x"), left_ankle_y:coord("left_ankle","y"),
    right_ankle_x:coord("right_ankle","x"), right_ankle_y:coord("right_ankle","y"),
    left_heel_x:coord("left_heel","x"), left_heel_y:coord("left_heel","y"),
    right_heel_x:coord("right_heel","x"), right_heel_y:coord("right_heel","y"),
    left_toe_x:coord("left_foot_index","x"), left_toe_y:coord("left_foot_index","y"),
    right_toe_x:coord("right_foot_index","x"), right_toe_y:coord("right_foot_index","y"),
    foot_distance:footDistance, pelvis_height:pelvisHeight,
    left_knee_angle:angle(lh,lk,la), right_knee_angle:angle(rh,rk,ra),
    left_hip_angle:angle(ls,lh,lk), right_hip_angle:angle(rs,rh,rk),
    torso_angle:torsoAngle,
    knee_over_foot_left:lk&&la?lk.x-la.x:NaN,
    knee_over_foot_right:rk&&ra?rk.x-ra.x:NaN,
    left_leg_extension:lh&&la?dist2(lh,la):NaN,
    right_leg_extension:rh&&ra?dist2(rh,ra):NaN,
    lateral_foot_distance:la&&ra?Math.abs(la.z-ra.z):NaN,
    shoulder_offset:shoulderOffset,
  };
}
function dist2(a:Landmark,b:Landmark){return Math.hypot(a.x-b.x,a.y-b.y);}
function mid(a:Landmark,b:Landmark):Landmark{return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2,visibility:1};}
function angle(a:Landmark|null,b:Landmark|null,c:Landmark|null){
  if(!a||!b||!c) return NaN;
  const ux=a.x-b.x, uy=a.y-b.y, uz=a.z-b.z, vx=c.x-b.x, vy=c.y-b.y, vz=c.z-b.z;
  const den=Math.hypot(ux,uy,uz)*Math.hypot(vx,vy,vz);
  if(den<1e-9) return NaN;
  return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy+uz*vz)/den)))*180/Math.PI;
}
