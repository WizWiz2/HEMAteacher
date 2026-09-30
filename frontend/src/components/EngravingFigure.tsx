import type { TargetPose } from "../drill/types";
import type { CameraView, Facing } from "../live/normalize";
import { retargetPose } from "../live/anatomy";
import { solveElbow } from "../drill/armGeometry";
import { targetPoseFor } from "../drill/posePresets";

type Point = [number, number];
type Part = keyof typeof CROPS;
const CROPS = {
  front: [156, 27, 430, 648], side: [756, 36, 342, 648],
  head: [720, 89, 275, 425], upperArm: [225, 713, 313, 327],
  forearm: [815, 724, 226, 505], hand: [735, 710, 240, 183],
  thigh: [41, 1008, 300, 457], calf: [441, 1021, 152, 435],
  shoe: [669, 1237, 335, 166],
} as const;

// Cropping the original artwork in SVG keeps all parts on one cached texture.
function Plate({ part, x, y, width, height }: {
  part: Part; x: number; y: number; width: number; height: number;
}) {
  const [cx, cy, cw, ch] = CROPS[part];
  const revised = ["front", "side", "upperArm", "forearm"].includes(part);
  return <svg x={x} y={y} width={width} height={height}
    viewBox={`${cx - 3} ${cy - 3} ${cw + 6} ${ch + 6}`} preserveAspectRatio="none" overflow="hidden">
    <image href={`${import.meta.env.BASE_URL}theme/${revised ? "engraving-torso-sleeves" : "engraving-anatomy"}.png`}
      width={revised ? 1254 : 1024} height={revised ? 1254 : 1536} />
  </svg>;
}

function Segment({ from, to, part, width }: { from: Point; to: Point; part: Part; width: number }) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI - 90;
  return <g transform={`translate(${from[0]} ${from[1]}) rotate(${angle})`}>
    <Plate part={part} x={-width / 2} y={-5} width={width} height={length + 10} />
  </g>;
}

export function engravingProjection(horizontal: number, y: number, view: CameraView): Point {
  return [180 + horizontal * (view === "front" ? 90 : 80), 244 - y * 80];
}

// The training coordinates describe a centre-line, not the visible body surface.
// Retarget only this illustration: the camera analysis and pose data stay intact.
export function engravingJoints(pose: TargetPose, view: CameraView, facing: Facing): Record<string, Point> {
  const points: Record<string, Point> = {};
  const mirror = facing === "right" ? 1 : -1;
  // A fixed anatomical illustration rig follows the pose's joint directions.
  // Calibrated measurements belong to scoring, not to stretching painted limbs.
  const drawingPose = retargetPose(pose, {
    version: 1, updatedAt: "illustration", samples: 1,
    shoulderWidth: .6, hipWidth: .36,
    leftUpperArm: .525, rightUpperArm: .525, leftForearm: .4625, rightForearm: .4625,
    leftThigh: .83, rightThigh: .83, leftShin: .78, rightShin: .78,
    leftFoot: .2, rightFoot: .2,
  });
  for (const [name, p] of Object.entries(drawingPose.landmarks)) {
    points[name] = engravingProjection(view === "front" ? -p.z : p.x * mirror, p.y, view);
  }
  if (view === "front" && points.left_shoulder && points.right_shoulder) {
    const center = (points.left_shoulder[0] + points.right_shoulder[0]) / 2;
    const span = Math.abs(points.left_shoulder[0] - points.right_shoulder[0]);
    const scale = 54 / Math.max(span, 1);
    for (const p of Object.values(points)) p[0] = 180 + (p[0] - center) * scale;
    for (const side of ["left", "right"]) {
      const hip = points[`${side}_hip`];
      if (!hip) continue;
      const offset = 180 + (side === "left" ? 18 : -18) - hip[0];
      for (const joint of ["hip", "knee", "ankle", "heel", "foot_index"]) {
        if (points[`${side}_${joint}`]) points[`${side}_${joint}`][0] += offset;
      }
    }
  }
  for (const side of ["left", "right"]) {
    const direction = side === "left" ? 1 : -1;
    const shoulder = points[`${side}_shoulder`], hip = points[`${side}_hip`];
    if (shoulder) shoulder[1] += 12;
    if (view === "side") {
      if (shoulder) shoulder[0] -= direction * 10 * mirror;
      if (hip) hip[0] += direction * 10 * mirror;
      for (const name of ["knee", "ankle", "heel", "foot_index"]) {
        if (points[`${side}_${name}`]) points[`${side}_${name}`][0] += direction * 5 * mirror;
      }
    }
  }
  // This guard uses a spatial arm rig: forcing equal SCREEN lengths would
  // undo foreshortening and turn a folded elbow into an outward wing.
  if (pose.illustration === "right-shoulder-guard") {
    const reference = targetPoseFor("vom-tag")!;
    for (const side of ["left", "right"]) {
      const direction = side === "left" ? 1 : -1;
      const shoulder = { x: .02 - direction * .125, y: 1, z: -direction * .3, visibility: 1 };
      const wrist = reference.landmarks[`${side}_wrist`];
      const pole = { x: side === "left" ? .4 : .15, y: .3, z: side === "left" ? -.08 : .36, visibility: 1 };
      const elbow = solveElbow(shoulder, wrist, pole);
      for (const [name, p] of Object.entries({ shoulder, elbow, wrist })) {
        const projected = engravingProjection(view === "front" ? -p.z : p.x * mirror, p.y, view);
        points[`${side}_${name}`] = [projected[0], projected[1] + 12];
      }
    }
    return points;
  }
  // Solve a shared reachable grip first. Keep room for a natural elbow bend
  // instead of lengthening either arm to reach an impossible calibrated point.
  if (pose.sword && points.left_wrist && points.right_wrist) {
    let x = (points.left_wrist[0] + points.right_wrist[0]) / 2;
    let y = (points.left_wrist[1] + points.right_wrist[1]) / 2;
    for (let i = 0; i < 4; i++) for (const side of ["left", "right"]) {
      const shoulder = points[`${side}_shoulder`];
      if (!shoulder) continue;
      const dx = x - shoulder[0], dy = y - shoulder[1], distance = Math.hypot(dx, dy);
      if (distance > 69) { x = shoulder[0] + dx / distance * 69; y = shoulder[1] + dy / distance * 69; }
    }
    const dx = view === "front" ? 0 : (pose.sword.tip.x - pose.sword.grip.x) * mirror;
    const dy = -(pose.sword.tip.y - pose.sword.grip.y);
    const length = Math.hypot(dx, dy) || 1;
    points.left_wrist = [x + dx / length * 5, y + dy / length * 5];
    points.right_wrist = [x - dx / length * 5, y - dy / length * 5];
  }
  for (const side of ["left", "right"]) {
    const direction = side === "left" ? 1 : -1;
    const shoulder = points[`${side}_shoulder`];
    const wrist = points[`${side}_wrist`];
    const elbow = points[`${side}_elbow`];
    if (shoulder && wrist && elbow) {
      // Preserve the target hand position, with a human upper-arm/forearm ratio.
      // Choose the bend nearest the original elbow; in a frontal view bend outwards.
      const dx = wrist[0] - shoulder[0], dy = wrist[1] - shoulder[1];
      const distance = Math.max(1, Math.hypot(dx, dy));
      const upper = 42, lower = 37;
      const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
      const height = Math.sqrt(Math.max(0, upper * upper - along * along));
      const bx = shoulder[0] + dx * along / distance, by = shoulder[1] + dy * along / distance;
      const candidates: Point[] = [
        [bx - dy * height / distance, by + dx * height / distance],
        [bx + dy * height / distance, by - dx * height / distance],
      ];
      points[`${side}_elbow`] = candidates.sort((a, b) => view === "front"
        ? direction * (b[0] - a[0])
        : Math.hypot(a[0] - elbow[0], a[1] - elbow[1]) - Math.hypot(b[0] - elbow[0], b[1] - elbow[1]))[0];
    }
  }
  return points;
}

