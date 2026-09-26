export function DrillResultPage({ elapsedMs, onRetry }: { elapsedMs: number; onRetry: () => void }) {
  return (
    <div className="result-banner">
      <h2>Готово</h2>
      <p className="elapsed">{formatElapsed(elapsedMs)}</p>
      <p className="muted">Время от первой пройденной точки до последней. Это не оценка техники.</p>
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
