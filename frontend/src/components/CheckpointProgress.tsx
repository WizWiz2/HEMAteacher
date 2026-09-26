export function CheckpointProgress({ count, index, completed }: { count: number; index: number; completed: boolean }) {
  return (
    <div className="dots" aria-label={`Точка ${Math.min(index + 1, count)} из ${count}`}>
      {Array.from({ length: count }, (_, dot) => {
        const kind = completed || dot < index ? "done" : dot === index ? "current" : "todo";
        return <span key={dot} className={`dot ${kind}`} />;
      })}
    </div>
  );
}
