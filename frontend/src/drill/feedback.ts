import type { CheckpointMatch } from "./types";

const CUES: Record<string, { high: string; low: string }> = {
  foot_distance: { high: "Сведи стопы", low: "Разведи стопы" },
  pelvis_height: { high: "↓ Опусти таз", low: "↑ Приподними таз" },
  torso_angle: { high: "↶ Корпус назад", low: "↷ Корпус вперёд" },
  left_ankle_x: { high: "Левая стопа ближе", low: "Левая стопа дальше вперёд" },
  right_ankle_x: { high: "Правая стопа ближе", low: "→ Правая стопа дальше" },
  left_ankle_y: { high: "Левая стопа ниже", low: "Левая стопа выше" },
  right_ankle_y: { high: "Правая стопа ниже", low: "Правая стопа выше" },
  left_knee_angle: { high: "Согни левое колено", low: "Разогни левое колено" },
  right_knee_angle: { high: "Согни правое колено", low: "Разогни правое колено" },
  knee_over_foot_left: { high: "Левое колено назад", low: "Левое колено вперёд" },
  knee_over_foot_right: { high: "Правое колено назад", low: "Правое колено вперёд" },
};

export interface LiveCue {
  name: string;
  ok: boolean;
  text: string;
}

/** Не больше трёх строк. Сначала самые большие промахи относительно цели. */
export function liveCues(match: CheckpointMatch | null, limit = 3): LiveCue[] {
  if (!match) return [];
  const rows = Object.entries(match.features).map(([name, feature]) => ({
    name,
    ok: feature.passed,
    gap: Math.abs(feature.delta ?? (feature.passed ? 0 : 1)),
    text: feature.passed ? passLabel(name) : failLabel(name, feature.delta),
  }));
  const fails = rows.filter((row) => !row.ok).sort((a, b) => b.gap - a.gap);
  const passes = rows.filter((row) => row.ok);
  return [...fails, ...passes].slice(0, limit).map((row) => ({ name: row.name, ok: row.ok, text: row.text }));
}

function passLabel(name: string): string {
  const labels: Record<string, string> = {
    foot_distance: "Расстояние стоп",
    pelvis_height: "Высота таза",
    torso_angle: "Корпус",
    left_ankle_x: "Левая стопа",
    right_ankle_x: "Правая стопа",
    left_knee_angle: "Левое колено",
    right_knee_angle: "Правое колено",
    knee_over_foot_left: "Левое колено над стопой",
    knee_over_foot_right: "Правое колено над стопой",
  };
  return labels[name] ?? name;
}

function failLabel(name: string, delta: number | undefined): string {
  const cue = CUES[name];
  if (!cue || delta == null || !Number.isFinite(delta)) return "Поправь положение";
  return delta > 0 ? cue.high : cue.low;
}
