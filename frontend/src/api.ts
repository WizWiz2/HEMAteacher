import type { Drill } from "./drill/types";
import type { MovementDetail, MovementSummary } from "./types";

const CONTENT_BASE = `${import.meta.env.BASE_URL}content`;

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (body?.detail?.status) return `Статус: ${body.detail.status}`;
  } catch {
    /* not JSON */
  }
  return `Ошибка ${response.status}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<T>;
}

export function listDrills(): Promise<Drill[]> {
  return getJson(`${CONTENT_BASE}/drills.json`);
}

export async function getDrill(id: string): Promise<Drill> {
  const items = await listDrills();
  const drill = items.find((item) => item.id === id);
  if (!drill) throw new Error("Упражнение не найдено");
  return drill;
}

interface StaticMovement {
  id: string;
  name: string;
  description: string;
  camera_view: string;
  analysis_profile: string;
}

export async function listMovements(): Promise<MovementSummary[]> {
  const items = await getJson<StaticMovement[]>(`${CONTENT_BASE}/movements.json`);
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    camera_view: item.camera_view,
    reference_ready: false,
  }));
}

export async function getMovement(id: string): Promise<MovementDetail> {
  const items = await getJson<StaticMovement[]>(`${CONTENT_BASE}/movements.json`);
  const item = items.find((value) => value.id === id);
  if (!item) throw new Error("Движение не найдено");
  return {
    ...item,
    reference_ready: false,
    reference_video_url: null,
    reference_pose_url: null,
    duration_ms: null,
  };
}
