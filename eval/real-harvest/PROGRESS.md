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
