# Real public-video validation: results

Clips evaluated: 30 (browser MediaPipe lite, raw frames replayed through main @ app checkout, blade flag OFF).

## Clips by drill

| drill | clips |
|---|---|
| advance | 5 |
| krumphau | 2 |
| passing-step-backward | 3 |
| passing-step-forward | 3 |
| retreat | 3 |
| schielhau | 4 |
| zornhau | 5 |
| zwerchhau | 5 |

## Own drill selected (VideoRegressionPage semantics: one attempt per clip)

| clip | drill | angle | facing | outcome | message | best match (dist) | own dist | accept | path ratio |
|---|---|---|---|---|---|---|---|---|---|
| stritschar_advance_01 | advance | profile ~10deg | right | undecided | Продолжай движение до конца | scheitelhau (4.135) | 9.037 | 2.7351 | 6.84 |
| stritschar_advance_02 | advance | profile ~10deg | right | undecided | Продолжай движение до конца | zwerchhau (3.219) | 7.643 | 2.7351 | 4.7 |
| stritschar_advance_03 | advance | profile ~10deg | right | undecided | Продолжай движение до конца | zwerchhau (3.219) | 8.815 | 2.7351 | 3.98 |
| ukolov_advance_01 | advance | ~30deg front | right | undecided | Продолжай движение до конца | advance (3.562) | 3.562 | 2.7351 | 1.42 |
| ukolov_advance_02 | advance | ~30deg front | right | undecided | Продолжай движение до конца | advance (3.315) | 3.315 | 2.7351 | 3.14 |
| drey_krumphau_01 | krumphau | profile 0deg | right | undecided | Продолжай движение до конца | krumphau (3.825) | 3.825 | 2.7351 | 1.94 |
| vcu_krumphau_01 | krumphau | near-frontal ~70deg | left | undecided | Продолжай движение до конца | scheitelhau (4.51) | 4.658 | 2.7351 | 1.36 |
| swc_passback_01 | passing-step-backward | ~30deg front | right | undecided | Продолжай движение до конца | passing-step-backward (4.464) | 4.464 | 2.7351 | 4.12 |
| vcu_passback_01 | passing-step-backward | ~45deg front | right | undecided | Двигайся без остановок | passing-step-forward (3.274) | 5.857 | 2.7351 | 2.56 |
| vcu_passback_02 | passing-step-backward | ~45deg front | right | accepted | Движение распознано | passing-step-backward (2.086) | 2.086 | 2.7351 | 1.81 |
| swc_passfwd_01 | passing-step-forward | ~30deg front | right | undecided | Продолжай движение до конца | zornhau (3.289) | 4.773 | 2.7351 | 2.66 |
| ukolov_passfwd_01 | passing-step-forward | ~30deg front | right | undecided | Двигайся без остановок | passing-step-forward (3.306) | 3.306 | 2.7351 | 2.18 |
| vcu_passfwd_01 | passing-step-forward | ~45deg front | right | accepted | Движение распознано | passing-step-forward (2.405) | 2.405 | 2.7351 | 1.65 |
| stritschar_retreat_01 | retreat | profile ~10deg | right | rejected_as_other | Похоже на Zwerchhau, а не шаг назад. Повтори выбранное движение | zwerchhau (2.564) | 8.08 | 2.7351 | 0.48 |
| ukolov_retreat_01 | retreat | ~30deg front | right | undecided | Продолжай движение до конца | retreat (3.563) | 3.563 | 2.7351 | 2.3 |
| ukolov_retreat_02 | retreat | ~30deg front | right | undecided | Продолжай движение до конца | retreat (3.191) | 3.191 | 2.7351 | 3.4 |
| bahff_schielhau_01 | schielhau | profile 0deg | left | rejected_as_other | Похоже на Zornhau, а не Schielhau. Повтори выбранное движение | zornhau (2.358) | 2.789 | 2.7351 | 1.44 |
| bahff_schielhau_02 | schielhau | profile 0deg | left | undecided | Продолжай движение до конца | zornhau (3.705) | 3.844 | 2.7351 | 2.59 |
| laurel_schielhau_01 | schielhau | ~20deg front | right | calibration_failed |  | - | - | - | - |
| laurel_schielhau_02 | schielhau | ~20deg front | right | rejected_as_other | Похоже на Zornhau, а не Schielhau. Повтори выбранное движение | zornhau (1.884) | 2.704 | 2.7351 | 1.33 |
| becker_zornhau_01 | zornhau | profile 0deg | right | failed:Камера потеряла движение. Повтори попытку | Камера потеряла движение. Повтори попытку | scheitelhau (2.863) | 3.015 | 2.7351 | 0.51 |
| bjorn_zornhau_01 | zornhau | profile 0deg | left | never_started | Прими исходную позицию | - | - | - | - |
| bjorn_zornhau_02 | zornhau | profile 0deg | left | never_started | Прими исходную позицию | - | - | - | - |
| bjorn_zornhau_03 | zornhau | ~20deg front | left | undecided | Двигайся без остановок | zornhau (2.763) | 2.763 | 2.7351 | 0.16 |
| drey_zornhau_01 | zornhau | profile 0deg | right | undecided | Продолжай движение до конца | krumphau (3.928) | 4.375 | 2.7351 | 1.34 |
| drey_zwerchhau_01 | zwerchhau | profile 0deg | right | undecided | Продолжай движение до конца | zornhau (3.386) | 4.252 | 2.7351 | 0.65 |
| laurel_zwerchhau_01 | zwerchhau | ~45deg front | right | undecided | Продолжай движение до конца | scheitelhau (3.171) | 3.401 | 2.7351 | 2.36 |
| laurel_zwerchhau_02 | zwerchhau | ~45deg front | right | accepted | Движение распознано | zwerchhau (2.667) | 2.667 | 2.7351 | 1.87 |
| laurel_zwerchhau_03 | zwerchhau | ~45deg front | left | undecided | Двигайся без остановок | scheitelhau (5.146) | 5.489 | 2.7351 | 3.02 |
| laurel_zwerchhau_04 | zwerchhau | ~45deg front | left | undecided | Продолжай движение до конца | scheitelhau (5.916) | 5.969 | 2.7351 | 5.73 |

