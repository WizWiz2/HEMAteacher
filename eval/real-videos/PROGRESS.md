# Real public video validation — progress notes
Started 2026-10-04 14:52 (UTC+5). yt-dlp binary at ~/.local/bin/yt-dlp (export PATH=$HOME/.local/bin:$PATH).
Layout: raw downloads /workspace/hema/real/raw (NOT git), clips /workspace/hema/real/clips/<drill>/<id>.mp4,
worktree /workspace/hema-real (branch eval/public-real-videos from origin/main 06a0070).
## Log
- 15:10 yt-dlp works ONLY with `--extractor-args youtube:player_client=mweb -f 18` (360p) + deno in ~/.local/bin; default/android/tv clients => "Sign in to confirm you're not a bot"/429.
- dl.sh downloads dl_list.txt then dl2.sh chains dl_list2.txt. Contact sheets: ./sheet.sh <id> <interval> <start> <dur> <suffix> (W=, T= env) -> sheets/.
- Facing: regression page hardcodes facing 'right'; DrillPage lets user pick. Plan: vr_eval (browser MediaPipe, raw frames) + replay.mjs with per-clip facing (patched copy) = what DrillPage user would get.
- VCU HEMA master-cut videos: solo demo by right person (Tom), near-frontal camera, partner in frame -> crop right half. French Galloglass / Blood&Iron 7-op: unusable (sparring / talking head).
- 15:20 Survey: GOOD candidates: IATS50UIRKQ (Laurel City solo Zwerchhau drill 0:26-1:05, ~45° front, 1 person); C2sVz_3v7dw (Björn Rüther Zornhau solo profile 0:36-0:57, 1:12-1:18, 2:15-2:33);
  9jjUHSz5pOU (Björn Krumphau pair, side, 0:27-0:33 slow, 0:36-0:48 fast); 3FrVSTJPaZs (Björn Schielhau pair side 0:27-0:33, 0:36-0:48). VCU (CaBF/0Utiff/w-8U/wlI9/wjAC) near-frontal explanatory demos, weak.
  UNUSABLE: f1EdAPzWRzw, 7-opqsXjlHc, eAmpyTzt_ss & 7abXnJ23un8 (feet only), JTuJ1j1hUL4 (frontal, tiny), OWJmZOGjB18 (pair, crowded).
- fine.sh <id> <start> <dur> <iv> <crop|none> <name> -> sheets/f_<name>_NN.jpg
- 15:30 BEST SOURCE: Dreynschlag "Learn Sword Fighting" (Rg3S5SEEnnc zornhau, _ELm_qxdpyA zwerchhau, LDlxJBlQH9U krumphau, W98A61cycQU/aJlRxoN9e4U schielhau): side view, full body, attacker on LEFT facing right, teacher middle, partner right -> crop left ~40-45%.
  Rg3S reps 0:16-1:52; _ELm 0:20-1:32. AK1I1TeLV_w (Alexander Gent solo 7-cut drill, side-ish, 0:16-0:46) maybe. Laurel IATS zwerch reps: ~29-37, ~39.5-46, after crossfade 47.
- 15:45 Eval app checkout = /workspace/hema/real/app (git archive origin/main 06a0070 + node_modules symlink + models/wasm copied). Worktree /workspace/hema-real only for commits (branch pushed, WIP commit 995d999).
- Python mediapipe pre-screen (needs libegl1, installed): screen.py <id> -> screen/<id>.json (10fps: people, full-body vis, handup, ankle spread, scene-cut diff). screen_all.sh detached runs all.
- Dreynschlag Rg3S: clean zornhau rep at 44.0-51.0 (crop left 45%, faces right); 54-94 is binding/winding (not clean reps).
- 16:05 More GOOD solo sources: vqUplDw3t04 (Schildwache footwork drills, side view, solo, 1:30-3:20, 4:40-5:20), 6sgFVs3idms (Mortal Snail zwerchhau solo backyard 0:00-0:40, 2:22-3:52, 4:36-6:40),
  6KXNTisuDYQ (Schiltschlac solo drills: Long&Short 0:24-1:44, Zwer&Schiel 1:48-4:00). Weak: 4IUzZhk5s-Y (pair dark), Hbc1pA1hMt8 (pairs gym), WeaCDGdYc2M (frontal Italian).
- strips.py <out.jpg> id:w0:w1[:x0-x1] ... -> rows of 10 frames per window. find.py <id> [x0 x1] -> candidates from screen json.
- screening: 4 workers screen_w.sh (claims in screen/claims). (pkill -f screen_all.sh kills your own shell - avoid)
- 16:25 VERIFIED segments so far: drey Rg3S 44.0-51.0 zornhau (crop 0-0.45, profile, faces R); laurel IATS 29-37 / 40.5-46.5 / 47.5-54.5 / 54.5-61.5 zwerchhau (~45° front; crossfades at 46.5 & 62 avoid);
  VCU krumphau 0Utiff 28.5-35 (crop 0.5-1, frontal, vom Tag->krumphau with step). VCU zornhau/zwerch/schaitel/schiel windows = slow talking explanations, NOT reps (skip).
  Mortal Snail = learner, frontal, ambiguous strike type (skip or low-confidence). Schiltschlac 6KXN = edited montage, cuts every 1-2s (skip). Björn pair clips: fencers overlap (2 persons, stress only).
- (box clock is the truth; earlier "16:xx" stamps in this file were wrong, real ~15:20 now)
- manifest.csv (source of truth) -> cut.py -> clips/<drill>/<clip_id>.mp4. vite for main checkout on :5210 (app/frontend). Browser run: vr_eval.mjs -> results/vr_own.json, raw MediaPipe frames -> rawframes/<drill>__<clip>.json (~55 s wall per clip).
- replay_facing.mjs = harness replay.mjs + per-file facing (FACING=<json> env). Synthetic clips ALL face right (checked nose vs ears) -> left-facing real clips need facing=left (=DrillPage 'Лицом ←'). facing_auto.py <rawdir> computes facing.
- dl_list3.txt (32 more: Paul Becker solo form, Laurel schielhau solo, Digladior krumphau solo, footwork videos, SuperiorHEMA zettel, etc.) downloading via dl3.sh. screen_w.sh workers must be restarted after dl3 (they exited on dl2_done).
- 15:25 (session 2) dl3 7 left; 4 screen workers + priority screens for xOQU/6xmG/hK25/T-M_. vr_eval of first 9 clips running (4 done: all cal=true, strikes stay 'running cp=2' "Продолжай движение до конца" / bjorn 'ready' = never started).
  New picks (pending verify): drey zwerch _ELm 42.5-50.0 crop0-0.5 R; drey krump LDlx 42.5-49.3 crop0-0.5 R (cut to closeup at 49.5).
  Steps sources: Ukolov xOQUcJpnRe8 60-210 (solo, ~45°, steps w/ sword), strîtschar 6xmG 39-110/180-222 (solo, side-ish, steps), HEMA TEAM hK25 48-125 steps / 156-245 guards (frontal-ish), Schildwache vqUpl.
  Ottawa T-M_ passing step frontal solo; Swordwind uy3t thrust+pass frontal; Laurel maVcL = talking head mostly (solo outdoor ~4:51-5:00, 6:57-7:10); Becker -c6R pair side 20-28; TInM frontal.
  Plan for steps: find.py on screen json (hip>0.5) then verify with strips.
