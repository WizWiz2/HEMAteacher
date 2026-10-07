# Phase 5: sword-through-body fix for the real-shape renders

## Diagnosis (21 of the 96 ba3 renders dropped by the fixture clearance gate: more than 9 failing frames)
Every failing frame is in the end of the cut: the cross→finish transition, the finish hold, or the finish→recover
transition. The guard, chamber and the cut itself are clean.

| drill | dropped | bodies (levels) | check failed | cause |
|---|---|---|---|---|
| zwerchhau | 7 | short_slim_male (M/E/B/slow), avg_longlimb_female (M/E/B/slow) | grip_head (grip < 3.5 cm from the head, down to 0.2 mm) | real_v3 raises the hands above the head (hand_y 1.60). Short arms cannot reach the forward target (IK reach clamp), so the hands stay near the head. As the blade yaws from pointing right to pointing forward (sword_lat 25° → 0°, horizontal blade, roll 90°), the pommel sweeps back through the head. |
| zwerchhau | 7 | tall_slim_female (test M/E/B), tall_heavy_male (M/E/slow) | forearm_penetration (one forearm inside the other) | real_v3 elbows forward (elbow_fwd .5) and close together (elbow_flare .15) under hands left of centre: the forearms cross in the finish hold. The derived recover key (chamber arms, elbow_fwd_r −1) crosses them again on the way back. |
| zwerchhau | 2 | stocky_short_male B, short_broad_female B | grip_head | Same pommel sweep, on beginner deviations. short_broad_female also had an old per-body override (finish hand_y 1.15) that ran after the shape preset and pulled the finish down to the face. |
| schielhau | 4 | short_slim_male (M/E/B/slow) | grip_head (2.1–2.4 cm) | real_v3 finish has a big forward lean (16°, shoulder_fwd 28) with the hands at chin height and the point slightly down: the pommel rises into the chin of the short body. |

Tool: `gen/probe_path.py` samples the exact render timeline (same keyframes, levels and tempo) and runs the same
Clearance check without rendering, in ~2 s per body/level. It reproduced the batch failures, e.g. zwerchhau
short_slim_male master: 53 failing frames in cross/finish/recover.
`gen/probe_search.py` evaluates candidate preset patches, and `gen/probe_grid.py` does static finish-key grids.

## Fix (preset real_v4 = real_v3 + clearance changes; the collision gate is unchanged)
- **zwerchhau, all bodies:**
  - cross: hands further forward and to the right, elbows out (hand_x .80→1.00, hand_y 1.60→1.64, hand_lat .10,
    elbow_flare .15→.60).
  - finish: same idea (hand_x .85→1.12, hand_y 1.60→1.66, hand_lat −.15→+.05, elbow_flare .60).
  - The arms are clamped at full reach, so the hands stay above the head.
  - The derived recover key keeps the elbows out and no longer crosses the forearms (`post_kfs`: elbow_fwd_r 0,
    elbow_flare .45, hand_lat .40).
- **zwerchhau, per body** (`body` section; applied after the old per-body overrides):
  - short_slim_male, avg_longlimb_female and short_broad_female: blade point 22° down at cross/finish, so the pommel
    passes above the head. MediaPipe does not see the blade.
  - short_broad_female also gets the high finish back, plus recover hand_x .95.
- **schielhau, short_slim_male:** blade point up (extend sword_ang 28, finish 20), so the pommel drops away from the
  chin. Hands and lean are unchanged.
- **Generator:**
  - `swordcuts.py`: shape `post_kfs` (derived keys) and per-body `body` overrides, applied after BODY_OVR.
  - `render_sword.py`: passes the body to `finalize`.

Path probe after the fix (master, experienced and beginner; zwerchhau also with the slow variants; all 7 bodies):
- zwerchhau: 0 failing frames everywhere.
- schielhau: 0 failing frames, except short_slim_male beginner with 1 frame, which is under the gate. The render
  loop also shrinks beginner deviations on colliding frames.
