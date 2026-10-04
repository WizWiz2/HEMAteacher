# facing_map.py: {rawframe file: facing} from manifest; 'auto' -> nose-vs-ears median (facing_auto logic)
import csv, json, glob, os, statistics
man = {r['clip_id']: r for r in csv.DictReader(open('/workspace/hema/real/manifest.csv'))}; out = {}
for f in sorted(glob.glob('/workspace/hema/real/rawframes/*.json')):
    b = os.path.basename(f); clip = b.split('__', 1)[1][:-5]; fc = man[clip]['facing'] if clip in man else 'auto'
    if fc == 'auto':
        vals = [fr['landmarks']['nose']['x'] - (fr['landmarks']['left_ear']['x'] + fr['landmarks']['right_ear']['x']) / 2
                for fr in json.load(open(f))['frames'] if all(k in fr['landmarks'] for k in ('nose', 'left_ear', 'right_ear'))]
        fc = ('right' if statistics.median(vals) > 0 else 'left') if vals else 'right'
    out[b] = fc
print(json.dumps(out, indent=0))
