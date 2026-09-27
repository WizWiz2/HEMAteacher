import type { TargetPose, TrackingMode } from "../drill/types";
import type { RawPose, Vec3 } from "./landmarks";

export interface BodyProfile {
  version: 1;
  updatedAt: string;
  samples: number;
  shoulderWidth?: number;
  hipWidth?: number;
  leftUpperArm?: number;
  rightUpperArm?: number;
  leftForearm?: number;
  rightForearm?: number;
  leftThigh?: number;
  rightThigh?: number;
  leftShin?: number;
  rightShin?: number;
  leftFoot?: number;
  rightFoot?: number;
}

type Metric = Exclude<keyof BodyProfile, "version" | "updatedAt" | "samples">;

const METRICS: Metric[] = [
  "shoulderWidth", "hipWidth",
  "leftUpperArm", "rightUpperArm", "leftForearm", "rightForearm",
  "leftThigh", "rightThigh", "leftShin", "rightShin", "leftFoot", "rightFoot",
];

export class BodyProfileCalibrator {
  private readonly values = new Map<Metric, number[]>();
  push(pose: RawPose): void {
    const measured = measureBodyRatios(pose);
    for (const metric of METRICS) {
      const value = measured[metric];
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
      const list = this.values.get(metric) ?? [];
      list.push(value);
      if (list.length > 90) list.shift();
      this.values.set(metric, list);
    }
  }

  reset(): void {
    this.values.clear();
  }

  ready(mode: TrackingMode, minimumSamples = 12): boolean {
    const enoughEitherSide = (left: Metric, right: Metric) =>
      Math.max(this.values.get(left)?.length ?? 0, this.values.get(right)?.length ?? 0) >= minimumSamples;

    const upperReady =
      enoughEitherSide("leftUpperArm", "rightUpperArm") &&
      enoughEitherSide("leftForearm", "rightForearm");
    if (mode === "upper_body") return upperReady;

    return (
      upperReady &&
      enoughEitherSide("leftThigh", "rightThigh") &&
      enoughEitherSide("leftShin", "rightShin")
    );
  }

  build(previous: BodyProfile | null = null): BodyProfile | null {
    const patch: Partial<BodyProfile> = {};
    let sampleCount = 0;
    for (const metric of METRICS) {
      const values = this.values.get(metric) ?? [];
      if (values.length < 4) continue;
      (patch as Partial<Record<Metric, number>>)[metric] = median(values);
      sampleCount = Math.max(sampleCount, values.length);
    }
    if (sampleCount === 0 && !previous) return null;

    const next: BodyProfile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      samples: Math.max(previous?.samples ?? 0, sampleCount),
      ...previous,
      ...patch,
    };

    mirrorMissingBilateral(next);
    if (!previous) return next;
    const blended = blendProfiles(previous, next, 0.28);
    mirrorMissingBilateral(blended);
    return blended;
  }
}

export function profileCoverage(profile: BodyProfile | null, mode: TrackingMode): number {
  if (!profile) return 0;
  const groups: Array<[Metric, Metric]> = [
    ["leftUpperArm", "rightUpperArm"],
    ["leftForearm", "rightForearm"],
  ];
  if (mode === "full_body") {
    groups.push(["leftThigh", "rightThigh"], ["leftShin", "rightShin"]);
  }
  const present = groups.filter(([left, right]) =>
    typeof profile[left] === "number" || typeof profile[right] === "number",
  ).length;
  return present / groups.length;
}

