# tip = blade end along forearm direction (elbow->wrist). Writes all_lab_fix.jsonl; flips only when forearm is confident.
import json,numpy as np,random
P={}
for l in open('pose_lab.jsonl'): r=json.loads(l); P[r['name']]=r
out=open('all_lab_fix.jsonl','w'); st=dict(ok=0,nopose=0,unsure=0,flip=0,keep=0); flipped=[]
for l in open('all_lab.jsonl'):
    r=json.loads(l)
    if r.get('ok'):
        st['ok']+=1; p=P.get(r['name'])
        if not p or 'el' not in p or p['dist']>40: st['nopose']+=1; r['fx']='nopose'
        else:
            u=np.zeros(2); w=0
            for e,wr in ((p['el'],p['wl']),(p['er'],p['wr'])):
                v=min(e[2],wr[2]); u+=v*(np.array(wr[:2])-np.array(e[:2])); w+=v
            d=np.array(r['tip'])-np.array(r['pommel']); n=np.linalg.norm(u)*np.linalg.norm(d)+1e-6; c=float(u@d/n)
            if w<.8 or abs(c)<.3: st['unsure']+=1; r['fx']='unsure'
            elif c<0:
                st['flip']+=1; r['tip'],r['pommel']=r['pommel'],r['tip']; r['ang']=(r['ang']+180)%360; r['fx']='flip'; flipped.append(r['name'])
            else: st['keep']+=1; r['fx']='keep'
            r['fcos']=c
    out.write(json.dumps(r)+'\n')
print(st); random.seed(1); json.dump(random.sample(flipped,min(30,len(flipped))),open('flip_sample.json','w'))
