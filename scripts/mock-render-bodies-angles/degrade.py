"""Webcam-like degradation: drop frames (repeat previous), optional downscale, then gen/postprocess.py noise + CRF.
Usage: degrade.py <frames_dir> <out.mp4> --seed N --drop F --scale W --noise S --crf C"""
import argparse, glob, os, random, shutil, subprocess, tempfile
import cv2
ap = argparse.ArgumentParser(); ap.add_argument("frames"); ap.add_argument("out")
ap.add_argument("--seed", type=int, default=0); ap.add_argument("--drop", type=float, default=0.0)
ap.add_argument("--scale", type=int, default=0); ap.add_argument("--noise", type=float, default=0.012); ap.add_argument("--crf", type=int, default=25)
a = ap.parse_args()
files = sorted(glob.glob(os.path.join(a.frames, "*.png"))); rng = random.Random(a.seed)
tmp = tempfile.mkdtemp(prefix="degrade_"); dropped = []
prev = None
for i, f in enumerate(files):
    src = f
    if i > 0 and rng.random() < a.drop: src = prev; dropped.append(i)
    else: prev = f
    dst = os.path.join(tmp, f"{i:04d}.png")
    if a.scale:
        im = cv2.imread(src); h, w = im.shape[:2]; cv2.imwrite(dst, cv2.resize(im, (a.scale, round(h * a.scale / w)), interpolation=cv2.INTER_AREA))
    else: os.symlink(src, dst)
subprocess.run(["python3", "/workspace/hema/gen/postprocess.py", tmp, a.out, "--seed", str(a.seed), "--noise", str(a.noise), "--crf", str(a.crf)], check=True)
shutil.rmtree(tmp); print("dropped", len(dropped), dropped)
