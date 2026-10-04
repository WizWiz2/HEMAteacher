# Diagnosis: why real distances are far above the accept distance

Same pipeline (VideoRegressionPage semantics, shipped model, acceptDistance 2.735) for the 30 real clips and the 148 reserved synthetic TEST clips (master/experienced). Values: 10th / median / 90th percentile.

| metric | real strikes | synth strikes | real steps | synth steps |
|---|---|---|---|---|
| own-drill distance | 2.70 / 3.83 / 5.49 | 0.58 / 0.74 / 1.34 | 2.40 / 4.46 / 8.81 | 0.65 / 1.02 / 1.33 |
| best-of-all distance | 2.36 / 3.39 / 5.15 | 0.58 / 0.73 / 1.17 | 2.40 / 3.29 / 4.13 | 0.65 / 1.01 / 1.27 |
| own distance, best prefix of attempt | 2.68 / 3.09 / 4.31 | 0.56 / 0.72 / 0.99 | 2.40 / 4.29 / 8.35 | 0.64 / 0.93 / 1.24 |
| tempo (active duration / typical) | 1.50 / 4.06 / 8.39 | 0.77 / 1.05 / 1.45 | 1.00 / 3.84 / 5.17 | 0.71 / 0.89 / 1.20 |
| attempt duration ms | 1200.00 / 3567.00 / 6133.00 | 933.00 / 1133.00 / 1400.00 | 1233.00 / 3267.00 / 4300.00 | 633.00 / 1067.00 / 1567.00 |
| path ratio (attempt path / typical) | 0.51 / 1.44 / 3.02 | 0.90 / 1.00 / 1.13 | 1.42 / 2.66 / 4.70 | 0.56 / 0.99 / 1.85 |
| hand x range (torso) | 0.20 / 0.68 / 1.27 | 0.21 / 0.54 / 0.90 | 0.09 / 0.42 / 1.32 | 0.04 / 0.18 / 0.34 |
| hand y range (torso) | 0.07 / 0.27 / 0.92 | 0.33 / 0.45 / 0.88 | 0.08 / 0.27 / 0.85 | 0.03 / 0.07 / 0.12 |
| hand path length (torso) | 0.73 / 1.84 / 6.77 | 0.97 / 1.56 / 2.21 | 0.44 / 2.11 / 6.48 | 0.15 / 0.46 / 1.03 |
| root x range (torso) | 0.13 / 0.91 / 2.24 | 0.64 / 0.86 / 0.98 | 0.53 / 0.96 / 1.87 | 0.17 / 0.70 / 1.39 |
| ankle x range (torso) | 0.12 / 1.20 / 1.56 | 0.59 / 0.80 / 0.92 | 0.46 / 0.73 / 1.58 | 0.26 / 0.78 / 1.02 |
| hand over head at attempt start (torso, - = above nose) | -0.78 / -0.59 / 0.13 | -0.29 / -0.19 / -0.08 | -1.17 / -0.99 / -0.09 | -1.44 / -1.33 / -1.27 |
| highest hand over head in attempt | -0.85 / -0.64 / -0.25 | -0.64 / -0.44 / -0.25 | -1.34 / -1.10 / -0.13 | -1.48 / -1.37 / -1.31 |
| lowest hand in attempt | -0.69 / -0.14 / 0.29 | -0.13 / 0.06 / 0.29 | -1.13 / -0.87 / 0.10 | -1.40 / -1.28 / -1.17 |
| hand x at attempt start (torso) | -0.03 / 0.18 / 0.77 | -0.12 / 0.35 / 0.70 | -0.08 / 0.49 / 1.12 | -0.37 / -0.01 / 0.25 |
| hand jitter (torso/frame) | 0.00 / 0.01 / 0.01 | 0.01 / 0.01 / 0.02 | 0.00 / 0.01 / 0.01 | 0.00 / 0.01 / 0.01 |
| ankle jitter (torso/frame) | 0.00 / 0.00 / 0.01 | 0.00 / 0.00 / 0.00 | 0.00 / 0.00 / 0.01 | 0.00 / 0.01 / 0.01 |
| torso length / frame height | 0.22 / 0.23 / 0.26 | 0.16 / 0.19 / 0.23 | 0.18 / 0.21 / 0.29 | 0.16 / 0.18 / 0.22 |
| min limb visibility | 0.10 / 0.52 / 0.91 | 0.20 / 0.52 / 0.77 | 0.14 / 0.41 / 0.87 | 0.04 / 0.06 / 0.63 |
| fps | 30.00 / 30.00 / 30.00 | 30.00 / 30.00 / 30.00 | 30.00 / 30.00 / 30.00 | 30.00 / 30.00 / 30.00 |

