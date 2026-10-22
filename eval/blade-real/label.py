# Pseudo-label blade guard->tip on real frames: OWLv2 ("sword") boxes near the hands -> SAM mask from the box ->
# principal axis of the mask; tip = mask end farther from the hands. Strict geometric checks; rejected frames get no label.
import sys, json, math, numpy as np, torch, cv2
from PIL import Image
from transformers import Owlv2Processor, Owlv2ForObjectDetection, SamModel, SamProcessor
torch.set_num_threads(int(sys.argv[3]) if len(sys.argv)>3 else 4)
OP=Owlv2Processor.from_pretrained('google/owlv2-base-patch16-ensemble'); OM=Owlv2ForObjectDetection.from_pretrained('google/owlv2-base-patch16-ensemble').eval()
SP=SamProcessor.from_pretrained('facebook/sam-vit-base'); SM=SamModel.from_pretrained('facebook/sam-vit-base').eval()
Q=[['a sword','a longsword blade','a wooden sword','a black training sword']]
def label(rec):
    img=Image.open(f"frames/{rec['name']}.jpg").convert('RGB'); W,H=img.size; L=np.array(rec['lm']); tor=rec['torso']
    hc=(L[15,:2]+L[16,:2])/2
    # OWLv2 on a square crop around the hands (blade within ~2.6 torso), so small blades get resolution
    R=2.8*tor; x0,y0=max(0,hc[0]-R),max(0,hc[1]-R); x1,y1=min(W,hc[0]+R),min(H,hc[1]+R)
    crop=img.crop((int(x0),int(y0),int(x1),int(y1)))
    with torch.no_grad():
        inp=OP(text=Q,images=crop,return_tensors='pt'); out=OM(**inp)
    cw,ch=crop.size; S=max(cw,ch)
    res=OP.post_process_grounded_object_detection(out,threshold=0.08,target_sizes=torch.tensor([[S,S]]))[0]
    boxes=[]
    for b,s in zip(res['boxes'].numpy(),res['scores'].numpy()):
        b=b+[x0,y0,x0,y0]; bw,bh=b[2]-b[0],b[3]-b[1]
        # box must reach the hands and be blade-sized
        dx=max(b[0]-hc[0],0,hc[0]-b[2]); dy=max(b[1]-hc[1],0,hc[1]-b[3])
        if math.hypot(dx,dy)>0.3*tor or math.hypot(bw,bh)<0.8*tor or math.hypot(bw,bh)>3.4*tor: continue
        boxes.append((float(s),b))
    if not boxes: return dict(ok=False,why='no_box')
    boxes.sort(key=lambda x:-x[0]); s,b=boxes[0]
    with torch.no_grad():
        si=SP(img,input_boxes=[[[float(v) for v in b]]],return_tensors='pt'); so=SM(**si,multimask_output=True)
    masks=SP.image_processor.post_process_masks(so.pred_masks,si['original_sizes'],si['reshaped_input_sizes'])[0][0].numpy()
    iou=so.iou_scores[0,0].numpy()
    best=None
    for m,q in zip(masks,iou):
        ys,xs=np.nonzero(m)
        if len(xs)<30: continue
        P=np.stack([xs,ys],1).astype(np.float32); c=P.mean(0); C=np.cov((P-c).T); ev,evec=np.linalg.eigh(C)
        el=math.sqrt(ev[1]/max(ev[0],1e-6)); ax=evec[:,1]
        proj=(P-c)@ax; lo,hi=np.percentile(proj,1),np.percentile(proj,99); length=hi-lo
        # distance of the hand centre from the axis line
        d=hc-c; off=abs(ax[0]*d[1]-ax[1]*d[0])
        if el<6 or length<0.8*tor or length>3.6*tor or off>0.35*tor: continue
        sc=float(q)*min(el,15)
        if best is None or sc>best[0]: best=(sc,c,ax,lo,hi,el,length,float(q),int(m.sum()))
    if best is None: return dict(ok=False,why='no_mask',owl=s)
    _,c,ax,lo,hi,el,length,q,area=best
    e1,e2=c+ax*lo,c+ax*hi
    tip,far=(e1,e2) if np.hypot(*(e1-hc))>np.hypot(*(e2-hc)) else (e2,e1)
    # tip must be clearly beyond the hands (> 0.7 torso)
    if np.hypot(*(tip-hc))<0.7*tor: return dict(ok=False,why='short')
    ang=math.degrees(math.atan2(tip[1]-hc[1],tip[0]-hc[0]))
    return dict(ok=True,owl=s,iou=q,el=round(el,1),len=round(length/tor,2),hands=hc.round(1).tolist(),tip=tip.round(1).tolist(),pommel=far.round(1).tolist(),ang=round(ang,1),box=[round(float(v),1) for v in b])
if __name__=='__main__':
    import os
    done=set(json.loads(l)['name'] for l in open(sys.argv[2])) if os.path.exists(sys.argv[2]) else set()
    recs=[r for r in (json.loads(l) for l in open(sys.argv[1])) if r['name'] not in done]
    with open(sys.argv[2],'a') as f:
        for r in recs:
            try: o=label(r)
            except Exception as e: o=dict(ok=False,why='err '+str(e)[:80])
            o['name']=r['name']; f.write(json.dumps(o)+'\n'); f.flush()
