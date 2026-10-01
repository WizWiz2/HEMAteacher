import { liveCues, primaryCue } from "../drill/feedback";
import type { CheckpointMatch, WeaponMatch } from "../drill/types";

export function LiveFeedback({
  match,
  enough,
  framingMessage,
  calibrating,
  weapon,
  completed = false,
  motion,
}: {
  match: CheckpointMatch | null;
  enough: boolean;
  framingMessage?: string;
  calibrating?: boolean;
  weapon?: WeaponMatch | null;
  completed?: boolean;
  motion?: import("../drill/continuousMotion").MotionAttempt;
}) {
  if (completed) {
    return (
      <div className="coach-overlay complete">
        <span className="coach-primary">ГОТОВО ✓</span>
        <span className="coach-score">Упражнение завершено</span>
      </div>
    );
  }
  if (motion && !calibrating) return <div className={`coach-overlay ${motion.phase === "armed" ? "good" : motion.phase === "failed" ? "adjust" : "wait"}`}><span className="coach-primary">{motion.message}</span></div>;
  const hasMeasurement = match != null && Object.values(match.features).some((feature) => Number.isFinite(feature.value));
  if (calibrating || !enough || !match || !hasMeasurement) {
    return <div className="coach-overlay wait"><span>{framingMessage ?? "ВСТАНЬ В КАДР"}</span></div>;
  }
  const cue = primaryCue(match);
  const details = liveCues(match, 3);
  const allGood = details.length > 0 && details.every((item) => item.ok);

  return (
    <div className={`coach-overlay ${allGood ? "good" : "adjust"}`}>
      <span className="coach-primary">{allGood ? "ДЕРЖИ ПОЗУ" : cue?.text ?? "ПОПРАВЬ ПОЗУ"}</span>
      <span className="coach-score">{Math.round(match.passScore * 100)}% условий</span>
      {weapon?.available && (
        <span className={weapon.passed ? "weapon-ok" : "weapon-adjust"}>
          Меч: {weapon.passed ? "линия похожа" : `поверни примерно на ${Math.round(Math.abs(weapon.deltaDeg ?? 0))}°`}
        </span>
      )}
    </div>
  );
}
