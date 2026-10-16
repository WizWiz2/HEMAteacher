# clips_index.py -> clips.json: every clip with rawframes for the template/eval harness (harvest, seen, fresh).
# view: 'front' for frontal (<~30deg from camera axis) clips, else 'side'. heldout: harvest clips reserved for the frontal held-out set.
import csv, json, os, re, sys
H='/workspace/hema/harvest'; R='/workspace/hema/real'; F='/workspace/hema/fresh'
HELD=set(open(H+'/heldout_people.txt').read().split('\n'))-{''} if os.path.exists(H+'/heldout_people.txt') else set()
SEEN2H={'laurel':'Rob Kelly (Laurel City)'}  # same person across sets
def view_of(angle, facing):
    a=(angle or '').lower()
    if facing=='front' or 'frontal' in a or 'head-on' in a: return 'front'
    return 'side'
out=[]
for r in csv.DictReader(open(H+'/manifest.csv')):
    p=f"{H}/rawframes/{r['drill']}__{r['clip_id']}.json"
    if not os.path.exists(p): continue
    out.append(dict(id=r['clip_id'],set='harvest',person=r['person'],drill=r['drill'],view=view_of(r['angle'],r['facing']),
        facing=r['facing'] if r['facing'] in ('left','right') else 'right',raw=p,clean=True,weapon='longsword',
        heldout=r['person'] in HELD, chained='chained' in (r['start_pose']+r['quality']).lower(), angle=r['angle']))
fm=json.load(open(R+'/results/facing_map.json'))
for r in csv.DictReader(open(R+'/manifest.csv')):
    f=f"{r['drill']}__{r['clip_id']}.json"; p=f"{R}/rawframes/{f}"
    if not os.path.exists(p): continue
    pk=r['clip_id'].split('_')[0]
    out.append(dict(id=r['clip_id'],set='seen',person=SEEN2H.get(pk,'seen:'+pk),drill=r['drill'],view=view_of(r['angle'],''),facing=fm.get(f,'right'),
        raw=p,clean=r.get('clean')=='yes',weapon=r.get('weapon',''),heldout=False,chained=False,angle=r['angle']))
if '--fresh' in sys.argv:
    fm=json.load(open(F+'/results/facing_map.json'))
    for r in csv.DictReader(open(F+'/manifest.csv')):
        f=f"{r['drill']}__{r['clip_id']}.json"; p=f"{F}/rawframes/{f}"
        if not os.path.exists(p): continue
        out.append(dict(id=r['clip_id'],set='fresh',person='fresh:'+r['clip_id'].split('_')[0],drill=r['drill'],view=view_of(r['angle'],''),facing=fm.get(f,r['facing'] or 'right'),
            raw=p,clean=r['clean']=='yes',weapon=r['weapon'],heldout=False,chained=False,angle=r['angle']))
json.dump(out,open(sys.argv[1],'w'),indent=0)
import collections
print(len(out),collections.Counter((c['set'],c['view']) for c in out))
