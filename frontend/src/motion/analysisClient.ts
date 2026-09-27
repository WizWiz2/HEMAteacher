import type { PoseSequence } from "../types";
import type { BrowserAnalysis } from "./types";

export function analyzeInWorker(movementId:string,reference:PoseSequence,attempt:PoseSequence):Promise<BrowserAnalysis>{
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
    worker.postMessage({id,movementId,reference,attempt});
  });
}
