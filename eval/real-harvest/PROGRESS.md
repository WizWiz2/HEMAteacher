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
- Round-4 search (queries4.txt: footwork/krumphau/schielhau, 13 queries): peeked 12, all rejected or offspec (see review.csv). TVG Steele Schrittevideo MB758cP5AaE = best step source but frontal (offspec).
- Fixed stritschar_alber_01 crop (was 0.05-0.6 -> person cut out, 0 landmarks); now 0.4-1.0, recut; needs vr re-run.
- step_find.py: CUT env var to raise scene-cut threshold for handheld outdoor video.
- SUMMARY.md written.
- Round-5 zornhau queries (queries5.txt): 7 peeked, Adelaide downloaded+screened, none accepted. Golden Falcon s1LKv5DnCg4 Zwerhaw lesson ACCEPTED (2 clips, non-chained zwerchs with steps).

## PHASE B (Oct 16 12:27): frontal..45deg now in spec (user). Steps: 1 harvest frontal, 2 fresh angle check + frontal held-out, 3 templates + eval + draft PR.
- Fresh angle distribution: clean 23 = profile 13 + ~30-45deg 10; frontal only 6 NON-clean (jtsay krumphau x3, cba zwerchhau x3). -> clean fresh does not cover frontal use case.
- Accepted: TVG Steele MB758 (passfwd/passback/advance/retreat, frontal), Harmon krumphau feBKwmT03t4 56.5-60.5, Rocket City schielhau x2 (slow demos).
- Downloading (dlF.out): SFp5 kl0m f0sU smTe CVLV 42nX nzrb aAUI gnmg.
- 12:5x accepted frontal: harmon vomtag, jkcs krumphau, ottawa vomtag x2, rocketyt vomtag; rejected kl0m (feet cut), U0ai re-check (spectators + ambiguous cut type in chained sequence)
- Synthetic azimuth coverage (render_ba: cam=(0.7+d sin az, -d cos az); az=0 = profile, characters face right): ba 351 jobs az -24.7..44.8; ba2 54 jobs -24.7..43.9; ba3 96 jobs -22.6..44.6 (18 at 0, 18 at 40). NOTHING beyond 45deg from profile -> frontal (60-90deg) renders missing.
- App has cameraView 'front' (normalize.ts: MediaPipe depth z -> fore/aft x, screen x -> lateral). Frontal eval must run process(raw, facing, mode, 'front') + adaptDrillForCameraView(...,'front'); ~45deg clips -> 'side'.
- Template/eval harness to reuse: /workspace/hema/real/p3/lopo.mjs (bursts -> prepareSequence templates, LOPO replay via CM.setRecognitionModel). Plan: copy to harvest/tools/h_lopo.mjs with sources harvest+seen, per-clip cameraView, sets: harvest LOPO, seen30, frontal held-out, fresh once.
- Base choice: main (5d9fd70, CI green) vs feat/real-shape-strikes (#25, CI red on beginner-similarity). -> branch off main (merge needs green CI).
- RESUME: CVLVJsiMxwc (Kuba Potocki footwork, 30 min, solo frontal arcade) screening in bg (dlF.out continues with 42nX nzrb aAUI gnmg). Then: frontal held-out pick, cut.py, vr_run.sh, h_lopo.
- 13:2x tools/clips_index.py + tools/h_lopo.mjs (APPROOT=/workspace/hema-front/frontend = worktree branch feat/real-harvest-templates off main 5d9fd70; node_modules symlink hema-gap). First run (partial harvest rawframes): syn harvest own 2/15 w1/120, seen 3/30 w3/240 (= known main baseline); mix harvest 4/15 w0, seen 3/30 w3; real harvest 3/15 w0, seen 2/30 w1.
  Finding: frontal clips in 'front' view -> feet path 5-8x typical (MediaPipe z noise) -> step templates rejected as 'long'.
- 13:4x Step 1 done for this session: 33 clips / 16 people (SUMMARY.md). Frontal held-out = Rocket City schielhau instructor + JKCS krumphau instructor (heldout_people.txt). Lynx advance added; nzrb/kl0m rejected; CVLV pending.
