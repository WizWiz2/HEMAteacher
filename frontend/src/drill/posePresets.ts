import type { TargetPose, TargetLandmark } from "./types";
import { solveElbow } from "./armGeometry";

function lm(x: number, y: number, z = 0): TargetLandmark {
  return { x, y, z, visibility: 1 };
}

function base(front: "left" | "right" = "left", stance = 0.9, torsoLean = 0.02) {
  const leftX = (front === "left" ? 1 : -1) * stance / 2;
  const rightX = -leftX;
  return {
    left_hip: lm(0, 0, -0.08),
    right_hip: lm(0, 0, 0.08),
    left_shoulder: lm(torsoLean, 1, -0.12),
    right_shoulder: lm(torsoLean, 1, 0.12),
    nose: lm(torsoLean + 0.08, 1.33),
    left_knee: lm(leftX * 0.55, -0.52, -0.08),
    right_knee: lm(rightX * 0.55, -0.52, 0.08),
    left_ankle: lm(leftX, -1, -0.08),
    right_ankle: lm(rightX, -1, 0.08),
    left_heel: lm(leftX - 0.06, -1.02, -0.08),
    right_heel: lm(rightX - 0.06, -1.02, 0.08),
    left_foot_index: lm(leftX + 0.14, -1.03, -0.08),
    right_foot_index: lm(rightX + 0.14, -1.03, 0.08),
  };
}

function pose(input: {
  front?: "left" | "right";
  stance?: number;
  torsoLean?: number;
  hand: [number, number];
  leftElbow: [number, number];
  rightElbow: [number, number];
  sword: [[number, number], [number, number]];
}): TargetPose {
  const landmarks: Record<string, TargetLandmark> = base(input.front, input.stance, input.torsoLean);
  landmarks.left_elbow = lm(input.leftElbow[0], input.leftElbow[1], -0.12);
  landmarks.right_elbow = lm(input.rightElbow[0], input.rightElbow[1], 0.12);
  landmarks.left_wrist = lm(input.hand[0] - 0.02, input.hand[1], -0.05);
  landmarks.right_wrist = lm(input.hand[0] + 0.02, input.hand[1], 0.05);
  return {
    landmarks,
    sword: {
      grip: { x: input.sword[0][0], y: input.sword[0][1] },
      tip: { x: input.sword[1][0], y: input.sword[1][1] },
    },
  };
}

const ready = (front: "left" | "right" = "left", stance = 0.9) => pose({
  front, stance, hand: [0.42, 0.62], leftElbow: [0.18, 0.72], rightElbow: [0.2, 0.68],
  sword: [[0.42, 0.62], [1.25, 1.2]],
});
const footwork = (front: "left" | "right" = "left", stance = 0.9) => {
  const value = ready(front, stance);
  delete value.sword;
  return value;
};

