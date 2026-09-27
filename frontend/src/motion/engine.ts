import type { PoseSequence } from "../types";
import { compareMotion } from "./compare";
import { alignDtw } from "./dtw";
import { extractOfflineFeatures } from "./features";
import { normalizeSequence } from "./normalize";
import { FOOTWORK_PROFILE } from "./profile";
import { segmentMotion } from "./segmentation";
import type { BrowserAnalysis, PreparedMotion } from "./types";

export function prepareMotion(sequence: PoseSequence): { normalized: PoseSequence; prepared: PreparedMotion } {
  const normalized=sequence.space==="normalized"?sequence:normalizeSequence(sequence);
  const features=extractOfflineFeatures(normalized);
  const prepared:PreparedMotion={
    fps:normalized.fps,
    timestamps_ms:normalized.frames.map(frame=>frame.timestamp_ms),
    features,
    phases:segmentMotion(features,normalized.fps),
  };
  return {normalized,prepared};
}

export function analyzeSequences(movementId:string,referenceImage:PoseSequence,attemptImage:PoseSequence):BrowserAnalysis {
  const ref=prepareMotion(referenceImage);
  const att=prepareMotion(attemptImage);
  const alignment=alignDtw(ref.prepared,att.prepared,FOOTWORK_PROFILE.dtw_features);
  const result=compareMotion(ref.prepared,att.prepared,alignment.pairs,FOOTWORK_PROFILE,movementId);
  result.quality={
    reliable:true,
    pose_detection_ratio:poseDetectionRatio(attemptImage),
    reasons:[],
  };
  return {
    result,
    referenceImage,
    referenceNormalized:ref.normalized,
    attemptImage,
    attemptNormalized:att.normalized,
  };
}

function poseDetectionRatio(sequence:PoseSequence){
  if(!sequence.frames.length)return 0;
  return sequence.frames.filter(frame=>Object.keys(frame.landmarks).length>0).length/sequence.frames.length;
}
