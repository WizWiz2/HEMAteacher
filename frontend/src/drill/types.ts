export interface TargetConstraint {
  target: number;
  tolerance: number;
}

export interface RangeConstraint {
  min: number;
  max: number;
}

export type FeatureConstraint = TargetConstraint | RangeConstraint;

export interface Checkpoint {
  id: string;
  title: string;
  illustrationUrl?: string;
  holdMs: number;
  constraints: Record<string, FeatureConstraint>;
  weights?: Record<string, number>;
}

export interface Drill {
  id: string;
  name: string;
  description: string;
  cameraView: "side";
  unvalidated?: boolean;
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