### Outcome totals (own drill)

| outcome | clips |
|---|---|
| undecided | 20 |
| accepted | 3 |
| rejected_as_other | 3 |
| never_started | 2 |
| calibration_failed | 1 |
| failed:Камера потеряла движение. Повтори попытку | 1 |

### Per drill

| drill | n | accepted | rejected as other | undecided | never started | other |
|---|---|---|---|---|---|---|
| advance | 5 | 0 | 0 | 5 | 0 | 0 |
| krumphau | 2 | 0 | 0 | 2 | 0 | 0 |
| passing-step-backward | 3 | 1 | 0 | 2 | 0 | 0 |
| passing-step-forward | 3 | 1 | 0 | 2 | 0 | 0 |
| retreat | 3 | 0 | 1 | 2 | 0 | 0 |
| schielhau | 4 | 0 | 2 | 1 | 0 | 1 |
| zornhau | 5 | 0 | 0 | 2 | 2 | 1 |
| zwerchhau | 5 | 1 | 0 | 4 | 0 | 0 |

### Per camera angle

| angle | n | accepted |
|---|---|---|
| near-frontal ~70deg | 1 | 0 |
| profile 0deg | 8 | 0 |
| profile ~10deg | 4 | 0 |
| ~20deg front | 3 | 0 |
| ~30deg front | 7 | 0 |
| ~45deg front | 7 | 3 |

### Per source (channel)

| source | n | accepted | outcomes |
|---|---|---|---|
| bahff | 2 | 0 | {'rejected_as_other': 1, 'undecided': 1} |
| becker | 1 | 0 | {'failed:Камера потеряла движение. Повтори попытку': 1} |
| bjorn | 3 | 0 | {'never_started': 2, 'undecided': 1} |
| drey | 3 | 0 | {'undecided': 3} |
| laurel | 6 | 1 | {'calibration_failed': 1, 'rejected_as_other': 1, 'undecided': 3, 'accepted': 1} |
| stritschar | 4 | 0 | {'undecided': 3, 'rejected_as_other': 1} |
| swc | 2 | 0 | {'undecided': 2} |
| ukolov | 5 | 0 | {'undecided': 5} |
| vcu | 4 | 2 | {'undecided': 2, 'accepted': 2} |

Facing sensitivity (same clips, opposite facing): accepted 0/30; outcomes {'undecided': 25, 'calibration_failed': 1, 'failed:Движение не удалось уверенно распознать. Повтори цельную попытку': 1, 'failed:Камера потеряла движение. Повтори попытку': 1, 'never_started': 2}

## Cross evaluation: every clip x every drill (regression page, one attempt)

Rows = clip (true drill), columns = selected drill; A = accepted, x = rejected as other drill, . = not accepted

