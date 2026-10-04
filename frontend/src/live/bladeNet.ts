// Tiny learned blade-direction model (experimental, docs/blade-tracking.md): a hand-centred 96x96 grey crop (side =
// 2.8 torso lengths) -> 4 stride-2 3x3 convolutions (8-16-32-32, BatchNorm folded, ReLU) -> 64 -> [cos, sin, presence].
// The direction is the blade keypoint at a fixed distance from the hands. Trained only on train-body renders with
// background, blur, blade-material, clutter and compression augmentation (/workspace scripts, PROGRESS Session 5).
// About 1.9 M multiply-adds per frame, plain JS (no WebGL / WASM dependency).
import type { GrayImage } from "./bladeDetector";

export const NET_SIZE = 96, NET_RADIUS = 1.4;
export interface BladeNetWeights { convs: { cin: number; cout: number; w: string; b: string }[]; fc: { cin: number; cout: number; w: string; b: string }[] }
interface Layer { cin: number; cout: number; w: Float32Array; b: Float32Array }
const f32 = (b64: string) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); };

/** Same crop as the training data (extract.py crop()): 2x2 supersampled bilinear, edge-clamped. */
export function cropHands(img: GrayImage, cx: number, cy: number, scale: number, out = new Float32Array(NET_SIZE * NET_SIZE)) {
  const { data, width: w, height: h } = img, S = NET_SIZE, sub = [.25, .75];
  for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
    let acc = 0;
    for (const oy of sub) for (const ox of sub) {
      const x = Math.min(w - 1.001, Math.max(0, cx + (u + ox - S / 2) / scale)), y = Math.min(h - 1.001, Math.max(0, cy + (v + oy - S / 2) / scale));
      const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
      acc += (data[i] * (1 - fx) + data[i + 1] * fx) * (1 - fy) + (data[i + w] * (1 - fx) + data[i + w + 1] * fx) * fy;
    }
    out[v * S + u] = Math.min(255, Math.max(0, Math.floor(acc / 4 + .5)));
  }
  return out;
}

export class BladeNet {
  private convs: Layer[]; private fc: Layer[];
  constructor(wts: BladeNetWeights) {
    const L = (l: BladeNetWeights["convs"][number]) => ({ cin: l.cin, cout: l.cout, w: f32(l.w), b: f32(l.b) });
    this.convs = wts.convs.map(L); this.fc = wts.fc.map(L);
  }
  /** Raw outputs [cos, sin, presence logit] for a crop (values 0..255). */
  forward(crop: Float32Array): [number, number, number] {
    let n = 0, mean = 0; for (const v of crop) { mean += v; n++; } mean /= n;
    let sd = 0; for (const v of crop) sd += (v - mean) ** 2; sd = Math.sqrt(sd / n) / 255 + 1e-3;
    let x = Float32Array.from(crop, v => (v - mean) / 255 / sd), size = NET_SIZE;
    for (const l of this.convs) {
      const o = size >> 1, y = new Float32Array(l.cout * o * o);
      for (let co = 0; co < l.cout; co++) for (let oy = 0; oy < o; oy++) for (let ox = 0; ox < o; ox++) {
        let s = l.b[co];
        for (let ci = 0; ci < l.cin; ci++) {
          const wb = (co * l.cin + ci) * 9, xb = ci * size * size;
          for (let ky = 0; ky < 3; ky++) {
            const iy = oy * 2 - 1 + ky; if (iy < 0 || iy >= size) continue;
            for (let kx = 0; kx < 3; kx++) { const ix = ox * 2 - 1 + kx; if (ix >= 0 && ix < size) s += l.w[wb + ky * 3 + kx] * x[xb + iy * size + ix]; }
          }
        }
        y[(co * o + oy) * o + ox] = s > 0 ? s : 0;
      }
      x = y; size = o;
    }
    this.fc.forEach((l, k) => {
      const y = new Float32Array(l.cout);
      for (let co = 0; co < l.cout; co++) { let s = l.b[co]; for (let ci = 0; ci < l.cin; ci++) s += l.w[co * l.cin + ci] * x[ci]; y[co] = k < this.fc.length - 1 && s < 0 ? 0 : s; }
      x = y;
    });
    return [x[0], x[1], x[2]];
  }
  /** Blade direction (radians, image y down) and presence probability around the hands. */
  direction(img: GrayImage, hands: [number, number], torsoPx: number): { angle: number; presence: number } | null {
    if (!(torsoPx > 4)) return null;
    const scale = NET_SIZE / (2 * NET_RADIUS * torsoPx);
    const [c, s, p] = this.forward(cropHands(img, hands[0] * img.width, hands[1] * img.height, scale));
    return { angle: Math.atan2(s, c), presence: 1 / (1 + Math.exp(-p)) };
  }
}
