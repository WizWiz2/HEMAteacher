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
- 13:5x EVAL (h_lopo injection, base = main model). results/h_<cfg>[_vside].txt. Core own / wrong:
  syn: harvest 3/15 w1/160 | seen 2/22 (all 3/30) w3/240 | heldout-front 0/2 w0/24
  mix: harvest 5/15 w0 | seen 2/22 (3/30) w4 | heldout 0/2 w0      real: harvest 3/15 w1 | seen 0/22 w2 | heldout 0/2
  view=side for frontal clips (vside): mix harvest 5/15 w2 | seen 2/22 w3 | heldout 0/2 w0.
  FINDING: app 'front' camera view never arms on real frontal clips (heldout funnel no_start 3/3, harvest-front no_start); in 'side' processing they start but stop short/undecided.

## 2026-10-16 ~13:20 Phase B step 3 done: real reps in the shipped model (branch feat/real-harvest-templates off main 5d9fd70)
- tools/build_real_fixture.py: KEEP reps of results/reps_side.txt -> fixture clips variant real:train (side-processed, left-facing mirrored); CAP/DROP env.
- motionTraining.buildModel: real:train clips are extra templates only; scales/weights/typical*/acceptDistance from renders only
  (first try let them calibrate thresholds: acceptDistance 2.74->3.58, beginner similarity test + scenarios red -> rejected).
- Synthetic (evaluate-motion-recognition lobo,test; M/E own, beginner own):
  main        lobo 102/122 w13/976, beg 44/61 | test 122/148 w14/1184, beg 58/76 w9/608
  all71       lobo 101/122 w13,     beg 44/61 | test 122/148 w14,      beg 56/76 w8
  cap2-noZw   identical to main
- CI: all71 -> vitest 70/70, vom-tag ok, --check ok, static ok, check-motion-scenarios FAIL (normal 2/0: beginner krumphau -> "looks like Zwerchhau"; fast 4/2, fps10 4/3, slow4x 8/4). cap2 incl. zwerchhau fails the same way. cap2-noZw: scenarios pass (commit cab6e28) but real-set results identical to syn (no effect).
- Real sets (CFG=built, person's own templates removed; core own / wrong):
  syn(main) vside  harvest 3/15 w3/160 | seen 2/22 w3/240 | heldout-front 0/2 w0/24
  all71 vside      harvest 6/15 w2/160 | seen 2/22 w2/240 | heldout-front 0/2 w0/24
  cap2-noZw vside  = syn
- Fresh ONCE (generic single attempt per clip x 9 drills; main and all71, clip view and vside): 0/35 own, 0/28 core, 0/280 wrong in all four. Funnel (main vside): no_start 16, no_decision 15, short 3, tracking 1.
- Verdict: bar (core >=60%, wrong <=5% on held-out real people) NOT met. Draft PR (head = all71), not merged (scenarios red + small synthetic beginner drop).

## 2026-10-16 13:05 PHASE C: front camera mode (branch fix/front-view off main 5d9fd70, worktree /workspace/hema-fv)
Diagnosis (tools/fv_diag.mjs -> results/fv_diag_front.json; 10 frontal harvest/seen motion clips; never fresh):
- drillEngine.ts on main short-circuits motion drills in front view ("повернись боком") -> front mode can never start (= the no_start funnel).
- Even bypassed: front normalisation maps MediaPipe z to fore/aft x. ankle_x jitter front .035-.115 torso/frame vs side .002-.006
  (10-20x); arming-stable frame pairs (pattern RMS delta < .035) front .02-.42 vs side .63-.93; longest stable run often < 200 ms
  (arming needs 200); whole-clip path front 4-7x side (tvg advance 17.5 vs 2.8). Zeroing z restores stability (.73-.97).
Plan: front = 2D image plane (x lateral, y vertical, z dropped), approach proxy root_x = k*ln(torso px), front-only model
(motionModel.front.json/motionPatterns.front.json) from frontal renders + harvest frontal reps; side untouched.
Renders: /workspace/hema/baf (gen_jobs_front.py, 81 jobs az 60-90, 9 drills, interleaved), pilot /workspace/hema/bafp (2 jobs).
  lanes: cd /workspace/hema/baf && BA=/workspace/hema/baf JOBS=/workspace/hema/baf/jobsf.tsv THR=3 setsid nohup /workspace/hema/ba3/run_ba3.sh <lane> > lane<lane>.out 2>&1 &
  extract: cd /workspace/hema/baf && BA=/workspace/hema/baf NL=3 setsid nohup ./extract_loop.sh > extract_loop.out 2>&1 &  (vite :5210 from real/app/frontend must be up)
  progress: baf/progress.txt (DONE/FAIL lines), baf/raw/*.json extracted.
- 13:27 Pilot 1 (d 3.7 zornhau): MediaPipe lost the first 2.2 s (person ~110 px) -> frontal distance range changed to 2.6-3.3 m (test 2.9).
  Pilot 2 (d 3.15 / 2.9): 239/240 detected both, clearance 0. FULL BATCH STARTED 13:27 /workspace/hema/baf (81 jobs, 2 copied from pilot2), lanes 1-3 THR=3 + extract_loop (NL=3). ETA ~16:50.
  Kill only: pkill -f "run_ba3.sh"; pkill -f "blender.*baf/render_ba.py"; pkill -f "baf.*extract_loop|extract_loop.sh"
- Code on fix/front-view (commits 451f5a6.., WIP): normalize front = image plane (z=0), root_x(front) = 2*ln(torso px), per-view
  model/patterns (motionModel.front.json etc.), drillEngine passes view, passing-step crossing on ankle y in front, clipView(),
  isFrontTrainClip/isFrontTestClip, protocols front-lobo/front-test, build-motion-fixture --base + 'front' variant.
  After the fix: front-mode arming stability = side (stable .63-.93, runs >= 600 ms); held-out funnel no_start 3/3 -> short 3/3 (side templates).
- Real frontal reps (h_lopo VIEWOVR=front TLOG results/reps_front_all.txt, non-held-out front clips): 12 KEEP
  (falcon zwerch 1, tvg passfwd 3, passback 1, advance 3, retreat 3, harmon krumph 1). build_real_fixture.py VARIANT=real:front VIEW=front.
- NEXT when baf done: node frontend/scripts/build-motion-fixture.mjs /tmp/fx_front.json.gz --base <main fixture> /workspace/hema/baf/raw:front:/workspace/hema/baf/clips
  then VARIANT=real:front VIEW=front python3 tools/build_real_fixture.py results/reps_front_all.txt clips.json /tmp/fx_front.json.gz frontend/test-fixtures/motion-poses.json.gz
  then build-motion-patterns, evaluate-motion-recognition (lobo,test,front-lobo,front-test), h_lopo VIEWOVR=front CFG=built (harvest/seen/heldout), CI, PR.
