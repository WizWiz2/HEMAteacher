# Validation on real public videos (first look)

**Validation only.** These clips were never used to train or tune anything, and must not be. No video is committed: the
manifest (`eval/real-videos/manifest.csv`) holds the YouTube URL, timestamps, crop and labels, and `cut.py` recreates the clips
from your own downloads.

Main at `06a0070`, VideoRegressionPage pipeline (browser MediaPipe pose *lite* in headless Chrome, blade flag OFF), shipped
recognition model (`acceptDistance` 2.735, margin 1.05).

## Data

30 clips (4–8 s, one repetition each, starting from a guard), cut from 13 public videos by 9 channels. All performers are
instructors or experienced fencers (= "master" level). Labels come from the video title or chapter plus what is shown. They are
not from audio, so confidence is marked per clip.

| drill | clips | sources |
|---|---|---|
| zornhau | 5 | Dreynschlag, Björn Rüther (×3), Paul Becker |
| zwerchhau | 5 | Laurel City (×4), Dreynschlag |
| schielhau | 4 | BAHFF (×2), Laurel City (×2) |
| krumphau | 2 | Dreynschlag, VCU HEMA |
| scheitelhau | **0** | none found: no usable solo or side-view rep (pairs, montage, vertical phone video with feet cut off, frontal talking head) |
| advance | 5 | S. Ukolov (×2), strîtschar (×3) |
| retreat | 3 | S. Ukolov (×2), strîtschar |
| passing-step-forward | 3 | S. Ukolov, VCU HEMA, Sword Carolina |
| passing-step-backward | 3 | VCU HEMA (×2), Sword Carolina |
| guards-basic | **0** | no single take with all four guards held in sequence |

Camera: 8 clips in profile, 4 at about 10°, 3 at about 20°, 7 at about 30°, 7 at about 45° front, and 1 near-frontal (about 70°, outside the
supported range). Most clips were 360p (only YouTube format 18 could be downloaded from the box). Three clips are crops of a
2–3 person demo. The VCU passing steps are performed without a sword.

