import type { PoseSequence } from "../types";
import { BodyProfileCalibrator, retargetPose, type BodyProfile } from "../live/anatomy";
import type { RawPose } from "../live/landmarks";
import { compareMotion } from "./compare";
import { alignDtw } from "./dtw";
import { extractOfflineFeatures } from "./features";
import { normalizeSequence } from "./normalize";
import { segmentMotion } from "./segmentation";
import type { AnalysisProfile, BrowserAnalysis, PreparedMotion } from "./types";

export function prepareMotion(sequence: PoseSequence): { normalized: PoseSequence; prepared: PreparedMotion } {
  const normalized=sequence.space==="normalized"?sequence:normalizeSequence(sequence);
  return { normalized, prepared: prepareNormalized(normalized) };
}

export function analyzeSequences(
  movementId:string,
  referenceImage:PoseSequence,
  attemptImage:PoseSequence,
  profile:AnalysisProfile,
):BrowserAnalysis {
  const referenceNormalized = referenceImage.space === "normalized" ? referenceImage : normalizeSequence(referenceImage);
  const attemptNormalized = attemptImage.space === "normalized" ? attemptImage : normalizeSequence(attemptImage);

  // Technique should be compared on the user's anatomy, not the trainer's limb lengths.
  // The attempt supplies the body proportions; the reference keeps its joint directions
  // but is retargeted to those proportions before features/DTW are calculated.
  const attemptBodyProfile = bodyProfileFromSequence(attemptNormalized);
  const personalizedReference = attemptBodyProfile
    ? retargetSequence(referenceNormalized, attemptBodyProfile)
    : referenceNormalized;

  const refPrepared=prepareNormalized(personalizedReference);
  const attPrepared=prepareNormalized(attemptNormalized);
  const alignment=alignDtw(refPrepared,attPrepared,profile.dtw_features);
  const result=compareMotion(refPrepared,attPrepared,alignment.pairs,profile,movementId);
  result.quality={
    reliable:true,
    pose_detection_ratio:poseDetectionRatio(attemptImage),
    reasons:attemptBodyProfile ? [] : ["Не удалось надёжно оценить пропорции тела; использован неперсонализированный эталон."],
  };
  return {
    result,
    referenceImage,
    referenceNormalized:personalizedReference,
    attemptImage,
    attemptNormalized,
  };
}

function prepareNormalized(normalized:PoseSequence):PreparedMotion {
  const features=extractOfflineFeatures(normalized);
  return {
    fps:normalized.fps,
    timestamps_ms:normalized.frames.map(frame=>frame.timestamp_ms),
    features,
    phases:segmentMotion(features,normalized.fps),
  };
}

function bodyProfileFromSequence(sequence:PoseSequence):BodyProfile|null {
  const calibrator=new BodyProfileCalibrator();
  for(const frame of sequence.frames) {
    const raw:RawPose={
      timestampMs:frame.timestamp_ms,
      width:1,
      height:1,
      landmarks:frame.landmarks,
    };
    calibrator.push(raw);
  }
  return calibrator.build();
}

function retargetSequence(sequence:PoseSequence,profile:BodyProfile):PoseSequence {
  return {
    ...sequence,
    frames:sequence.frames.map((frame)=>({
      timestamp_ms:frame.timestamp_ms,
      landmarks:retargetPose({landmarks:frame.landmarks},profile).landmarks,
    })),
  };
}

function poseDetectionRatio(sequence:PoseSequence){
  if(!sequence.frames.length)return 0;
  return sequence.frames.filter(frame=>Object.keys(frame.landmarks).length>0).length/sequence.frames.length;
}
