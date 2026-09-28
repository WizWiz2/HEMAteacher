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
  const shoulders = ls && rs ? midpoint2(ls, rs) : null;
  const hips = lh && rh ? midpoint2(lh, rh) : null;
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
        <filter id="ink-rough" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.15" />
        </filter>
      </defs>

      <text x="26" y="38" fill="#962820" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="25" fontWeight="700">{title}</text>
      <text x="26" y="59" fill="#66513c" fontFamily="PT Serif, Georgia, serif" fontSize="12">
        Целевая поза · {cameraView === "front" ? "вид спереди" : "вид сбоку"}
      </text>
      <line x1="28" y1="355" x2="332" y2="355" stroke="#745b40" strokeWidth="1" opacity=".55" />

      <g className="engraved-figure" filter="url(#ink-rough)">
        <BodySegment from={point("right_hip")} to={point("right_knee")} width={25} faded />
        <BodySegment from={point("right_knee")} to={point("right_ankle")} width={21} faded />
        <Foot ankle={point("right_ankle")} toe={point("right_foot_index")} heel={point("right_heel")} faded />

        <BodySegment from={point("right_shoulder")} to={point("right_elbow")} width={20} faded />
        <BodySegment from={point("right_elbow")} to={point("right_wrist")} width={16} faded />

        {shoulders && hips && <Torso shoulders={shoulders} hips={hips} />}
        {shoulders && nose && <Neck from={shoulders} to={nose} />}
        {nose && <Head center={nose} cameraView={cameraView} />}

        <BodySegment from={point("left_hip")} to={point("left_knee")} width={27} />
        <BodySegment from={point("left_knee")} to={point("left_ankle")} width={22} />
        <Foot ankle={point("left_ankle")} toe={point("left_foot_index")} heel={point("left_heel")} />

        <BodySegment from={point("left_shoulder")} to={point("left_elbow")} width={21} />
        <BodySegment from={point("left_elbow")} to={point("left_wrist")} width={17} />

        {ls && rs && <JointBar from={ls} to={rs} width={14} />}
        {lh && rh && <JointBar from={lh} to={rh} width={16} />}
      </g>

      {swordGrip && swordTip && (
        <g>
          <line x1={swordGrip[0]} y1={swordGrip[1]} x2={swordTip[0]} y2={swordTip[1]} stroke="#342313" strokeWidth="7" strokeLinecap="round" />
          <line x1={swordGrip[0] - 13} y1={swordGrip[1] + 3} x2={swordGrip[0] + 13} y2={swordGrip[1] - 3} stroke="#342313" strokeWidth="5" />
        </g>
      )}

      <g className="machine-overlay">
        {EDGES.map(([a, b]) => {
          const pa = point(a);
          const pb = point(b);
          return pa && pb ? (
            <line key={`skeleton-${a}${b}`} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#a51d17" strokeWidth="2.5" strokeLinecap="round" opacity=".9" />
          ) : null;
        })}
        {KEY_POINTS.map((name) => {
          const p = point(name);
          return p ? <circle key={name} cx={p[0]} cy={p[1]} r="5.3" fill="#b8211b" stroke="#f0d9a7" strokeWidth="1.4" /> : null;
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

      <text x="180" y="391" textAnchor="middle" fill="#66513c" fontFamily="PT Serif, Georgia, serif" fontSize="13">
        Красным отмечены опорные точки.
      </text>
      {cameraView === "front" && (
        <text x="180" y="409" textAnchor="middle" fill="#8a5d2c" fontFamily="PT Serif, Georgia, serif" fontSize="10">
          Глубина по одной камере оценивается мягче.
        </text>
      )}
    </svg>
  );
}

function BodySegment({ from, to, width, faded = false }: {
  from: [number, number] | null;
  to: [number, number] | null;
  width: number;
  faded?: boolean;
}) {
  if (!from || !to) return null;
  return (
    <g opacity={faded ? .76 : 1}>
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#382617" strokeWidth={width + 6} strokeLinecap="round" />
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#c7a56b" strokeWidth={width} strokeLinecap="round" />
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke="#80613d" strokeWidth="1.6" strokeDasharray="5 6" strokeLinecap="round" opacity=".72" />
    </g>
  );
}

function Torso({ shoulders, hips }: { shoulders: [number, number]; hips: [number, number] }) {
  return (
    <g>
      <line x1={shoulders[0]} y1={shoulders[1]} x2={hips[0]} y2={hips[1]} stroke="#382617" strokeWidth="61" strokeLinecap="round" />
      <line x1={shoulders[0]} y1={shoulders[1]} x2={hips[0]} y2={hips[1]} stroke="#b98e52" strokeWidth="53" strokeLinecap="round" />
      <line x1={shoulders[0]} y1={shoulders[1]} x2={hips[0]} y2={hips[1]} stroke="#745332" strokeWidth="2" strokeDasharray="6 7" opacity=".7" />
    </g>
  );
}

function Neck({ from, to }: { from: [number, number]; to: [number, number] }) {
  const end: [number, number] = [
    from[0] + (to[0] - from[0]) * .68,
    from[1] + (to[1] - from[1]) * .68,
  ];
  return <BodySegment from={from} to={end} width={15} />;
}

function Head({ center, cameraView }: { center: [number, number]; cameraView: CameraView }) {
  return (
    <g>
      <ellipse cx={center[0]} cy={center[1] - 4} rx={cameraView === "front" ? 23 : 19} ry="28" fill="#c8a66d" stroke="#382617" strokeWidth="5" />
      <path d={`M ${center[0]-12} ${center[1]-11} Q ${center[0]} ${center[1]-20} ${center[0]+13} ${center[1]-10}`} fill="none" stroke="#745332" strokeWidth="2" opacity=".75" />
    </g>
  );
}

function JointBar({ from, to, width }: { from: [number, number]; to: [number, number]; width: number }) {
  if (Math.hypot(to[0]-from[0], to[1]-from[1]) < 3) return null;
  return <BodySegment from={from} to={to} width={width} faded />;
}

function Foot({ ankle, toe, heel, faded = false }: {
  ankle: [number, number] | null;
  toe: [number, number] | null;
  heel: [number, number] | null;
  faded?: boolean;
}) {
  if (!ankle || !toe) return null;
  const back = heel ?? ankle;
  return (
    <g opacity={faded ? .76 : 1}>
      <line x1={back[0]} y1={back[1]} x2={toe[0]} y2={toe[1]} stroke="#382617" strokeWidth="13" strokeLinecap="round" />
      <line x1={back[0]} y1={back[1]} x2={toe[0]} y2={toe[1]} stroke="#9b7448" strokeWidth="8" strokeLinecap="round" />
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
