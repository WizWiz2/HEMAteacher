# Tiny blade net (same architecture as src/live/bladeNet.ts) on synthetic renders + REAL pseudo-labelled frames
# (train channels only). Internal validation = a few TRAIN channels held out from training (never the held-out set).
import numpy as np,torch,torch.nn as nn,cv2,math,sys,json,time
sys.argv=[sys.argv[0]]+sys.argv[1:]
torch.set_num_threads(int(__import__('os').environ.get('THR','4'))); rng=np.random.default_rng(0)
exec(open('/workspace/hema/kp/train.py').read().split('net=Net()')[0].split("d=np.load")[0])  # imports
src=open('/workspace/hema/kp/train.py').read()
exec(src[src.index('S=96'):src.index('net=Net()')].replace("rng.random()<.5: img=img[:,::-1]","False and rng.random()<.5: img=img[:,::-1]"))  # augment (flip handled below), Net, prep, loss_fn
import os
RAD=1.4
import os; AXONLY=os.environ.get('AXONLY','1')=='1'; AXW=1.0
def loss_fn(out,y):
    pres=nn.functional.binary_cross_entropy_with_logits(out[:,2],y[:,2])
    v=out[:,:2]; v=v/(v.norm(dim=1,keepdim=True)+1e-6); cos=(v*y[:,:2]).sum(1)
    cos=torch.where(y[:,3]>0,cos.abs(),cos)  # axis-only for ambiguous real labels
    m=y[:,2]>0; return pres+((1-cos)[m].mean() if m.any() else 0)
d=np.load("/workspace/hema/kp/train_crops.npz"); XS,YS,LS=d['X'],d['Y'],d['L']
R=dict(np.load(os.environ.get('RC','real_crops.npz'))); C=json.load(open('cands_by_name.json'))
VALCH=set(sys.argv[1].split(',')) if len(sys.argv)>1 and sys.argv[1] else set()
EP=int(sys.argv[2]) if len(sys.argv)>2 else 14; REALW=float(sys.argv[3]) if len(sys.argv)>3 else 3; OUT=sys.argv[4] if len(sys.argv)>4 else 'net_real.pt'
tr_real=[i for i in range(len(R['X'])) if R['S'][i]=='train' and R['C'][i] not in VALCH]
va_real=[i for i in range(len(R['X'])) if R['S'][i]=='train' and R['C'][i] in VALCH]
frames={}
def frame(name):
    if name not in frames:
        c=C[name]; frames[name]=np.fromfile(f'gray/{name}.raw',np.uint8).reshape(c['H'],c['W'])
    return frames[name]
def real_sample(i):
    name=str(R['N'][i]); c=C[name]; g=frame(name); y=R['Y'][i].copy()
    hx,hy=R['H'][i]; tor=float(R['T'][i])*rng.uniform(.85,1.18)
    hx+=rng.normal(0,.06)*tor; hy+=rng.normal(0,.06)*tor
    th=rng.uniform(-25,25) if rng.random()<.7 else 0; sc=2*S/(2*RAD*tor)
    M=cv2.getRotationMatrix2D((hx,hy),th,sc); M[0,2]+=S-hx; M[1,2]+=S-hy
    img=cv2.warpAffine(g,M,(2*S,2*S),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    img=cv2.resize(img,(S,S),interpolation=cv2.INTER_AREA)
    a=math.atan2(y[1],y[0])-math.radians(th); y=np.array([math.cos(a),math.sin(a),1],np.float32)
    img,y=augment(img,y,[0,0,0,0]); y=np.append(y[:3],AXW*(1.0 if os.environ.get('AXALL','1')=='1' else float(R['A'][i])) if AXONLY else 0).astype(np.float32); return img,y
def syn_sample(j):
    img,y=augment(XS[j],YS[j],LS[j])
    # thin/faint blades on renders: random extra blur of the blade region is covered by augment; add contrast squeeze
    return img,np.append(y[:3],0).astype(np.float32)
nS=len(XS); nR=len(tr_real); nRw=int(nR*REALW)
class DS(torch.utils.data.Dataset):
    def __len__(s): return nS+nRw
    def __getitem__(s,i):
        img,y=syn_sample(i) if i<nS else real_sample(tr_real[(i-nS)%nR])
        if rng.random()<.5: img=img[:,::-1].copy(); y=y.copy(); y[0]=-y[0]
        return img,y
def wi(k):
    global rng; rng=np.random.default_rng(1000+k+torch.initial_seed()%100000)
def collate(b): return [z[0] for z in b],np.array([z[1] for z in b])
net=Net(); BS=128; opt=torch.optim.Adam(net.parameters(),2e-3)
dl=torch.utils.data.DataLoader(DS(),batch_size=BS,shuffle=True,num_workers=4,worker_init_fn=wi,persistent_workers=True,collate_fn=collate)
sched=torch.optim.lr_scheduler.OneCycleLR(opt,3e-3,total_steps=EP*len(dl))
def ev(idx):
    if not idx: return ''
    net.eval()
    with torch.no_grad(): P=net(prep([R['X'][i] for i in idx])).numpy()
    net.train(); ang=np.arctan2(P[:,1],P[:,0]); ga=np.arctan2(R['Y'][idx,1],R['Y'][idx,0]); err=np.degrees(np.abs((ang-ga+np.pi)%(2*np.pi)-np.pi))
    pr=1/(1+np.exp(-P[:,2])); return f'val real n={len(idx)} med {np.median(err):.1f} <15 {np.mean(err<15):.0%} <30 {np.mean(err<30):.0%} pres>=.5 {np.mean(pr>=.5):.0%}'
t0=time.time()
for ep in range(EP):
    tot=0
    for ims,ys in dl:
        out=net(prep(ims)); l=loss_fn(out,torch.tensor(ys)); opt.zero_grad(); l.backward(); opt.step(); sched.step(); tot+=float(l.detach())*len(ims)
    print(f'ep {ep} loss {tot/len(dl.dataset):.3f} {time.time()-t0:.0f}s',ev(va_real),flush=True)
torch.save(net.state_dict(),OUT)
