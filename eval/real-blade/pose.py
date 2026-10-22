# MediaPipe pose on labelled ok frames -> elbows+wrists of the person whose wrists are nearest the label's hands. -> pose_lab.jsonl
import json,sys,cv2,numpy as np,mediapipe as mp,os
from mediapipe.tasks.python import vision, BaseOptions
M='/workspace/hema-follow/frontend/public/models/pose_landmarker_full.task'
det=vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=M),running_mode=vision.RunningMode.IMAGE,num_poses=3,min_pose_detection_confidence=.4))
done=set()
if os.path.exists('pose_lab.jsonl'): done={json.loads(l)['name'] for l in open('pose_lab.jsonl')}
out=open('pose_lab.jsonl','a')
for l in open('all_lab.jsonl'):
    r=json.loads(l)
    if not r.get('ok') or r['name'] in done: continue
    im=cv2.imread(f"frames/{r['name']}.jpg"); H,W=im.shape[:2]
    res=det.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(im,cv2.COLOR_BGR2RGB)))
    best=None
    for lm in res.pose_landmarks:
        P=lambda k:[lm[k].x*W,lm[k].y*H,lm[k].visibility]
        wl,wr=P(15),P(16); d=np.hypot((wl[0]+wr[0])/2-r['hands'][0],(wl[1]+wr[1])/2-r['hands'][1])
        if best is None or d<best[0]: best=(d,{'el':P(13),'er':P(14),'wl':wl,'wr':wr})
    o={'name':r['name']}
    if best: o.update(best[1]); o['dist']=float(best[0])
    out.write(json.dumps(o)+'\n'); out.flush()
