import type { Drill } from "./drill/types";
import type { ComparisonResult, MovementDetail, MovementSummary, PoseSequence, SessionInfo } from "./types";

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

async function staticFirst<T>(staticUrl: string, apiUrl: string): Promise<T> {
  try {
    return await getJson<T>(staticUrl);
  } catch {
    return getJson<T>(apiUrl);
  }
}

export function listDrills(): Promise<Drill[]> {
  return staticFirst(`${CONTENT_BASE}/drills.json`, "/api/v1/drills");
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
  const items = await staticFirst<StaticMovement[]>(`${CONTENT_BASE}/movements.json`, "/api/v1/movements");
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    camera_view: item.camera_view,
    reference_ready: false,
  }));
}

export async function getMovement(id: string): Promise<MovementDetail> {
  const items = await staticFirst<StaticMovement[]>(`${CONTENT_BASE}/movements.json`, "/api/v1/movements");
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

/** Legacy/cloud API helpers. Core live + offline browser flows do not use them. */
export function getSession(id: string): Promise<SessionInfo> {
  return getJson(`/api/v1/sessions/${id}`);
}
export function getResult(id: string): Promise<ComparisonResult> {
  return getJson(`/api/v1/sessions/${id}/result`);
}
export function getPose(url: string): Promise<PoseSequence> {
  return getJson(url);
}
export async function uploadAttempt(movementId: string, file: Blob, filename: string): Promise<string> {
  const body = new FormData();
  body.append("video", file, filename);
  const response = await fetch(`/api/v1/movements/${movementId}/attempts`, { method: "POST", body });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { session_id: string };
  return payload.session_id;
}
export async function deleteSession(id: string): Promise<void> {
  const response = await fetch(`/api/v1/sessions/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response));
}