| clip | drill | source (URL with start) | angle | persons | level | label conf. |
|---|---|---|---|---|---|---|
| drey_zornhau_01 | zornhau | [Rg3S5SEEnnc 44.0–51.0 s](https://www.youtube.com/watch?v=Rg3S5SEEnnc&t=44s) | profile 0deg | 1 (3 in source; cropped to attacker) | instructor/experienced (Dreynschlag) | high |
| laurel_zwerchhau_01 | zwerchhau | [IATS50UIRKQ 29.0–37.0 s](https://www.youtube.com/watch?v=IATS50UIRKQ&t=29s) | ~45deg front | 1 | instructor (Laurel City) | medium |
| laurel_zwerchhau_02 | zwerchhau | [IATS50UIRKQ 40.5–46.3 s](https://www.youtube.com/watch?v=IATS50UIRKQ&t=40s) | ~45deg front | 1 | instructor (Laurel City) | medium |
| laurel_zwerchhau_03 | zwerchhau | [IATS50UIRKQ 47.5–54.5 s](https://www.youtube.com/watch?v=IATS50UIRKQ&t=47s) | ~45deg front | 1 | instructor (Laurel City) | medium |
| laurel_zwerchhau_04 | zwerchhau | [IATS50UIRKQ 54.5–61.5 s](https://www.youtube.com/watch?v=IATS50UIRKQ&t=54s) | ~45deg front | 1 | instructor (Laurel City) | medium |
| vcu_krumphau_01 | krumphau | [0UtiffQ67GE 28.5–35.0 s](https://www.youtube.com/watch?v=0UtiffQ67GE&t=28s) | near-frontal ~70deg | 1 (2 in source; cropped) | instructor (VCU HEMA) | medium |
| bahff_schielhau_01 | schielhau | [lwh7T2vksng 18.5–25.5 s](https://www.youtube.com/watch?v=lwh7T2vksng&t=18s) | profile 0deg | 1 (2 in source; cropped) | instructor (BAHFF) | high |
| bahff_schielhau_02 | schielhau | [lwh7T2vksng 52.5–59.0 s](https://www.youtube.com/watch?v=lwh7T2vksng&t=52s) | profile 0deg | 1 (2 in source; cropped) | instructor (BAHFF) | high |
| bjorn_zornhau_01 | zornhau | [C2sVz_3v7dw 139.3–145.3 s](https://www.youtube.com/watch?v=C2sVz_3v7dw&t=139s) | profile 0deg | 1 | instructor (Björn Rüther / Hammaborg) | medium |
| drey_zwerchhau_01 | zwerchhau | [_ELm_qxdpyA 42.5–50.0 s](https://www.youtube.com/watch?v=_ELm_qxdpyA&t=42s) | profile 0deg | 1 (3 in source; cropped to attacker) | instructor/experienced (Dreynschlag) | medium |
| drey_krumphau_01 | krumphau | [LDlxJBlQH9U 42.5–49.3 s](https://www.youtube.com/watch?v=LDlxJBlQH9U&t=42s) | profile 0deg | 1 (3 in source; cropped to attacker) | instructor/experienced (Dreynschlag) | medium |
| bjorn_zornhau_02 | zornhau | [C2sVz_3v7dw 38.8–45.2 s](https://www.youtube.com/watch?v=C2sVz_3v7dw&t=38s) | profile 0deg | 1 | instructor (Björn Rüther / Hammaborg) | low |
| bjorn_zornhau_03 | zornhau | [C2sVz_3v7dw 73.0–78.0 s](https://www.youtube.com/watch?v=C2sVz_3v7dw&t=73s) | ~20deg front | 1 | instructor (Björn Rüther / Hammaborg) | low |
| ukolov_advance_01 | advance | [xOQUcJpnRe8 189.5–194.0 s](https://www.youtube.com/watch?v=xOQUcJpnRe8&t=189s) | ~30deg front | 1 | instructor (S. Ukolov) | medium |
| ukolov_advance_02 | advance | [xOQUcJpnRe8 194.0–198.6 s](https://www.youtube.com/watch?v=xOQUcJpnRe8&t=194s) | ~30deg front | 1 | instructor (S. Ukolov) | medium |
| ukolov_retreat_01 | retreat | [xOQUcJpnRe8 200.2–204.0 s](https://www.youtube.com/watch?v=xOQUcJpnRe8&t=200s) | ~30deg front | 1 | instructor (S. Ukolov) | medium |
| ukolov_retreat_02 | retreat | [xOQUcJpnRe8 203.9–207.8 s](https://www.youtube.com/watch?v=xOQUcJpnRe8&t=203s) | ~30deg front | 1 | instructor (S. Ukolov) | medium |
| ukolov_passfwd_01 | passing-step-forward | [xOQUcJpnRe8 215.7–221.5 s](https://www.youtube.com/watch?v=xOQUcJpnRe8&t=215s) | ~30deg front | 1 | instructor (S. Ukolov) | medium |
| stritschar_retreat_01 | retreat | [6xmG_vA7f7g 65.1–71.3 s](https://www.youtube.com/watch?v=6xmG_vA7f7g&t=65s) | profile ~10deg | 1 | instructor (strîtschar) | low |
| stritschar_advance_01 | advance | [6xmG_vA7f7g 75.6–81.4 s](https://www.youtube.com/watch?v=6xmG_vA7f7g&t=75s) | profile ~10deg | 1 | instructor (strîtschar) | low |
| stritschar_advance_02 | advance | [6xmG_vA7f7g 82.9–87.0 s](https://www.youtube.com/watch?v=6xmG_vA7f7g&t=82s) | profile ~10deg | 1 | instructor (strîtschar) | low |
| stritschar_advance_03 | advance | [6xmG_vA7f7g 97.4–101.6 s](https://www.youtube.com/watch?v=6xmG_vA7f7g&t=97s) | profile ~10deg | 1 | instructor (strîtschar) | low |
| vcu_passfwd_01 | passing-step-forward | [JTuJ1j1hUL4 267.9–272.9 s](https://www.youtube.com/watch?v=JTuJ1j1hUL4&t=267s) | ~45deg front | 1 | instructor (VCU HEMA) | medium |
| vcu_passback_01 | passing-step-backward | [JTuJ1j1hUL4 275.9–280.6 s](https://www.youtube.com/watch?v=JTuJ1j1hUL4&t=275s) | ~45deg front | 1 | instructor (VCU HEMA) | medium |
| vcu_passback_02 | passing-step-backward | [JTuJ1j1hUL4 282.2–286.3 s](https://www.youtube.com/watch?v=JTuJ1j1hUL4&t=282s) | ~45deg front | 1 | instructor (VCU HEMA) | medium |
| swc_passfwd_01 | passing-step-forward | [vZCeqNPYRSg 122.6–128.2 s](https://www.youtube.com/watch?v=vZCeqNPYRSg&t=122s) | ~30deg front | 1 | instructor (Sword Carolina) | medium |
| swc_passback_01 | passing-step-backward | [vZCeqNPYRSg 128.2–133.3 s](https://www.youtube.com/watch?v=vZCeqNPYRSg&t=128s) | ~30deg front | 1 | instructor (Sword Carolina) | medium |
| laurel_schielhau_01 | schielhau | [maVcL1HSkIE 295.5–302.5 s](https://www.youtube.com/watch?v=maVcL1HSkIE&t=295s) | ~20deg front | 1 | instructor (Laurel City) | medium |
| laurel_schielhau_02 | schielhau | [maVcL1HSkIE 423.0–430.0 s](https://www.youtube.com/watch?v=maVcL1HSkIE&t=423s) | ~20deg front | 1 | instructor (Laurel City) | medium |
| becker_zornhau_01 | zornhau | [-c6Rhb3O6-0 20.5–27.0 s](https://www.youtube.com/watch?v=-c6Rhb3O6-0&t=20s) | profile 0deg | 1-2 (partner partly inside crop) | instructor (Paul Becker) | medium |

## Results

Full tables: `eval/real-videos/results/summary.md`. Browser raw frames were replayed offline through the same modules.
`replay_facing.mjs` reproduces all 30 browser outcomes 30/30 and adds the per-clip facing that a DrillPage user would choose.

### Own drill selected (one attempt, like the regression page)

| | real (this run) | synthetic reserved test, M/E (docs/motion-recognition.md) |
|---|---|---|
| strikes own drill accepted | **1/16 (6%)** | 65/84 (77%) |
| steps own drill accepted | **2/14 (14%)** | 57/64 (89%) |
| all own accepted | **3/30 (10%)** | 122/148 (82%) |
| accepted as the WRONG drill (9 continuous drills) | 3/240 (1.3%) | 14/1184 (1.2%)¹ |
| accepted as the wrong drill, incl. guards-basic column | 4/270 (1.5%) | n/a |

¹ Re-run here with the shipped model through the same streaming path. The doc table counts 13/672 for strikes plus 3/512 for steps.

The accepted clips are `laurel_zwerchhau_02` (similarity 31, marked "too slow, about 2.4×"), `vcu_passfwd_01` and `vcu_passback_02`.
Wrong accepts: `bahff_schielhau_01` was accepted as zornhau and as guards-basic, `laurel_schielhau_02` as zornhau, and `bjorn_zornhau_02` as retreat.
DrillPage mode (a retry after each failed attempt) gives the same 3/30 own and the same wrong accepts.

### Outcome on the own drill: what the user would see

| outcome | clips | message |
|---|---|---|
| **undecided**: the movement settled but was neither accepted nor rejected | 20 | "Продолжай движение до конца" / "Двигайся без остановок" (stays on screen) |
| accepted | 3 | "Движение распознано" |
| rejected as another drill | 3 | "Похоже на Zornhau / Zwerchhau…" (2 schielhau → zornhau, 1 retreat → zwerchhau) |
| attempt never started (strike start pose not reached) | 2 | "Прими исходную позицию" (Björn: small figure, Zornhut start, not vom Tag) |
| calibration never completed | 1 | (laurel_schielhau_01) |
| tracking failure | 1 | "Камера потеряла движение" (becker: partner inside the crop) |

So framing and calibration cause only 4/30 failures. **The main failure is recognition:** 20/30 attempts end undecided
because the attempt is farther than the accept distance from every template.

Per drill (own accepted): zornhau 0/5, zwerchhau 1/5, schielhau 0/4, krumphau 0/2, advance 0/5, retreat 0/3,
passing-step-forward 1/3, passing-step-backward 1/3. Per angle: 3/7 at about 45° front and 0/23 everywhere else, including 0/8 in pure
profile. Profile is the angle the app recommends. By source: VCU 2/4 and Laurel 1/6; all other channels 0.
Facing matters: with the opposite facing, 0/30 are accepted.

## Why real distances (2.4–9) are far above 2.735

Full numbers: `eval/real-videos/diag/diagnosis.md` (from `diag.mjs attempts`, which uses the same pipeline and the same model
for the 30 real clips and the 148 reserved synthetic test clips). Values are median (10th–90th percentile).

| | real strikes | synth strikes | real steps | synth steps |
|---|---|---|---|---|
| own-drill distance | **3.83** (2.70–5.49) | 0.74 (0.58–1.34) | **4.46** (2.40–8.81) | 1.02 (0.65–1.33) |
| nearest distance to ANY drill | 3.39 | 0.73 | 3.29 | 1.01 |
| own distance, best prefix of the attempt | 3.09 | 0.72 | 4.29 | 0.93 |
| own drill is the nearest drill | 3/13 | 68/84 | 8/14 | 59/64 |
| tempo (active duration / typical) | **4.1×** (1.5–8.4) | 1.05 | **3.8×** (1.0–5.2) | 0.89 |
| path ratio (attempt path / typical) | 1.44 | 1.00 | **2.66** | 0.99 |
| hand vertical range (torso) | 0.27 | 0.45 | 0.27 | **0.07** |
| hand path length during the attempt (torso) | 1.84 | 1.56 | **2.11** | **0.46** |
| hand height at start (torso vs nose, − = above) | −0.59 | −0.19 | −0.99 | −1.33 |
| lowest hand position | −0.14 | +0.06 | −0.87 | −1.28 |
| landmark jitter, hand / ankle (torso/frame) | 0.006 / 0.002 | 0.011 / 0.002 | 0.006 / 0.003 | 0.005 / 0.008 |
| torso length / frame height | 0.23 | 0.19 | 0.21 | 0.18 |

Share of the own-drill DTW cost by channel (median): real vs synthetic. The mean |z| is the difference in model channel scales.

| channel | strikes real / synth share | strikes \|z\| real / synth | steps real / synth share | steps \|z\| real / synth |
|---|---|---|---|---|
| hand_y | 0.12 / 0.06 | **4.1** / 0.6 | 0.12 / 0.02 | **4.0** / 0.5 |
| hand_over_head | 0.10 / 0.04 | **4.4** / 0.6 | 0.11 / 0.02 | **5.1** / 0.5 |
| forearm_sin | 0.06 / 0.09 | 3.5 / 0.8 | **0.20** / 0.00 | **6.8** / 0.1 |
| forearm_cos | 0.03 / 0.04 | 2.8 / 0.7 | 0.10 / 0.02 | 4.7 / 0.5 |
| left/right_ankle_x | 0.10+0.08 / 0.03+0.03 | **3.4** / 0.4 | 0.04+0.06 / 0.05+0.04 | 2.3 / 0.6 |
| root_dx | 0.07 / 0.03 | 3.0 / 0.3 | 0.02 / 0.06 | 2.2 / 0.7 |

Interpretation, from most to least important:

1. **The movement shape differs, not the noise or scale.** Real attempts are about 4× farther from *every* template (nearest of all
   drills is 3.4 vs 0.7). The model's channel scales are narrow because the training spread is narrow: `hand_y` scale is 0.068 torso
   and `hand_over_head` is 0.073. A 0.27-torso difference in hand height is therefore already about 4 units. Real instructors start vom
   Tag with the hands higher above the head (−0.59 vs −0.19 torso). They also finish higher (lowest hand −0.14 vs +0.06): the
   strikes end at shoulder or chest height in Langort instead of dropping low. Their vertical hand excursion is about 40% smaller
   (0.27 vs 0.45 torso).
2. **The sword arm moves during steps.** Synthetic step clips keep the hands frozen (hand path 0.46 torso, vertical range 0.07,
   forearm_sin |z| 0.1). Real fencers carry the sword through the step, or cut while stepping: the hand path is 4.6× longer and
   forearm_sin |z| is 6.8. The forearm and hand channels then carry about 60% of the step cost, and the step looks like a strike
   (stritschar advances are nearest to zwerchhau or scheitelhau).
3. **More than one movement per attempt, and slower.** Real active duration is about 4× the typical value, and the attempt path is
   1.4× (strikes) to 2.7× (steps) the typical one: wind-up, follow-through, recovery or extra steps fall inside one attempt. This is
   secondary, though. Cutting the attempt at its best prefix only lowers the strike median from 3.83 to 3.09 and leaves steps at
   about 4.3. The path-length resampling already removes tempo itself.
4. **Footwork inside strikes.** For strikes, the ankle and root channels differ by |z| about 3 versus 0.4 synthetic. Real performers
   step differently (or not at all) compared with the template's "Zornhau with passing step".
5. **Not the cause:** MediaPipe jitter is no higher on real video (hand 0.006 vs 0.011, ankle 0.002–0.003 vs 0.002–0.008 torso/frame), person scale is similar (torso 0.21–0.23 vs 0.18–0.19 of
   frame height), and fps is 30 on both. Facing must be right (0/30 with the wrong facing), but it was set per clip here.
   360p and crops did not show up as noise in these numbers. Three clips failed earlier for framing reasons (small figure,
   partner inside the crop).

### Diagnostic only: looser accept distance (NOT a proposed change)

`ACCEPT=<d> node diag.mjs sweep`. acceptByDrill is cleared, and the same streaming pipeline is used for real clips and synthetic test
M/E clips, over the 9 continuous drills:

| acceptDistance | real own | real strikes | real steps | real wrong-drill | synthetic own | synthetic wrong-drill |
|---|---|---|---|---|---|---|
| 2.735 (shipped) | 3/30 | 1/16 | 2/14 | 3/240 (1.3%) | 122/148 | 14/1184 (1.2%) |
| 3.25 | 5/30 | 1/16 | 4/14 | 6/240 (2.5%) | 122/148 | 14/1184 |
| 3.75 | 6/30 | 1/16 | 5/14 | 6/240 (2.5%) | 122/148 | 14/1184 |
| 4.5 | 6/30 | 1/16 | 5/14 | 8/240 (3.3%) | 122/148 | 14/1184 |
| 6.0 | 7/30 | 1/16 | 6/14 | 9/240 (3.8%) | 122/148 | 14/1184 |

Loosening the threshold does not change the synthetic test set at all, because its own distances are almost all below 1.4. On the
real clips it recovers a few steps and **no strikes**: real strikes are usually nearer to a *different* strike (own is nearest in
only 3/13), so the margin rule rejects them. Meanwhile, real wrong-drill accepts triple. The threshold is not the fix. The gap is in
the templates (synthetic movement style), not in the decision rule.

## Verdict

**Not yet at a "show a coach" level for strikes.** On real instructors from public videos, the selected strike is recognised
1 time in 16, and steps 2 times in 14, against 77% and 89% on the synthetic test. In 2 of 3 cases, the app leaves the user on
"Продолжай движение до конца" with no decision. Wrong-drill accepts stay low (about 1.5%), so the system is cautious rather than
wrong. Framing and calibration mostly work: 29/30 calibrated and 27/30 started an attempt. The weakness is the synthetic-only templates:
hand height and range, the sword arm held still during steps, and one-movement-only attempts.

Caveats: 30 clips, 0 scheitelhau and 0 guards clips, 360p, labels from titles and chapters (not audio). Many clips are slow
teaching demos (tempo 4×), which are harder than a student drilling at speed. A small self-recorded set (phone, profile and 30°,
vom Tag, 10 reps per strike and step) would be the next useful test. The recogniser would most likely need real-movement
templates (recorded under a proper train/test split, not these clips) before it handles real fencers.

## Reproduce

`eval/real-videos/`: `dl*.sh` (yt-dlp `player_client=mweb`, format 18) → `screen.py`/`find.py`/`step_find.py` (candidate
search) → `manifest.csv` → `cut.py` → `vr_queue.sh` (browser pass, raw frames) → `run_replay.sh` → `summarize_real.py`;
`diag.mjs` + `diag_report.py` for the diagnosis. Notes: `PROGRESS.md`.
