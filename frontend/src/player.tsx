import { useEffect, useRef, useState } from "react";
import { drawImageSkeleton, fitCanvas, frameAt } from "./skeleton";
import type { PoseSequence } from "./types";

const RATES = [0.25, 0.5, 1];

export function ReferencePlayer({ src, pose }: { src: string; pose: PoseSequence | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rate, setRate] = useState(1);
  const [skeleton, setSkeleton] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && skeleton) {
        const fitted = fitCanvas(canvas);
        if (fitted) {
          const poseFrame = frameAt(pose, video.currentTime * 1000);
          drawImageSkeleton(fitted.ctx, video, poseFrame, "#e2c48a");
        }
      } else if (canvas && !skeleton) {
        fitCanvas(canvas);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pose, skeleton]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="stack">
      <div className="video-wrap">
        <video
          ref={videoRef}
          src={src}
          playsInline
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
        <canvas ref={canvasRef} className="overlay" />
      </div>
      <div className="row">
        <button type="button" onClick={toggle}>{playing ? "Пауза" : "Смотреть"}</button>
        {RATES.map((value) => (
          <button
            key={value}
            type="button"
            className={value === rate ? "ghost active" : "ghost"}
            onClick={() => setRate(value)}
          >
            {value}×
          </button>
        ))}
        <button type="button" className={skeleton ? "ghost active" : "ghost"} onClick={() => setSkeleton((value) => !value)}>
          Скелет
        </button>
      </div>
    </div>
  );
}
