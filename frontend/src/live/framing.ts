import type { RawPose } from "./landmarks";
import type { TrackingMode } from "../drill/types";

export interface FramingAssessment {
  ready: boolean;
  coverage: number;
  message: string;
  missing: string[];
}

const LABELS: Record<string, string> = {
  nose: "голову",
  left_wrist: "левую кисть",
  right_wrist: "правую кисть",
  left_ankle: "левую стопу",
  right_ankle: "правую стопу",
};

export function assessFraming(pose: RawPose, mode: TrackingMode, movement = false): FramingAssessment {
  const required = mode === "upper_body"
    ? ["nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip"]
    : ["nose", "left_shoulder", "right_shoulder", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"];

  const observed = movement ? required.filter(name => !name.endsWith("_knee")) : required;
  const missing = observed.filter((name) => {
    const point = pose.landmarks[name];
    return !point || point.visibility < 0.42 || point.x < -0.03 || point.x > 1.03 || point.y < -0.03 || point.y > 1.03;
  });

  const visible = observed
    .map((name) => pose.landmarks[name])
    .filter((point) => point && point.visibility >= 0.42);
  const ys = visible.map((point) => point.y);
  const coverage = ys.length > 1 ? Math.max(...ys) - Math.min(...ys) : 0;

  if (missing.length > 0) {
    if (mode === "full_body" && (missing.includes("left_ankle") || missing.includes("right_ankle"))) {
      return {
        ready: false,
        coverage,
        missing,
        message: "НЕ ВИЖУ СТОПЫ · отойди дальше или наклони камеру ниже",
      };
    }
    const first = LABELS[missing[0]] ?? "всё тело";
    return { ready: false, coverage, missing, message: `НЕ ВИЖУ ${first.toUpperCase()} · поправь камеру` };
  }

  const minCoverage = mode === "upper_body" ? 0.34 : 0.58;
  if (coverage < minCoverage) {
    return {
      ready: true,
      coverage,
      missing,
      message: mode === "upper_body" ? "КАМЕРА ВИДИТ · можно подойти ближе" : "КАМЕРА ВИДИТ · можно чуть ближе",
    };
  }
  if (coverage > 0.96) {
    return { ready: true, coverage, missing, message: "КАМЕРА ВИДИТ · ты почти у края кадра" };
  }
  return { ready: true, coverage, missing, message: "КАМЕРА · ГОТОВО" };
}
