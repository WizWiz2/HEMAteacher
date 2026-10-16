# Real public-video HARVEST for templates — progress
Started 2026-10-16 11:45 (UTC+5). Goal: per drill >=5 (ideally 8+) DISTINCT people, clean two-handed longsword reps.
Layout: /workspace/hema/harvest (raw/ NOT git; clips/<drill>/<clip>.mp4; rawframes/<drill>__<clip>.json = same format as real/rawframes).
Git worktree: /workspace/hema-harvest, branch data/real-harvest (from origin/main 5d9fd70); commit tools+manifest under eval/real-harvest/.
yt-dlp: export PATH=$HOME/.local/bin:$PATH; ONLY works with --extractor-args youtube:player_client=mweb -f 18 (360p).
Exclusions: excl_seen_ids.txt (71 seen video ids), excl_fresh_ids.txt (LOCKED fresh videos), excl_fresh_people.txt (fresh persons -> exclude all their videos).
Tools (copied from real/fresh, paths patched): search.sh (queries.txt -> search.txt), screen.py <id> (MediaPipe lite pre-screen -> screen/<id>.json),
 find.py / step_find.py (candidate windows), strips.py, sheet.sh, fine.sh (contact sheets).
## Log
- 11:50 search.sh round 1 (75 multilingual queries, ytsearch20) running in background (search.out).
- 11:47 STEERING (user): quality over quantity; drill by drill; check title/description/chapters + sampled frames BEFORE full download; keep only clean solo side..45deg full-body two-handed reps; verify labels by frames; note every rejection (review.csv).
- 11:48 STEERING: prioritise beginner/first-lesson content (queries appended to queries.txt).
- Tools: peek.sh <id> t1 t2.. (yt-dlp --download-sections 0.5 s snippets -> sheets/peek_<id>.jpg; direct googlevideo URLs 403), peekbatch.sh id:dur.. (12 evenly spaced), pairs.py (stack 2 peeks for viewing),
  dl.sh <id> (360p download + screen.py), burst.py <id> [x0 x1 thr] (hand-speed bursts), rep.sh <name> id:t0:t1:crop.. (8-frame rows ~800px; Read tool downsizes to ~820px -> keep sheets narrow).
- Box was rebuilt: needed sudo apt-get install libegl1 for mediapipe. yt-dlp 429 when search+peek+dl run in parallel -> keep it serial-ish.
- Fresh-set raw videos that were NOT used in fresh (y6Nlm, z-6uB, U0m97, JhuER, ChC0g, XXZs, MtiIN, CW-Rop) symlinked into raw/ (allowed: not fresh persons).
- Findings so far (~45 peeked): most lessons are PAIR plays or FRONTAL talking demos; clean solo side..45deg reps are rare. KEEP: Mj1DMuAzEmg (2 zornhau). Pending verify: Y_MhB6yAQMY (vom Tag), s1LKv5DnCg4 (zwerch 40-65), y6NlmHGolws (zwerch).
- 12:10 App drill ids (frontend/public/content/drills.json): advance, guards-basic (Vom Tag/Ochs/Pflug/Alber), krumphau, passing-step-backward, passing-step-forward, retreat, scheitelhau, schielhau, zornhau, zwerchhau. Vom Tag clips -> drill guards-basic (notes guard=...).
- vite :5210 restarted from real/app/frontend (node_modules was gone -> npm ci in /workspace/hema-gap/frontend; puppeteer-core in /workspace/hema/tools/pp). vr_run.sh -> rawframes/<drill>__<clip>.json (same format as real/rawframes). cut.py cuts manifest rows.
- KEEP so far: Mj1DMuAzEmg (Laurel R.Kelly zornhau x2), zwerchcopter: 8dReOlmijX4 Fabian, FSOU-uu_QiA Messering, RnG2KcviRLc Ritterschaft, RUJ1O5SxKVc Rensen (2 each, chained-fast),
  8Mqi_QbXqnI stritschar vom Tag x2 + Alber x1 (profile). Pending: 4hwTpsZ5cgk Björn guards (vom Tag 154-192, Ochs, Pflug 240-284, Alber 284-331; dynamic -> still.py for holds), bhvhekgvYso Stahlakademie footwork (mostly feet close-ups; full-body side 6:12-8:50 includes FALSCH demos -> careful).
- still.py <id> t0 t1: static-hand holds (guards).

## Session (Oct 16, later)
- Round-3 peeks: ACCEPT 9mREqmP7jhM (Paul Becker student, Scheitelhau on commands, side/45) -> 2 clips. Others rejected/offspec (see review.csv).
- Björn Rüther guards 4hwTpsZ5cgk: still.py holds -> Vom Tag 156.5-163.5, 171.5-179.5; Alber 300.8-308.1.
- Stahlakademie footwork bhvhekgvYso rejected (no clean labelable steps).
