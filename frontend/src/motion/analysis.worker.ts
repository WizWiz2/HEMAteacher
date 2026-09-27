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

interface Response {
  id:string;
  ok:boolean;
  analysis?:ReturnType<typeof analyzeSequences>;
  error?:string;
}

const ctx=self as unknown as {
  onmessage: ((event:MessageEvent<Request>)=>void)|null;
  postMessage: (message:Response)=>void;
};

ctx.onmessage=(event)=>{
  const {id,movementId,reference,attempt,profile}=event.data;
  try {
    const analysis=analyzeSequences(movementId,reference,attempt,profile);
    ctx.postMessage({id,ok:true,analysis});
  } catch(error) {
    ctx.postMessage({id,ok:false,error:error instanceof Error?error.message:"Не удалось сравнить движения"});
  }
};
