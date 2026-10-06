# funnel.py <tag>...: own-run funnel + per-drill own + core/all wrong on the fresh replay outputs (reads results only)
import json, csv, sys, collections
man = {r['clip_id']: r for r in csv.DictReader(open('/workspace/hema/fresh/manifest.csv'))}
CORE = {'zornhau', 'zwerchhau', 'schielhau', 'passing-step-forward', 'advance'}
key = lambda r: r['file'].split('/')[-1][:-5].split('__', 1)[1]
def fun(r):
    if r['state'] == 'completed': return 'accepted'
    if r.get('outcome') == 'other_drill': return 'other'
    if r.get('outcome') == 'tracking_lost': return 'tracking'
    started = any(e.get('state') == 'running' for e in r.get('events', []))
    if not started and r['state'] != 'failed': return 'no_start'
    if 'Продолжай' in (r.get('message') or '') or r['state'] == 'failed': return 'short'
    return 'no_decision'
FN = ['no_start', 'no_decision', 'short', 'tracking', 'other', 'accepted']
for tag in sys.argv[1:]:
    own = json.load(open(f'/workspace/hema/fresh/results/fresh_{tag}_own.json')); cross = json.load(open(f'/workspace/hema/fresh/results/fresh_{tag}_cross.json'))
    print('==', tag)
    for nm, ok in (('all', lambda c: True), ('clean', lambda c: man[c]['clean'] == 'yes')):
        o = [r for r in own if ok(key(r))]; c = collections.Counter(fun(r) for r in o)
        per = collections.defaultdict(lambda: [0, 0])
        for r in o: per[man[key(r)]['drill']][1] += 1; per[man[key(r)]['drill']][0] += r['state'] == 'completed'
        co = [sum(v[0] for d, v in per.items() if d in CORE), sum(v[1] for d, v in per.items() if d in CORE)]
        x = [r for r in cross if ok(key(r)) and r['drillId'] != man[key(r)]['drill'] and r['drillId'] != 'guards-basic']
        acc = lambda L: sum(r['state'] == 'completed' for r in L)
        xc = [r for r in x if man[key(r)]['drill'] in CORE]; xi = [r for r in x if r['drillId'] in CORE]
        print(f" {nm} funnel ({len(o)}):", ' | '.join(f"{f} {c[f]}" for f in FN))
        print(f" {nm} per-drill:", ' '.join(f"{d}:{v[0]}/{v[1]}" for d, v in sorted(per.items())), f"| CORE own {co[0]}/{co[1]} wrong-on-core-clips {acc(xc)}/{len(xc)} wrong-into-core {acc(xi)}/{len(xi)} | all wrong {acc(x)}/{len(x)}")
