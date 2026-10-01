import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkEngravingAssets } from "./check-engraving-assets.mjs";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
checkEngravingAssets(path.join(dist, "theme"));
const required = [
  "index.html",
  "content/drills.json",
  "content/movements.json",
  "content/footwork_v1.json",
  "models/pose_landmarker_lite.task",
  "wasm/vision_wasm_internal.wasm",
];
for (const item of required) {
  const file = path.join(dist, item);
  if (!existsSync(file) || statSync(file).size === 0) throw new Error(`Missing static asset: ${item}`);
}
const assets = readdirSync(path.join(dist, "assets"));
if (!assets.some((file) => /\.js$/.test(file) && /worker/.test(file))) {
  throw new Error("Analysis Web Worker is missing from the build");
}
const scripts = assets.filter((file) => file.endsWith(".js"));
if (scripts.some((file) => readFileSync(path.join(dist, "assets", file), "utf8").includes("/api/v1/"))) {
  throw new Error("Static build still refers to the server API");
}
for (const file of scripts) {
  const source = readFileSync(path.join(dist, "assets", file), "utf8");
  if (["/dev/video-regression", "Видео вместо камеры", "browser-video-results.json"].some(marker => source.includes(marker))) {
    throw new Error(`Development video regression tool leaked into production: ${file}`);
  }
}
console.log("Static build contains content, local MediaPipe assets, and the analysis worker; no /api/v1/ calls.");
