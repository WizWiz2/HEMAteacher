# Real blade set + retrain (resume notes) — work dir /workspace/hema/rb, venv /workspace/hema/venv (torch cpu, transformers)
Split by CHANNEL. Held-out channels = the people of the 30 real e2e clips (BAHFF, Paul Becker, Björn Rüther, Dreynschlag,
Drey Wunder, Laurel City, strîtschar, Sword Carolina, Ukolov, VCU). Never train/tune on them.
1. sample.py: 107 public videos (harvest/raw + real/raw) -> 16 172 candidate frames (one dominant person, wrists together) -> cands.jsonl, frames/. DONE
2. label.py q0..q3 -> lab0..3.jsonl (OWLv2 "sword" box near hands -> SAM mask -> principal axis; tip = far end). 3210 queued
   (train 40/video, held 25/video). Resumable: ./resume.sh (skips done names). Started 11:31, ~17/min.
   By-eye precision (3 random sheets, 48 labels): see RESULTS.
3. cat lab*.jsonl > all_lab.jsonl; venv python build_real.py -> real_crops.npz + gray/*.raw
4. venv python train_real.py <valChannels> <epochs> <realWeight> <out.pt>   (same arch as bladeNet.ts)
5. venv python eval_frames.py name=net.pt  (held-out frames: classical / old net / new net / hybrid)
6. export_real.py net.pt weights.json parity.json; WEIGHTS=.. OUT=det.json node run_real.mjs (30 clips); ./eval_e2e.sh tag /abs/det.json
Baselines e2e (30 real clips, own / wrong-of-240): blade off 3/30 · 3; old hybrid 2/30 · 4; track only 2/30 · 3.