export function retargetPose(target: TargetPose, profile: BodyProfile | null): TargetPose {
  if (!profile) return clonePose(target);
  const original = target.landmarks;
  const landmarks = Object.fromEntries(
    Object.entries(original).map(([name, point]) => [name, { ...point }]),
  );

  const leftHip = original.left_hip;
  const rightHip = original.right_hip;
  const leftShoulder = original.left_shoulder;
  const rightShoulder = original.right_shoulder;
  if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return clonePose(target);

  const hipCenter = midpoint(leftHip, rightHip);
  const shoulderCenter0 = midpoint(leftShoulder, rightShoulder);
  const torsoDirection = unit(sub(shoulderCenter0, hipCenter));
  const shoulderCenter = add(hipCenter, scale(torsoDirection, 1));

  const hipAxis = unit(sub(leftHip, rightHip));
  const shoulderAxis = unit(sub(leftShoulder, rightShoulder));
  const hipWidth = profile.hipWidth ?? distance(leftHip, rightHip);
  const shoulderWidth = profile.shoulderWidth ?? distance(leftShoulder, rightShoulder);

  landmarks.left_hip = withVisibility(add(hipCenter, scale(hipAxis, hipWidth / 2)), leftHip.visibility);
  landmarks.right_hip = withVisibility(add(hipCenter, scale(hipAxis, -hipWidth / 2)), rightHip.visibility);
  landmarks.left_shoulder = withVisibility(add(shoulderCenter, scale(shoulderAxis, shoulderWidth / 2)), leftShoulder.visibility);
  landmarks.right_shoulder = withVisibility(add(shoulderCenter, scale(shoulderAxis, -shoulderWidth / 2)), rightShoulder.visibility);

  retargetChain(landmarks, original, "left_shoulder", "left_elbow", "left_wrist", profile.leftUpperArm, profile.leftForearm);
  retargetChain(landmarks, original, "right_shoulder", "right_elbow", "right_wrist", profile.rightUpperArm, profile.rightForearm);
  retargetChain(landmarks, original, "left_hip", "left_knee", "left_ankle", profile.leftThigh, profile.leftShin);
  retargetChain(landmarks, original, "right_hip", "right_knee", "right_ankle", profile.rightThigh, profile.rightShin);

  retargetFoot(landmarks, original, "left_ankle", "left_foot_index", "left_heel", profile.leftFoot);
  retargetFoot(landmarks, original, "right_ankle", "right_foot_index", "right_heel", profile.rightFoot);

  if (original.nose) {
    const delta = sub(shoulderCenter, shoulderCenter0);
    landmarks.nose = withVisibility(add(original.nose, delta), original.nose.visibility);
  }

  const sword = target.sword ? { grip: { ...target.sword.grip }, tip: { ...target.sword.tip } } : undefined;
  if (sword && original.left_wrist && original.right_wrist && landmarks.left_wrist && landmarks.right_wrist) {
    const oldHands = midpoint(original.left_wrist, original.right_wrist);
    const newHands = midpoint(landmarks.left_wrist, landmarks.right_wrist);
    const dx = newHands.x - oldHands.x;
    const dy = newHands.y - oldHands.y;
    sword.grip.x += dx;
    sword.grip.y += dy;
    sword.tip.x += dx;
    sword.tip.y += dy;
  }

  return { landmarks, sword };
}

export function measureBodyRatios(pose: RawPose): Partial<BodyProfile> {
  const p = (name: string) => {
    const value = pose.landmarks[name];
    return value && value.visibility >= 0.55 ? value : null;
  };
  const ls = p("left_shoulder"), rs = p("right_shoulder");
  const le = p("left_elbow"), re = p("right_elbow");
  const lw = p("left_wrist"), rw = p("right_wrist");
  const lh = p("left_hip"), rh = p("right_hip");
  const lk = p("left_knee"), rk = p("right_knee");
  const la = p("left_ankle"), ra = p("right_ankle");
  const lf = p("left_foot_index"), rf = p("right_foot_index");

  return {
    shoulderWidth: d(ls, rs),
    hipWidth: d(lh, rh),
    leftUpperArm: d(ls, le),
    rightUpperArm: d(rs, re),
    leftForearm: d(le, lw),
    rightForearm: d(re, rw),
    leftThigh: d(lh, lk),
    rightThigh: d(rh, rk),
    leftShin: d(lk, la),
    rightShin: d(rk, ra),
    leftFoot: d(la, lf),
    rightFoot: d(ra, rf),
  };
}

