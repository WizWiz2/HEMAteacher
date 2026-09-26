import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMovement, uploadAttempt } from "../api";
import type { MovementDetail } from "../types";

export function RecordPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const liveRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [movement, setMovement] = useState<MovementDetail | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const secure = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    getMovement(id).then(setMovement).catch((reason: Error) => setError(reason.message));
  }, [id]);

  useEffect(() => {
    const video = liveRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [stream]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<string | null>(null);
  streamRef.current = stream;
  previewRef.current = previewUrl;
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  async function enableCamera() {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(media);
    } catch {
      setError("Камера не открылась. Разрешите доступ или загрузите готовый файл.");
    }
  }

  function startRecording() {
    if (!stream) return;
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((item) =>
      MediaRecorder.isTypeSupported(item),
    );
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || "video/webm";
      const next = new Blob(chunksRef.current, { type });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBlob(next);
      setPreviewUrl(URL.createObjectURL(next));
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    };
    recorder.start();
    recorderRef.current = recorder;
    setSeconds(0);
    setRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function onFile(file: File | null) {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }

  async function submit() {
    if (!blob) return;
    setBusy(true);
    setError(null);
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const sessionId = await uploadAttempt(id, blob, `attempt.${ext}`);
      navigate(`/sessions/${sessionId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить видео");
      setBusy(false);
    }
  }

  return (
    <main className="stack">
      <div>
        <h1>{movement ? movement.name : "Запись"}</h1>
        <p className="lede">Разбор начнётся после остановки записи. В кадре ничего не считается в реальном времени.</p>
      </div>
      <ul className="checklist">
        <li>В кадре весь человек, от головы до обеих стоп.</li>
        <li>Телефон стоит неподвижно, ракурс — сбоку.</li>
        <li>В кадре один человек.</li>
        <li>Фон попроще, без пёстрого рисунка.</li>
        <li>Первая версия — без меча.</li>
      </ul>
      {error && <p className="error">{error}</p>}
      {secure && !blob && (
        <div className="stack">
          {!stream && <button type="button" onClick={() => void enableCamera()}>Включить камеру</button>}
          {stream && <video ref={liveRef} className="preview-live" playsInline muted autoPlay />}
          {stream && !recording && <button type="button" onClick={startRecording}>Начать запись</button>}
          {recording && (
            <button type="button" onClick={stopRecording}>
              Остановить ({seconds} с)
            </button>
          )}
        </div>
      )}
      {!secure && !blob && (
        <p className="callout">
          Живой предпросмотр камеры в браузере доступен на localhost или по HTTPS.
          С телефона по обычному адресу в сети откройте https и порт 8443 либо снимите ролик и загрузите файл.
        </p>
      )}
      <label className="button ghost">
        Загрузить видео
        <input
          type="file"
          accept="video/*"
          capture="environment"
          hidden
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {previewUrl && (
        <div className="stack">
          <video className="preview-live" src={previewUrl} controls playsInline />
          <div className="row">
            <button type="button" onClick={submit} disabled={busy}>
              {busy ? "Отправляю…" : "Отправить на анализ"}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setBlob(null);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }}
            >
              Переснять
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
