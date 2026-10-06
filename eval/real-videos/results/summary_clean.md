# CLEAN SUBSET (two-handed longsword, solo, full body, unedited)

# Real public-video validation: results

Clips evaluated: 17 (browser MediaPipe lite, raw frames replayed through main @ app checkout, blade flag OFF).

## Clips by drill

| drill | clips |
|---|---|
| advance | 2 |
| krumphau | 2 |
| passing-step-backward | 1 |
| passing-step-forward | 2 |
| retreat | 2 |
| schielhau | 2 |
| zornhau | 3 |
| zwerchhau | 3 |

## Own drill selected (VideoRegressionPage semantics: one attempt per clip)

| clip | drill | angle | facing | outcome | message | best match (dist) | own dist | accept | path ratio |
|---|---|---|---|---|---|---|---|---|---|
| ukolov_advance_01 | advance | ~30deg front | right | undecided | Продолжай движение до конца | advance (3.562) | 3.562 | 2.7351 | 1.42 |
| ukolov_advance_02 | advance | ~30deg front | right | undecided | Продолжай движение до конца | advance (3.315) | 3.315 | 2.7351 | 3.14 |
| drey_krumphau_01 | krumphau | profile 0deg | right | undecided | Продолжай движение до конца | krumphau (3.825) | 3.825 | 2.7351 | 1.94 |
| vcu_krumphau_01 | krumphau | near-frontal ~70deg | left | undecided | Продолжай движение до конца | scheitelhau (4.51) | 4.658 | 2.7351 | 1.36 |
| swc_passback_01 | passing-step-backward | ~30deg front | right | undecided | Продолжай движение до конца | passing-step-backward (4.464) | 4.464 | 2.7351 | 4.12 |
| swc_passfwd_01 | passing-step-forward | ~30deg front | right | undecided | Продолжай движение до конца | zornhau (3.289) | 4.773 | 2.7351 | 2.66 |
| ukolov_passfwd_01 | passing-step-forward | ~30deg front | right | undecided | Двигайся без остановок | passing-step-forward (3.306) | 3.306 | 2.7351 | 2.18 |
| ukolov_retreat_01 | retreat | ~30deg front | right | undecided | Продолжай движение до конца | retreat (3.563) | 3.563 | 2.7351 | 2.3 |
| ukolov_retreat_02 | retreat | ~30deg front | right | undecided | Продолжай движение до конца | retreat (3.191) | 3.191 | 2.7351 | 3.4 |
| bahff_schielhau_01 | schielhau | profile 0deg | left | rejected_as_other | Похоже на Zornhau, а не Schielhau. Повтори выбранное движение | zornhau (2.358) | 2.789 | 2.7351 | 1.44 |
| bahff_schielhau_02 | schielhau | profile 0deg | left | undecided | Продолжай движение до конца | zornhau (3.705) | 3.844 | 2.7351 | 2.59 |
| bjorn_zornhau_01 | zornhau | profile 0deg | left | never_started | Прими исходную позицию | - | - | - | - |
| bjorn_zornhau_02 | zornhau | profile 0deg | left | never_started | Прими исходную позицию | - | - | - | - |
| drey_zornhau_01 | zornhau | profile 0deg | right | undecided | Продолжай движение до конца | krumphau (3.928) | 4.375 | 2.7351 | 1.34 |
| laurel_zwerchhau_01 | zwerchhau | ~45deg front | right | undecided | Продолжай движение до конца | scheitelhau (3.171) | 3.401 | 2.7351 | 2.36 |
| laurel_zwerchhau_02 | zwerchhau | ~45deg front | right | accepted | Движение распознано | zwerchhau (2.667) | 2.667 | 2.7351 | 1.87 |
| laurel_zwerchhau_03 | zwerchhau | ~45deg front | left | undecided | Двигайся без остановок | scheitelhau (5.146) | 5.489 | 2.7351 | 3.02 |

### Outcome totals (own drill)

| outcome | clips |
|---|---|
| undecided | 13 |
| never_started | 2 |
| rejected_as_other | 1 |
| accepted | 1 |

### Per drill

| drill | n | accepted | rejected as other | undecided | never started | other |
|---|---|---|---|---|---|---|
| advance | 2 | 0 | 0 | 2 | 0 | 0 |
| krumphau | 2 | 0 | 0 | 2 | 0 | 0 |
| passing-step-backward | 1 | 0 | 0 | 1 | 0 | 0 |
| passing-step-forward | 2 | 0 | 0 | 2 | 0 | 0 |
| retreat | 2 | 0 | 0 | 2 | 0 | 0 |
| schielhau | 2 | 0 | 1 | 1 | 0 | 0 |
| zornhau | 3 | 0 | 0 | 1 | 2 | 0 |
| zwerchhau | 3 | 1 | 0 | 2 | 0 | 0 |

