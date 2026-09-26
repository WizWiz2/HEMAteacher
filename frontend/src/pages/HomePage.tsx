import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDrills } from "../api";
import type { Drill } from "../drill/types";

export function HomePage() {
  const [drills, setDrills] = useState<Drill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDrills().then(setDrills).catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main className="stack">
      <div>
        <h1>Тренировка</h1>
        <p className="lede">
          Встань боком к камере и собери движение из контрольных точек. Подсказка приходит сразу, ролик загружать не нужно.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="cards">
        {drills?.map((drill) => (
          <Link className="card" key={drill.id} to={`/drills/${drill.id}`}>
            <div className="card-top">
              <h2>{drill.name}</h2>
              <span className="badge">{drill.checkpoints.length} точек</span>
            </div>
            <p className="muted">{drill.description}</p>
            <span className="button">Начать тренировку</span>
          </Link>
        ))}
      </div>
      <Link className="button ghost" to="/analysis">Подробный разбор видео</Link>
      <Link className="muted" to="/dev/checkpoint-capture">Снять контрольную точку</Link>
    </main>
  );
}
