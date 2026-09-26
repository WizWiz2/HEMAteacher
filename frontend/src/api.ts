import type { Drill } from "./drill/types";
import type { ComparisonResult, MovementDetail, MovementSummary, PoseSequence, SessionInfo } from "./types";

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (body?.detail?.status) return `Статус: ${body.detail.status}`;
  } catch {
    /* тело не JSON */
  }
  return `Ошибка ${response.status}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<T>;
}

export function listDrills(): Promise<Drill[]> {
  return getJson("/api/v1/drills");
}

export function getDrill(id: string): Promise<Drill> {
  return getJson(`/api/v1/drills/${id}`);
}

export function listMovements(): Promise<MovementSummary[]> {
  return getJson("/api/v1/movements");
}

export function getMovement(id: string): Promise<MovementDetail> {
  return getJson(`/api/v1/movements/${id}`);
}

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
