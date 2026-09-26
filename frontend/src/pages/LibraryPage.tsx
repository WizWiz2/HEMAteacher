import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMovements } from "../api";
import type { MovementSummary } from "../types";

const VIEW: Record<string, string> = { side: "сбоку" };

export function LibraryPage() {
  const [items, setItems] = useState<MovementSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMovements().then(setItems).catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main className="stack">
      <Link className="muted" to="/">К тренировке</Link>
      <div>
        <h1>Подробный разбор видео</h1>
        <p className="lede">
          Приложение сравнивает вашу попытку с записью, которую показал тренер.
          Это вторая пара глаз на тренировке, а не оценка «правильности» фехтования.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && <p>В каталоге пока нет движений.</p>}
      <div className="cards">
        {items?.map((item) => (
          <Link className="card" key={item.id} to={`/movements/${item.id}`}>
            <div className="card-top">
              <h2>{item.name}</h2>
              <span className={item.reference_ready ? "badge ready" : "badge"}>
                {item.reference_ready ? "эталон есть" : "нет эталона"}
              </span>
            </div>
            <p className="muted">Ракурс: {VIEW[item.camera_view] ?? item.camera_view}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
