// Placement of the reference ghost over the live camera: the ghost's hip centre sits on the user's hip centre and
// one reference torso length (shoulder centre to hip centre) equals the user's torso on screen.
import { placePose, type Point, type ReferencePose } from "./reference";

export interface ScreenBox { x: number; y: number; w: number; h: number }
interface Landmark { x: number; y: number; visibility: number }
/** Where the ghost goes, in overlay-canvas CSS px: hip centre and px per torso length; `t` = pose timestamp (ms). */
export interface GhostAnchor { x: number; y: number; s: number; t: number }

const TRUNK = ["left_shoulder", "right_shoulder", "left_hip", "right_hip"] as const;
/** Position follows the hips almost directly (only pose jitter is filtered); the size changes slowly. */
export const ANCHOR_POSITION_TAU_MS = 40;
export const ANCHOR_SCALE_TAU_MS = 300;
const RESET_GAP_MS = 600;

/** Rectangle the video picture occupies inside its element (object-fit: contain, letterboxed and centred). */
export function containBox(elW: number, elH: number, videoW: number, videoH: number): ScreenBox {
  if (!elW || !elH || !videoW || !videoH) return {x: 0, y: 0, w: elW, h: elH};
  const k = Math.min(elW / videoW, elH / videoH), w = videoW * k, h = videoH * k;
  return {x: (elW - w) / 2, y: (elH - h) / 2, w, h};
}

/** Normalised landmark -> overlay px, the same mapping the live skeleton uses (both canvases share the video's box). */
export const toBox = (p: {x: number; y: number}, box: ScreenBox): Point => [box.x + p.x * box.w, box.y + p.y * box.h];

/** The user's hip centre and torso length on screen, or null when the trunk is not visible. */
export function bodyAnchor(landmarks: Partial<Record<string, Landmark>>, box: ScreenBox, timeMs: number, minVisibility = 0.5): GhostAnchor | null {
  const [ls, rs, lh, rh] = TRUNK.map(n => landmarks[n]);
  if (![ls, rs, lh, rh].every(p => p && p.visibility > minVisibility)) return null;
  const hip = toBox({x: (lh!.x + rh!.x) / 2, y: (lh!.y + rh!.y) / 2}, box);
  const sh = toBox({x: (ls!.x + rs!.x) / 2, y: (ls!.y + rs!.y) / 2}, box);
  const s = Math.hypot(sh[0] - hip[0], sh[1] - hip[1]);
  return s > 1 ? {x: hip[0], y: hip[1], s, t: timeMs} : null;
}

/**
 * Smooths the anchor by pose time (not by animation frames, so a slow device does not drag the ghost behind the body).
 * Starts over after a gap or when the body jumps by more than a torso (camera switch, someone else in frame).
 */
export function followAnchor(prev: GhostAnchor | null, next: GhostAnchor): GhostAnchor {
  if (!prev) return next;
  const dt = next.t - prev.t;
  if (dt <= 0) return prev;
  if (dt > RESET_GAP_MS || Math.hypot(next.x - prev.x, next.y - prev.y) > 1.5 * prev.s) return next;
  const a = 1 - Math.exp(-dt / ANCHOR_POSITION_TAU_MS), b = 1 - Math.exp(-dt / ANCHOR_SCALE_TAU_MS);
  return {x: prev.x + (next.x - prev.x) * a, y: prev.y + (next.y - prev.y) * a, s: prev.s + (next.s - prev.s) * b, t: next.t};
}

export function hipCentre(pose: Partial<Record<string, Point>>): Point | null {
  const l = pose.left_hip, r = pose.right_hip;
  return l && r ? [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2] : null;
}

/**
 * Reference pose placed on the overlay: its current hip centre exactly on the anchor (the reference's own travel is
 * removed, so limbs are compared where the user stands), scaled so its torso equals the user's.
 * `flipX` turns a side-view reference to the other facing. Mirroring of a selfie preview is not done here: the overlay
 * canvas sits inside the mirrored wrapper with the video and the live skeleton, so all three flip together.
 */
export function placeGhost(pose: ReferencePose, anchor: GhostAnchor, flipX = false): Record<string, Point> {
  const hip = hipCentre(pose) ?? [0, 0];
  const origin: Point = [anchor.x - (flipX ? -hip[0] : hip[0]) * anchor.s, anchor.y - hip[1] * anchor.s];
  return placePose(pose, origin, anchor.s, flipX);
}
