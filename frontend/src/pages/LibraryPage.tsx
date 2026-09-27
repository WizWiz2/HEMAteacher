import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMovements } from "../api";
import { getReference } from "../motion/storage";
import type { MovementSummary } from "../types";

const VIEW: Record<string, string> = { side: "сбоку" };

export function LibraryPage() {
  const [items, setItems] = useState<MovementSummary[] | null>(null);
  const [localReady, setLocalReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMovements()
      .then(async (list) => {
        setItems(list);
        const pairs = await Promise.all(list.map(async (item) => [item.id, Boolean(await getReference(item.id))] as const));
        setLocalReady(Object.fromEntries(pairs));
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main className="stack">
      <Link className="muted" to="/">К тренировке</Link>
      <div>
        <span className="rubric">Локальный анализ</span>
        <h1>Подробный разбор видео</h1>
        <p className="lede">
          Видео и вычисления остаются на этом устройстве. Сначала один раз сохраните локальный эталон,
          затем сравнивайте с ним любые попытки без отправки роликов на сервер.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="cards manuscript-cards">
        {items?.map((item) => (
          <Link className="card manuscript-card" key={item.id} to={`/movements/${item.id}`}>
            <div className="card-top">
              <h2>{item.name}</h2>
              <span className={localReady[item.id] ? "badge ready" : "badge"}>
                {localReady[item.id] ? "эталон на устройстве" : "нужен эталон"}
              </span>
            </div>
            <p className="muted">Ракурс: {VIEW[item.camera_view] ?? item.camera_view}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
