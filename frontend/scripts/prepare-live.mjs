import { createWriteStream, cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wasmSource = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDest = path.join(root, "public", "wasm");
const models = [
  {
    dest: path.join(root, "public", "models", "pose_landmarker_lite.task"),
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  },
  {
    dest: path.join(root, "public", "models", "pose_landmarker_full.task"),
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  },
];
// Pin concrete model artifact versions; never use /latest/.

if (!existsSync(wasmSource)) throw new Error("Нет @mediapipe/tasks-vision. Сначала npm install.");
mkdirSync(wasmDest, { recursive: true });
cpSync(wasmSource, wasmDest, { recursive: true });

for (const model of models) {
  if (existsSync(model.dest)) continue;
  mkdirSync(path.dirname(model.dest), { recursive: true });
  const response = await fetch(model.url);
  if (!response.ok || !response.body) throw new Error(`Не удалось скачать модель позы: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(model.dest));
}
console.log("Browser pose assets ready");
