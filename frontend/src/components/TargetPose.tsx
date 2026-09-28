import type { LiveCue } from "../drill/feedback";
import { targetPoseFor } from "../drill/posePresets";
import type { Checkpoint, TargetLandmark, TargetPose as TargetPoseData } from "../drill/types";
import type { CameraView, Facing } from "../live/normalize";

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

const LIMBS: Array<[string, string, number]> = [
  ["right_hip", "right_knee", 27],
  ["right_knee", "right_ankle", 23],
  ["right_shoulder", "right_elbow", 23],
  ["right_elbow", "right_wrist", 19],
  ["left_hip", "left_knee", 29],
  ["left_knee", "left_ankle", 24],
  ["left_shoulder", "left_elbow", 24],
  ["left_elbow", "left_wrist", 20],
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
  const point = (name: string) => {
    const value = pose.landmarks[name];
    return value ? projectLandmark(value, cameraView, facing) : null;
  };

  const nose = point("nose");
  const ls = point("left_shoulder");
  const rs = point("right_shoulder");
  const lh = point("left_hip");
  const rh = point("right_hip");

  const torso = ls && rs && lh && rh
    ? `${ls[0]},${ls[1]} ${rs[0]},${rs[1]} ${rh[0]},${rh[1]} ${lh[0]},${lh[1]}`
    : "";

  const swordGrip = pose.sword && cameraView === "side"
    ? projectXY(pose.sword.grip.x * (facing === "right" ? 1 : -1), pose.sword.grip.y, cameraView)
    : null;
  const swordTip = pose.sword && cameraView === "side"
    ? projectXY(pose.sword.tip.x * (facing === "right" ? 1 : -1), pose.sword.tip.y, cameraView)
    : null;

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
      <defs>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#3e2a18" strokeWidth="1.2" opacity=".55" />
        </pattern>
        <pattern id="clothHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(26)">
          <rect width="8" height="8" fill="#caa86f" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#6a492a" strokeWidth="1.1" opacity=".5" />
        </pattern>
        <filter id="roughInk" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale=".8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <rect width="360" height="430" rx="10" fill="#ead5a7" />
      <rect x="9" y="9" width="342" height="412" fill="none" stroke="#6a3e22" strokeWidth="2" />
      <rect x="15" y="15" width="330" height="400" fill="none" stroke="#9a6b3d" strokeWidth="1" />
      <path d="M22 34 C70 15, 96 18, 126 30 M238 30 C274 16, 312 18, 338 34" fill="none" stroke="#7e1f1a" strokeWidth="2" opacity=".8" />
      <text x="26" y="48" fill="#7e1f1a" fontFamily="Georgia, serif" fontSize="15" fontWeight="700">{title}</text>
      <text x="26" y="67" fill="#6a3e22" fontFamily="Georgia, serif" fontSize="11">
        FIGURA EXEMPLARIS · {cameraView === "front" ? "фронтальный ракурс" : "боковой ракурс"}
      </text>
      <line x1="28" y1="355" x2="332" y2="355" stroke="#6a3e22" strokeWidth="2" />

      <g filter="url(#roughInk)" opacity=".98">
        {LIMBS.slice(0,4).map(([a,b,width]) => (
          <EngravedLimb key={`rear-${a}-${b}`} from={point(a)} to={point(b)} width={width} faded />
        ))}

        {torso && (
          <polygon
            points={torso}
            fill="url(#hatch)"
            stroke="#3e2a18"
            strokeWidth="8"
            strokeLinejoin="round"
          />
        )}

        {ls && rs && <JointBridge from={ls} to={rs} width={16} />}
        {lh && rh && <JointBridge from={lh} to={rh} width={18} />}

        {nose && (
          <>
            <circle cx={nose[0]} cy={nose[1]-2} r="23" fill="#d5b47c" stroke="#3e2a18" strokeWidth="5" />
            <path
              d={`M ${nose[0]-12} ${nose[1]-4} q 12 -7 25 1 M ${nose[0]-8} ${nose[1]+7} q 9 5 18 0`}
              fill="none"
              stroke="#3e2a18"
              strokeWidth="2"
            />
          </>
        )}

        {LIMBS.slice(4).map(([a,b,width]) => (
          <EngravedLimb key={`front-${a}-${b}`} from={point(a)} to={point(b)} width={width} />
        ))}

        <EngravedFoot ankle={point("right_ankle")} toe={point("right_foot_index")} heel={point("right_heel")} faded />
        <EngravedFoot ankle={point("left_ankle")} toe={point("left_foot_index")} heel={point("left_heel")} />

        {["left_elbow","right_elbow","left_knee","right_knee"].map((name) => {
          const p = point(name);
          return p ? <circle key={name} cx={p[0]} cy={p[1]} r="8" fill="url(#clothHatch)" stroke="#3e2a18" strokeWidth="3" /> : null;
        })}
      </g>

      {swordGrip && swordTip && (
        <g filter="url(#roughInk)">
          <line x1={swordGrip[0]} y1={swordGrip[1]} x2={swordTip[0]} y2={swordTip[1]} stroke="#342313" strokeWidth="8" strokeLinecap="round" />
          <line x1={swordGrip[0]-14} y1={swordGrip[1]+3} x2={swordGrip[0]+14} y2={swordGrip[1]-3} stroke="#342313" strokeWidth="5" />
        </g>
      )}

      <g className="machine-overlay">
        {EDGES.map(([a, b]) => {
          const pa = point(a), pb = point(b);
          return pa && pb ? (
            <line key={`skeleton-${a}${b}`} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#a51d17" strokeWidth="2.6" strokeLinecap="round" opacity=".92" />
          ) : null;
        })}
        {KEY_POINTS.map((name) => {
          const p = point(name);
          return p ? <circle key={name} cx={p[0]} cy={p[1]} r="5.7" fill="#b8211b" stroke="#f0d9a7" strokeWidth="1.5" /> : null;
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

      <text x="28" y="390" fill="#4c321d" fontFamily="Georgia, serif" fontSize="12">Красные линии — то, что сравнивает система.</text>
      <text x="28" y="407" fill="#4c321d" fontFamily="Georgia, serif" fontSize="12">
        {cameraView === "front" ? "Фронтальный режим по глубине мягче." : "Гравюра и machine target — одна и та же поза."}
      </text>
    </svg>
  );
}

function EngravedLimb({
  from,
  to,
  width,
  faded = false,
}: {
  from: [number, number] | null;
  to: [number, number] | null;
  width: number;
  faded?: boolean;
}) {
  if (!from || !to) return null;
  return (
    <g opacity={faded ? .72 : 1}>
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#3e2a18" strokeWidth={width + 8} strokeLinecap="round" />
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="url(#clothHatch)" strokeWidth={width} strokeLinecap="round" />
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#4a311d" strokeWidth="1.4" strokeDasharray="4 6" strokeLinecap="round" opacity=".72" />
    </g>
  );
}

function JointBridge({
  from,
  to,
  width,
}: {
  from: [number, number];
  to: [number, number];
  width: number;
}) {
  if (Math.hypot(to[0]-from[0], to[1]-from[1]) < 2) return null;
  return (
    <g opacity=".9">
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#3e2a18" strokeWidth={width + 6} strokeLinecap="round" />
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="url(#hatch)" strokeWidth={width} strokeLinecap="round" />
    </g>
  );
}

function EngravedFoot({
  ankle,
  toe,
  heel,
  faded = false,
}: {
  ankle: [number, number] | null;
  toe: [number, number] | null;
  heel: [number, number] | null;
  faded?: boolean;
}) {
  if (!ankle || !toe) return null;
  const back = heel ?? ankle;
  return (
    <g opacity={faded ? .72 : 1}>
      <line x1={back[0]} y1={back[1]} x2={toe[0]} y2={toe[1]} stroke="#3e2a18" strokeWidth="16" strokeLinecap="round" />
      <line x1={back[0]} y1={back[1]} x2={toe[0]} y2={toe[1]} stroke="#8c633c" strokeWidth="10" strokeLinecap="round" />
    </g>
  );
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

function projectLandmark(point: TargetLandmark, cameraView: CameraView, facing: Facing): [number, number] {
  const horizontal = cameraView === "front"
    ? -point.z
    : point.x * (facing === "right" ? 1 : -1);
  return projectXY(horizontal, point.y, cameraView);
}

function projectXY(horizontal: number, y: number, cameraView: CameraView): [number, number] {
  const xScale = cameraView === "front" ? 180 : 82;
  return [180 + horizontal * xScale, 345 - (y + 1.1) * 97];
}

function midpoint2(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
