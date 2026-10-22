# Held-out real frames (held channels only): coverage and angle accuracy vs pseudo-labels for classical / old net / new net / hybrids.
import sys,json,subprocess,numpy as np,torch
src=open('/workspace/hema/kp/train.py').read(); import torch.nn as nn
exec(src[src.index('class Net'):src.index('def loss_fn')])
R=np.load('real_crops.npz'); idx=[i for i in range(len(R['X'])) if R['S'][i]=='held']
C=json.load(open('cands_by_name.json')); LM={}
for l in open('cands.jsonl'):
    r=json.loads(l)
    if r['split']=='held': LM[r['name']]=r['lm']
items=[dict(name=str(R['N'][i]),W=C[str(R['N'][i])]['W'],H=C[str(R['N'][i])]['H'],hands=R['H'][i].tolist(),torso=float(R['T'][i]),lm=LM[str(R['N'][i])]) for i in idx]
json.dump(items,open('/tmp/items.json','w'))
subprocess.run(['node','classical.mjs','/tmp/items.json','/tmp/cls.json'],check=True,cwd='/workspace/hema/rb')
cls=json.load(open('/tmp/cls.json'))
ga=np.degrees(np.arctan2(R['Y'][idx,1],R['Y'][idx,0]))
err=lambda a: np.abs((a-ga+180)%360-180)
def net_out(pt):
    n=Net(); n.load_state_dict(torch.load(pt)); n.eval()
    with torch.no_grad(): P=n(prep([R['X'][i] for i in idx])).numpy()
    return np.degrees(np.arctan2(P[:,1],P[:,0])),1/(1+np.exp(-P[:,2]))
cc=np.array([cls[it['name']]['conf'] for it in items]); ca=np.array([cls[it['name']]['ang'] for it in items])
rows=[]
def rep(name,acc,ang):
    e=err(ang); n=len(idx); a=acc.sum()
    rows.append(f"{name:28s} cov {a/n:5.1%}  prec<15° {((e<15)&acc).sum()/max(a,1):5.1%}  prec<30° {((e<30)&acc).sum()/max(a,1):5.1%}  correct<15° of all {((e<15)&acc).sum()/n:5.1%}  median {np.median(e[acc]) if a else float('nan'):.1f}°")
rep('classical conf>=3',cc>=3,ca); rep('classical conf>=1.1',cc>=1.1,ca)
for name,pt in [('old net (renders)', '/workspace/hema/kp/net_none.pt')]+[(a,b) for a,b in (x.split('=') for x in sys.argv[1:])]:
    na,pr=net_out(pt); rep(name+' p>=.5',pr>=.5,na); rep(name+' all',np.ones(len(idx),bool),na)
    hy=np.where(cc>=3,ca,na); rep('hybrid cls>=3 + '+name,(cc>=3)|(pr>=.5),hy)
print(f'held-out frames {len(idx)} from {len(set(R["C"][idx]))} channels'); print('\n'.join(rows))
