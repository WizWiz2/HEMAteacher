# Contact sheet: label line hands->tip (green), box (blue), numbered. usage: viz.py labels.jsonl out.jpg [n] [seed] [names-file]
import sys,json,cv2,numpy as np,random
L=[json.loads(l) for l in open(sys.argv[1])]; L=[l for l in L if l.get('ok')]
n=int(sys.argv[3]) if len(sys.argv)>3 else 12; random.seed(int(sys.argv[4]) if len(sys.argv)>4 else 0); S=random.sample(L,min(n,len(L)))
tiles=[]
for i,l in enumerate(S):
    im=cv2.imread(f"frames/{l['name']}.jpg"); h=np.array(l['hands']); t=np.array(l['tip'])
    cx,cy=h; R=int(1.3*np.hypot(*(t-h)))+20
    cv2.line(im,tuple(h.astype(int)),tuple(t.astype(int)),(0,255,0),1,cv2.LINE_AA); cv2.circle(im,tuple(t.astype(int)),3,(0,0,255),-1)
    x0,y0=int(max(0,cx-R)),int(max(0,cy-R)); c=im[y0:int(cy+R),x0:int(cx+R)]
    c=cv2.resize(c,(260,260)); cv2.putText(c,str(i),(4,20),0,.7,(0,255,255),2); tiles.append(c)
while len(tiles)%4: tiles.append(np.zeros_like(tiles[0]))
rows=[np.hstack(tiles[i:i+4]) for i in range(0,len(tiles),4)]; cv2.imwrite(sys.argv[2],np.vstack(rows))
json.dump([l['name'] for l in S],open(sys.argv[2]+'.json','w'))
