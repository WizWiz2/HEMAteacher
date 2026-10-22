# Sample candidate frames from the public HEMA videos: one dominant person, both wrists together (two-handed grip).
# Output frames/<vid>_<t>.jpg (640 wide) + cands.jsonl with landmarks (pixel coords).
import sys, json, glob, os, cv2, numpy as np, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
from concurrent.futures import ProcessPoolExecutor
M='/workspace/HEMAteacher-push/frontend/public/models/pose_landmarker_full.task'
HELD={'BAHFF - Bataireacht and Historical Fencing Faction','Paul Becker - Historical Fencing','Björn Rüther','Dreynschlag','Drey Wunder Martial Arts','Laurel City Historical Fencing','strîtschar - Historical Fencing School Sexau','Sword Carolina',"Ukolov's HMB educational channel",'VCU HEMA'}
os.makedirs('frames',exist_ok=True)
def chan(p):
    j=p[:-4]+'.info.json'
    if os.path.exists(j): d=json.load(open(j)); return d.get('channel') or d.get('uploader')
    return 'unk:'+os.path.basename(p)[:-4]
def run(p):
    vid=os.path.basename(p)[:-4]; ch=chan(p); split='held' if ch in HELD else 'train'
    det=vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=M),running_mode=vision.RunningMode.IMAGE,num_poses=2,min_pose_detection_confidence=.5))
    cap=cv2.VideoCapture(p); fps=cap.get(cv2.CAP_PROP_FPS) or 30; n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step=max(1,int(fps*0.7)); out=[]
    for fi in range(0,n,step):
        cap.set(cv2.CAP_PROP_POS_FRAMES,fi); ok,fr=cap.read()
        if not ok: break
        h,w=fr.shape[:2]
        if w!=640: fr=cv2.resize(fr,(640,round(h*640/w/2)*2)); h,w=fr.shape[:2]
        r=det.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(fr,cv2.COLOR_BGR2RGB)))
        ps=[]
        for lm in r.pose_landmarks:
            P=np.array([[l.x*w,l.y*h,l.visibility or 0] for l in lm])
            tor=np.hypot(*(P[[11,12],:2].mean(0)-P[[23,24],:2].mean(0))); ps.append((tor,P))
        if not ps: continue
        ps.sort(key=lambda x:-x[0]); tor,P=ps[0]
        if len(ps)>1 and ps[1][0]>0.6*tor: continue
        if tor<35 or min(P[[11,12,15,16,23,24],2])<.5: continue
        if np.hypot(*(P[15,:2]-P[16,:2]))>0.6*tor: continue
        name=f'{vid}_{fi:06d}'; cv2.imwrite(f'frames/{name}.jpg',fr,[cv2.IMWRITE_JPEG_QUALITY,92])
        out.append(dict(name=name,vid=vid,ch=ch,split=split,fi=fi,t=fi/fps,W=w,H=h,torso=float(tor),lm=np.round(P,1).tolist()))
    return out
vids=sorted(glob.glob('/workspace/hema/harvest/raw/*.mp4')+glob.glob('/workspace/hema/real/raw/*.mp4'))
seen=set(); vids=[v for v in vids if not (os.path.basename(v) in seen or seen.add(os.path.basename(v)))]
with ProcessPoolExecutor(7) as ex, open('cands.jsonl','w') as f:
    for v,res in zip(vids,ex.map(run,vids)):
        for r in res: f.write(json.dumps(r)+'\n')
        print(os.path.basename(v),len(res),flush=True)
