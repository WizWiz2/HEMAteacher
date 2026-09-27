import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listDrills } from "../api";
import type { Drill } from "../drill/types";

export function HomePage() {
  const [drills, setDrills] = useState<Drill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDrills().then(setDrills).catch((reason: Error) => setError(reason.message));
  }, []);

  const groups = useMemo(() => {
    const list = drills ?? [];
    return [
      { id: "footwork", title: "Schritte · шаги", items: list.filter((d) => d.category === "footwork") },
      { id: "guards", title: "Leger · позиции", items: list.filter((d) => d.category === "guards") },
      { id: "meisterhau", title: "Meisterhäue · мастер-удары", items: list.filter((d) => d.category === "meisterhau") },
    ];
  }, [drills]);

  return (
    <main className="stack home-manuscript">
      <section className="hero-manuscript manuscript-panel">
        <span className="rubric">Ars Longi Gladii</span>
        <h1>HEMA Trainer</h1>
        <p>
          Повтори контрольные позиции перед камерой. Приложение показывает крупную подсказку,
          проговаривает её вслух и автоматически переводит к следующей фазе.
        </p>
      </section>

      {error && <p className="error">{error}</p>}

      {groups.map((group) => group.items.length > 0 && (
        <section key={group.id} className="library-section">
          <h2>{group.title}</h2>
          <div className="cards manuscript-cards">
            {group.items.map((drill) => (
              <Link className="card manuscript-card" key={drill.id} to={`/drills/${drill.id}`}>
                <div className="card-top">
                  <div>
                    <span className="rubric">{drill.trackingMode === "upper_body" ? "камера ближе" : "всё тело"}</span>
                    <h3>{drill.name}</h3>
                  </div>
                  <span className="badge">{drill.checkpoints.length} точек</span>
                </div>
                <p>{drill.description}</p>
                <span className="start-rune">Открыть упражнение →</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
