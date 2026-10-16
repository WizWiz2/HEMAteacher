# cands.py: merge search results (harvest + earlier real/fresh searches) -> candidates.csv (deduped, exclusions applied)
import re, csv, glob
seen = set(open('excl_seen_ids.txt').read().split()); fresh = set(open('excl_fresh_ids.txt').read().split())
fpeople = [l.strip().lower() for l in open('excl_fresh_people.txt') if l.strip() and not l.startswith('#')]
BAD = re.compile(r'buckler|messer|rapier|sabre|saber|szabla|сабл|katana|kenjutsu|tournament|turniej|турнир|sparring|спарринг|highlights|bout|final|dussack|dusack|smallsword|spadone|sidesword|side sword|spear|polearm|dagger|kendo|iaido|lightsaber|movie|film|game|elden|skyrim|minecraft|review|unboxing|reaction|shorts?\b|#shorts|forged in fire|blacksmith|test cutting|tameshigiri', re.I)
rows = {}; order = []
files = sorted(glob.glob('/workspace/hema/harvest/search*.txt')) + sorted(glob.glob('/workspace/hema/fresh/search*.txt')) + sorted(glob.glob('/workspace/hema/real/search*.txt'))
for f in files:
    q = ''
    for l in open(f, errors='ignore'):
        l = l.rstrip('\n')
        if l.startswith('###'): q = l[4:]; continue
        p = l.split('|', 3)
        if len(p) < 4 or len(p[0]) != 11: continue
        vid, dur, ch, title = p
        if vid in rows: rows[vid]['queries'].add(q); continue
        why = ''
        if vid in fresh: why = 'fresh video (LOCKED)'
        elif any(fp in ch.lower() for fp in fpeople): why = 'fresh person/channel'
        elif vid in seen: why = 'seen video'
        elif BAD.search(title): why = 'title: other weapon/sparring/non-lesson'
        else:
            try: d = float(dur)
            except: d = 0
            if d and (d < 20 or d > 3600): why = f'duration {dur}'
        rows[vid] = dict(video_id=vid, duration=dur, channel=ch, title=title, queries={q}, auto_excl=why, src=f.split('/')[-2]); order.append(vid)
with open('candidates.csv', 'w', newline='') as fo:
    w = csv.DictWriter(fo, ['video_id', 'duration', 'channel', 'title', 'auto_excl', 'src', 'queries']); w.writeheader()
    for v in order:
        r = dict(rows[v]); r['queries'] = ' ; '.join(sorted(r['queries'])); w.writerow(r)
print(len(order), 'candidates;', sum(1 for v in order if not rows[v]['auto_excl']), 'not auto-excluded')
