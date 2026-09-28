import type { CameraView } from "../live/normalize";
import type { Checkpoint, Drill, FeatureConstraint } from "./types";

const DEPTH_FEATURES = new Set([
  "left_ankle_x", "right_ankle_x", "hand_center_x",
  "knee_over_foot_left", "knee_over_foot_right", "foot_distance",
]);

export function adaptDrillForCameraView(drill: Drill | null, view: CameraView): Drill | null {
  if (!drill || view === "side") return drill;
  return {
    ...drill,
    checkpoints: drill.checkpoints.map(adaptCheckpoint),
  };
}

function adaptCheckpoint(checkpoint: Checkpoint): Checkpoint {
  const featureTolerances = checkpoint.featureTolerances
    ? Object.fromEntries(Object.entries(checkpoint.featureTolerances).map(([name, tolerance]) => [
        name,
        DEPTH_FEATURES.has(name) ? tolerance * 1.8 : tolerance,
      ]))
    : undefined;

  const constraints = checkpoint.constraints
    ? Object.fromEntries(Object.entries(checkpoint.constraints).map(([name, constraint]) => [
        name,
        DEPTH_FEATURES.has(name) ? loosen(constraint, 1.8) : constraint,
      ]))
    : undefined;

  const weights = checkpoint.weights
    ? Object.fromEntries(Object.entries(checkpoint.weights).map(([name, weight]) => [
        name,
        DEPTH_FEATURES.has(name) ? weight * 0.55 : weight,
      ]))
    : undefined;

  return {
    ...checkpoint,
    featureTolerances,
    constraints,
    weights,
    requiredFeatures: (checkpoint.requiredFeatures ?? []).filter((name) => !DEPTH_FEATURES.has(name)),
  };
}

function loosen(constraint: FeatureConstraint, factor: number): FeatureConstraint {
  if ("target" in constraint) return { ...constraint, tolerance: constraint.tolerance * factor };
  const center = (constraint.min + constraint.max) / 2;
  const half = ((constraint.max - constraint.min) / 2) * factor;
  return { min: center - half, max: center + half };
}
