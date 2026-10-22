// Single-frame classical blade scan (as in bladeDetector.ts) on labelled frames. in: items.json [{name,W,H,hands:[x,y]px,torso,lm}], gray/<name>.raw
import {createServer} from '/workspace/HEMAteacher-push/frontend/node_modules/vite/dist/node/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
const N=['nose','left_eye_inner','left_eye','left_eye_outer','right_eye_inner','right_eye','right_eye_outer','left_ear','right_ear','mouth_left','mouth_right','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_pinky','right_pinky','left_index','right_index','left_thumb','right_thumb','left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle','left_heel','right_heel','left_foot_index','right_foot_index'];
const v=await createServer({root:'/workspace/HEMAteacher-push/frontend',configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},logLevel:'error'});
try{
 const D=await v.ssrLoadModule('/src/live/bladeDetector.ts');
 const items=JSON.parse(readFileSync(process.argv[2],'utf8')),out={};
 for(const it of items){
  const data=readFileSync(`gray/${it.name}.raw`),img={data,width:it.W,height:it.H};
  const lm={};it.lm.forEach((p,i)=>lm[N[i]]={x:p[0]/it.W,y:p[1]/it.H,z:0,visibility:p[2]});
  const hands=[it.hands[0]/it.W,it.hands[1]/it.H];
  const scan=D.scanBlade(img,hands,it.torso,D.BLADE_DETECTOR_DEFAULTS,D.bodyPoints(lm),D.shoulderCentre(lm));
  const k=D.bestIndex(scan.scores),conf=D.confidenceAt(scan,k),d=D.detectionAt(scan,k);
  out[it.name]={conf,ang:Math.atan2((d.tip[1]-d.guard[1])*it.H,(d.tip[0]-d.guard[0])*it.W)*180/Math.PI};
 }
 writeFileSync(process.argv[3],JSON.stringify(out));
}finally{await v.close();}
