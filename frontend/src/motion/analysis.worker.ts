import { analyzeSequences } from "./engine";
import type { PoseSequence } from "../types";
import type { AnalysisProfile } from "./types";

interface Request {
  id:string;
  movementId:string;
  reference:PoseSequence;
  attempt:PoseSequence;
  profile:AnalysisProfile;
}

self.onmessage=(event:MessageEvent<Request>)=>{
  const {id,movementId,reference,attempt,profile}=event.data;
  try {
    const analysis=analyzeSequences(movementId,reference,attempt,profile);
    self.postMessage({id,ok:true,analysis});
  } catch(error) {
    self.postMessage({id,ok:false,error:error instanceof Error?error.message:"Не удалось сравнить движения"});
  }
};
