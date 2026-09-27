import type { PhaseSpan } from "./types";

export function segmentMotion(features: Record<string, number[]>, fps: number): PhaseSpan[] {
  const count = Object.values(features)[0]?.length ?? 0;
  if (!count) return [];
  if (count < 4) return [{ name: "stride", start_frame: 0, end_frame: count }];

  const speed = footSpeed(features, fps, count);
  const finite = speed.filter(Number.isFinite);
  if (!finite.length) return quartiles(count);
  const peak = percentile(finite, 95);
  const threshold = Math.max(0.25, 0.22 * peak);
  const active = speed.map((value,index)=>value>threshold?index:-1).filter((value)=>value>=0);
  if (!active.length) return quartiles(count);

  const start = active[0];
  const end = active[active.length-1] + 1;
  const foot = features.foot_distance ?? [];
  let maxStride = Math.floor((start + end) / 2);
  let best = -Infinity;
  for(let i=start;i<Math.min(end,foot.length);i++){
    const value=foot[i];
    if(Number.isFinite(value) && value>best){best=value;maxStride=i;}
  }

  let plant = -1;
  for(let i=maxStride;i<end;i++) if(speed[i] < threshold){plant=i;break;}
  if(plant<0) plant=maxStride+Math.max(1,Math.floor(.45*(end-maxStride)));
  plant=Math.min(Math.max(plant,maxStride),count);

  const labels=Array(count).fill("preparation");
  for(let i=start;i<maxStride;i++) labels[i]="stride";
  for(let i=maxStride;i<plant;i++) labels[i]="landing";
  for(let i=Math.max(plant,maxStride);i<count;i++) labels[i]="completion";
  return compress(labels);
}

function footSpeed(features:Record<string,number[]>,fps:number,count:number){
  const series=(name:string)=>{
    const src=features[name]??[];
    return Array.from({length:count},(_,i)=>Number.isFinite(src[i])?src[i]:0);
  };
  const speed=(x:number[],y:number[])=>x.map((_,i)=>{
    const prev=Math.max(0,i-1);
    return Math.hypot(x[i]-x[prev],y[i]-y[prev])*Math.max(fps,1);
  });
  const left=speed(series("left_ankle_x"),series("left_ankle_y"));
  const right=speed(series("right_ankle_x"),series("right_ankle_y"));
  const combined=left.map((v,i)=>Math.max(v,right[i]));
  if(count<5) return combined;
  return combined.map((_,i)=>{
    let total=0,n=0;
    for(let k=Math.max(0,i-2);k<=Math.min(count-1,i+2);k++){total+=combined[k];n++;}
    return total/n;
  });
}
function compress(labels:string[]):PhaseSpan[]{
  const out:PhaseSpan[]=[]; let start=0;
  for(let i=1;i<=labels.length;i++){
    if(i===labels.length||labels[i]!==labels[start]){
      out.push({name:labels[start],start_frame:start,end_frame:i}); start=i;
    }
  }
  return out;
}
function quartiles(count:number):PhaseSpan[]{
  const cuts=[0,Math.max(1,Math.floor(count/4)),Math.max(2,Math.floor(count/2)),Math.max(3,Math.floor(3*count/4)),count];
  const unique=[...new Set(cuts.map(v=>Math.min(count,v)))].sort((a,b)=>a-b);
  const names=["preparation","stride","landing","completion"];
  const out:PhaseSpan[]=[];
  for(let i=0;i<unique.length-1;i++) if(unique[i+1]>unique[i]) out.push({name:names[Math.min(i,3)],start_frame:unique[i],end_frame:unique[i+1]});
  return out.length?out:[{name:"stride",start_frame:0,end_frame:count}];
}
function percentile(values:number[],p:number){
  const sorted=[...values].sort((a,b)=>a-b);
  const pos=(sorted.length-1)*p/100, lo=Math.floor(pos), hi=Math.ceil(pos);
  return lo===hi?sorted[lo]:sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
}
