import { retargetPose, type BodyProfile } from "../live/anatomy";
import { targetPoseFor } from "./posePresets";
import type { Drill } from "./types";

export function personalizeDrill(drill: Drill | null, profile: BodyProfile | null): Drill | null {
  if (!drill || !profile) return drill;
  return {
    ...drill,
    checkpoints: drill.checkpoints.map((checkpoint) => {
      const base = checkpoint.targetPose ?? targetPoseFor(checkpoint.targetPoseId);
      if (!base) return { ...checkpoint };
      return {
        ...checkpoint,
        targetPose: retargetPose(base, profile),
        targetPoseId: undefined,
      };
    }),
  };
}
