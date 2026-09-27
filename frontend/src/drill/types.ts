export interface TargetConstraint {
  target: number;
  tolerance: number;
}

export interface RangeConstraint {
  min: number;
  max: number;
}

export type FeatureConstraint = TargetConstraint | RangeConstraint;
export type TrackingMode = "full_body" | "upper_body";
export type WeaponTrackingMode = "none" | "optional";

export interface TargetLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface TargetPose {
  landmarks: Record<string, TargetLandmark>;
  sword?: {
    grip: { x: number; y: number };
    tip: { x: number; y: number };
  };
}

export interface Checkpoint {
  id: string;
  title: string;
  illustrationUrl?: string;
  targetPoseId?: string;
  targetPose?: TargetPose;
  holdMs: number;
  smoothingMs?: number;
  constraints?: Record<string, FeatureConstraint>;
  featureTolerances?: Record<string, number>;
  weights?: Record<string, number>;
  requiredFeatures?: string[];
  passThreshold?: number;
  cue?: string;
}

export interface Drill {
  id: string;
  name: string;
  description: string;
  cameraView: "side";
  category?: "footwork" | "guards" | "meisterhau";
  trackingMode?: TrackingMode;
  weaponTracking?: WeaponTrackingMode;
  unvalidated?: boolean;
  limitations?: string[];
  checkpoints: Checkpoint[];
  transitions?: unknown[];
}

export interface FeatureMatch {
  passed: boolean;
  value: number;
  target?: number;
  delta?: number;
  closeness?: number;
}

export interface CheckpointMatch {
  passed: boolean;
  confidence: number;
  passScore: number;
  features: Record<string, FeatureMatch>;
}

export interface WeaponPoint {
  x: number;
  y: number;
  confidence: number;
}

export interface WeaponMarkers {
  detected: boolean;
  grip?: WeaponPoint;
  tip?: WeaponPoint;
  angleDeg?: number;
}

export interface WeaponMatch {
  available: boolean;
  passed: boolean;
  angleDeg?: number;
  targetAngleDeg?: number;
  deltaDeg?: number;
}

export type DrillState = "calibrating" | "ready" | "running" | "completed";

export interface DrillRuntime {
  state: DrillState;
  checkpointIndex: number;
  startedAt?: number;
  finishedAt?: number;
  validSince: number | null;
  match: CheckpointMatch | null;
}

export function isTargetConstraint(constraint: FeatureConstraint): constraint is TargetConstraint {
  return "target" in constraint && "tolerance" in constraint;
}
