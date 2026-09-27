import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMovement } from "../api";
import { deleteReference, getReference, saveReference, type LocalReference } from "../motion/storage";
import { extractPoseFromVideo } from "../motion/videoPose";
import { ReferencePlayer } from "../player";
import type { MovementDetail } from "../types";

export function MovementPage() {
  const { id = "" } = useParams();
  const [movement, setMovement] = useState<MovementDetail | null>(null);
  const [reference, setReference] = useState<LocalReference | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getMovement(id), getReference(id)])
      .then(([detail, stored]) => {
        if (!alive) return;
        setMovement(detail);
        setReference(stored);
      })
      .catch((reason: Error) => alive && setError(reason.message));
    return () => { alive = false; };
  }, [id]);

  const referenceUrl = useMemo(() => reference ? URL.createObjectURL(reference.video) : null, [reference]);
  useEffect(() => () => { if (referenceUrl) URL.revokeObjectURL(referenceUrl); }, [referenceUrl]);

  async function importReference(file: File | null) {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      const pose = await extractPoseFromVideo(file, { sampleFps: 15, onProgress: setProgress });
      const detected = pose.frames.filter((frame) => Object.keys(frame.landmarks).length > 0).length / Math.max(pose.frames.length, 1);
      if (detected < 0.65) throw new Error("Поза находится менее чем в 65% кадров. Пересними эталон: весь человек сбоку и в кадре.");
      const stored: LocalReference = {
        movementId: id,
        createdAt: new Date().toISOString(),
        video: file,
        pose,
      };
      await saveReference(stored);
      setReference(stored);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось разобрать эталон");
    } finally {
      setBusy(false);
    }
  }

  async function removeReference() {
    await deleteReference(id);
    setReference(null);
  }

  if (error && !movement) return <p className="error">{error}</p>;
  if (!movement) return <p className="muted">Загружаю движение…</p>;

  return (
    <main className="stack">
      <div>
        <span className="rubric">Browser-only reference</span>
        <h1>{movement.name}</h1>
        <p>{movement.description}</p>
      </div>

      {error && <p className="error">{error}</p>}

      {reference && referenceUrl ? (
        <>
          <ReferencePlayer src={referenceUrl} pose={reference.pose} />
          <p className="muted">
            Эталон сохранён только в IndexedDB этого браузера · {new Date(reference.createdAt).toLocaleString()}.
          </p>
          <div className="row">
            <label className="button ghost">
              Заменить эталон
              <input type="file" accept="video/*" hidden onChange={(event) => void importReference(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" className="ghost" onClick={() => void removeReference()}>Удалить локальный эталон</button>
          </div>
          <Link className="button" to={`/record/${movement.id}`}>Записать / загрузить попытку</Link>
        </>
      ) : (
        <section className="manuscript-panel local-reference-import">
          <span className="rubric">Первый раз</span>
          <h2>Добавь эталон тренера</h2>
          <p>
            Выбери короткое видео движения сбоку. Браузер сам извлечёт скелет и сохранит ролик локально.
            На сервер файл не отправляется.
          </p>
          <label className="button">
            {busy ? `Разбираю… ${Math.round(progress * 100)}%` : "Выбрать видео эталона"}
            <input type="file" accept="video/*" hidden disabled={busy} onChange={(event) => void importReference(event.target.files?.[0] ?? null)} />
          </label>
          {busy && <progress max={1} value={progress} />}
        </section>
      )}
    </main>
  );
}
