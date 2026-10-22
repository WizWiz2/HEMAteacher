import sys,json,numpy as np,torch
src=open('/workspace/hema/kp/train.py').read(); import torch.nn as nn
exec(src[src.index('class Net'):src.index('def loss_fn')])
R=dict(np.load('real_crops.npz')); V=set(sys.argv[1].split(','))
idx=[i for i in range(len(R['X'])) if R['S'][i]=='train' and R['C'][i] in V]
ga=np.degrees(np.arctan2(R['Y'][idx,1],R['Y'][idx,0]))
for pt in sys.argv[2:]:
    n=Net(); n.load_state_dict(torch.load(pt)); n.eval()
    with torch.no_grad(): P=n(prep([R['X'][i] for i in idx])).numpy()
    a=np.degrees(np.arctan2(P[:,1],P[:,0])); e=np.abs((a-ga+180)%360-180); ax=np.minimum(e,180-e)
    print(pt,len(idx),f'dir<15 {np.mean(e<15):.0%} axis<15 {np.mean(ax<15):.0%} flipped(>165) {np.mean(e>165):.0%} med {np.median(e):.0f} axis med {np.median(ax):.0f}')
    nr=np.hypot(P[:,0],P[:,1])
    for q in (50,70,85):
        t=np.percentile(nr,q); m=nr>=t; print(f'  norm top {100-q}%: dir<15 {np.mean(e[m]<15):.0%}')
