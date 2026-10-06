# score_seen.py <own.json> <cross.json>: own accepted + wrong-drill accepted (guards column excluded), all and clean
import json, csv, sys
man = {r['clip_id']: r for r in csv.DictReader(open('/workspace/hema/fresh/manifest.csv'))}
key = lambda r: r['file'].split('/')[-1][:-5].split('__', 1)[1]
own, cross = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
STR = {'zornhau', 'scheitelhau', 'krumphau', 'zwerchhau', 'schielhau'}
for name, ok in (('all', lambda c: True), ('clean', lambda c: man[c].get('clean') == 'yes')):
    o = [r for r in own if ok(key(r))]; acc = [r for r in o if r['state'] == 'completed']
    s = [r for r in o if man[key(r)]['drill'] in STR]; sa = [r for r in s if r['state'] == 'completed']
    x = [r for r in cross if ok(key(r)) and r['drillId'] != man[key(r)]['drill'] and r['drillId'] != 'guards-basic']
    xa = [r for r in x if r['state'] == 'completed']
    print(f"{name}: own {len(acc)}/{len(o)} (strikes {len(sa)}/{len(s)}, steps {len(acc)-len(sa)}/{len(o)-len(s)}) | wrong {len(xa)}/{len(x)} {[ (key(r), r['drillId']) for r in xa]}")
