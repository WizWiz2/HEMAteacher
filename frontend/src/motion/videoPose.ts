import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { LANDMARK_NAMES } from "../live/landmarks";
import type { Landmark, PoseSequence } from "../types";

let sharedLandmarker: Promise<PoseLandmarker> | null = null;

export interface ExtractPoseOptions {
  sampleFps?: number;
  maxDurationSeconds?: number;
  onProgress?: (fraction: number) => void;
}

export async function extractPoseFromVideo(blob: Blob, options: ExtractPoseOptions = {}): Promise<PoseSequence> {
  const sampleFps=options.sampleFps ?? 15;
  const maxDuration=options.maxDurationSeconds ?? 25;
  const url=URL.createObjectURL(blob);
  const video=document.createElement("video");
  video.muted=true;
  video.playsInline=true;
  video.preload="auto";
  video.src=url;

  try {
    await waitEvent(video,"loadedmetadata");
    await waitEvent(video,"loadeddata");
    const duration=Math.min(video.duration,maxDuration);
    if(!Number.isFinite(duration)||duration<=0) throw new Error("Браузер не смог прочитать длительность видео.");
    const width=video.videoWidth||1,height=video.videoHeight||1;
    const step=1/sampleFps;
    const frames:PoseSequence["frames"]=[];
    const landmarker=await getLandmarker();
    const total=Math.max(1,Math.floor(duration/step)+1);

    for(let index=0;index<total;index++){
      const seconds=Math.min(duration-.001,index*step);
      await seek(video,Math.max(0,seconds));
      const timestamp=Math.max(index,Math.round(seconds*1000));
      const result=landmarker.detectForVideo(video,timestamp);
      const landmarks:Record<string,Landmark>={};
      const pose=result.landmarks?.[0];
      if(pose){
        pose.forEach((point,i)=>{
          const name=LANDMARK_NAMES[i];
          if(!name)return;
          landmarks[name]={x:point.x,y:point.y,z:point.z,visibility:point.visibility??0};
        });
      }
      frames.push({timestamp_ms:timestamp,landmarks});
      options.onProgress?.((index+1)/total);
      if(index%6===0) await nextTask();
    }

    return {
      fps:sampleFps,
      duration_ms:Math.round(duration*1000),
      space:"image",
      width,
      height,
      frames,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function getLandmarker():Promise<PoseLandmarker>{
  if(!sharedLandmarker){
    sharedLandmarker=(async()=>{
      const vision=await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
      const common={
        baseOptions:{modelAssetPath:`${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`},
        runningMode:"VIDEO" as const,
        numPoses:1,
      };
      try {
        return await PoseLandmarker.createFromOptions(vision,{...common,baseOptions:{...common.baseOptions,delegate:"GPU"}});
      } catch {
        return PoseLandmarker.createFromOptions(vision,{...common,baseOptions:{...common.baseOptions,delegate:"CPU"}});
      }
    })();
  }
  return sharedLandmarker;
}

function waitEvent(target:HTMLMediaElement,name:string){
  if(name==="loadedmetadata"&&target.readyState>=1)return Promise.resolve();
  if(name==="loadeddata"&&target.readyState>=2)return Promise.resolve();
  return new Promise<void>((resolve,reject)=>{
    const ok=()=>{cleanup();resolve();};
    const fail=()=>{cleanup();reject(new Error("Браузер не смог декодировать видео. Попробуйте MP4/H.264 или WebM."));};
    const cleanup=()=>{target.removeEventListener(name,ok);target.removeEventListener("error",fail);};
    target.addEventListener(name,ok,{once:true});
    target.addEventListener("error",fail,{once:true});
  });
}

function seek(video:HTMLVideoElement,seconds:number){
  if(Math.abs(video.currentTime-seconds)<.002&&video.readyState>=2)return Promise.resolve();
  return new Promise<void>((resolve,reject)=>{
    const ok=()=>{cleanup();resolve();};
    const fail=()=>{cleanup();reject(new Error("Не удалось перейти к кадру видео."));};
    const cleanup=()=>{video.removeEventListener("seeked",ok);video.removeEventListener("error",fail);};
    video.addEventListener("seeked",ok,{once:true});
    video.addEventListener("error",fail,{once:true});
    video.currentTime=seconds;
  });
}

function nextTask(){return new Promise<void>((resolve)=>setTimeout(resolve,0));}
