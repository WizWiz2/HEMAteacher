import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMovement, getPose } from "../api";
import { ReferencePlayer } from "../player";
import type { MovementDetail, PoseSequence } from "../types";

export function MovementPage() {
  const { id = "" } = useParams();
  const [movement, setMovement] = useState<MovementDetail | null>(null);
  const [pose, setPose] = useState<PoseSequence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setMovement(null);
    setPose(null);
    getMovement(id)
      .then(async (detail) => {
        if (!alive) return;
        setMovement(detail);
        if (detail.reference_pose_url) {
          const sequence = await getPose(detail.reference_pose_url);
          if (alive) setPose(sequence);
        }
      })
      .catch((reason: Error) => {
        if (alive) setError(reason.message);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!movement) return <p className="muted">Загружаю движение…</p>;

  return (
    <main className="stack">
      <div>
        <h1>{movement.name}</h1>
        <p>{movement.description}</p>
      </div>
      {movement.reference_ready && movement.reference_video_url ? (
        <ReferencePlayer src={movement.reference_video_url} pose={pose} />
      ) : (
        <div className="callout">
          <h2>Эталон ещё не загружен</h2>
          <p>Снимите движение сбоку и импортируйте его один раз:</p>
          <pre className="command">{`python scripts/import_reference.py --movement ${movement.id} --video reference.mp4`}</pre>
        </div>
      )}
      {movement.reference_ready ? (
        <Link className="button" to={`/record/${movement.id}`}>Записать попытку</Link>
      ) : (
        <button type="button" disabled>Записать попытку</button>
      )}
    </main>
  );
}
