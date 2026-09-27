import type { WeaponMarkers } from "../drill/types";

const SAMPLE_WIDTH = 240;

export interface MarkerConfig {
  cyanHue?: [number, number];
  magentaHue?: [number, number];
  minSaturation?: number;
  minValue?: number;
  minPixels?: number;
}

export function detectWeaponMarkers(video: HTMLVideoElement, canvas: HTMLCanvasElement, config: MarkerConfig = {}): WeaponMarkers {
  if (!video.videoWidth || !video.videoHeight) return { detected: false };
  const width = SAMPLE_WIDTH;
  const height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { detected: false };
  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  return detectWeaponMarkerPixels(image.data, width, height, config);
}

export function detectWeaponMarkerPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  config: MarkerConfig = {},
): WeaponMarkers {
  const cyanHue = config.cyanHue ?? [165, 205];
  const magentaHue = config.magentaHue ?? [285, 345];
  const minSaturation = config.minSaturation ?? 0.55;
  const minValue = config.minValue ?? 0.35;
  const minPixels = config.minPixels ?? Math.max(5, Math.round(width * height * 0.00025));

  const cyan = { x: 0, y: 0, count: 0 };
  const magenta = { x: 0, y: 0, count: 0 };

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const hsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      if (hsv.s < minSaturation || hsv.v < minValue) continue;
      const bucket = inHue(hsv.h, cyanHue) ? cyan : inHue(hsv.h, magentaHue) ? magenta : null;
      if (!bucket) continue;
      bucket.x += x;
      bucket.y += y;
      bucket.count += 1;
    }
  }

  const grip = cyan.count >= minPixels
    ? { x: cyan.x / cyan.count / width, y: cyan.y / cyan.count / height, confidence: Math.min(1, cyan.count / (minPixels * 4)) }
    : undefined;
  const tip = magenta.count >= minPixels
    ? { x: magenta.x / magenta.count / width, y: magenta.y / magenta.count / height, confidence: Math.min(1, magenta.count / (minPixels * 4)) }
    : undefined;

  if (!grip || !tip) return { detected: false, grip, tip };
  const angleDeg = Math.atan2(-(tip.y - grip.y), tip.x - grip.x) * 180 / Math.PI;
  return { detected: true, grip, tip, angleDeg };
}

function inHue(hue: number, range: [number, number]): boolean {
  return hue >= range[0] && hue <= range[1];
}

function rgbToHsv(r8: number, g8: number, b8: number) {
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
