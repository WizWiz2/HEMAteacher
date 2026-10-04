# Bodies/angles mock clips (representative subset)

27 of the 351 clips rendered for `docs/bodies-angles-split.md` (MPFB bodies, Blender 4.5, 640×360, then webcam
degradation). Per drill: one TRAIN clip (master, random camera) and two reserved TEST clips: tall_slim_female
experienced at +40° (front-side) and stocky_short_male master at −20° (behind profile). The full set (~240 MB) is not
committed; its MediaPipe poses are in `frontend/test-fixtures/motion-poses.json.gz` (clip ids `ba:<split>/<drill>/<name>`).

The files are byte-identical to the ones the fixture was extracted from (not re-encoded), so each clip keeps its own
CRF from the split (TRAIN random 23–32, TEST 28). Sidecar JSON: ground-truth landmarks and phases as for the main mock
clips, plus `ba_camera`, `ba_degradation` and `ba_split`. Slow beginner passing steps whose timeline exceeded 6 s were
rendered as 7 s clips (210 frames); none are in this subset.

Tooling: `scripts/mock-render-bodies-angles/`.

| clip | azimuth | camera h / d (m) / lens (mm) | width | noise σ | CRF | dropped |
|---|---|---|---|---|---|---|
| test/advance/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/advance/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/krumphau/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/krumphau/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/passing-step-backward/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/passing-step-backward/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/passing-step-forward/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/passing-step-forward/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/retreat/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/retreat/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/scheitelhau/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/scheitelhau/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/schielhau/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/schielhau/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/zornhau/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/zornhau/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/zwerchhau/stocky_short_male_master_az-20 | -20.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| test/zwerchhau/tall_slim_female_experienced_az40 | 40.0° | 1.25 / 3.3 / 24.0 | 0 | 0.02 | 28 | 0.05 |
| train/advance/tall_heavy_male_master_rnd0 | 40.5° | 1.08 / 3.65 / 22.8 | 480 | 0.028 | 28 | 0.063 |
| train/krumphau/avg_longlimb_female_master_rnd0 | -0.5° | 1.14 / 3.22 / 21.4 | 0 | 0.019 | 24 | 0.055 |
| train/passing-step-backward/avg_longlimb_female_master_rnd0 | 34.6° | 1.01 / 3.75 / 23.8 | 480 | 0.019 | 23 | 0.08 |
| train/passing-step-forward/tall_heavy_male_master_rnd0 | 39.2° | 1.29 / 3.67 / 21.3 | 480 | 0.019 | 23 | 0.074 |
| train/retreat/tall_heavy_male_master_rnd0 | 34.8° | 1.27 / 3.27 / 20.1 | 0 | 0.025 | 26 | 0.045 |
| train/scheitelhau/short_slim_male_master_rnd0 | 21.6° | 1.48 / 3.47 / 20.9 | 0 | 0.016 | 27 | 0.065 |
| train/schielhau/avg_longlimb_female_master_rnd0 | -9.5° | 1.41 / 3.89 / 25.4 | 0 | 0.028 | 23 | 0.054 |
| train/zornhau/avg_longlimb_female_master_rnd0 | 27.8° | 1.28 / 3.5 / 24.4 | 480 | 0.018 | 25 | 0.071 |
| train/zwerchhau/avg_longlimb_female_master_rnd0 | -19.2° | 1.13 / 3.39 / 25.0 | 0 | 0.016 | 29 | 0.067 |
