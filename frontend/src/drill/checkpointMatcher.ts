import { liveFeatures } from "../live/features";
import type { LandmarkMap } from "../live/landmarks";
import { targetPoseFor } from "./posePresets";
import { isTargetConstraint, type Checkpoint, type CheckpointMatch, type FeatureConstraint, type FeatureMatch } from "./types";

export interface MatcherState {
  validSince: number | null;
}

const constraintCache = new WeakMap<Checkpoint, Record<string, FeatureConstraint>>();

export function checkpointConstraints(checkpoint: Checkpoint): Record<string, FeatureConstraint> {
  const cached = constraintCache.get(checkpoint);
  if (cached) return cached;
  const constraints: Record<string, FeatureConstraint> = { ...(checkpoint.constraints ?? {}) };
  const targetPose = checkpoint.targetPose ?? targetPoseFor(checkpoint.targetPoseId);
  if (targetPose && checkpoint.featureTolerances) {
    const targetFeatures = liveFeatures(targetPose.landmarks as LandmarkMap, 0);
    for (const [name, tolerance] of Object.entries(checkpoint.featureTolerances)) {
      const target = targetFeatures[name as keyof typeof targetFeatures];
      if (typeof target === "number" && Number.isFinite(target)) {
        constraints[name] = { target, tolerance };
      }
    }
  }
  constraintCache.set(checkpoint, constraints);
  return constraints;
}

export function matchCheckpoint(
  features: Record<string, number> | null,
  checkpoint: Checkpoint,
  state: MatcherState,
  nowMs: number,
  enoughSamples: boolean,
): { match: CheckpointMatch; state: MatcherState } {
  const evaluated = evaluateConstraints(features, checkpoint);
  const rows = Object.values(evaluated.features);
  const met = rows.length > 0 && enoughSamples && features != null && rows.every((item) => item.passed);
  if (!met) {
    return { match: { ...evaluated, passed: false }, state: { validSince: null } };
  }
  const validSince = state.validSince ?? nowMs;
  const passed = nowMs - validSince >= checkpoint.holdMs;
  return { match: { ...evaluated, passed }, state: { validSince } };
}

export function evaluateConstraints(features: Record<string, number> | null, checkpoint: Checkpoint): CheckpointMatch {
  const constraints = checkpointConstraints(checkpoint);
  const rows: Record<string, FeatureMatch> = {};
  let weightedScore = 0;
  let weightSum = 0;
  for (const [name, constraint] of Object.entries(constraints)) {
    const value = features?.[name];
    const row = scoreFeature(value, constraint);
    const weight = checkpoint.weights?.[name] ?? 1;
    rows[name] = row;
    weightedScore += row.closeness * weight;
    weightSum += weight;
  }
  const confidence = weightSum > 0 ? Math.min(1, Math.max(0, weightedScore / weightSum)) : 0;
  return { passed: false, confidence, features: rows };
}

function scoreFeature(value: number | undefined, constraint: FeatureConstraint): FeatureMatch & { closeness: number } {
  if (value == null || !Number.isFinite(value)) {
    return { passed: false, value: Number.NaN, closeness: 0 };
  }
  if (isTargetConstraint(constraint)) {
    const delta = value - constraint.target;
    const closeness = constraint.tolerance <= 0
      ? (delta === 0 ? 1 : 0)
      : Math.max(0, 1 - Math.abs(delta) / (2 * constraint.tolerance));
    return {
      passed: Math.abs(delta) <= constraint.tolerance,
      value,
      target: constraint.target,
      delta,
      closeness,
    };
  }
  const inside = value >= constraint.min && value <= constraint.max;
  const span = Math.max(constraint.max - constraint.min, 1e-6);
  const outside = value < constraint.min ? constraint.min - value : value > constraint.max ? value - constraint.max : 0;
  return {
    passed: inside,
    value,
    delta: value < constraint.min ? value - constraint.min : value > constraint.max ? value - constraint.max : 0,
    closeness: inside ? 1 : Math.max(0, 1 - outside / span),
  };
}
