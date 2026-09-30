import type { LiveCue } from "../drill/feedback";
import { targetPoseFor } from "../drill/posePresets";
import type { Checkpoint, TargetPose as TargetPoseData } from "../drill/types";
import type { CameraView, Facing } from "../live/normalize";

import { EngravingFigure, engravingJoints } from "./EngravingFigure";

const EDGES: Array<[string, string]> = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["left_ankle", "left_foot_index"],
  ["right_ankle", "right_foot_index"],
];

const KEY_POINTS = [
  "left_wrist", "right_wrist", "left_elbow", "right_elbow",
  "left_hip", "right_hip", "left_knee", "right_knee",
  "left_ankle", "right_ankle",
];

export function TargetPose({
  checkpoint,
  facing,
  cameraView = "side",
  cue,
  calibrating = false,
}: {
  checkpoint: Checkpoint;
  facing: Facing;
  cameraView?: CameraView;
  cue?: LiveCue | null;
  calibrating?: boolean;
}) {
  const pose = checkpoint.targetPose ?? targetPoseFor(checkpoint.targetPoseId);
  const correction = cue && !cue.ok ? cue : null;
  const calibrationCue = cameraView === "front"
    ? "Встань лицом к камере как на рисунке и задержись"
    : "Встань боком как на рисунке и задержись";

  return (
    <figure className={`target-card manuscript-panel ${correction || calibrating ? "target-guiding" : ""}`}>
      {pose ? (
        <EngravingPose
          pose={pose}
          facing={facing}
          cameraView={cameraView}
          title={checkpoint.title}
          cue={correction}
          calibrating={calibrating}
        />
      ) : checkpoint.illustrationUrl ? (
        <img src={checkpoint.illustrationUrl} alt={checkpoint.title} />
      ) : (
        <div className="target-fallback">Нет визуального эталона</div>
      )}
      <figcaption>
        <span className="rubric">{calibrating ? "Повтори позу" : correction ? "Что поправить" : "Контрольная точка"}</span>
        <strong>{checkpoint.title}</strong>
        {(correction || calibrating || checkpoint.cue) && (
          <span className="target-cue">{calibrating ? calibrationCue : correction?.text ?? checkpoint.cue}</span>
        )}
      </figcaption>
    </figure>
  );
}

