import { isTargetConstraint, type Checkpoint, type CheckpointMatch, type FeatureConstraint, type FeatureMatch } from "./types";

export interface MatcherState {
  validSince: number | null;
}

/** Ограничения текущего кадра. `passed` становится true только после holdMs. */
export function matchCheckpoint(
  features: Record<string, number> | null,
  checkpoint: Checkpoint,
  state: MatcherState,
  nowMs: number,
  enoughSamples: boolean,
): { match: CheckpointMatch; state: MatcherState } {
  const evaluated = evaluateConstraints(features, checkpoint);
  const met = enoughSamples && features != null && Object.values(evaluated.features).every((item) => item.passed);
  if (!met) {
    return { match: { ...evaluated, passed: false }, state: { validSince: null } };
  }
  const validSince = state.validSince ?? nowMs;
  const passed = nowMs - validSince >= checkpoint.holdMs;
  return { match: { ...evaluated, passed }, state: { validSince } };
}

export function evaluateConstraints(features: Record<string, number> | null, checkpoint: Checkpoint): CheckpointMatch {
  const rows: Record<string, FeatureMatch> = {};
  const scores: number[] = [];
  for (const [name, constraint] of Object.entries(checkpoint.constraints)) {
    const value = features?.[name];
    const row = scoreFeature(value, constraint);
    const weight = checkpoint.weights?.[name] ?? 1;
    rows[name] = row;
    scores.push(row.closeness * weight);
  }
  const weightSum = Object.keys(checkpoint.constraints).reduce((sum, name) => sum + (checkpoint.weights?.[name] ?? 1), 0);
  const confidence = weightSum > 0 ? Math.min(1, Math.max(0, scores.reduce((sum, score) => sum + score, 0) / weightSum)) : 0;
  return { passed: false, confidence, features: rows };
}

function scoreFeature(value: number | undefined, constraint: FeatureConstraint): FeatureMatch & { closeness: number } {
  if (value == null || !Number.isFinite(value)) {
    return { passed: false, value: Number.NaN, closeness: 0 };
  }
  if (isTargetConstraint(constraint)) {
    const delta = value - constraint.target;
    const closeness = constraint.tolerance <= 0 ? (delta === 0 ? 1 : 0) : Math.max(0, 1 - Math.abs(delta) / constraint.tolerance);
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
