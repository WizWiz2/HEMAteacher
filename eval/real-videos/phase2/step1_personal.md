# Phase 2 / step 1: personal-template experiment (seen clips)

`personal.mjs`: personal template = `prepareSequence` of the calibration rep's attempt, appended to the shipped
generic templates; per person, 1 calibration rep per drill, the other reps tested (rotating folds); own + cross.
`PERSONMAP` = json {person: [clip ids]}; `personmap_clean.json` = only clean clips (two-handed longsword, solo, full body, unedited).

| set | variant | own (strikes / steps) | wrong-drill accepted |
|---|---|---|---|
| all seen | generic | 4/36 (3/24 / 1/12) | 5/288 |
| all seen | generic + personal | 6/36 (3/24 / 3/12) | 12/288 |
| clean | generic | 2/14 | 2/112 |
| clean | generic + personal | 5/14 (3/10 / 2/4) | 3/112 |

Why it helps little: same person + same drill reps are 2-7 apart (laurel zwerchhau 2.6-7.3, bahff schielhau 3.7),
while different drills of one person can be closer (ukolov advance-retreat 2.3, drey zornhau-zwerchhau 2.45).
Attempt windows are inconsistent (path length of one person's zwerchhau reps 4.1..12.6).

`window_oracle.mjs` (best sub-window 0.4-3 s per drill, an upper bound for segmentation): own <= accept on 16/30
(clean 9/17) vs 4/27 with the app's windows, but own is the NEAREST drill on only 5/30 (clean 3/17).
Segmentation lowers distances but does not fix discrimination; the templates (synthetic distribution) must move too.
