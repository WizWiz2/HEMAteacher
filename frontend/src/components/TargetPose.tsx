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

const KEY_POINTS = ["left_wrist", "right_wrist", "left_elbow", "right_elbow", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"];

export function TargetPose({ checkpoint, facing }: { checkpoint: Checkpoint; facing: Facing }) {
  const pose = checkpoint.targetPose ?? targetPoseFor(checkpoint.targetPoseId);
  return (
    <figure className="target-card manuscript-panel">
      {pose ? (
        <EngravingPose pose={pose} facing={facing} title={checkpoint.title} />
      ) : checkpoint.illustrationUrl ? (
        <img src={checkpoint.illustrationUrl} alt={checkpoint.title} />
      ) : (
        <div className="target-fallback">Нет визуального эталона</div>
      )}
      <figcaption>
        <span className="rubric">Контрольная точка</span>
        <strong>{checkpoint.title}</strong>
        {checkpoint.cue && <span className="target-cue">{checkpoint.cue}</span>}
      </figcaption>
    </figure>
  );
}

function EngravingPose({ pose, facing, title }: { pose: TargetPoseData; facing: Facing; title: string }) {
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

  const torso = ls && rs && lh && rh
    ? `${ls[0]},${ls[1]} ${rs[0]},${rs[1]} ${rh[0]},${rh[1]} ${lh[0]},${lh[1]}`
    : "";

  return (
    <svg className="target-pose-svg engraving" viewBox="0 0 360 430" role="img" aria-label={title}>
      <defs>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#3e2a18" strokeWidth="1.2" opacity="0.55" />
        </pattern>
        <filter id="roughInk">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <rect width="360" height="430" rx="10" fill="#ead5a7" />
      <rect x="9" y="9" width="342" height="412" fill="none" stroke="#6a3e22" strokeWidth="2" />
      <rect x="15" y="15" width="330" height="400" fill="none" stroke="#9a6b3d" strokeWidth="1" />
      <path d="M22 34 C70 15, 96 18, 126 30 M238 30 C274 16, 312 18, 338 34" fill="none" stroke="#7e1f1a" strokeWidth="2" opacity="0.8" />
      <text x="26" y="48" fill="#7e1f1a" fontFamily="Georgia, serif" fontSize="15" fontWeight="700">{title}</text>
      <text x="26" y="67" fill="#6a3e22" fontFamily="Georgia, serif" fontSize="11">FIGURA EXEMPLARIS · боковой ракурс</text>
      <line x1="28" y1="355" x2="332" y2="355" stroke="#6a3e22" strokeWidth="2" />

      <g filter="url(#roughInk)" opacity="0.96">
        {torso && <polygon points={torso} fill="url(#hatch)" stroke="#3e2a18" strokeWidth="8" strokeLinejoin="round" />}
        {EDGES.filter(([a,b]) => !["left_shoulder,right_shoulder","left_shoulder,left_hip","right_shoulder,right_hip","left_hip,right_hip"].includes(`${a},${b}`)).map(([a, b]) => {
          const pa = point(a), pb = point(b);
          return pa && pb ? (
            <line key={"body-"+a+b} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#3e2a18" strokeWidth="18" strokeLinecap="round" />
          ) : null;
        })}
        {nose && (
          <>
            <circle cx={nose[0]} cy={nose[1]-2} r="23" fill="#d5b47c" stroke="#3e2a18" strokeWidth="5" />
            <path d={`M ${nose[0]-12} ${nose[1]-4} q 12 -7 25 1 M ${nose[0]-8} ${nose[1]+7} q 9 5 18 0`} fill="none" stroke="#3e2a18" strokeWidth="2" />
          </>
        )}
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
            <line key={"skeleton-"+a+b} x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} stroke="#a51d17" strokeWidth="2.6" strokeLinecap="round" opacity="0.92" />
          ) : null;
        })}
        {KEY_POINTS.map((name) => {
          const p = point(name);
          return p ? <circle key={name} cx={p[0]} cy={p[1]} r="5.7" fill="#b8211b" stroke="#f0d9a7" strokeWidth="1.5" /> : null;
        })}
      </g>

      <text x="28" y="390" fill="#4c321d" fontFamily="Georgia, serif" fontSize="12">Красные линии — то, что сравнивает система.</text>
      <text x="28" y="407" fill="#4c321d" fontFamily="Georgia, serif" fontSize="12">Гравюра и machine target — одна и та же поза.</text>
    </svg>
  );
}

function project(x: number, y: number): [number, number] {
  return [110 + (x + 0.8) * 82, 345 - (y + 1.1) * 97];
}
