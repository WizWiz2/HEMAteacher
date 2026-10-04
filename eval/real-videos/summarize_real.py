# summarize_real.py: manifest + replay results -> results/summary.md and results/summary.json
import csv, json, collections
man = {r['clip_id']: r for r in csv.DictReader(open('/workspace/hema/real/manifest.csv'))}
STRIKES = {'zornhau', 'scheitelhau', 'krumphau', 'zwerchhau', 'schielhau'}
def key(r): return r['file'].split('/')[-1][:-5].split('__', 1)[1]
def cls(r):
    if r['calibratedAtFrame'] is None: return 'calibration_failed'
    if r['state'] == 'completed': return 'accepted'
    if r['state'] == 'failed' and r.get('outcome') == 'other_drill': return 'rejected_as_other'
    if r['state'] == 'failed': return 'failed:' + (r.get('message') or '')
    if r['state'] == 'running': return 'undecided'
    return 'never_started'
def load(p):
    try: return json.load(open(p))
    except FileNotFoundError: return []
own, flipped, cross, crossdp = (load(f'/workspace/hema/real/results/{n}.json') for n in ('rp_own', 'rp_own_flipped', 'rp_cross', 'rp_cross_drillpage'))
L = []; P = L.append
clips = sorted({key(r) for r in own})
P(f'# Real public-video validation: results\n\nClips evaluated: {len(clips)} (browser MediaPipe lite, raw frames replayed through main @ app checkout, blade flag OFF).\n')
cnt = collections.Counter(man[c]['drill'] for c in clips)
P('## Clips by drill\n\n| drill | clips |\n|---|---|\n' + '\n'.join(f'| {d} | {n} |' for d, n in sorted(cnt.items())) + '\n')
P('## Own drill selected (VideoRegressionPage semantics: one attempt per clip)\n')
P('| clip | drill | angle | facing | outcome | message | best match (dist) | own dist | accept | path ratio |\n|---|---|---|---|---|---|---|---|---|---|')
oc = collections.Counter(); byd = collections.defaultdict(collections.Counter); bya = collections.defaultdict(collections.Counter)
for r in sorted(own, key=lambda r: (man[key(r)]['drill'], key(r))):
    c = key(r); m = man[c]; o = cls(r); oc[o] += 1; byd[m['drill']][o] += 1; bya[m['angle']][o] += 1; d = r.get('diag') or {}
    best = f"{d['top3'][0][0]} ({d['top3'][0][1]})" if d.get('top3') else '-'
    P(f"| {c} | {m['drill']} | {m['angle']} | {r['facing']} | {o} | {r.get('message') or ''} | {best} | {d.get('own', '-')} | {d.get('accept', '-')} | {d.get('pathRatio', '-')} |")
P('\n### Outcome totals (own drill)\n\n| outcome | clips |\n|---|---|\n' + '\n'.join(f'| {k} | {v} |' for k, v in oc.most_common()) + '\n')
P('### Per drill\n\n| drill | n | accepted | rejected as other | undecided | never started | other |\n|---|---|---|---|---|---|---|')
for d, c in sorted(byd.items()):
    n = sum(c.values()); P(f"| {d} | {n} | {c['accepted']} | {c['rejected_as_other']} | {c['undecided']} | {c['never_started']} | {n - c['accepted'] - c['rejected_as_other'] - c['undecided'] - c['never_started']} |")
P('\n### Per camera angle\n\n| angle | n | accepted |\n|---|---|---|')
for a, c in sorted(bya.items()): P(f"| {a} | {sum(c.values())} | {c['accepted']} |")
fo = collections.Counter(cls(r) for r in flipped)
P(f"\nFacing sensitivity (same clips, opposite facing): accepted {fo['accepted']}/{len(flipped)}; outcomes {dict(fo)}\n")
def matrix(rows, title):
    P(f'## {title}\n')
    if not rows: P('(not run)\n'); return {}
    acc = collections.defaultdict(dict)
    for r in rows: acc[key(r)][r['drillId']] = cls(r)
    drills = sorted({r['drillId'] for r in rows})
    P('Rows = clip (true drill), columns = selected drill; A = accepted, x = rejected as other drill, . = not accepted\n')
    P('| clip | true | ' + ' | '.join(d[:6] for d in drills) + ' |\n|---|---|' + '---|' * len(drills))
    own_ok = wrong = offd = 0; own_n = 0; strike = [0, 0]; step = [0, 0]
    for c in sorted(acc, key=lambda c: (man[c]['drill'], c)):
        t = man[c]['drill']; cells = []
        for d in drills:
            o = acc[c].get(d, '-'); cells.append('**A**' if o == 'accepted' and d == t else 'A!' if o == 'accepted' else 'x' if o == 'rejected_as_other' else '.')
            if d == t:
                own_n += 1; own_ok += o == 'accepted'; g = strike if t in STRIKES else step; g[0] += o == 'accepted'; g[1] += 1
            else: offd += 1; wrong += o == 'accepted'
        P(f"| {c} | {t} | " + ' | '.join(cells) + ' |')
    s = dict(own_accept=f'{own_ok}/{own_n}', strikes=f'{strike[0]}/{strike[1]}', steps=f'{step[0]}/{step[1]}', wrong_accept=f'{wrong}/{offd}', wrong_rate=round(100 * wrong / max(1, offd), 1))
    P(f"\nOwn drill accepted {s['own_accept']} (strikes {s['strikes']}, steps {s['steps']}); accepted as the WRONG drill {s['wrong_accept']} ({s['wrong_rate']}%).\n"); return s
s1 = matrix(cross, 'Cross evaluation: every clip x every drill (regression page, one attempt)')
s2 = matrix(crossdp, 'Cross evaluation, DrillPage mode (retries after a failed attempt, like a user repeating)')
open('/workspace/hema/real/results/summary.md', 'w').write('\n'.join(L) + '\n')
json.dump(dict(own=dict(oc), by_drill={k: dict(v) for k, v in byd.items()}, cross=s1, cross_drillpage=s2), open('/workspace/hema/real/results/summary.json', 'w'), indent=1)
print('\n'.join(L[-12:]))
