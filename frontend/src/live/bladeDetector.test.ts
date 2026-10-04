import { describe, expect, it } from "vitest";
import { detectBlade } from "./bladeDetector";
import { BLADE, frameChannels, CHANNELS } from "../drill/motionRecognition";

/** Grey background with mild noise, a thin bright line (the blade) from (x0,y0) at angle deg, and a thick dark bar (an arm). */
function scene(deg: number, seed = 1) {
  const w = 320, h = 180, data = new Uint8Array(w * h);
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < data.length; i++) data[i] = 150 + Math.round((rnd() - .5) * 10);
  const x0 = 160, y0 = 90, th = deg * Math.PI / 180;
  for (let r = 4; r < 110; r += .25) {
    const x = Math.round(x0 + Math.cos(th) * r), y = Math.round(y0 + Math.sin(th) * r);
    if (x >= 0 && y >= 0 && x < w && y < h) data[y * w + x] = 210;
  }
  // arm: thick bar from the hands back-down to the left
  for (let y = 90; y < 130; y++) for (let x = 110; x < 160; x++) if (Math.abs((y - 90) - (160 - x) * .8) < 5) data[y * w + x] = 60;
  return { img: { data, width: w, height: h }, hands: [x0 / w, y0 / h] as [number, number] };
}

describe("blade detector", () => {
  for (const deg of [-90, -45, 0, 30, 120]) {
    it(`finds a thin line at ${deg} degrees from the hands`, () => {
      const { img, hands } = scene(deg);
      const d = detectBlade(img, hands, 50)!;
      expect(d).not.toBeNull();
      const a = Math.atan2((d.tip[1] - d.guard[1]) * img.height, (d.tip[0] - d.guard[0]) * img.width) * 180 / Math.PI;
      expect(Math.abs(((a - deg + 540) % 360) - 180)).toBeLessThan(4);
      expect(d.contrast).toBeGreaterThan(3);
    });
  }
  it("reports low confidence on a frame without a blade", () => {
    const { img, hands } = scene(0); for (let i = 0; i < img.data.length; i++) img.data[i] = 150 + (i * 7919 % 9) - 4;
    const d = detectBlade(img, hands, 50);
    expect(d === null || d.contrast < 3).toBe(true);
  });
  it("blade channels are absent unless the flag is on", () => {
    const f = { blade_guard_x: 0, blade_guard_y: 0, blade_tip_x: 1, blade_tip_y: 0, nose_x: 0, nose_y: 1 };
    expect(BLADE.enabled).toBe(false);
    expect(frameChannels(f)).toHaveLength(CHANNELS.length);
    BLADE.enabled = true;
    try { expect(frameChannels(f).slice(CHANNELS.length)).toEqual([1, 0, 1, -1, 1, 0]); } finally { BLADE.enabled = false; }
  });
});

describe("blade track", () => {
  it("keeps a weak blade inside the predicted window and drops it after the gap limit", async () => {
    const { BladeTrack, BLADE_TRACK_DEFAULTS, scanBlade } = await import("./bladeDetector");
    const opt = { ...BLADE_TRACK_DEFAULTS }, track = new BladeTrack(opt);
    const strong = scene(-60), s1 = scanBlade(strong.img, strong.hands, 50)!;
    expect(track.update(s1, 0)).not.toBeNull();
    // weak frame: the blade at -63 degrees with low contrast plus a rival line far away
    const weak = scene(-63);
    for (let i = 0; i < weak.img.data.length; i++) if (weak.img.data[i] === 210) weak.img.data[i] = 158;
    const sw = scanBlade(weak.img, weak.hands, 50)!;
    opt.high = 1e9; // from here on only the track can accept
    const d = track.update(sw, 33)!;
    expect(d).not.toBeNull();
    const a = Math.atan2((d.tip[1] - d.guard[1]) * 180, (d.tip[0] - d.guard[0]) * 320) * 180 / Math.PI;
    expect(Math.abs(a + 63)).toBeLessThan(5);
    expect(track.update(sw, 1000)).toBeNull();
  });
});
