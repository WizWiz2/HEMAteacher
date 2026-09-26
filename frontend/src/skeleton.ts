import type { PoseFrame, PoseSequence } from "./types";

export const POSE_EDGES: Array<[string, string]> = [
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
  ["left_ankle", "left_heel"],
  ["left_heel", "left_foot_index"],
  ["left_ankle", "left_foot_index"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["right_ankle", "right_heel"],
  ["right_heel", "right_foot_index"],
  ["right_ankle", "right_foot_index"],
  ["left_shoulder", "nose"],
  ["right_shoulder", "nose"],
];

export function frameAt(pose: PoseSequence | null, timeMs: number): PoseFrame | null {
  if (!pose || pose.frames.length === 0) return null;
  let low = 0;
  let high = pose.frames.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (pose.frames[mid].timestamp_ms < timeMs) low = mid + 1;
    else high = mid;
  }
  const next = pose.frames[low];
  const prev = pose.frames[Math.max(0, low - 1)];
  return Math.abs(prev.timestamp_ms - timeMs) <= Math.abs(next.timestamp_ms - timeMs) ? prev : next;
}

export function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; width: number; height: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const pixelW = Math.round(width * dpr);
  const pixelH = Math.round(height * dpr);
  if (canvas.width !== pixelW || canvas.height !== pixelH) {
    canvas.width = pixelW;
    canvas.height = pixelH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

export function drawImageSkeleton(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  pose: PoseFrame | null,
  color: string,
) {
  if (!pose) return;
  const box = contentRect(video);
  const points = projectImage(pose, box);
  stroke(ctx, points, color);
}

export function drawNormalizedSkeleton(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: PoseFrame | null,
  color: string,
  originX: number,
) {
  if (!pose) return;
  const unit = Math.min(width, height) * 0.22;
  const originY = height * 0.66;
  const points = new Map<string, [number, number]>();
  for (const [name, landmark] of Object.entries(pose.landmarks)) {
    if (landmark.visibility < 0.25) continue;
    points.set(name, [originX + landmark.x * unit, originY - landmark.y * unit]);
  }
  stroke(ctx, points, color);
}

function contentRect(video: HTMLVideoElement) {
  const elW = video.clientWidth;
  const elH = video.clientHeight;
  const vw = video.videoWidth || elW;
  const vh = video.videoHeight || elH;
  if (!elW || !elH || !vw || !vh) return { x: 0, y: 0, w: elW, h: elH };
  const scale = Math.min(elW / vw, elH / vh);
  const w = vw * scale;
  const h = vh * scale;
  return { x: (elW - w) / 2, y: (elH - h) / 2, w, h };
}

function projectImage(pose: PoseFrame, box: { x: number; y: number; w: number; h: number }) {
  const points = new Map<string, [number, number]>();
  for (const [name, landmark] of Object.entries(pose.landmarks)) {
    if (landmark.visibility < 0.25) continue;
    points.set(name, [box.x + landmark.x * box.w, box.y + landmark.y * box.h]);
  }
  return points;
}

function stroke(ctx: CanvasRenderingContext2D, points: Map<string, [number, number]>, color: string) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [start, end] of POSE_EDGES) {
    const a = points.get(start);
    const b = points.get(end);
    if (!a || !b) continue;
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
  for (const [x, y] of points.values()) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