n: {'real_strikes': 13, 'real_steps': 14, 'synthetic_strikes': 84, 'synthetic_steps': 64}. Real clips with no attempt (never started / calibration failed): ['laurel_schielhau_01', 'bjorn_zornhau_01', 'bjorn_zornhau_02']

Own distance <= 2.735: real 4/27, synthetic 145/148; best prefix <= 2.735: real 4/27.

## Per-channel share of the own-drill DTW cost (nearest own template, aligned path)

Share of the weighted squared distance carried by each channel (sums to 1), and mean |z| (difference in units of the model channel scale). Median over attempts.

| channel | real strikes share | synth strikes share | real steps share | synth steps share | real strikes mean abs z | synth strikes mean abs z | real steps mean abs z | synth steps mean abs z |
|---|---|---|---|---|---|---|---|---|
| hand_y | 0.124 | 0.063 | 0.115 | 0.021 | 4.10 | 0.60 | 4.02 | 0.45 |
| left_ankle_x | 0.102 | 0.032 | 0.039 | 0.050 | 3.38 | 0.39 | 2.23 | 0.69 |
| hand_over_head | 0.099 | 0.039 | 0.113 | 0.018 | 4.44 | 0.57 | 5.09 | 0.51 |
| right_ankle_x | 0.076 | 0.033 | 0.062 | 0.040 | 3.25 | 0.40 | 2.39 | 0.57 |
| root_dx | 0.074 | 0.026 | 0.021 | 0.059 | 2.99 | 0.33 | 2.21 | 0.71 |
| forearm_sin | 0.057 | 0.091 | 0.202 | 0.001 | 3.47 | 0.81 | 6.77 | 0.13 |
| hand_dir_y | 0.033 | 0.087 | 0.015 | 0.210 | 1.80 | 0.44 | 1.50 | 1.10 |
| forearm_cos | 0.031 | 0.043 | 0.097 | 0.018 | 2.84 | 0.66 | 4.67 | 0.52 |
| shoulder_offset | 0.029 | 0.039 | 0.002 | 0.018 | 2.09 | 0.74 | 0.98 | 0.58 |
| hand_dir_x | 0.025 | 0.102 | 0.026 | 0.182 | 1.45 | 0.48 | 1.86 | 0.88 |
| hand_x | 0.015 | 0.011 | 0.028 | 0.013 | 1.38 | 0.26 | 2.71 | 0.45 |
| left_ankle_y | 0.014 | 0.068 | 0.012 | 0.054 | 2.33 | 0.81 | 1.85 | 0.97 |
| right_ankle_y | 0.010 | 0.021 | 0.003 | 0.019 | 1.58 | 0.47 | 0.96 | 0.59 |
| elbow_angle | 0.009 | 0.021 | 0.013 | 0.003 | 1.59 | 0.54 | 1.58 | 0.24 |
| torso_angle | 0.009 | 0.032 | 0.005 | 0.019 | 1.99 | 0.78 | 1.39 | 0.59 |
| wrist_cross_x | 0.008 | 0.015 | 0.000 | 0.000 | 2.30 | 0.55 | 4.71 | 1.70 |
| wrist_cross_y | 0.005 | 0.036 | 0.000 | 0.000 | 1.55 | 0.81 | 0.64 | 1.00 |

