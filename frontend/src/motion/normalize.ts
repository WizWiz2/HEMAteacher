import type { Landmark, PoseFrame, PoseSequence } from "../types";

const MIN_VISIBILITY = 0.5;

export function normalizeSequence(sequence: PoseSequence): PoseSequence {
  const scales: number[] = [];
  const facingSamples: number[] = [];

  for (const frame of sequence.frames) {
    const scale = torsoLength(frame, sequence.width, sequence.height);
    if (scale != null) scales.push(scale);
    const nose = visible(frame.landmarks.nose);
    const leftHip = visible(frame.landmarks.left_hip);
    const rightHip = visible(frame.landmarks.right_hip);
    if (nose && leftHip && rightHip) {
      const hipX = ((leftHip.x + rightHip.x) / 2) * sequence.width;
      facingSamples.push(nose.x * sequence.width - hipX);
    }
  }

  const scale = median(scales);
  const face = facingSign(facingSamples);
  const frames = sequence.frames.map((frame) => normalizeFrame(frame, sequence.width, sequence.height, scale, face));
  return { ...sequence, width: 1, height: 1, space: "normalized", frames };
}

function normalizeFrame(frame: PoseFrame, width: number, height: number, scale: number, face: number): PoseFrame {
  const leftHip = visible(frame.landmarks.left_hip);
  const rightHip = visible(frame.landmarks.right_hip);
  if (!leftHip || !rightHip || !Number.isFinite(scale) || scale <= 1e-6) {
    return { timestamp_ms: frame.timestamp_ms, landmarks: {} };
  }
  const root = midpoint(pixel(leftHip, width, height), pixel(rightHip, width, height));
  const landmarks: Record<string, Landmark> = {};
  for (const [name, source] of Object.entries(frame.landmarks)) {
    if (source.visibility < MIN_VISIBILITY) continue;
    const p = pixel(source, width, height);
    landmarks[name] = {
      x: ((p.x - root.x) / scale) * face,
      y: -((p.y - root.y) / scale),
      z: (p.z - root.z) / scale,
      visibility: source.visibility,
    };
  }
  return { timestamp_ms: frame.timestamp_ms, landmarks };
}

function torsoLength(frame: PoseFrame, width: number, height: number): number | null {
  const ls = visible(frame.landmarks.left_shoulder), rs = visible(frame.landmarks.right_shoulder);
  const lh = visible(frame.landmarks.left_hip), rh = visible(frame.landmarks.right_hip);
  if (!ls || !rs || !lh || !rh) return null;
  const shoulder = midpoint(pixel(ls,width,height), pixel(rs,width,height));
  const hip = midpoint(pixel(lh,width,height), pixel(rh,width,height));
  const value = Math.hypot(shoulder.x-hip.x, shoulder.y-hip.y);
  return value > 1e-6 ? value : null;
}

function visible(point: Landmark | undefined): Landmark | null {
  return point && point.visibility >= MIN_VISIBILITY ? point : null;
}
function pixel(p: Landmark,width:number,height:number): Landmark {
  return { x:p.x*width, y:p.y*height, z:p.z*width, visibility:p.visibility };
}
function midpoint(a: Landmark,b: Landmark): Landmark {
  return { x:(a.x+b.x)/2, y:(a.y+b.y)/2, z:(a.z+b.z)/2, visibility:Math.min(a.visibility,b.visibility) };
}
function median(values:number[]): number {
  if(!values.length) return Number.NaN;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.floor((sorted.length-1)/2)];
}
function facingSign(values:number[]): number {
  if(!values.length) return 1;
  const m=median(values);
  return Math.abs(m)<1e-3 ? 1 : m>0 ? 1 : -1;
}
