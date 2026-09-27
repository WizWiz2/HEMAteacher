import type { BrowserAnalysis } from "./types";
import type { PoseSequence, ComparisonResult } from "../types";

const DB_NAME="hema-trainer";
const DB_VERSION=1;
const REF_STORE="references";
const SESSION_STORE="sessions";

export interface LocalReference {
  movementId:string;
  createdAt:string;
  video:Blob;
  pose:PoseSequence;
}

export interface LocalSession {
  id:string;
  movementId:string;
  createdAt:string;
  video:Blob;
  pose:PoseSequence;
  normalizedPose:PoseSequence;
  result:ComparisonResult;
}

export async function saveReference(value:LocalReference):Promise<void>{
  await put(REF_STORE,value);
}
export async function getReference(movementId:string):Promise<LocalReference|null>{
  return get<LocalReference>(REF_STORE,movementId);
}
export async function deleteReference(movementId:string):Promise<void>{
  await del(REF_STORE,movementId);
}
export async function saveSession(id:string,movementId:string,video:Blob,analysis:BrowserAnalysis):Promise<void>{
  const value:LocalSession={
    id,movementId,createdAt:new Date().toISOString(),video,
    pose:analysis.attemptImage,normalizedPose:analysis.attemptNormalized,result:analysis.result,
  };
  await put(SESSION_STORE,value);
}
export async function getLocalSession(id:string):Promise<LocalSession|null>{
  return get<LocalSession>(SESSION_STORE,id);
}
export async function deleteLocalSession(id:string):Promise<void>{
  await del(SESSION_STORE,id);
}

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(REF_STORE)) db.createObjectStore(REF_STORE,{keyPath:"movementId"});
      if(!db.objectStoreNames.contains(SESSION_STORE)){
        const store=db.createObjectStore(SESSION_STORE,{keyPath:"id"});
        store.createIndex("movementId","movementId");
        store.createIndex("createdAt","createdAt");
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error("IndexedDB недоступна"));
  });
}
async function put(storeName:string,value:unknown){
  const db=await openDb();
  await transaction(db,storeName,"readwrite",(store)=>store.put(value));
  db.close();
}
async function get<T>(storeName:string,key:IDBValidKey):Promise<T|null>{
  const db=await openDb();
  try {
    return await new Promise<T|null>((resolve,reject)=>{
      const tx=db.transaction(storeName,"readonly");
      const request=tx.objectStore(storeName).get(key);
      request.onsuccess=()=>resolve((request.result as T|undefined)??null);
      request.onerror=()=>reject(request.error);
    });
  } finally {db.close();}
}
async function del(storeName:string,key:IDBValidKey){
  const db=await openDb();
  await transaction(db,storeName,"readwrite",(store)=>store.delete(key));
  db.close();
}
function transaction(db:IDBDatabase,storeName:string,mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest){
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(storeName,mode);
    action(tx.objectStore(storeName));
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
  });
}
