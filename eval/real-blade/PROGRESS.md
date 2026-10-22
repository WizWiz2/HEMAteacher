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
- 13:15 interim net_i1 (realW 3, ~700 labels): val (3 train channels) <15° 38%, median 31°. Trying realW 10 (net_i2).
- 13:45 net_i2 (realW 10) worse: val <15° 27%. Val (3 train channels, 101 frames): classical conf>=3 cov 12% @67%; old net 15% correct;
  i1 39% correct (axis 54%, 16% flipped); hybrid cls+i1 44%. Net confidence (vector norm) barely separates right/wrong.
- 13:35 by-eye label precision: 64 random labels (48 mixed + 16 held) ~52/64 correct (~80%); main error = tip/pommel flip, also wall racks/partner swords.
- 13:37 resumed (worker 3): labels 2302/3210, jobs alive; ETA ~14:30.
- 14:00 labels 2509/3210, jobs alive (box seems to pause; rate varies).
- 14:35 built real set from 3072 labels: build_real.py now drops owl<0.2 / iou<0.75 and flags tip/pommel-ambiguous (A=1, 29) -> 1207 crops (848 train, 359 held).
  train_real.py: 4th target = axis-only flag (|cos| loss). AXALL=1 -> all real labels axis-only (direction learned from renders only); AXALL=0 -> only ambiguous.
  No elbows in cands, so forearm-based tip resolution not done (needs pose rerun).
  Running (val = Ottawa Swordplay, Michael Kozin, JKCS-Goslar; 14 ep, realW 3, THR=2): net_i3 AXALL=1 (train_i3.log), net_i4 AXALL=0 (train_i4.log). ~80 s/epoch -> ~15:00.
  Code pushed to feat/blade-tracking-prototype 545871c (eval/real-blade/). Worktree /workspace/hema-blade (branch blade-wip).
  Next: python eval_frames.py name=net_i3.pt (and i4) ; labels still trickling (3105) — rebuild later optional.
- 15:00 results (val 3 train ch, n=105, final ep): i3 AXALL=1 <15° 6%, med 69° (direction lost -> axis-only for ALL real is bad);
  i4 AXALL=0 <15° 17%, <30° 37%, med 40°. Not comparable 1:1 with i1 (val was n=80, other channels) -> retrain i1 recipe on same val needed.
  Launched eval_frames.py on held-out frames for net_i1 + net_i4 -> eval_i4.log.
- 14:50 held-out (359 frames, 9 held ch) eval_i4.log: correct<15° of all — classical conf>=1.1 71.3% (cov 93%, median 4°); old net 13%; i1 22.3% (med 50°); i4 24.8% (med 40°);
  hybrid cls>=3+old 49.6%, +i1 52.6%, +i4 49.9%. => nets far below classical; i4 ≈ i1.
- 14:55 pose.py (MediaPipe full, nearest person to label hands) -> pose_lab.jsonl (1652 ok labels). fixflip.py: tip := end along elbow->wrist.
  Stats: keep 866, flip 397 (31%), unsure 384, nopose 5. By-eye 32 flipped (fl1.jpg, fl2.jpg): majority now WRONG (two-handed grip:
  forearms cross/point across the hilt, not along blade; high guards point opposite). Forearm rule REJECTED; labels left as-is (far end from hands).
- 15:00 rebuilt: rc_nofilt.npz 1548 (1112 train/436 held), rc_filt.npz 1258. Training full-direction loss (AXONLY=0), same val:
  i5 = nofilt (=i1 recipe) train_i5.log; i6 = filt train_i6.log.
- 15:15 val (3 train ch): i5 nofilt (i1 recipe, all 3210-ish labels) <15° 29%, <30° 49%, med 31° (n=115); i6 filt <15° 21%, <30° 41%, med 39° (n=108).
  Filter hurts. Neither beats i1 (38% on its old val) -> NO e2e, nothing to main. Held-out eval i5/i6 running -> eval_i56.log.
  Conclusion: pseudo-label tip/pommel noise + tiny real set cap the net; classical (71% correct on held, med 4°) is the strong component.
  Next idea: use the net only for axis (fold direction) + classical/hands for sign, or train on classical-confirmed labels.
