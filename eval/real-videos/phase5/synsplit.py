# synsplit.py <tag>...: split /tmp/p5_<tag>_syn.json (test + lobo protocols) into old vs _rs clips, M/E vs beginner,
# plus core-strike rows (zornhau/zwerchhau/schielhau) own/wrong. Reads results only.
import json, sys, re, collections
CORE = ('zornhau', 'zwerchhau', 'schielhau')
for tag in sys.argv[1:]:
    d = json.load(open(f'/tmp/p5_{tag}_syn.json')); print('==', tag)
    for proto in ('test', 'lobo'):
        g = collections.defaultdict(lambda: [0, 0, 0, 0])
        for r in d:
            if r['protocol'] != proto: continue
            rs = 'rs' if re.search(r'_rs(_|$)', r['clip']) else 'old'
            lv = 'beg' if r['level'] == 'beginner' else 'M/E'
            keys = [(rs, lv)] + ([(rs + ' core', lv)] if r['source'] in CORE else []) + ([('wrong-into-core-strike ' + rs, lv)] if r['selected'] in CORE and r['selected'] != r['source'] else [])
            for k in keys:
                x = g[k]
                if r['selected'] == r['source']: x[1] += 1; x[0] += bool(r['completed'])
                else: x[3] += 1; x[2] += bool(r['completed'])
        for k in sorted(g):
            o, n, w, m = g[k]
            print(f" {proto:4} {k[0]:28} {k[1]:4} own {o}/{n}" + (f" {100*o/n:.0f}%" if n else '') + f"  wrong {w}/{m}" + (f" {100*w/m:.1f}%" if m else ''))
