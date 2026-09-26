export type Severity = "info" | "warning" | "major";

export interface MovementSummary {
  id: string;
  name: string;
  camera_view: string;
  reference_ready: boolean;
}

export interface MovementDetail extends MovementSummary {
  description: string;
  analysis_profile: string;
  reference_video_url: string | null;
  reference_pose_url: string | null;
  duration_ms: number | null;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseFrame {
  timestamp_ms: number;
  landmarks: Record<string, Landmark>;
}

export interface PoseSequence {
  fps: number;
  duration_ms: number;
  space: "image" | "normalized";
  width: number;
  height: number;
  frames: PoseFrame[];
}

export interface FeedbackItem {
  severity: Severity;
  phase: number;
  phase_name: string;
  feature: string;
  message: string;
}

export interface AlignmentPair {
  reference_frame: number;
  attempt_frame: number;
  reference_time_ms: number;
  attempt_time_ms: number;
}

export interface TimelineMarker {
  position: number;
  severity: Severity;
  feature: string;
  reference_time_ms: number;
  attempt_time_ms: number;
}

export interface PhaseMetric {
  reference: number;
  attempt: number;
  delta: number;
  severity: Severity;
}

export interface MetricFeature {
  label: string;
  unit: string;
  weight: number;
  mean_abs_delta: number | null;
  phases: Record<string, PhaseMetric>;
}

export interface ComparisonResult {
  movement_id: string | null;
  reliable: boolean;
  message: string | null;
  similarity: number | null;
  quality: {
    pose_detection_ratio?: number;
    reasons?: string[];
    reliable?: boolean;
  };
  feedback: FeedbackItem[];
  alignment: AlignmentPair[];
  metrics: Record<string, MetricFeature>;
  largest_deviations: Array<Record<string, unknown>>;
  timeline_markers: TimelineMarker[];
  attempt_video_url?: string;
  attempt_pose_url?: string;
  reference_video_url?: string;
  reference_pose_url?: string;
}

export interface SessionInfo {
  id: string;
  movement_id: string;
  created_at: string;
  status: string;
  error_reason: string | null;
}