export function EngravingFigure({ joints, view, facing }: {
  joints: Record<string, Point>; view: CameraView; facing: Facing;
}) {
  const ls = joints.left_shoulder, rs = joints.right_shoulder;
  const lh = joints.left_hip, rh = joints.right_hip;
  if (!ls || !rs || !lh || !rh) return null;
  const shoulder: Point = [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2 - 12];
  const hip: Point = [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2];
  const torsoLength = Math.hypot(hip[0] - shoulder[0], hip[1] - shoulder[1]);
  const torsoAngle = Math.atan2(hip[1] - shoulder[1], hip[0] - shoulder[0]) * 180 / Math.PI - 90;
  const limbs = (side: string, arms: boolean) => {
    const a = joints[`${side}_${arms ? "shoulder" : "hip"}`];
    const b = joints[`${side}_${arms ? "elbow" : "knee"}`];
    const c = joints[`${side}_${arms ? "wrist" : "ankle"}`];
    if (!a || !b || !c) return null;
    return <g>
      <Segment from={a} to={b} part={arms ? "upperArm" : "thigh"} width={arms ? 28 : 36} />
      <Segment from={b} to={c} part={arms ? "forearm" : "calf"} width={arms ? 19 : 23} />
      {arms
        ? <g transform={`translate(${c[0]} ${c[1]}) rotate(${Math.atan2(c[1] - b[1], c[0] - b[0]) * 180 / Math.PI}) scale(1 ${side === "right" ? -1 : 1})`}>
            <Plate part="hand" x={-9} y={-6.5} width={18} height={13} />
          </g>
        : <g transform={`translate(${c[0]} ${c[1]}) scale(${view === "front" ? (side === "right" ? -1 : 1) : facing === "left" ? -1 : 1} 1)`}>
            <Plate part="shoe" x={-10} y={-7} width={34} height={17} />
          </g>}
    </g>;
  };
  return <g className="engraved-figure">
    {limbs("right", false)}
    {limbs("left", false)}
    {view === "side" && limbs("right", true)}
    <g transform={`translate(${shoulder[0]} ${shoulder[1]}) rotate(${torsoAngle}) scale(${view === "side" && facing === "left" ? -1 : 1} 1)`}>
      <Plate part="head" x={-15} y={-48} width={31} height={45} />
      <Plate part={view === "front" ? "front" : "side"} x={view === "front" ? -33 : -24} y={view === "front" ? -18 : -21}
        width={view === "front" ? 66 : 51} height={torsoLength + 30} />
    </g>
    {view === "front" && limbs("right", true)}
    {limbs("left", true)}
  </g>;
}
