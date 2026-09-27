import type { PoseSequence } from "../types";
import type { AnalysisProfile, BrowserAnalysis } from "./types";

const profileCache=new Map<string,Promise<AnalysisProfile>>();

export async function analyzeInWorker(
  movementId:string,
  reference:PoseSequence,
  attempt:PoseSequence,
  profileId="footwork_v1",
):Promise<BrowserAnalysis>{
  const profile=await loadProfile(profileId);
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("./analysis.worker.ts",import.meta.url),{type:"module"});
    const id=crypto.randomUUID();
    const cleanup=()=>worker.terminate();
    worker.onmessage=(event:MessageEvent<{id:string;ok:boolean;analysis?:BrowserAnalysis;error?:string}>)=>{
      if(event.data.id!==id)return;
      cleanup();
      if(event.data.ok&&event.data.analysis)resolve(event.data.analysis);
      else reject(new Error(event.data.error??"Не удалось сравнить движения"));
    };
    worker.onerror=(event)=>{cleanup();reject(new Error(event.message||"Ошибка analysis worker"));};
    worker.postMessage({id,movementId,reference,attempt,profile});
  });
}

function loadProfile(id:string):Promise<AnalysisProfile>{
  const cached=profileCache.get(id);
  if(cached)return cached;
  const promise=fetch(`${import.meta.env.BASE_URL}content/${id}.json`).then(async(response)=>{
    if(!response.ok)throw new Error(`Не найден профиль анализа ${id}`);
    return response.json() as Promise<AnalysisProfile>;
  });
  profileCache.set(id,promise);
  return promise;
}
