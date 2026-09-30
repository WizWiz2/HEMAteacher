import { useEffect, useState } from "react";
import { TargetPose } from "./TargetPose";
import type { Checkpoint, Drill } from "../drill/types";
import { targetPoseFor } from "../drill/posePresets";
import type { CameraView, Facing } from "../live/normalize";

export function CheckpointStoryboard({ drill, index, completed, facing, cameraView }:{
  drill: Drill; index: number; completed: boolean; facing: Facing; cameraView: CameraView;
}) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

  const checkpoint = (item: Checkpoint) => ({ ...item, targetPose: item.targetPose ?? targetPoseFor(item.targetPoseId) ?? undefined });
  const current = open === null ? null : drill.checkpoints[open];
  return <>
    <nav className="checkpoint-storyboard" aria-label="Порядок поз в упражнении">
      {drill.checkpoints.map((item, step) => <button key={item.id} type="button"
        className={`story-frame ${step === index && !completed ? "active" : step < index || completed ? "done" : ""}`}
        aria-label={`Открыть шаг ${step + 1}: ${item.title}`} aria-haspopup="dialog" onClick={() => setOpen(step)}>
        <TargetPose checkpoint={checkpoint(item)} facing={facing} cameraView={cameraView} calibrating={false} />
        <span className="story-caption"><b>{step + 1}</b> {item.title}</span>
      </button>)}
    </nav>
    {current && <div className="story-lightbox" role="dialog" aria-modal="true" aria-label={`Шаг ${open! + 1}: ${current.title}`}
      onMouseDown={event => { if (event.target === event.currentTarget) setOpen(null); }}>
      <section className="story-detail manuscript-panel">
        <header><div><span className="rubric">Шаг {open! + 1} из {drill.checkpoints.length}</span><h2>{current.title}</h2></div>
          <button type="button" autoFocus aria-label="Закрыть разбор" onClick={() => setOpen(null)}>Закрыть</button></header>
        <TargetPose checkpoint={checkpoint(current)} facing={facing} cameraView={cameraView} calibrating={false} />
        <p>{current.cue ?? (open === 0 ? "Исходная позиция." : open === drill.checkpoints.length - 1 ? "Конечная позиция." : `Промежуточная позиция: ${current.title}.`)}</p>
        <footer><button type="button" disabled={open === 0} onClick={() => setOpen(open! - 1)}>Предыдущая поза</button>
          <button type="button" disabled={open === drill.checkpoints.length - 1} onClick={() => setOpen(open! + 1)}>Следующая поза</button></footer>
      </section>
    </div>}
  </>;
}
