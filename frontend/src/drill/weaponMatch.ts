import type { Facing } from "../live/normalize";
import type { TargetPose, WeaponMarkers, WeaponMatch } from "./types";

export function matchWeaponAngle(markers: WeaponMarkers | null, pose: TargetPose | null, facing: Facing, toleranceDeg = 28): WeaponMatch {
  if (!markers?.detected || !markers.grip || !markers.tip || !pose?.sword) return { available: false, passed: false };

  const face = facing === "right" ? 1 : -1;
  const liveDx = (markers.tip.x - markers.grip.x) * face;
  const liveDy = -(markers.tip.y - markers.grip.y);
  const live = Math.atan2(liveDy, liveDx) * 180 / Math.PI;

  const targetDx = pose.sword.tip.x - pose.sword.grip.x;
  const targetDy = pose.sword.tip.y - pose.sword.grip.y;
  const target = Math.atan2(targetDy, targetDx) * 180 / Math.PI;
  const delta = smallestAngle(live - target);

  return {
    available: true,
    passed: Math.abs(delta) <= toleranceDeg,
    angleDeg: live,
    targetAngleDeg: target,
    deltaDeg: delta,
  };
}

function smallestAngle(angle: number): number {
  let value = ((angle + 180) % 360 + 360) % 360 - 180;
  if (value === -180) value = 180;
  return value;
}
