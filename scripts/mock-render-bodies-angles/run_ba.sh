#!/bin/bash
# Lane runner: ./run_ba.sh <lane>. Claims jobs from jobs.tsv in order (mkdir lock), renders at 640x360, degrades, stores
# clips/<split>/<drill>/<name>.{mp4,json}. Resumable: done = mp4 exists. Strike jobs wait for the body's Zornhau guard fit.
B=/workspace/hema/tools/blender-4.5.14-linux-x64/blender; G=/workspace/hema/gen; BA=/workspace/hema/ba
export HEMA_PRESET_JSON=$G/app484/presets_484fefd.json
BODIES=$(cat $BA/bodies.json | tr -d '\n')
mkdir -p $BA/claims $BA/work $BA/logs
while true; do
  picked=""; blocked=0
  while IFS=$'\t' read -r name split body drill level az h d lens scale noise crf drop seed; do
    out=$BA/clips/$split/$drill/$name.mp4; [ -f $out ] && continue
    if [ $drill != zornhau ] && [[ $drill == *hau ]] && [ ! -f $G/cache/zornhau_${body}_fit.json ]; then blocked=1; continue; fi
    mkdir $BA/claims/${drill}__$name 2>/dev/null || continue
    picked=1; break
  done < $BA/jobs.tsv
  if [ -z "$picked" ]; then [ $blocked = 1 ] && { sleep 30; continue; }; echo "lane $1 finished $(date +%T)" >> $BA/progress.txt; exit 0; fi
  case $drill in zornhau) S=render_drill.py;; *hau) S=render_sword.py;; *) S=render_footwork.py;; esac
  W=$BA/work/${drill}__$name; mkdir -p $W $BA/clips/$split/$drill; L=$BA/logs/${drill}__$name.txt
  OV="{\"script\":\"$S\",\"camera\":{\"az\":$az,\"h\":$h,\"d\":$d,\"lens\":$lens},\"bodies\":$BODIES}"
  t0=$(date +%s)
  FR=180
  HEMA_BA_JSON="$OV" nice -n 15 $B -b -t 4 -P $BA/render_ba.py -- --drill $drill --body $body --level $level --samples 3 --seed $seed --pct 50 --out $W --frames-dir $W/frames > $L 2>&1
  # Slow beginner passing steps (graded pass + ungraded return) can exceed the 6 s clip for some seeds: the footwork
  # generator refuses ("timeline too long"). Re-render the same seed as a 7 s clip (longer end hold) instead of
  # re-drawing the seed, which would bias the beginner tempo towards faster attempts.
  if grep -q "timeline too long" $L; then
    FR=210; mv $L $L.6s
    HEMA_BA_JSON="$OV" nice -n 15 $B -b -t 4 -P $BA/render_ba.py -- --drill $drill --body $body --level $level --samples 3 --seed $seed --pct 50 --frames $FR --out $W --frames-dir $W/frames > $L 2>&1
  fi
  if [ -f $W/${body}_$level.json ] && [ $(ls $W/frames/*.png 2>/dev/null | wc -l) -ge $((FR - 10)) ]; then
    nice -n 15 python3 $BA/degrade.py $W/frames $W/out.mp4 --seed $seed --drop $drop --scale $scale --noise $noise --crf $crf >> $L 2>&1 \
      && python3 - "$W/${body}_$level.json" "$BA/clips/$split/$drill/$name.json" "$az" "$h" "$d" "$lens" "$scale" "$noise" "$crf" "$drop" "$split" <<'PY' && mv $W/out.mp4 $out && rm -rf $W/frames
import json, sys
src, dst, az, h, d, lens, scale, noise, crf, drop, split = sys.argv[1:]
j = json.load(open(src)); j["ba_camera"] = {"azimuth_deg": float(az), "height_m": float(h), "distance_m": float(d), "lens_mm": float(lens)}
j["ba_degradation"] = {"downscale_width": int(scale), "noise_sigma": float(noise), "crf": int(crf), "drop_fraction": float(drop)}; j["ba_split"] = split
json.dump(j, open(dst, "w"))
PY
    echo "DONE $split $drill $name $(( $(date +%s)-t0 ))s $(date +%T)" >> $BA/progress.txt
  else echo "FAIL $split $drill $name $(date +%T) (see $L)" >> $BA/progress.txt; fi
done
