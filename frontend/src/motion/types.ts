import type { ComparisonResult, PoseSequence, Severity } from "../types";

export interface FeatureSpec {
  weight: number;
  warning_threshold?: number;
  major_threshold?: number;
  warning_threshold_deg?: number;
  major_threshold_deg?: number;
  unit: string;
  label: string;
  source?: string;
  reduce?: "mean" | "std";
  greater?: string;
  less?: string;
}

export interface AnalysisProfile {
  id: string;
  scale_strategy: string;
  scale_scope: string;
  dtw_features: string[];
  phases: Record<string, string>;
  features: Record<string, FeatureSpec>;
}

export interface PhaseSpan {
  name: string;
  start_frame: number;
  end_frame: number;
}

export interface PreparedMotion {
  fps: number;
  timestamps_ms: number[];
  features: Record<string, number[]>;
  phases: PhaseSpan[];
}

export interface Observation {
  feature: string;
  phase: string;
  phase_position: number;
  reference: number;
  attempt: number;
  delta: number;
  severity: Severity;
  weight: number;
  duration_fraction: number;
  unit: string;
  label: string;
  reference_frame: number;
  attempt_frame: number;
  reference_time_ms: number;
  attempt_time_ms: number;
}

export interface BrowserAnalysis {
  result: ComparisonResult;
  referenceImage: PoseSequence;
  referenceNormalized: PoseSequence;
  attemptImage: PoseSequence;
  attemptNormalized: PoseSequence;
}

export type AnalysisStage =
  | "loading_video"
  | "extracting_pose"
  | "normalizing"
  | "aligning"
  | "analyzing"
  | "saving";
