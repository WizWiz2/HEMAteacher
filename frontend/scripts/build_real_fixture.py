# [CAP=2] [DROP=zwerchhau] build_real_fixture.py <reps_tlog> <clips.json> <in_fixture.gz> <out_fixture.gz>
# Appends one fixture clip per KEPT real rep (variant 'real:train', body 'real:<person>', level master), side-processed
# like the synthetic clips (fixture has no z). Left-facing clips are mirrored (x -> 1-x, left_/right_ swapped) because
# the fixture pipeline assumes facing right. Context of 800 ms around the rep, move = rep window.
import gzip, json, sys, re, os, collections
DROP = set(filter(None, os.environ.get('DROP', '').split(',')))  # drills whose real reps are left out
CAP = int(os.environ.get('CAP', '0'))  # max reps per person and drill (0 = all), evenly spaced
tlog, cj, fin, fout = sys.argv[1:5]
clips = {c['id']: c for c in json.load(open(cj))}
fx = json.load(gzip.open(fin)); names = fx['names']
swap = {n: (n.replace('left_', 'right_') if n.startswith('left_') else n.replace('right_', 'left_') if n.startswith('right_') else n) for n in names}
fx['clips'] = [c for c in fx['clips'] if c['variant'] != 'real:train']
slug = lambda s: re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')[:40]
kept = [l.split() for l in open(tlog) if l.split() and l.split()[-1] == 'KEEP' and clips[l.split()[0]]['drill'] not in DROP]
if CAP:
    g = collections.defaultdict(list)
    for r in kept: g[(clips[r[0]]['person'], clips[r[0]]['drill'])].append(r)
    kept = [v[round(i * (len(v) - 1) / max(1, CAP - 1))] if len(v) > CAP else v[i] for v in g.values() for i in range(min(CAP, len(v)))]
n = 0
for cid, k, t0, t1, ratio, why in kept:
    c = clips[cid]; raw = json.load(open(c['raw'])); fr = raw['frames']
    a, b = float(t0) * 1000, float(t1) * 1000; s0, s1 = a - 800, b + 800
    sel = [f for f in fr if s0 <= f['timestampMs'] <= s1]
    if len(sel) < 10: continue
    base = sel[0]['timestampMs']; mirror = c['facing'] == 'left'
    t, p = [], []
    for f in sel:
        t.append(int(round(f['timestampMs'] - base)))
        L = f['landmarks']
        if not L: p.append([]); continue
        row = []
        for nm in names:
            src = L.get(swap[nm] if mirror else nm)
            if not src: row += [0, 0, 0]; continue
            x = 1 - src['x'] if mirror else src['x']
            row += [int(round(x * 1e4)), int(round(src['y'] * 1e4)), int(round(src.get('visibility', 0) * 100))]
        p.append(row)
    fx['clips'].append({'id': f"real/{c['drill']}/{cid}_r{k}", 'drill': c['drill'], 'variant': 'real:train', 'body': 'real:' + slug(c['person']),
        'level': 'master', 'source': f"public video (eval/real-harvest manifest {cid}), browser MediaPipe Lite", 'move': [int(round(a - base)), int(round(b - base))],
        'width': sel[0]['width'], 'height': sel[0]['height'], 't': t, 'p': p})
    n += 1
with gzip.open(fout, 'wt') as g: json.dump(fx, g, separators=(',', ':'))
print('real clips appended', n, 'total', len(fx['clips']))
