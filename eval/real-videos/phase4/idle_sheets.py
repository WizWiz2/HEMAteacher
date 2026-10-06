import csv, subprocess, os, collections
man=[r for r in csv.DictReader(open('/workspace/hema/real/manifest.csv'))]
byv=collections.defaultdict(list)
for r in man: byv[r['video_id']].append((float(r['start_s']),float(r['end_s'])))
for v,w in byv.items():
    f=f'/workspace/hema/real/raw/{v}.mp4'
    if not os.path.exists(f): print('missing',v); continue
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f],capture_output=True,text=True).stdout)
    lo=max(0,min(a for a,b in w)-90); hi=min(dur,max(b for a,b in w)+90)
    ts=[t for t in range(int(lo),int(hi),4) if not any(a-1<=t<=b+1 for a,b in w)]
    os.makedirs(f'sheets/{v}',exist_ok=True)
    for t in ts:
        subprocess.run(['ffmpeg','-loglevel','error','-y','-ss',str(t),'-i',f,'-frames:v','1','-vf',f"scale=150:110:force_original_aspect_ratio=decrease,pad=150:110:(ow-iw)/2:(oh-ih)/2,drawtext=text='{t}':fontsize=12:fontcolor=yellow:x=2:y=2",f'sheets/{v}/{t:05d}.png'])
    subprocess.run(['ffmpeg','-loglevel','error','-y','-pattern_type','glob','-i',f'sheets/{v}/*.png','-vf','tile=8x8',f'sheets/{v}_%d.png'])
    print(v, len(ts), 'frames', lo, hi, dur, w)
