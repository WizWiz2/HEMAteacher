import type { Facing } from "../live/normalize";
import { targetPoseFor } from "../drill/posePresets";
import type { Checkpoint, TargetPose as TargetPoseData } from "../drill/types";

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

export function TargetPose({ checkpoint, facing }: { checkpoint: Checkpoint; facing: Facing }) {
  const pose = checkpoint.targetPose ?? targetPoseFor(checkpoint.targetPoseId);
  return (
    <figure className="target-card">
      {pose ? (
        <PoseSvg pose={pose} facing={facing} title={checkpoint.title} />
      ) : checkpoint.illustrationUrl ? (
        <img src={checkpoint.illustrationUrl} alt={checkpoint.title} />
      ) : (
        <div className="target-fallback">Нет визуального эталона</div>
      )}
      <figcaption>
        <strong>{checkpoint.title}</strong>
        {checkpoint.cue && <span className="target-cue">{checkpoint.cue}</span>}
      </figcaption>
    </figure>
  );
}

function PoseSvg({ pose, facing, title }: { pose: TargetPoseData; facing: Facing; title: string }) {
  const mirror = facing === "right" ? 1 : -1;
  const point = (name: string) => {
    const p = pose.landmarks[name];
    return p ? project(p.x * mirror, p.y) : null;
  };
  const nose = point("nose");
  const swordGrip = pose.sword ? project(pose.sword.grip.x * mirror, pose.sword.grip.y) : null;
  const swordTip = pose.sword ? project(pose.sword.tip.x * mirror, pose.sword.tip.y) : null;
  return (
    <svg className="target-pose-svg" viewBox="0 0 320 420" role="img" aria-label={title}>
      <rect width="320" height="420" rx="18" fill="#100e0c" />
      <line x1="20" y1="345" x2="300" y2="345" stroke="#3a332b" strokeWidth="3" />
      {EDGES.map(([a, b]) => {
        const pa = point(a);
        const pb = point(b);
        return pa && pb ? (
          <line key={a + b} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#e2c48a" strokeWidth="11" strokeLinecap="round" />
        ) : null;
      })}
      {nose && <circle cx={nose[0]} cy={nose[1] - 5} r="19" fill="#e2c48a" />}
      {Object.keys(pose.landmarks).filter((name) => /wrist|elbow|knee|ankle/.test(name)).map((name) => {
        const p = point(name);
        return p ? <circle key={name} cx={p[0]} cy={p[1]} r="6" fill="#d6a15c" /> : null;
      })}
      {swordGrip && swordTip && (
        <>
          <line x1={swordGrip[0]} y1={swordGrip[1]} x2={swordTip[0]} y2={swordTip[1]} stroke="#f3efe6" strokeWidth="6" strokeLinecap="round" />
          <circle cx={swordGrip[0]} cy={swordGrip[1]} r="7" fill="#d6a15c" />
        </>
      )}
      <text x="18" y="28" fill="#b7ad9e" fontSize="13">TARGET · боковой ракурс</text>
    </svg>
  );
}

function project(x: number, y: number): [number, number] {
  return [95 + (x + 0.8) * 82, 340 - (y + 1.1) * 98];
}
