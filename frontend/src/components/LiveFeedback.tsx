import { liveCues } from "../drill/feedback";
import type { CheckpointMatch } from "../drill/types";

export function LiveFeedback({ match, enough }: { match: CheckpointMatch | null; enough: boolean }) {
  const hasMeasurement = match != null && Object.values(match.features).some((feature) => Number.isFinite(feature.value));
  if (!enough || !match || !hasMeasurement) {
    return <p className="cue wait">Встань в кадр целиком и подержи позу.</p>;
  }
  const cues = liveCues(match, 3);
  if (cues.length === 0) return <p className="cue wait">Для этой точки нет ограничений.</p>;
  return (
    <ul className="cues">
      {cues.map((cue) => (
        <li key={cue.name} className={cue.ok ? "ok" : "bad"}>
          {cue.ok ? "✓" : "•"} {cue.text}
        </li>
      ))}
    </ul>
  );
}
