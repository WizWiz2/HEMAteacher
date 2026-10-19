import type { FramingAssessment } from "../live/framing";

export interface FrameCheckItem { id: "body" | "distance" | "fps" | "delegate"; ok: boolean; text: string }

/** Pre-set checklist: whole body visible, distance, pose frame rate and whether MediaPipe runs on the GPU. */
export function frameCheck(framing: FramingAssessment | null, fps: number | null, delegate: "GPU" | "CPU" | null): FrameCheckItem[] {
  const items: FrameCheckItem[] = [];
  if (!framing) items.push({ id: "body", ok: false, text: "Не вижу человека в кадре" });
  else if (framing.missing.length) items.push({ id: "body", ok: false, text: framing.message.replace(/^НЕ ВИЖУ/, "Не вижу").replace(/ · /, ": ").toLowerCase().replace(/^не вижу/, "Не вижу") });
  else items.push({ id: "body", ok: true, text: "Всё тело в кадре" });
  if (framing && !framing.missing.length) {
    if (framing.coverage < 0.58) items.push({ id: "distance", ok: false, text: "Далеко: подойди на шаг ближе" });
    else if (framing.coverage > 0.96) items.push({ id: "distance", ok: false, text: "Слишком близко: отойди на шаг" });
    else items.push({ id: "distance", ok: true, text: "Расстояние подходит" });
  }
  if (fps !== null) items.push({ id: "fps", ok: fps >= 15, text: fps >= 15 ? `${Math.round(fps)} кадров/с` : `${Math.round(fps)} кадров/с: мало, счёт может пропускать повторы` });
  if (delegate === "CPU") items.push({ id: "delegate", ok: false, text: "Видеоускорение недоступно: распознавание идёт на процессоре и может тормозить" });
  return items;
}

/** Frames per second over the timestamps of the last ~2 s. */
export function frameRate(times: number[]): number | null {
  if (times.length < 5) return null;
  const span = times.at(-1)! - times[0];
  return span > 0 ? ((times.length - 1) * 1000) / span : null;
}
