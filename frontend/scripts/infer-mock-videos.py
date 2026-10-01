import argparse,json,pathlib,time,cv2,mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
parser=argparse.ArgumentParser(description='Decode MP4 and infer raw poses with MediaPipe lite CPU (not browser WASM).')
parser.add_argument('--root',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[2])
parser.add_argument('--output',type=pathlib.Path,required=True)
args=parser.parse_args();root=args.root;out=args.output;out.mkdir(parents=True,exist_ok=True)
for file in sorted((root/'test-data/mock-videos').glob('*/*.mp4')):
    labels=json.loads(file.with_suffix('.json').read_text()); cap=cv2.VideoCapture(str(file)); fps=cap.get(cv2.CAP_PROP_FPS)
    options=vision.PoseLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=str(root/'frontend/public/models/pose_landmarker_lite.task')),running_mode=vision.RunningMode.VIDEO,num_poses=1)
    frames=[]; timings=[]
    with vision.PoseLandmarker.create_from_options(options) as model:
        index=0
        while True:
            ok,frame=cap.read()
            if not ok:break
            t=round(index/fps*1000); index+=1
            img=mp.Image(image_format=mp.ImageFormat.SRGB,data=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB))
            start=time.perf_counter();result=model.detect_for_video(img,t);timings.append((time.perf_counter()-start)*1000)
            points=result.pose_landmarks[0] if result.pose_landmarks else []
            frames.append({'timestampMs':t,'width':frame.shape[1],'height':frame.shape[0],'landmarks':{name:{'x':p.x,'y':p.y,'z':p.z,'visibility':p.visibility} for name,p in zip(labels['landmark_format']['names'],points)}})
    cap.release()
    payload={'file':str(file.relative_to(root)),'drill':labels['drill_id'],'level':labels['level'],'body':labels['body_type'],'backend':'Python MediaPipe tasks CPU; same lite model asset, different runtime from browser','inferenceMs':sum(timings)/len(timings),'frames':frames}
    (out/(file.parent.name+'_'+file.stem+'.json')).write_text(json.dumps(payload))
    print(file.name,len(frames),round(payload['inferenceMs'],1),flush=True)
