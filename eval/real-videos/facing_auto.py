# facing_auto.py <rawdir> -> prints JSON {file: 'left'|'right'} from nose x vs ear midpoint (median over frames)
import json, sys, glob, os, statistics
out = {}
for f in sorted(glob.glob(sys.argv[1] + '/*.json')):
    vals = []
    for fr in json.load(open(f))['frames']:
        L = fr['landmarks']
        if all(k in L for k in ('nose', 'left_ear', 'right_ear')):
            vals.append(L['nose']['x'] - (L['left_ear']['x'] + L['right_ear']['x']) / 2)
    out[os.path.basename(f)] = ('right' if statistics.median(vals) > 0 else 'left') if vals else 'right'
    print(os.path.basename(f), out[os.path.basename(f)], round(statistics.median(vals), 4) if vals else None, file=sys.stderr)
print(json.dumps(out))
