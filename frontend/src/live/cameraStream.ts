export type PhysicalCamera = "environment" | "user";
type CameraAPI = Pick<MediaDevices, "getUserMedia" | "enumerateDevices">;
const retryable = new Set(["OverconstrainedError", "NotFoundError", "NotReadableError", "AbortError"]);
export const cameraErrorName = (reason: unknown): string =>
  reason && typeof reason === "object" && "name" in reason ? String(reason.name) : "Error";

export async function listCameras(media: CameraAPI): Promise<MediaDeviceInfo[]> {
  try {return (await media.enumerateDevices()).filter(d => d.kind === "videoinput" && d.deviceId);}
  catch {return [];}
}

/** Relax constraints before trying other devices. Never retry denied permission or return a stale stream. */
export async function openCameraStream(camera: PhysicalCamera, deviceId = "", media: CameraAPI = navigator.mediaDevices,
  current: () => boolean = () => true, pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 180))): Promise<MediaStream> {
  const resolution = {width: {ideal: 640}, height: {ideal: 480}};
  const candidates: MediaTrackConstraints[] = deviceId
    ? [{deviceId: {exact: deviceId}, ...resolution}, {deviceId: {exact: deviceId}}]
    : [{facingMode: {exact: camera}, ...resolution}, {facingMode: {ideal: camera}, ...resolution}, {}];
  let lastError: unknown;
  let enumerated = false;
  for (let index = 0; index < candidates.length; index++) {
    if (!current()) throw new DOMException("Camera request cancelled", "AbortError");
    try {
      const stream = await media.getUserMedia({audio: false, video: candidates[index]});
      if (!current()) {stream.getTracks().forEach(track => track.stop()); throw new DOMException("Camera request cancelled", "AbortError");}
      return stream;
    } catch (reason) {
      lastError = reason;
      if (!current() || !retryable.has(cameraErrorName(reason))) throw reason;
      if (!deviceId && index === candidates.length - 1 && !enumerated) {
        enumerated = true;
        const devices = await listCameras(media);
        candidates.push(...devices.filter(d => d.deviceId && d.deviceId !== "default").slice(0, 6)
          .map(d => ({deviceId: {exact: d.deviceId}})));
      }
      if (index + 1 < candidates.length && ["NotReadableError", "AbortError"].includes(cameraErrorName(reason))) await pause();
    }
  }
  throw lastError;
}