## Real clips, one line each

| clip | drill | angle | state | own | best | prefix own | tempo | path ratio | hand path | torso/frame | top-3 channels by share |
|---|---|---|---|---|---|---|---|---|---|---|---|
| stritschar_advance_01 | advance | profile ~10deg | running | 9.037 | scheitelhau 4.135 | 8.349 | 7.47 | 6.84 | 3.5 | 0.215 | forearm_sin 0.33, hand_y 0.27, hand_over_head 0.18 |
| stritschar_advance_02 | advance | profile ~10deg | running | 7.643 | zwerchhau 3.219 | 7.148 | 5.11 | 4.7 | 10.98 | 0.213 | forearm_sin 0.36, hand_y 0.32, hand_over_head 0.22 |
| stritschar_advance_03 | advance | profile ~10deg | running | 8.815 | zwerchhau 3.219 | 8.714 | 5.17 | 3.98 | 2.23 | 0.215 | forearm_sin 0.37, hand_y 0.34, hand_over_head 0.23 |
| ukolov_advance_01 | advance | ~30deg front | running | 3.562 | advance 3.562 | 3.28 | 1.53 | 1.42 | 0.44 | 0.283 | forearm_sin 0.20, forearm_cos 0.19, hand_x 0.13 |
| ukolov_advance_02 | advance | ~30deg front | running | 3.315 | advance 3.315 | 3.248 | 4.7 | 3.14 | 1.8 | 0.289 | forearm_cos 0.19, forearm_sin 0.19, hand_x 0.17 |
| drey_krumphau_01 | krumphau | profile 0deg | running | 3.825 | krumphau 3.825 | 3.298 | 2.4 | 1.94 | 0.73 | 0.248 | hand_y 0.21, forearm_sin 0.18, hand_over_head 0.16 |
| vcu_krumphau_01 | krumphau | near-frontal ~70deg | running | 4.658 | scheitelhau 4.51 | 4.31 | 6.95 | 1.36 | 4.68 | 0.204 | forearm_cos 0.64, hand_y 0.07, hand_over_head 0.05 |
| swc_passback_01 | passing-step-backward | ~30deg front | running | 4.464 | passing-step-backward 4.464 | 4.295 | 3.31 | 4.12 | 6.48 | 0.189 | forearm_sin 0.30, hand_y 0.23, hand_over_head 0.15 |
| vcu_passback_01 | passing-step-backward | ~45deg front | running | 5.857 | passing-step-forward 3.274 | 4.373 | 3.08 | 2.56 | 2.68 | 0.184 | left_ankle_x 0.44, right_ankle_x 0.30, shoulder_offset 0.08 |
| vcu_passback_02 | passing-step-backward | ~45deg front | completed | 2.086 | passing-step-backward 2.086 | 2.022 | 1 | 1.81 | 1.08 | 0.202 | shoulder_offset 0.34, right_ankle_x 0.17, root_dx 0.11 |
| swc_passfwd_01 | passing-step-forward | ~30deg front | running | 4.773 | zornhau 3.289 | 4.319 | 4.6 | 2.66 | 5.55 | 0.188 | forearm_sin 0.27, hand_y 0.26, hand_over_head 0.20 |
| ukolov_passfwd_01 | passing-step-forward | ~30deg front | running | 3.306 | passing-step-forward 3.306 | 2.867 | 3.84 | 2.18 | 2.11 | 0.283 | forearm_cos 0.15, root_dx 0.14, forearm_sin 0.12 |
| vcu_passfwd_01 | passing-step-forward | ~45deg front | completed | 2.405 | passing-step-forward 2.405 | 2.405 | 2.36 | 1.65 | 1.4 | 0.178 | shoulder_offset 0.20, left_ankle_y 0.14, right_ankle_x 0.10 |
| stritschar_retreat_01 | retreat | profile ~10deg | failed | 8.08 | zwerchhau 2.564 | 8.08 | 0.88 | 0.48 | 0.25 | 0.224 | forearm_sin 0.41, hand_y 0.32, hand_over_head 0.21 |
| ukolov_retreat_01 | retreat | ~30deg front | running | 3.563 | retreat 3.563 | 3.287 | 2.35 | 2.3 | 1.03 | 0.294 | forearm_sin 0.21, hand_x 0.14, hand_y 0.13 |
| ukolov_retreat_02 | retreat | ~30deg front | running | 3.191 | retreat 3.191 | 3.219 | 4.94 | 3.4 | 1.44 | 0.29 | forearm_sin 0.15, hand_x 0.14, right_ankle_x 0.12 |
| bahff_schielhau_01 | schielhau | profile 0deg | failed | 2.789 | zornhau 2.358 | 2.791 | 4.94 | 1.44 | 1.57 | 0.232 | hand_y 0.21, torso_angle 0.18, hand_over_head 0.17 |
| bahff_schielhau_02 | schielhau | profile 0deg | running | 3.844 | zornhau 3.705 | 3.77 | 4.81 | 2.59 | 5.86 | 0.216 | right_ankle_x 0.17, left_ankle_y 0.14, hand_y 0.12 |
| laurel_schielhau_01 | schielhau | ~20deg front | calibrating (no attempt) | | | | | | | 0.398 | |
| laurel_schielhau_02 | schielhau | ~20deg front | failed | 2.704 | zornhau 1.884 | 2.682 | 1.31 | 1.33 | 1.84 | 0.279 | hand_y 0.25, hand_over_head 0.23, forearm_sin 0.12 |
| becker_zornhau_01 | zornhau | profile 0deg | failed | 3.015 | scheitelhau 2.863 | 2.962 | 3.25 | 0.51 | 1.59 | 0.229 | forearm_cos 0.19, right_ankle_x 0.17, left_ankle_x 0.15 |
| bjorn_zornhau_01 | zornhau | profile 0deg | ready (no attempt) | | | | | | | 0.119 | |
| bjorn_zornhau_02 | zornhau | profile 0deg | ready (no attempt) | | | | | | | 0.183 | |
| bjorn_zornhau_03 | zornhau | ~20deg front | running | 2.763 | zornhau 2.763 | 2.77 | 1.5 | 0.16 | 0.47 | 0.227 | right_ankle_x 0.25, forearm_cos 0.17, left_ankle_x 0.17 |
| drey_zornhau_01 | zornhau | profile 0deg | running | 4.375 | krumphau 3.928 | 3.504 | 6.99 | 1.34 | 0.94 | 0.235 | root_dx 0.28, left_ankle_x 0.20, hand_y 0.12 |
| drey_zwerchhau_01 | zwerchhau | profile 0deg | running | 4.252 | zornhau 3.386 | 3.617 | 3.11 | 0.65 | 1.02 | 0.221 | hand_y 0.32, hand_over_head 0.21, left_ankle_x 0.15 |
| laurel_zwerchhau_01 | zwerchhau | ~45deg front | running | 3.401 | scheitelhau 3.171 | 3.082 | 4.06 | 2.36 | 4.13 | 0.25 | hand_y 0.23, hand_over_head 0.13, hand_dir_y 0.10 |
| laurel_zwerchhau_02 | zwerchhau | ~45deg front | completed | 2.667 | zwerchhau 2.667 | 2.28 | 2.44 | 1.87 | 2.85 | 0.263 | shoulder_offset 0.14, hand_y 0.12, forearm_cos 0.11 |
| laurel_zwerchhau_03 | zwerchhau | ~45deg front | running | 5.489 | scheitelhau 5.146 | 3.094 | 8.61 | 3.02 | 6.77 | 0.253 | left_ankle_x 0.28, root_dx 0.21, right_ankle_x 0.19 |
| laurel_zwerchhau_04 | zwerchhau | ~45deg front | running | 5.969 | scheitelhau 5.916 | 4.799 | 8.39 | 5.73 | 9.51 | 0.262 | left_ankle_x 0.26, root_dx 0.25, forearm_cos 0.21 |
