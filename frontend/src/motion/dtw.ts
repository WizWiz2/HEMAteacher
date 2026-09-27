import type { AlignmentPair } from "../types";
import type { PreparedMotion } from "./types";

export interface AlignmentResult {
  distance: number;
  pairs: AlignmentPair[];
}

export function alignDtw(reference: PreparedMotion, attempt: PreparedMotion, names: string[]): AlignmentResult {
  if(!reference.timestamps_ms.length || !attempt.timestamps_ms.length) throw new Error("Пустая последовательность");
  const ref=matrix(reference,names), att=matrix(attempt,names);
  const {a,b}=standardize(ref,att);
  const n=a.length,m=b.length;
  const acc=Array.from({length:n},()=>new Float64Array(m).fill(Number.POSITIVE_INFINITY));
  const local=(i:number,j:number)=>{
    let sum=0;
    for(let k=0;k<a[i].length;k++){const d=a[i][k]-b[j][k];sum+=d*d;}
    return Math.sqrt(sum);
  };
  acc[0][0]=local(0,0);
  for(let i=1;i<n;i++) acc[i][0]=local(i,0)+acc[i-1][0];
  for(let j=1;j<m;j++) acc[0][j]=local(0,j)+acc[0][j-1];
  for(let i=1;i<n;i++) for(let j=1;j<m;j++) acc[i][j]=local(i,j)+Math.min(acc[i-1][j],acc[i][j-1],acc[i-1][j-1]);

  let i=n-1,j=m-1;
  const path:Array<[number,number]>=[[i,j]];
  while(i>0||j>0){
    if(i===0) j--;
    else if(j===0) i--;
    else {
      const diag=acc[i-1][j-1], up=acc[i-1][j], left=acc[i][j-1];
      if(diag<=up&&diag<=left){i--;j--;} else if(up<=left){i--;} else j--;
    }
    path.push([i,j]);
  }
  path.reverse();

  const buckets=new Map<number,number[]>();
  for(const [ri,ai] of path){const arr=buckets.get(ri)??[];arr.push(ai);buckets.set(ri,arr);}
  const pairs:AlignmentPair[]=[];
  for(let ri=0;ri<reference.timestamps_ms.length;ri++){
    const choices=buckets.get(ri)??[Math.min(ri,attempt.timestamps_ms.length-1)];
    const ai=Math.max(0,Math.min(medianInt(choices),attempt.timestamps_ms.length-1));
    pairs.push({
      reference_frame:ri,attempt_frame:ai,
      reference_time_ms:reference.timestamps_ms[ri],
      attempt_time_ms:attempt.timestamps_ms[ai],
    });
  }
  return {distance:acc[n-1][m-1]/Math.max(path.length,1),pairs};
}

function matrix(motion:PreparedMotion,names:string[]){
  const n=motion.timestamps_ms.length;
  return Array.from({length:n},(_,i)=>names.map(name=>{
    const v=motion.features[name]?.[i];
    return Number.isFinite(v)?v:0;
  }));
}
function standardize(ref:number[][],att:number[][]){
  const dims=ref[0]?.length??1;
  const mean=Array(dims).fill(0),std=Array(dims).fill(1);
  for(let k=0;k<dims;k++){
    mean[k]=ref.reduce((s,row)=>s+row[k],0)/ref.length;
    const variance=ref.reduce((s,row)=>s+(row[k]-mean[k])**2,0)/ref.length;
    std[k]=Math.sqrt(variance); if(std[k]<1e-6) std[k]=1;
  }
  const map=(rows:number[][])=>rows.map(row=>row.map((v,k)=>(v-mean[k])/std[k]));
  return {a:map(ref),b:map(att)};
}
function medianInt(values:number[]){const s=[...values].sort((a,b)=>a-b);return s[Math.floor((s.length-1)/2)];}