| clip | true | advanc | guards | krumph | passin | passin | retrea | scheit | schiel | zornha | zwerch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| stritschar_advance_01 | advance | . | . | . | . | . | . | . | . | . | . |
| stritschar_advance_02 | advance | . | . | . | . | . | . | . | . | . | . |
| stritschar_advance_03 | advance | . | . | . | . | . | . | . | . | . | . |
| ukolov_advance_01 | advance | . | . | . | . | . | . | . | . | . | . |
| ukolov_advance_02 | advance | . | . | . | . | . | . | . | . | . | . |
| drey_krumphau_01 | krumphau | . | . | . | . | . | . | . | . | . | . |
| vcu_krumphau_01 | krumphau | . | . | . | . | . | . | . | . | . | . |
| swc_passback_01 | passing-step-backward | . | . | . | . | . | . | . | . | . | . |
| vcu_passback_01 | passing-step-backward | . | . | . | . | . | . | . | . | . | . |
| vcu_passback_02 | passing-step-backward | x | . | . | **A** | x | x | . | . | . | . |
| swc_passfwd_01 | passing-step-forward | . | . | . | . | . | . | . | . | . | . |
| ukolov_passfwd_01 | passing-step-forward | . | . | . | . | . | . | . | . | . | . |
| vcu_passfwd_01 | passing-step-forward | x | . | . | x | **A** | x | . | . | . | . |
| stritschar_retreat_01 | retreat | x | . | . | . | . | x | . | . | . | . |
| ukolov_retreat_01 | retreat | . | . | . | . | . | . | . | . | . | . |
| ukolov_retreat_02 | retreat | . | . | . | . | . | . | . | . | . | . |
| bahff_schielhau_01 | schielhau | x | A! | x | x | x | x | x | x | A! | x |
| bahff_schielhau_02 | schielhau | . | . | . | . | . | . | . | . | . | . |
| laurel_schielhau_01 | schielhau | . | . | . | . | . | . | . | . | . | . |
| laurel_schielhau_02 | schielhau | x | . | x | x | x | x | x | x | A! | x |
| becker_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| bjorn_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| bjorn_zornhau_02 | zornhau | x | . | . | . | . | A! | . | . | . | . |
| bjorn_zornhau_03 | zornhau | . | . | . | . | . | . | . | . | . | . |
| drey_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| drey_zwerchhau_01 | zwerchhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_01 | zwerchhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_02 | zwerchhau | x | . | x | x | x | x | x | x | x | **A** |
| laurel_zwerchhau_03 | zwerchhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_04 | zwerchhau | . | . | . | . | . | . | . | . | . | . |

Own drill accepted 3/30 (strikes 1/16, steps 2/14); accepted as the WRONG drill 4/270 (1.5%).

## Cross evaluation, DrillPage mode (retries after a failed attempt, like a user repeating)

Rows = clip (true drill), columns = selected drill; A = accepted, x = rejected as other drill, . = not accepted

| clip | true | advanc | guards | krumph | passin | passin | retrea | scheit | schiel | zornha | zwerch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| stritschar_advance_01 | advance | . | . | . | . | . | . | . | . | . | . |
| stritschar_advance_02 | advance | . | . | . | . | . | . | . | . | . | . |
| stritschar_advance_03 | advance | . | . | . | . | . | . | . | . | . | . |
| ukolov_advance_01 | advance | . | . | . | . | . | . | . | . | . | . |
| ukolov_advance_02 | advance | . | . | . | . | . | . | . | . | . | . |
| drey_krumphau_01 | krumphau | . | . | . | . | . | . | . | . | . | . |
| vcu_krumphau_01 | krumphau | . | . | . | . | . | . | . | . | . | . |
| swc_passback_01 | passing-step-backward | . | . | . | . | . | . | . | . | . | . |
| vcu_passback_01 | passing-step-backward | . | . | . | . | . | . | . | . | . | . |
| vcu_passback_02 | passing-step-backward | . | . | . | **A** | . | . | . | . | . | . |
| swc_passfwd_01 | passing-step-forward | . | . | . | . | . | . | . | . | . | . |
| ukolov_passfwd_01 | passing-step-forward | . | . | . | . | . | . | . | . | . | . |
| vcu_passfwd_01 | passing-step-forward | . | . | . | . | **A** | . | . | . | . | . |
| stritschar_retreat_01 | retreat | . | . | . | . | . | . | . | . | . | . |
| ukolov_retreat_01 | retreat | . | . | . | . | . | . | . | . | . | . |
| ukolov_retreat_02 | retreat | . | . | . | . | . | . | . | . | . | . |
| bahff_schielhau_01 | schielhau | . | A! | . | . | . | . | . | . | A! | . |
| bahff_schielhau_02 | schielhau | . | . | . | . | . | . | . | . | . | . |
| laurel_schielhau_01 | schielhau | . | . | . | . | . | . | . | . | . | . |
| laurel_schielhau_02 | schielhau | . | . | . | . | . | . | . | . | A! | . |
| becker_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| bjorn_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| bjorn_zornhau_02 | zornhau | . | . | . | . | . | A! | . | . | . | . |
| bjorn_zornhau_03 | zornhau | . | . | . | . | . | . | . | . | . | . |
| drey_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| drey_zwerchhau_01 | zwerchhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_01 | zwerchhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_02 | zwerchhau | . | . | . | . | . | . | . | . | . | **A** |
| laurel_zwerchhau_03 | zwerchhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_04 | zwerchhau | . | . | . | . | . | . | . | . | . | . |

Own drill accepted 3/30 (strikes 1/16, steps 2/14); accepted as the WRONG drill 4/270 (1.5%).

