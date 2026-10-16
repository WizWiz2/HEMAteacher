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