### Per camera angle

| angle | n | accepted |
|---|---|---|
| near-frontal ~70deg | 1 | 0 |
| profile 0deg | 6 | 0 |
| ~30deg front | 7 | 0 |
| ~45deg front | 3 | 1 |

### Per source (channel)

| source | n | accepted | outcomes |
|---|---|---|---|
| bahff | 2 | 0 | {'rejected_as_other': 1, 'undecided': 1} |
| bjorn | 2 | 0 | {'never_started': 2} |
| drey | 2 | 0 | {'undecided': 2} |
| laurel | 3 | 1 | {'undecided': 2, 'accepted': 1} |
| swc | 2 | 0 | {'undecided': 2} |
| ukolov | 5 | 0 | {'undecided': 5} |
| vcu | 1 | 0 | {'undecided': 1} |

Facing sensitivity (same clips, opposite facing): accepted 0/17; outcomes {'undecided': 15, 'never_started': 2}

## Cross evaluation: every clip x every drill (regression page, one attempt)

Rows = clip (true drill), columns = selected drill; A = accepted, x = rejected as other drill, . = not accepted

| clip | true | advanc | guards | krumph | passin | passin | retrea | scheit | schiel | zornha | zwerch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ukolov_advance_01 | advance | . | . | . | . | . | . | . | . | . | . |
| ukolov_advance_02 | advance | . | . | . | . | . | . | . | . | . | . |
| drey_krumphau_01 | krumphau | . | . | . | . | . | . | . | . | . | . |
| vcu_krumphau_01 | krumphau | . | . | . | . | . | . | . | . | . | . |
| swc_passback_01 | passing-step-backward | . | . | . | . | . | . | . | . | . | . |
| swc_passfwd_01 | passing-step-forward | . | . | . | . | . | . | . | . | . | . |
| ukolov_passfwd_01 | passing-step-forward | . | . | . | . | . | . | . | . | . | . |
| ukolov_retreat_01 | retreat | . | . | . | . | . | . | . | . | . | . |
| ukolov_retreat_02 | retreat | . | . | . | . | . | . | . | . | . | . |
| bahff_schielhau_01 | schielhau | x | A! | x | x | x | x | x | x | A! | x |
| bahff_schielhau_02 | schielhau | . | . | . | . | . | . | . | . | . | . |
| bjorn_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| bjorn_zornhau_02 | zornhau | x | . | . | . | . | A! | . | . | . | . |
| drey_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_01 | zwerchhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_02 | zwerchhau | x | . | x | x | x | x | x | x | x | **A** |
| laurel_zwerchhau_03 | zwerchhau | . | . | . | . | . | . | . | . | . | . |

Own drill accepted 1/17 (strikes 1/10, steps 0/7); accepted as the WRONG drill 3/153 (2.0%).

## Cross evaluation, DrillPage mode (retries after a failed attempt, like a user repeating)

Rows = clip (true drill), columns = selected drill; A = accepted, x = rejected as other drill, . = not accepted

| clip | true | advanc | guards | krumph | passin | passin | retrea | scheit | schiel | zornha | zwerch |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ukolov_advance_01 | advance | . | . | . | . | . | . | . | . | . | . |
| ukolov_advance_02 | advance | . | . | . | . | . | . | . | . | . | . |
| drey_krumphau_01 | krumphau | . | . | . | . | . | . | . | . | . | . |
| vcu_krumphau_01 | krumphau | . | . | . | . | . | . | . | . | . | . |
| swc_passback_01 | passing-step-backward | . | . | . | . | . | . | . | . | . | . |
| swc_passfwd_01 | passing-step-forward | . | . | . | . | . | . | . | . | . | . |
| ukolov_passfwd_01 | passing-step-forward | . | . | . | . | . | . | . | . | . | . |
| ukolov_retreat_01 | retreat | . | . | . | . | . | . | . | . | . | . |
| ukolov_retreat_02 | retreat | . | . | . | . | . | . | . | . | . | . |
| bahff_schielhau_01 | schielhau | . | A! | . | . | . | . | . | . | A! | . |
| bahff_schielhau_02 | schielhau | . | . | . | . | . | . | . | . | . | . |
| bjorn_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| bjorn_zornhau_02 | zornhau | . | . | . | . | . | A! | . | . | . | . |
| drey_zornhau_01 | zornhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_01 | zwerchhau | . | . | . | . | . | . | . | . | . | . |
| laurel_zwerchhau_02 | zwerchhau | . | . | . | . | . | . | . | . | . | **A** |
| laurel_zwerchhau_03 | zwerchhau | . | . | . | . | . | . | . | . | . | . |

Own drill accepted 1/17 (strikes 1/10, steps 0/7); accepted as the WRONG drill 3/153 (2.0%).

