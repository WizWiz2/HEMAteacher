export function DrillResultPage({ elapsedMs, onRetry, continuous = false, feedback = [] }: { elapsedMs: number; onRetry: () => void; continuous?: boolean; feedback?: string[] }) {
  return (
    <div className="result-banner">
      <h2>{continuous ? "Движение распознано" : "Готово"}</h2>
      <p className="elapsed">{formatElapsed(elapsedMs)}</p>
      {continuous && <ul>{feedback.map(note => <li key={note}>{note}</li>)}</ul>}
      <p className="muted">{continuous ? "Время цельной попытки. По этому ракурсу оцениваем движение тела; ориентацию лезвия и работу кистей без отдельного отслеживания меча не проверяем." : "Время от первой пройденной точки до последней. Это не оценка техники."}</p>
      <button type="button" onClick={onRetry}>Ещё раз</button>
    </div>
  );
}

export function formatElapsed(ms: number): string {
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const centis = Math.floor((clamped % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}
