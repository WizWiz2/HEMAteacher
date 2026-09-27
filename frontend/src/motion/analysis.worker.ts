import { analyzeSequences } from "./engine";
import type { PoseSequence } from "../types";

interface Request {
  id:string;
  movementId:string;
  reference:PoseSequence;
  attempt:PoseSequence;
}

self.onmessage=(event:MessageEvent<Request>)=>{
  const {id,movementId,reference,attempt}=event.data;
  try {
    const analysis=analyzeSequences(movementId,reference,attempt);
    self.postMessage({id,ok:true,analysis});
  } catch(error) {
    self.postMessage({id,ok:false,error:error instanceof Error?error.message:"Не удалось сравнить движения"});
  }
};
