export interface TargetConstraint {
  target: number;
  tolerance: number;
}

export interface RangeConstraint {
  min: number;
  max: number;
}

export type FeatureConstraint = TargetConstraint | RangeConstraint;

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
  cue?: string;
}

export interface Drill {
  id: string;
  name: string;
  description: string;
  cameraView: "side";
  category?: "footwork" | "guards" | "meisterhau";
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
}

export interface CheckpointMatch {
  passed: boolean;
  confidence: number;
  features: Record<string, FeatureMatch>;
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
