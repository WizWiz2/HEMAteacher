# series.py <id> t0 t1 [x0 x1]: main person hipx/ank/handup/face per row
import json,sys
a=sys.argv; d=json.load(open(f'screen/{a[1]}.json')); t0,t1=float(a[2]),float(a[3]); X0,X1=(float(a[4]),float(a[5])) if len(a)>5 else (0,1)
o=[]
for r in d['rows']:
  if t0<=r['t']<=t1:
    ps=[p for p in r['p'] if X0<=p['hipx']<=X1]
    if not ps: o.append(f"{r['t']:.1f}:--"); continue
    p=max(ps,key=lambda p:p['torso']); o.append(f"{r['t']:.1f}:{p['hipx']:.2f}/{p['ank']:+.1f}/{p['handup']:+.1f}{'*' if r['cut']>18 else ''}")
print('  '.join(o))
