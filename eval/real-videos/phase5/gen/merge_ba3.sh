#!/bin/bash
# merge_ba3.sh: /workspace/hema/ba3m = ba3 renders with the re-rendered (real_v4 clearance fix) jobs from ba3r replacing
# the dropped ones (raw dumps + sidecars as symlinks), for build-motion-fixture.mjs <ba3m/raw>:ba:<ba3m/clips>
M=/workspace/hema/ba3m; rm -rf $M; mkdir -p $M/raw
for src in /workspace/hema/ba3 /workspace/hema/ba3r; do
  for f in $src/raw/*.json; do b=$(basename $f .json); d=${b%%__*}; r=${b#*__}; s=${r%%__*}; n=${r#*__}
    [ -f $src/clips/$s/$d/$n.json ] || continue
    mkdir -p $M/clips/$s/$d; ln -sf $f $M/raw/$b.json; ln -sf $src/clips/$s/$d/$n.json $M/clips/$s/$d/$n.json; done; done
echo "$(ls $M/raw | wc -l) raw dumps in $M (ba3r: $(ls /workspace/hema/ba3r/raw 2>/dev/null | wc -l))"