export const POSE_PRESETS: Record<string, TargetPose> = {
  "stance-left": footwork("left", 0.9),
  "stance-right": footwork("right", 0.9),
  "stance-wide-left": footwork("left", 1.25),
  "stance-wide-right": footwork("right", 1.25),
  "advance-front-out": (() => {
    const value = footwork("left", 0.9);
    value.landmarks.left_ankle.x = 0.75;
    value.landmarks.left_knee.x = 0.4;
    value.landmarks.left_heel.x = 0.69;
    value.landmarks.left_foot_index.x = 0.89;
    return value;
  })(),
  "retreat-rear-out": (() => {
    const value = ready("left", 0.9);
    value.landmarks.right_ankle.x = -0.75;
    value.landmarks.right_knee.x = -0.4;
    value.landmarks.right_heel.x = -0.81;
    value.landmarks.right_foot_index.x = -0.61;
    return value;
  })(),
  "stance-compact-left": footwork("left", 0.65),
  "stance-cross": (() => {
    const value = footwork("left", 0.18);
    value.landmarks.left_ankle.x = 0.05;
    value.landmarks.right_ankle.x = -0.05;
    return value;
  })(),
  "vom-tag": (() => {
    const value = pose({ hand: [.66, 1.015], leftElbow: [.39, .78], rightElbow: [.39, .63],
      sword: [[.632, 1.218], [.50, 2.175]] });
    // Preserve the hand centre from the supplied shoulder-guard report.
    // Both fists and the blade share one axis; equal bones determine elbows.
    value.landmarks.left_wrist = lm(.68, .87, .23);
    value.landmarks.right_wrist = lm(.64, 1.16, .27);
    value.landmarks.left_elbow = solveElbow(value.landmarks.left_shoulder, value.landmarks.left_wrist, lm(.25, .35, -.12));
    value.landmarks.right_elbow = solveElbow(value.landmarks.right_shoulder, value.landmarks.right_wrist, lm(.30, .3, .30));
    value.sword!.grip.z = .278;
    value.sword!.tip.z = .41;
    value.illustration = "right-shoulder-guard";
    return value;
  })(),
  "ochs": pose({
    hand: [0.38, 1.14], leftElbow: [0.12, 1.1], rightElbow: [0.18, 0.98],
    sword: [[0.38, 1.14], [1.42, 1.3]],
  }),
  "pflug": pose({
    hand: [0.34, 0.48], leftElbow: [0.1, 0.72], rightElbow: [0.2, 0.66],
    sword: [[0.34, 0.48], [1.35, 0.78]],
  }),
  "alber": pose({
    hand: [0.34, 0.38], leftElbow: [0.1, 0.62], rightElbow: [0.2, 0.56],
    sword: [[0.34, 0.38], [1.28, -0.28]],
  }),
  "zorn-init": pose({
    hand: [0.3, 1.05], leftElbow: [0.02, 1], rightElbow: [0.1, 0.92],
    sword: [[0.3, 1.05], [1.1, 1.35]],
  }),
  "zorn-extend": pose({
    front: "right", stance: 1.05, hand: [0.65, 0.82], leftElbow: [0.34, 0.88], rightElbow: [0.38, 0.8],
    sword: [[0.65, 0.82], [1.55, 0.28]],
  }),
  "zorn-finish": pose({
    front: "right", hand: [0.66, 0.56], leftElbow: [0.34, 0.7], rightElbow: [0.38, 0.66],
    sword: [[0.66, 0.56], [1.45, -0.08]],
  }),
  "krump-chamber": pose({
    hand: [0.08, 1.34], leftElbow: [-0.12, 1.12], rightElbow: [0.2, 1.08],
    sword: [[0.08, 1.34], [-0.5, 1.8]],
  }),
  "krump-cross": pose({
    front: "right", stance: 1, hand: [0.52, 0.98], leftElbow: [0.24, 1.02], rightElbow: [0.28, 0.9],
    sword: [[0.52, 0.98], [1.35, 0.42]],
  }),
  "krump-finish": pose({
    front: "right", hand: [0.58, 0.68], leftElbow: [0.3, 0.8], rightElbow: [0.34, 0.72],
    sword: [[0.58, 0.68], [1.38, 0.18]],
  }),
  "zwerch-chamber": pose({
    hand: [0.1, 1.16], leftElbow: [-0.02, 1.03], rightElbow: [0.2, 1],
    sword: [[0.1, 1.16], [-0.78, 1.22]],
  }),
  "zwerch-extend": pose({
    front: "right", stance: 1, hand: [0.64, 1.04], leftElbow: [0.36, 1.02], rightElbow: [0.4, 0.96],
    sword: [[0.64, 1.04], [1.62, 1.02]],
  }),
  "zwerch-finish": pose({
    front: "right", hand: [0.68, 1], leftElbow: [0.4, 1], rightElbow: [0.44, 0.94],
    sword: [[0.68, 1], [1.56, 0.92]],
  }),
  "schiel-chamber": pose({
    hand: [0.18, 1.28], leftElbow: [-0.02, 1.08], rightElbow: [0.2, 1],
    sword: [[0.18, 1.28], [0.95, 1.62]],
  }),
  "schiel-extend": pose({
    front: "right", stance: 1, hand: [0.62, 0.96], leftElbow: [0.34, 0.98], rightElbow: [0.4, 0.88],
    sword: [[0.62, 0.96], [1.55, 0.82]],
  }),
  "schiel-finish": pose({
    front: "right", hand: [0.68, 0.9], leftElbow: [0.4, 0.94], rightElbow: [0.44, 0.84],
    sword: [[0.68, 0.9], [1.55, 0.72]],
  }),
  "scheitel-extend": pose({
    front: "right", stance: 1, hand: [0.5, 1.12], leftElbow: [0.22, 1.06], rightElbow: [0.28, 0.98],
    sword: [[0.5, 1.12], [1.3, 1.58]],
  }),
  "scheitel-finish": pose({
    front: "right", hand: [0.7, 0.95], leftElbow: [0.4, 0.98], rightElbow: [0.46, 0.88],
    sword: [[0.7, 0.95], [1.62, 0.95]],
  }),
};

export function targetPoseFor(id: string | undefined): TargetPose | null {
  return id ? POSE_PRESETS[id] ?? null : null;
}
