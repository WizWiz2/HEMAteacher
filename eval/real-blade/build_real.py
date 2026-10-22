# Real labelled set: ok labels -> exact JS crop (96x96, 2.8 torso, JS grey weights) + full grey frame for augmentation.
import json,sys,numpy as np,cv2,math
sys.path.insert(0,'/workspace/hema/kp'); from extract import crop,S,RAD
C={}
for l in open('cands.jsonl'): r=json.loads(l); C[r['name']]=r
L=[json.loads(l) for l in open('all_lab.jsonl')]
X=[];Y=[];SPL=[];CH=[];NM=[];FR=[];HS=[];TS=[];AM=[]
for l in L:
    if not l.get('ok'): continue
    if l.get('owl',0)<0.2 or l.get('iou',0)<0.75: continue   # drop low-confidence labels
    hx_,hy_=l['hands']; dt=math.dist(l['tip'],(hx_,hy_)); dp=math.dist(l['pommel'],(hx_,hy_))
    AMB=1 if dt<1.6*dp+5 else 0   # tip/pommel ambiguous -> axis-only loss
    r=C[l['name']]; im=cv2.imread(f"frames/{l['name']}.jpg").astype(np.int32)
    g=((im[:,:,2]*77+im[:,:,1]*150+im[:,:,0]*29)>>8).astype(np.uint8)
    g.tofile(f"gray/{l['name']}.raw")
    hx,hy=l['hands']; sc=S/(2*RAD*r['torso']); a=math.radians(l['ang'])
    X.append(crop(g,hx,hy,sc)); Y.append([math.cos(a),math.sin(a),1]); SPL.append(r['split']); CH.append(r['ch']); NM.append(l['name']); HS.append(l['hands']); TS.append(r['torso']); AM.append(AMB)
np.savez_compressed('real_crops.npz',X=np.array(X),Y=np.array(Y,np.float32),S=np.array(SPL),C=np.array(CH),N=np.array(NM),H=np.array(HS,np.float32),T=np.array(TS,np.float32),A=np.array(AM,np.int8))
print(len(X),'amb',sum(AM),{s:SPL.count(s) for s in set(SPL)})
