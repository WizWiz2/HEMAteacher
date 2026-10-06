# Pre-screen a video with MediaPipe (python, lite) to find candidate windows. Output screen/<id>.json
import sys, json, cv2, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
vid = sys.argv[1]; step = 3
M = '/workspace/hema/real/app/frontend/public/models/pose_landmarker_lite.task'
opt = vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=M), running_mode=vision.RunningMode.VIDEO, num_poses=3,
                                   min_pose_detection_confidence=0.5, min_tracking_confidence=0.5)
det = vision.PoseLandmarker.create_from_options(opt)
cap = cv2.VideoCapture(f'/workspace/hema/fresh/raw/{vid}.mp4'); fps = cap.get(cv2.CAP_PROP_FPS)
rows = []; i = 0; prev = None
while True:
    ok, fr = cap.read()
    if not ok: break
    if i % step == 0:
        small = cv2.resize(fr, (64, 36)); g = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(float)
        cut = float(abs(g - prev).mean()) if prev is not None else 0; prev = g
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
        t = int(i / fps * 1000); res = det.detect_for_video(img, t)
        people = []
        for lm in res.pose_landmarks:
            L = lambda k: lm[k]
            v = lambda k: (lm[k].visibility or 0)
            sh = ((L(11).x + L(12).x) / 2, (L(11).y + L(12).y) / 2); hp = ((L(23).x + L(24).x) / 2, (L(23).y + L(24).y) / 2)
            torso = max(1e-3, ((sh[0] - hp[0]) ** 2 + ((sh[1] - hp[1]) * 9 / 16) ** 2) ** .5)
            full = min(v(k) for k in (0, 11, 12, 23, 24, 27, 28))
            people.append(dict(full=round(full, 2), hipx=round(hp[0], 3), hipy=round(hp[1], 3), torso=round(torso, 3),
                               handup=round((L(0).y - min(L(15).y, L(16).y)) * 9 / 16 / torso, 2),
                               handx=round(((L(15).x + L(16).x) / 2 - hp[0]) / torso, 2),
                               ank=round((L(27).x - L(28).x) / torso, 2), face=round((L(0).x - hp[0]) / torso, 2),
                               top=round(min(l.y for l in lm), 3), bot=round(max(L(27).y, L(28).y, L(31).y, L(32).y), 3)))
        rows.append(dict(t=round(i / fps, 2), cut=round(cut, 1), p=people))
    i += 1
json.dump(dict(id=vid, fps=fps, rows=rows), open(f'/workspace/hema/fresh/screen/{vid}.json', 'w'))
print(vid, len(rows))