function EngravingPose({
  pose,
  facing,
  cameraView,
  title,
  cue,
  calibrating,
}: {
  pose: TargetPoseData;
  facing: Facing;
  cameraView: CameraView;
  title: string;
  cue: LiveCue | null;
  calibrating: boolean;
}) {
  const joints = engravingJoints(pose, cameraView, facing);
  const point = (name: string) => joints[name] ?? null;

  const hands = joints.left_wrist && joints.right_wrist ? midpoint2(joints.left_wrist, joints.right_wrist) : null;
  const swordGrip = pose.sword && hands ? hands : null;
  const bladeX = pose.sword ? pose.sword.tip.x - pose.sword.grip.x : 0;
  const bladeY = pose.sword ? pose.sword.tip.y - pose.sword.grip.y : 0;
  const bladeZ = pose.sword ? (pose.sword.tip.z ?? 0) - (pose.sword.grip.z ?? 0) : 0;
  const bladeScale = 105 / (Math.hypot(bladeX, bladeY, bladeZ) || 1);
  const swordTip: [number, number] | null = pose.sword && swordGrip
    ? cameraView === "side"
      ? [swordGrip[0] + bladeX * bladeScale * (facing === "right" ? 1 : -1), swordGrip[1] - bladeY * bladeScale]
      // Match the illustration's 90:80 frontal projection, so the hilt
      // stays collinear with both wrists rather than drifting across them.
      : [swordGrip[0] - bladeZ * bladeScale * 90 / 80, swordGrip[1] - bladeY * bladeScale]
    : null;
  const visiblePoints = [...Object.values(joints), ...[swordGrip, swordTip].filter((p): p is [number, number] => p !== null)];
  const top = Math.min(...visiblePoints.map(p => p[1]), (joints.left_shoulder?.[1] ?? 176) - 58) - 18;
  const bottom = Math.max(...visiblePoints.map(p => p[1])) + 25;
  const left = Math.min(...visiblePoints.map(p => p[0])) - 40;
  const right = Math.max(...visiblePoints.map(p => p[0])) + 40;
  const figureScale = Math.min(1, 284 / Math.max(1, bottom - top), 300 / Math.max(1, right - left));
  const figureX = 180 - (left + right) / 2 * figureScale;
  const figureY = 369 - bottom * figureScale;

  const focus = cue
    ? focusJoints(cue.name)
    : calibrating
      ? ["left_wrist", "right_wrist", "left_ankle", "right_ankle"]
      : [];

  const leftWrist = point("left_wrist");
  const rightWrist = point("right_wrist");
  const handCenter = leftWrist && rightWrist ? midpoint2(leftWrist, rightWrist) : null;
  const sideMirror = facing === "right" ? 1 : -1;
  const handArrow = cue?.name === "hand_center_x" && handCenter && cameraView === "side"
    ? [cue.text.includes("ВПЕРЁД") ? sideMirror : -sideMirror, 0] as const
    : cue?.name === "hand_center_y" && handCenter
      ? [0, cue.text.includes("ВЫШЕ") ? -1 : 1] as const
      : null;

  return (
    <svg
      className="target-pose-svg engraving"
      viewBox="0 0 360 430"
      role="img"
      aria-label={`${title}. ${cameraView === "front" ? "Вид спереди" : "Вид сбоку"}${cue ? `. ${cue.text}` : calibrating ? ". Повтори позу на рисунке" : ""}`}
    >
      <rect width="360" height="430" rx="10" fill="#ead5a7" />
      <rect x="9" y="9" width="342" height="412" fill="none" stroke="#6a3e22" strokeWidth="2" />
      <rect x="15" y="15" width="330" height="400" fill="none" stroke="#9a6b3d" strokeWidth="1" />
      <path d="M22 34 C70 15, 96 18, 126 30 M238 30 C274 16, 312 18, 338 34" fill="none" stroke="#7e1f1a" strokeWidth="2" opacity=".8" />
      <text x="26" y="48" fill="#7e1f1a" fontFamily="Georgia, serif" fontSize="15" fontWeight="700">{title}</text>
      <text x="26" y="67" fill="#6a3e22" fontFamily="Georgia, serif" fontSize="11">
        FIGURA EXEMPLARIS · {cameraView === "front" ? "фронтальный ракурс" : "боковой ракурс"}
      </text>
      <line x1="28" y1="373" x2="332" y2="373" stroke="#6a3e22" strokeWidth="2" />

      <g className="fitted-engraving" transform={`translate(${figureX} ${figureY}) scale(${figureScale})`}>
      <EngravingFigure joints={joints} view={cameraView} facing={facing} />

      {swordGrip && swordTip && (
        <SwordDiagram grip={swordGrip} tip={swordTip} handSpan={Math.hypot(joints.left_wrist[0] - joints.right_wrist[0], joints.left_wrist[1] - joints.right_wrist[1])} />
      )}

      <g className="machine-overlay">
        {EDGES.map(([a, b]) => {
          const pa = point(a), pb = point(b);
          return pa && pb ? (
            <line key={`skeleton-${a}${b}`} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#a51d17" strokeWidth="1.1" strokeLinecap="round" opacity=".38" />
          ) : null;
        })}
        {KEY_POINTS.map((name) => {
          const p = point(name);
          return p ? <circle key={name} cx={p[0]} cy={p[1]} r="3.6" fill="#b8211b" stroke="#f0d9a7" strokeWidth="1.5" /> : null;
        })}
      </g>

      {focus.length > 0 && (
        <g className="target-focus" aria-hidden="true">
          {focus.map((name) => {
            const p = point(name);
            return p ? <circle key={name} cx={p[0]} cy={p[1]} r="11" /> : null;
          })}
          {handArrow && handCenter && (
            <g className="target-direction">
              <line
                x1={handCenter[0] - handArrow[0] * 62}
                y1={handCenter[1] - handArrow[1] * 62}
                x2={handCenter[0] - handArrow[0] * 20}
                y2={handCenter[1] - handArrow[1] * 20}
              />
              <path d={`M ${handCenter[0] - handArrow[0] * 20} ${handCenter[1] - handArrow[1] * 20} l ${-handArrow[0] * 11 - handArrow[1] * 7} ${-handArrow[1] * 11 + handArrow[0] * 7} M ${handCenter[0] - handArrow[0] * 20} ${handCenter[1] - handArrow[1] * 20} l ${-handArrow[0] * 11 + handArrow[1] * 7} ${-handArrow[1] * 11 - handArrow[0] * 7}`} />
            </g>
          )}
        </g>
      )}

      </g>
      <text x="28" y="390" fill="#4c321d" fontFamily="Georgia, serif" fontSize="12">Красные метки — контрольные суставы.</text>
      <text x="28" y="407" fill="#4c321d" fontFamily="Georgia, serif" fontSize="12">
        {cameraView === "front" ? "Повтори положение рук и ног." : "Повтори положение рук и ног."}
      </text>
    </svg>
  );
}

function SwordDiagram({ grip, tip, handSpan }: { grip: [number, number]; tip: [number, number]; handSpan: number }) {
  const length = Math.hypot(tip[0] - grip[0], tip[1] - grip[1]);
  const angle = Math.atan2(tip[1] - grip[1], tip[0] - grip[0]) * 180 / Math.PI + 90;
  const guard = -handSpan / 2 - 7;
  const pommel = handSpan / 2 + 9;
  return <g className="target-sword" aria-label={length < 12 ? "Меч направлен вдоль линии взгляда" : "Положение меча"}
    transform={`translate(${grip[0]} ${grip[1]}) rotate(${length < 1 ? 0 : angle})`} stroke="#342313" strokeLinejoin="round">
    <path d={`M -3 ${guard} L -2 ${-Math.max(12, length) + 7} L 0 ${-Math.max(12, length)} L 2 ${-Math.max(12, length) + 7} L 3 ${guard} Z`} fill="#f4e7c9" strokeWidth="1.5" />
    <path d={`M -12 ${guard} L 12 ${guard} M 0 ${guard + 2} L 0 ${pommel}`} fill="none" strokeWidth="3" strokeLinecap="round" />
    <circle cy={pommel} r="3" fill="#d1b684" strokeWidth="1.5" />
  </g>;
}

function focusJoints(feature: string): string[] {
  if (feature.startsWith("hand_")) return ["left_wrist", "right_wrist"];
  if (feature === "foot_distance") return ["left_ankle", "right_ankle"];
  if (feature === "pelvis_height") return ["left_hip", "right_hip"];
  if (feature === "torso_angle") return ["left_shoulder", "right_shoulder", "left_hip", "right_hip"];
  if (feature.startsWith("left_")) return [feature.includes("knee") ? "left_knee" : feature.includes("elbow") ? "left_elbow" : "left_ankle"];
  if (feature.startsWith("right_")) return [feature.includes("knee") ? "right_knee" : feature.includes("elbow") ? "right_elbow" : "right_ankle"];
  return [];
}

function midpoint2(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
