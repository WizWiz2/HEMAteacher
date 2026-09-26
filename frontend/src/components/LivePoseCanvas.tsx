import type { RefObject } from "react";

export function LivePoseCanvas({
  videoRef,
  canvasRef,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <div className="video-wrap live-frame">
      <video ref={videoRef} playsInline muted autoPlay />
      <canvas ref={canvasRef} className="overlay" />
    </div>
  );
}
