import type { RefObject } from "react";

export function LivePoseCanvas({
  videoRef,
  canvasRef,
  mirrored = false,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  mirrored?: boolean;
}) {
  return (
    <div className={`video-wrap live-frame ${mirrored ? "preview-mirrored" : ""}`}>
      <video ref={videoRef} playsInline muted autoPlay />
      <canvas ref={canvasRef} className="overlay" />
    </div>
  );
}
