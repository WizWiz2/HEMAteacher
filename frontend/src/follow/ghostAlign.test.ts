import { describe, expect, it } from "vitest";
import data from "./referenceClips.json";
import { bodyAnchor, containBox, followAnchor, hipCentre, placeGhost, toBox, type GhostAnchor } from "./ghostAlign";
import { clipDurationMs, poseAt, referenceKey, type ReferenceSet } from "./reference";
import type { Point } from "./reference";

const set = data as unknown as ReferenceSet;
const lm = (x: number, y: number) => ({x, y, visibility: 0.99});
/** A standing user, normalised image coordinates (camera picture, not mirrored). */
const user = {
  nose: lm(0.62, 0.30), left_shoulder: lm(0.66, 0.40), right_shoulder: lm(0.58, 0.40),
  left_hip: lm(0.65, 0.62), right_hip: lm(0.59, 0.62), left_ankle: lm(0.65, 0.95), right_ankle: lm(0.59, 0.95),
};
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** What CSS `transform: scaleX(-1)` on the camera wrapper does to a point drawn on the overlay canvas. */
const onScreen = (p: Point, width: number, mirrored: boolean): Point => (mirrored ? [width - p[0], p[1]] : p);

describe("follow-along ghost alignment", () => {
  it("maps landmarks into the letterboxed video picture like the live skeleton", () => {
    expect(containBox(800, 450, 1280, 720)).toEqual({x: 0, y: 0, w: 800, h: 450});
    const box = containBox(800, 600, 1280, 720); // bars top and bottom
    expect(box.x).toBe(0); expect(box.y).toBeCloseTo(75); expect(box.h).toBeCloseTo(450);
    expect(toBox({x: 0.5, y: 0.5}, box)).toEqual([400, 300]);
  });

  for (const view of ["front", "side"] as const) for (const mirrored of [false, true]) {
    it(`puts the ghost hip centre on the user's and matches the torso (${view}, ${mirrored ? "mirrored" : "unmirrored"})`, () => {
      const width = 800, box = containBox(width, 600, 1280, 720);
      const anchor = bodyAnchor(user, box, 1000)!;
      const userHip = mid(toBox(user.left_hip, box), toBox(user.right_hip, box));
      const userSh = mid(toBox(user.left_shoulder, box), toBox(user.right_shoulder, box));
      const userTorso = Math.hypot(userSh[0] - userHip[0], userSh[1] - userHip[1]);
      const clip = set.clips[referenceKey(view, "zornhau")];
      for (const flip of view === "side" ? [false, true] : [false]) {
        for (const t of [0, clipDurationMs(clip) * 0.37, clipDurationMs(clip) * 0.8]) {
          const ghost = placeGhost(poseAt(set, clip, t), anchor, flip);
          const gHip = onScreen(hipCentre(ghost)!, width, mirrored), uHip = onScreen(userHip, width, mirrored);
          expect(gHip[0]).toBeCloseTo(uHip[0], 6);
          expect(gHip[1]).toBeCloseTo(uHip[1], 6);
        }
        // At rest (first frame of the loop = the guard) the ghost torso is the user's torso.
        const rest = placeGhost(poseAt(set, clip, 0), anchor, flip);
        const gSh = mid(rest.left_shoulder, rest.right_shoulder), gHip = hipCentre(rest)!;
        expect(Math.hypot(gSh[0] - gHip[0], gSh[1] - gHip[1])).toBeCloseTo(userTorso, 0);
        // ...and the shoulders land within a tenth of a torso of the user's shoulders.
        const a = onScreen(gSh, width, mirrored), b = onScreen(userSh, width, mirrored);
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(userTorso * 0.1);
      }
    });
  }

  it("keeps the selfie mirror consistent: ghost and body flip together, the ghost's left stays on the body's left", () => {
    const width = 800, box = containBox(width, 450, 1280, 720), anchor = bodyAnchor(user, box, 0)!;
    const ghost = placeGhost(poseAt(set, set.clips["front:zornhau"], 0), anchor);
    for (const mirrored of [false, true]) {
      const userSide = Math.sign(onScreen(toBox(user.left_shoulder, box), width, mirrored)[0] - onScreen(toBox(user.right_shoulder, box), width, mirrored)[0]);
      const ghostSide = Math.sign(onScreen(ghost.left_shoulder, width, mirrored)[0] - onScreen(ghost.right_shoulder, width, mirrored)[0]);
      expect(ghostSide).toBe(userSide);
    }
  });

  it("follows the hips without lagging behind, whatever the frame rate", () => {
    const step = (fps: number) => {
      let a: GhostAnchor | null = null;
      for (let t = 0; t <= 2000; t += 1000 / fps) a = followAnchor(a, {x: t < 1000 ? 300 : 360, y: 250, s: 90, t});
      return a!;
    };
    // 60 px step at t = 1 s: within a pixel of the new hip position a second later, at 30 and at 8 pose fps.
    expect(step(30).x).toBeCloseTo(360, 0);
    expect(step(8).x).toBeCloseTo(360, 0);
    // 150 ms after the step it is already most of the way there.
    let a: GhostAnchor | null = null;
    for (let t = 0; t <= 1150; t += 33) a = followAnchor(a, {x: t < 1000 ? 300 : 360, y: 250, s: 90, t});
    expect(a!.x).toBeGreaterThan(350);
  });

  it("restarts after a tracking gap and ignores missing trunk landmarks", () => {
    const a = followAnchor({x: 100, y: 100, s: 80, t: 0}, {x: 500, y: 120, s: 60, t: 2000});
    expect(a).toEqual({x: 500, y: 120, s: 60, t: 2000});
    const box = containBox(800, 450, 1280, 720);
    expect(bodyAnchor({...user, left_hip: {...user.left_hip, visibility: 0.2}}, box, 0)).toBeNull();
  });
});
