# cut.py: cut every manifest row not yet cut into clips/<drill>/<clip_id>.mp4 (h264, native fps, optional x-crop)
import csv, os, subprocess
for r in csv.DictReader(open('/workspace/hema/fresh/manifest.csv')):
    out = f"/workspace/hema/fresh/clips/{r['drill']}/{r['clip_id']}.mp4"
    if os.path.exists(out): continue
    os.makedirs(os.path.dirname(out), exist_ok=True)
    vf = 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
    if r['crop_x']:
        a, b = map(float, r['crop_x'].split('-')); vf = f'crop=trunc(iw*{b-a}/2)*2:ih:trunc(iw*{a}):0'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', r['start_s'], '-to', r['end_s'], '-i', f"/workspace/hema/fresh/raw/{r['video_id']}.mp4",
                    '-vf', vf, '-an', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], check=True)
    print('cut', out)