function retargetChain(
  out: Record<string, Vec3>,
  source: Record<string, Vec3>,
  rootName: string,
  middleName: string,
  endName: string,
  firstLength?: number,
  secondLength?: number,
) {
  const root = out[rootName];
  const sourceRoot = source[rootName];
  const sourceMiddle = source[middleName];
  const sourceEnd = source[endName];
  if (!root || !sourceRoot || !sourceMiddle || !sourceEnd) return;

  const first = firstLength ?? distance(sourceRoot, sourceMiddle);
  const middle = add(root, scale(unit(sub(sourceMiddle, sourceRoot)), first));
  out[middleName] = withVisibility(middle, sourceMiddle.visibility);

  const second = secondLength ?? distance(sourceMiddle, sourceEnd);
  const end = add(middle, scale(unit(sub(sourceEnd, sourceMiddle)), second));
  out[endName] = withVisibility(end, sourceEnd.visibility);
}

function retargetFoot(
  out: Record<string, Vec3>,
  source: Record<string, Vec3>,
  ankleName: string,
  toeName: string,
  heelName: string,
  footLength?: number,
) {
  const ankle = out[ankleName], sourceAnkle = source[ankleName], toe = source[toeName], heel = source[heelName];
  if (!ankle || !sourceAnkle) return;
  if (toe) {
    const length = footLength ?? distance(sourceAnkle, toe);
    out[toeName] = withVisibility(add(ankle, scale(unit(sub(toe, sourceAnkle)), length)), toe.visibility);
  }
  if (heel) {
    const scaleFactor = footLength && toe ? footLength / Math.max(distance(sourceAnkle, toe), 1e-6) : 1;
    const vector = scale(sub(heel, sourceAnkle), scaleFactor);
    out[heelName] = withVisibility(add(ankle, vector), heel.visibility);
  }
}

function mirrorMissingBilateral(profile: BodyProfile): void {
  const pairs: Array<[Metric, Metric]> = [
    ["leftUpperArm", "rightUpperArm"],
    ["leftForearm", "rightForearm"],
    ["leftThigh", "rightThigh"],
    ["leftShin", "rightShin"],
    ["leftFoot", "rightFoot"],
  ];
  for (const [left, right] of pairs) {
    const a = profile[left], b = profile[right];
    const writable = profile as BodyProfile & Record<Metric, number | undefined>;
    if (typeof a === "number" && typeof b !== "number") writable[right] = a;
    if (typeof b === "number" && typeof a !== "number") writable[left] = b;
  }
}

function blendProfiles(previous: BodyProfile, current: BodyProfile, alpha: number): BodyProfile {
  const result: BodyProfile = {
    ...previous,
    version: 1,
    updatedAt: current.updatedAt,
    samples: Math.max(previous.samples, current.samples),
  };
  for (const metric of METRICS) {
    const a = previous[metric], b = current[metric];
    if (typeof b !== "number") continue;
    (result as BodyProfile & Record<Metric, number | undefined>)[metric] = typeof a === "number" ? a * (1 - alpha) + b * alpha : b;
  }
  return result;
}

function d(a: Vec3 | null, b: Vec3 | null): number | undefined {
  return a && b ? distance(a, b) : undefined;
}
function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility, b.visibility) };
}
function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z, visibility: 1 };
}
function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z, visibility: 1 };
}
function scale(a: Vec3, factor: number): Vec3 {
  return { x: a.x * factor, y: a.y * factor, z: a.z * factor, visibility: 1 };
}
function unit(a: Vec3): Vec3 {
  const length = Math.hypot(a.x, a.y, a.z);
  return length > 1e-8 ? scale(a, 1 / length) : { x: 0, y: 0, z: 0, visibility: 1 };
}
function withVisibility(point: Vec3, visibility: number): Vec3 {
  return { ...point, visibility };
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}
function clonePose(target: TargetPose): TargetPose {
  return {
    landmarks: Object.fromEntries(Object.entries(target.landmarks).map(([name, point]) => [name, { ...point }])),
    sword: target.sword ? { grip: { ...target.sword.grip }, tip: { ...target.sword.tip } } : undefined,
  };
}
