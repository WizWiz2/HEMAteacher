# strips.py <out.jpg> <id>:<w0>:<w1>[:crop x0-x1] ... -> one row of 10 frames per window, labelled
import sys, subprocess, io
from PIL import Image, ImageDraw
out, items = sys.argv[1], sys.argv[2:]; rows = []
for it in items:
    parts = it.split(':'); vid, w0, w1 = parts[0], float(parts[1]), float(parts[2])
    crop = parts[3] if len(parts) > 3 else None; ims = []
    NF = int(__import__('os').environ.get('NF', 10))
    for k in range(NF):
        t = w0 + (w1 - w0) * k / (NF - 1)
        vf = 'scale=-1:' + __import__('os').environ.get('SH', '150') + ''
        if crop: a, b = map(float, crop.split('-')); vf = f'crop=iw*{b-a}:ih:iw*{a}:0,' + vf
        png = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', f'/workspace/hema/real/raw/{vid}.mp4', '-frames:v', '1', '-vf', vf, '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
        im = Image.open(io.BytesIO(png)).convert('RGB'); ImageDraw.Draw(im).text((2, 2), f'{t:.1f}', fill=(255, 255, 0)); ims.append(im)
    w = sum(i.width for i in ims); H = ims[0].height + 15; row = Image.new('RGB', (w, H), 'black'); x = 0
    for i in ims: row.paste(i, (x, 15)); x += i.width
    ImageDraw.Draw(row).text((2, 1), it, fill=(0, 255, 255)); rows.append(row)
W = max(r.width for r in rows); RH = rows[0].height; img = Image.new('RGB', (W, RH * len(rows)), 'black')
for n, r in enumerate(rows): img.paste(r, (0, RH * n))
img.save(out, quality=85)
