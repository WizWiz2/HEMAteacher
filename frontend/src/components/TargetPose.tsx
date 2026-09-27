import type { Facing } from "../live/normalize";
import { targetPoseFor } from "../drill/posePresets";
import type { Checkpoint, TargetPose as TargetPoseData } from "../drill/types";
import type { LiveCue } from "../drill/feedback";

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
];

const KEY_POINTS = ["left_wrist", "right_wrist", "left_elbow", "right_elbow", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"];

export function TargetPose({ checkpoint, facing, cue, calibrating = false }: {
  checkpoint: Checkpoint; facing: Facing; cue?: LiveCue | null; calibrating?: boolean;
}) {
  const pose = checkpoint.targetPose ?? targetPoseFor(checkpoint.targetPoseId);
  const correction = cue && !cue.ok ? cue : null;
  return (
    <figure className={`target-card manuscript-panel ${correction || calibrating ? "target-guiding" : ""}`}>
      {pose ? (
        <EngravingPose pose={pose} facing={facing} title={checkpoint.title} cue={correction} calibrating={calibrating} />
      ) : checkpoint.illustrationUrl ? (
        <img src={checkpoint.illustrationUrl} alt={checkpoint.title} />
      ) : (
        <div className="target-fallback">Нет визуального эталона</div>
      )}
      <figcaption>
        <span className="rubric">{calibrating ? "Повтори позу" : correction ? "Что поправить" : "Контрольная точка"}</span>
        <strong>{checkpoint.title}</strong>
        {(correction || calibrating || checkpoint.cue) && <span className="target-cue">{calibrating ? "Встань боком как на рисунке и задержись" : correction?.text ?? checkpoint.cue}</span>}
      </figcaption>
    </figure>
  );
}

function EngravingPose({ pose, facing, title, cue, calibrating }: {
  pose: TargetPoseData; facing: Facing; title: string; cue: LiveCue | null; calibrating: boolean;
}) {
  const mirror = facing === "right" ? 1 : -1;
  const point = (name: string) => {
    const p = pose.landmarks[name];
    return p ? project(p.x * mirror, p.y) : null;
  };
  const nose = point("nose");
  const ls = point("left_shoulder");
  const rs = point("right_shoulder");
  const lh = point("left_hip");
  const rh = point("right_hip");
  const swordGrip = pose.sword ? project(pose.sword.grip.x * mirror, pose.sword.grip.y) : null;
  const swordTip = pose.sword ? project(pose.sword.tip.x * mirror, pose.sword.tip.y) : null;

  const shoulders: [number, number] | null = ls && rs ? [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2] : null;
  const hips: [number, number] | null = lh && rh ? [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2] : null;
  const limb = (a: string, b: string, asset: string, width: number) => {
    const from = point(a), to = point(b);
    return from && to ? <EngravedSegment key={a+b} from={from} to={to} asset={asset} width={width} /> : null;
  };
  const focus = cue ? focusJoints(cue.name) : calibrating ? ["left_wrist", "right_wrist", "left_ankle", "right_ankle"] : [];
  const handCenter = point("left_wrist") && point("right_wrist")
    ? [(point("left_wrist")![0] + point("right_wrist")![0]) / 2, (point("left_wrist")![1] + point("right_wrist")![1]) / 2]
    : null;
  const handArrow = cue?.name === "hand_center_x" && handCenter
    ? [cue.text.includes("ВПЕРЁД") ? mirror : -mirror, 0]
    : cue?.name === "hand_center_y" && handCenter
      ? [0, cue.text.includes("ВЫШЕ") ? -1 : 1]
      : null;

  return (
    <svg className="target-pose-svg engraving" viewBox="0 0 360 430" role="img" aria-label={`${title}${cue ? `. ${cue.text}` : calibrating ? ". Повтори позу на рисунке" : ""}`}>
      <text x="26" y="38" fill="#962820" fontFamily="Cormorant Garamond, Georgia, serif" fontSize="25" fontWeight="700">{title}</text>
      <text x="26" y="59" fill="#66513c" fontFamily="PT Serif, Georgia, serif" fontSize="12">Целевая поза · вид сбоку</text>
      <line x1="28" y1="355" x2="332" y2="355" stroke="#745b40" strokeWidth="1" opacity="0.55" />

      <g className="engraved-figure">
        {(['right', 'left'] as const).map((side) => (
          <g key={side} opacity={side === 'right' ? .82 : 1}>
            {limb(`${side}_hip`, `${side}_knee`, 'rig-hose', 29)}
            {limb(`${side}_knee`, `${side}_ankle`, 'rig-hose', 23)}
            {point(`${side}_ankle`) && (
              <g transform={`translate(${point(`${side}_ankle`)!.join(' ')}) scale(${mirror} 1)`}>
                <image href={`${import.meta.env.BASE_URL}theme/rig-boot.webp`} x="-10" y="-5" width="35" height="19" preserveAspectRatio="none" />
              </g>
            )}
          </g>
        ))}
        {limb('right_shoulder', 'right_elbow', 'rig-sleeve', 28)}
        {limb('right_elbow', 'right_wrist', 'rig-sleeve', 23)}
        {shoulders && hips && (
          <EngravedSegment from={[shoulders[0], shoulders[1] - 9]} to={[hips[0], hips[1] + 7]} asset="rig-torso" width={63} mirror={mirror} />
        )}
        {nose && <g transform={`translate(${nose.join(' ')}) scale(${mirror} 1)`}>
          <image href={`${import.meta.env.BASE_URL}theme/rig-head.webp`} x="-24" y="-28" width="48" height="51" preserveAspectRatio="xMidYMid meet" />
        </g>}
        {limb('left_shoulder', 'left_elbow', 'rig-sleeve', 28)}
        {limb('left_elbow', 'left_wrist', 'rig-sleeve', 23)}
      </g>

      {swordGrip && swordTip && (
        <g>
          <line x1={swordGrip[0]} y1={swordGrip[1]} x2={swordTip[0]} y2={swordTip[1]} stroke="#342313" strokeWidth="8" strokeLinecap="round" />
          <line x1={swordGrip[0]-14} y1={swordGrip[1]+3} x2={swordGrip[0]+14} y2={swordGrip[1]-3} stroke="#342313" strokeWidth="5" />
        </g>
      )}

      <g className="machine-overlay">
        {EDGES.map(([a, b]) => {
          const pa = point(a), pb = point(b);
          return pa && pb ? (
            <line key={"skeleton-"+a+b} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#a51d17" strokeWidth="2.6" strokeLinecap="round" opacity="0.92" />
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
              <line x1={handCenter[0]-handArrow[0]*62} y1={handCenter[1]-handArrow[1]*62}
                x2={handCenter[0]-handArrow[0]*20} y2={handCenter[1]-handArrow[1]*20} />
              <path d={`M ${handCenter[0]-handArrow[0]*20} ${handCenter[1]-handArrow[1]*20} l ${-handArrow[0]*11-handArrow[1]*7} ${-handArrow[1]*11+handArrow[0]*7} M ${handCenter[0]-handArrow[0]*20} ${handCenter[1]-handArrow[1]*20} l ${-handArrow[0]*11+handArrow[1]*7} ${-handArrow[1]*11-handArrow[0]*7}`} />
            </g>
          )}
        </g>
      )}

      <text x="180" y="391" textAnchor="middle" fill="#66513c" fontFamily="PT Serif, Georgia, serif" fontSize="13">Красным отмечены опорные точки.</text>
    </svg>
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

function project(x: number, y: number): [number, number] {
  return [110 + (x + 0.8) * 82, 345 - (y + 1.1) * 97];
}

/** Raster clothing follows the same endpoints as the measured target skeleton. */
function EngravedSegment({ from, to, asset, width, mirror = 1 }: {
  from: [number, number]; to: [number, number]; asset: string; width: number; mirror?: number;
}) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length < 1) return null;
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI - 90;
  return <image
    href={`${import.meta.env.BASE_URL}theme/${asset}.webp`}
    transform={`translate(${from.join(' ')}) rotate(${angle}) scale(${mirror} 1)`}
    x={-width / 2} y={-length * .04} width={width} height={length * 1.08}
    preserveAspectRatio="none"
  />;
}
