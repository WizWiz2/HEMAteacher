import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMovement } from "../api";
import { analyzeInWorker } from "../motion/analysisClient";
import { getReference, saveSession } from "../motion/storage";
import { extractPoseFromVideo } from "../motion/videoPose";
import type { AnalysisStage } from "../motion/types";
import type { MovementDetail } from "../types";

export function RecordPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const liveRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [movement, setMovement] = useState<MovementDetail | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<AnalysisStage | null>(null);
  const [progress, setProgress] = useState(0);
  const secure = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
  const browserRecorderAvailable = secure && typeof MediaRecorder !== "undefined";

  useEffect(() => { getMovement(id).then(setMovement).catch((reason: Error) => setError(reason.message)); }, [id]);
  useEffect(() => {
    const video=liveRef.current;
    if(video&&stream){video.srcObject=stream;void video.play().catch(()=>undefined);}
  },[stream]);
  useEffect(() => {
    if(!recording)return;
    const timer=window.setInterval(()=>setSeconds((value)=>value+1),1000);
    return()=>window.clearInterval(timer);
  },[recording]);

  const streamRef=useRef<MediaStream|null>(null);
  const previewRef=useRef<string|null>(null);
  streamRef.current=stream;previewRef.current=previewUrl;
  useEffect(()=>()=>{streamRef.current?.getTracks().forEach((track)=>track.stop());if(previewRef.current)URL.revokeObjectURL(previewRef.current);},[]);

  async function enableCamera(){
    setError(null);
    if (!window.isSecureContext) {
      setError("Live-камера браузера требует HTTPS или localhost. На телефоне используй «Снять камерой устройства» — ролик всё равно анализируется локально.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Этот браузер не даёт live-доступ к камере. Используй «Снять камерой устройства».");
      return;
    }
    try{
      const media=await navigator.mediaDevices.getUserMedia({
        audio:false,
        video:{
          facingMode:{ideal:"environment"},
          width:{ideal:1280},
          height:{ideal:720},
        },
      });
      setStream(media);
    }catch(reason){
      const detail = reason instanceof DOMException ? ` (${reason.name})` : "";
      setError(`Live-камера не открылась${detail}. На телефоне используй «Снять камерой устройства» — это надёжнее Safari.`);
    }
  }

  function startRecording(){
    if(!stream)return;
    const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"].find((item)=>MediaRecorder.isTypeSupported(item));
    const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
    chunksRef.current=[];
    recorder.ondataavailable=(event)=>{if(event.data.size>0)chunksRef.current.push(event.data);};
    recorder.onstop=()=>{
      const next=new Blob(chunksRef.current,{type:recorder.mimeType||mime||"video/webm"});
      if(previewUrl)URL.revokeObjectURL(previewUrl);
      setBlob(next);setPreviewUrl(URL.createObjectURL(next));
      stream.getTracks().forEach((track)=>track.stop());setStream(null);
    };
    recorder.start();recorderRef.current=recorder;setSeconds(0);setRecording(true);
  }
  function stopRecording(){recorderRef.current?.stop();setRecording(false);}
  function onFile(file:File|null){
    if(!file)return;
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    setBlob(file);setPreviewUrl(URL.createObjectURL(file));setError(null);
  }

  async function analyze(){
    if(!blob)return;
    setBusy(true);setError(null);setProgress(0);
    try{
      const reference=await getReference(id);
      if(!reference)throw new Error("Для этого движения нет локального эталона. Сначала импортируй его.");
      setStage("extracting_pose");
      const attemptPose=await extractPoseFromVideo(blob,{sampleFps:15,onProgress:setProgress});
      const ratio=attemptPose.frames.filter((frame)=>Object.keys(frame.landmarks).length>0).length/Math.max(attemptPose.frames.length,1);
      if(ratio<0.65)throw new Error("Поза находится менее чем в 65% кадров. Весь человек должен оставаться в кадре.");
      setStage("aligning");
      const analysis=await analyzeInWorker(id,reference.pose,attemptPose);
      setStage("saving");
      const sessionId=crypto.randomUUID();
      await saveSession(sessionId,id,blob,analysis);
      navigate(`/sessions/${sessionId}`);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"Не удалось проанализировать видео");
      setBusy(false);setStage(null);
    }
  }

  return (
    <main className="stack">
      <div>
        <span className="rubric">Локальная обработка</span>
        <h1>{movement?movement.name:"Запись"}</h1>
        <p className="lede">Ролик остаётся в браузере: MediaPipe, нормализация, DTW и comparison выполняются на этом устройстве.</p>
      </div>
      <ul className="checklist">
        <li>В кадре весь человек, от головы до обеих стоп.</li>
        <li>Камера неподвижна и стоит сбоку.</li>
        <li>Одна попытка на ролик; оптимально 2–10 секунд.</li>
      </ul>
      {error&&<p className="error">{error}</p>}

      {!blob && (
        <section className="record-source-grid">
          <label className="button record-primary">
            Снять камерой устройства
            <input
              type="file"
              accept="video/*"
              capture="environment"
              hidden
              disabled={busy}
              onChange={(event)=>onFile(event.target.files?.[0]??null)}
            />
          </label>

          <label className="button ghost">
            Выбрать готовое видео
            <input type="file" accept="video/*" hidden disabled={busy} onChange={(event)=>onFile(event.target.files?.[0]??null)} />
          </label>

          {browserRecorderAvailable && !stream && (
            <button type="button" className="ghost" onClick={()=>void enableCamera()}>
              Live-камера в браузере
            </button>
          )}

          {!secure && (
            <p className="muted record-source-note">
              Live-камера браузера отключена: для неё нужен HTTPS или localhost. Нативная камера устройства выше работает без этого ограничения.
            </p>
          )}
        </section>
      )}

      {stream&&!blob&&(
        <div className="stack">
          <video ref={liveRef} className="preview-live" playsInline muted autoPlay />
          {!recording&&<button type="button" onClick={startRecording}>Начать запись</button>}
          {recording&&<button type="button" onClick={stopRecording}>Остановить ({seconds} с)</button>}
        </div>
      )}
      {previewUrl&&(
        <div className="stack">
          <video className="preview-live" src={previewUrl} controls playsInline />
          {busy ? (
            <section className="manuscript-panel browser-analysis-progress">
              <strong>{stageLabel(stage)}</strong>
              {stage==="extracting_pose"&&<progress max={1} value={progress}/>}
              <span>{stage==="extracting_pose"?`${Math.round(progress*100)}%`:"Вычисления идут локально"}</span>
            </section>
          ) : (
            <div className="row">
              <button type="button" onClick={()=>void analyze()}>Анализировать на этом устройстве</button>
              <button type="button" className="ghost" onClick={()=>{setBlob(null);if(previewUrl)URL.revokeObjectURL(previewUrl);setPreviewUrl(null);}}>Переснять</button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function stageLabel(stage:AnalysisStage|null){
  if(stage==="extracting_pose")return"Считываю положение тела";
  if(stage==="aligning")return"Сопоставляю движение";
  if(stage==="saving")return"Сохраняю результат локально";
  return"Готовлю анализ";
}
