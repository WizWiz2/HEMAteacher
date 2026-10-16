# pairs.py out_prefix id1 id2 ... -> /tmp/<prefix>_N.jpg with 2 peek sheets stacked (labelled)
import sys
from PIL import Image, ImageDraw
pre, ids = sys.argv[1], sys.argv[2:]
def ld(i):
    try: im = Image.open(f'/workspace/hema/harvest/sheets/peek_{i}.jpg')
    except Exception: im = Image.new('RGB', (1280, 180))
    im = im.resize((960, int(im.height * 960 / im.width))); d = ImageDraw.Draw(im); d.rectangle((400, 0, 560, 16), fill='red'); d.text((404, 2), i, fill='white'); return im
for k in range(0, len(ids), 2):
    g = [ld(i) for i in ids[k:k + 2]]; o = Image.new('RGB', (960, sum(i.height for i in g))); y = 0
    for i in g: o.paste(i, (0, y)); y += i.height
    o.save(f'/tmp/{pre}_{k // 2}.jpg', quality=80); print(f'/tmp/{pre}_{k // 2}.jpg', ids[k:k + 2])
