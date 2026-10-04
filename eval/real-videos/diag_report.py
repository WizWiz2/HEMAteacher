# diag_report.py: diag/attempts.json -> diag/diagnosis.md (real vs synthetic distributions; per-channel divergence)
import json, statistics as st, collections
R = json.load(open('/workspace/hema/real/diag/attempts.json'))
STR = lambda d: d.endswith('hau')
def grp(s, kind): return [r for r in R if r['set'] == s and 'own' in r and (STR(r['drill']) == (kind == 'strikes'))]
def q(v, p): v = sorted(v); return v[min(len(v) - 1, int(p * (len(v) - 1) + .5))] if v else float('nan')
def qs(v): return f"{q(v,.1):.2f} / {q(v,.5):.2f} / {q(v,.9):.2f}" if v else '-'
L = []; P = L.append
P('# Diagnosis: why real distances are far above the accept distance\n')
P('Same pipeline (VideoRegressionPage semantics, shipped model, acceptDistance 2.735) for the 30 real clips and the 148 reserved synthetic TEST clips (master/experienced). Values: 10th / median / 90th percentile.\n')
P('| metric | real strikes | synth strikes | real steps | synth steps |\n|---|---|---|---|---|')
M = [('own-drill distance', 'own'), ('best-of-all distance', 'bestDist'), ('own distance, best prefix of attempt', 'bestPrefixOwn'), ('tempo (active duration / typical)', 'tempo'),
     ('attempt duration ms', 'attemptMs'), ('path ratio (attempt path / typical)', 'pathRatio'), ('hand x range (torso)', 'handRangeX'), ('hand y range (torso)', 'handRangeY'),
     ('hand path length (torso)', 'handPath'), ('root x range (torso)', 'rootRange'), ('ankle x range (torso)', 'ankleRange'),
     ('hand over head at attempt start (torso, - = above nose)', 'startHOH'), ('highest hand over head in attempt', 'minHOH'), ('lowest hand in attempt', 'maxHOH'), ('hand x at attempt start (torso)', 'startHandX'),
     ('hand jitter (torso/frame)', 'jitHand'), ('ankle jitter (torso/frame)', 'jitAnkle'), ('torso length / frame height', 'torsoFrac'), ('min limb visibility', 'minLimbVis'), ('fps', 'fps')]
for name, k in M:
    P(f"| {name} | " + ' | '.join(qs([r[k] for r in grp(s, kind) if isinstance(r.get(k), (int, float))]) for kind in ('strikes', 'steps') for s in ('real', 'synthetic')) + ' |')
n = {f'{s}_{k}': len(grp(s, k)) for s in ('real', 'synthetic') for k in ('strikes', 'steps')}
P(f"\nn: {n}. Real clips with no attempt (never started / calibration failed): {[r['id'] for r in R if r['set']=='real' and 'own' not in r]}\n")
def frac(s, f): v = [r for r in R if r['set'] == s and 'own' in r]; return f"{sum(f(r) for r in v)}/{len(v)}"
P(f"Own distance <= 2.735: real {frac('real', lambda r: r['own'] <= 2.7351)}, synthetic {frac('synthetic', lambda r: r['own'] <= 2.7351)}; best prefix <= 2.735: real {frac('real', lambda r: r['bestPrefixOwn'] <= 2.7351)}.\n")
P('## Per-channel share of the own-drill DTW cost (nearest own template, aligned path)\n')
P('Share of the weighted squared distance carried by each channel (sums to 1), and mean |z| (difference in units of the model channel scale). Median over attempts.\n')
chans = list(next(r for r in R if 'share' in r)['share'].keys())
P('| channel | real strikes share | synth strikes share | real steps share | synth steps share | real strikes mean abs z | synth strikes mean abs z | real steps mean abs z | synth steps mean abs z |\n|---|---|---|---|---|---|---|---|---|')
rowsC = []
for c in chans:
    sh = [st.median([r['share'][c] for r in grp(s, k)]) for k in ('strikes', 'steps') for s in ('real', 'synthetic')]
    z = [st.median([r['meanAbsZ'][c] for r in grp(s, k) if r['meanAbsZ'][c] is not None] or [float('nan')]) for k in ('strikes', 'steps') for s in ('real', 'synthetic')]
    rowsC.append((c, sh, z))
for c, sh, z in sorted(rowsC, key=lambda x: -x[1][0]):
    P(f"| {c} | " + ' | '.join(f'{x:.3f}' for x in sh) + ' | ' + ' | '.join(f'{x:.2f}' for x in z) + ' |')
P('\n## Real clips, one line each\n\n| clip | drill | angle | state | own | best | prefix own | tempo | path ratio | hand path | torso/frame | top-3 channels by share |\n|---|---|---|---|---|---|---|---|---|---|---|---|')
for r in sorted([r for r in R if r['set'] == 'real'], key=lambda r: (r['drill'], r['id'])):
    if 'own' not in r: P(f"| {r['id']} | {r['drill']} | {r['angle']} | {r['state']} (no attempt) | | | | | | | {r['torsoFrac']} | |"); continue
    top = ', '.join(f"{c} {v:.2f}" for c, v in sorted(r['share'].items(), key=lambda x: -x[1])[:3])
    P(f"| {r['id']} | {r['drill']} | {r['angle']} | {r['state']} | {r['own']} | {r['best']} {r['bestDist']} | {r['bestPrefixOwn']} | {r['tempo']} | {r['pathRatio']} | {r['handPath']} | {r['torsoFrac']} | {top} |")
open('/workspace/hema/real/diag/diagnosis.md', 'w').write('\n'.join(L) + '\n'); print('\n'.join(L))
