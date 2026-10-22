# Folds BatchNorm and exports the net to src/live/bladeNetWeights.json (base64 float32) + a parity sample.
import sys,json,base64,numpy as np,torch
import torch.nn as nn
src=open('/workspace/hema/kp/train.py').read(); exec(src[src.index('class Net'):src.index('def loss_fn')].replace('def prep','def _prep'))
import torch.nn as nn
name=sys.argv[1]; out=sys.argv[2]
net=Net(); net.load_state_dict(torch.load(name)); net.eval()
b64=lambda a: base64.b64encode(np.ascontiguousarray(a,dtype=np.float32).tobytes()).decode()
convs=[]
for blk in net.f:
    conv,bn=blk[0],blk[1]; s=(bn.weight/torch.sqrt(bn.running_var+bn.eps)).detach()
    w=(conv.weight.detach()*s[:,None,None,None]).numpy(); b=((conv.bias.detach()-bn.running_mean)*s+bn.bias.detach()).numpy()
    convs.append(dict(cin=conv.in_channels,cout=conv.out_channels,w=b64(w),b=b64(b)))
fc=[dict(cin=l.in_features,cout=l.out_features,w=b64(l.weight.detach().numpy()),b=b64(l.bias.detach().numpy())) for l in net.h if isinstance(l,nn.Linear)]
json.dump(dict(source='tiny blade net trained on train-body renders + pseudo-labelled real public videos (train channels only)',convs=convs,fc=fc),open(out,'w'))
d=np.load('/workspace/hema/kp/train_crops.npz'); x=d['X'][:3].astype(np.float32)
t=torch.tensor(x)[:,None]/255.; t=(t-t.mean((2,3),keepdim=True))/(t.std((2,3),keepdim=True)+1e-3)
with torch.no_grad(): o=net(t).numpy()
json.dump(dict(crops=[base64.b64encode(c.astype(np.uint8).tobytes()).decode() for c in d['X'][:3]],out=o.tolist()),open(sys.argv[3] if len(sys.argv)>3 else '/tmp/parity.json','w'))
print('exported',out)
