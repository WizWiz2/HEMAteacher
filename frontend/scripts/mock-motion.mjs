import {readFileSync,readdirSync} from 'node:fs';
export function clips(root) {
 return readdirSync(root).flatMap(id=>readdirSync(`${root}/${id}`).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`${root}/${id}/${f}`))));
}
export function samples(clip, normalizePose, torsoPixels, liveFeatures) {
 return clip.frames.map(frame=>{
  const raw={timestampMs:frame.t_ms,width:clip.resolution[0],height:clip.resolution[1],landmarks:Object.fromEntries(clip.landmark_format.names.map((name,i)=>{const[x,y,z,visibility]=frame.landmarks[i];return[name,{x,y,z,visibility}]}))};
  const normalized=normalizePose(raw,'right',torsoPixels(raw,0),0,'side');
  return {timeMs:frame.t_ms,features:liveFeatures(normalized.landmarks,0)};
 });
}
