#!/bin/bash
# peekbatch.sh <id:dur> ... : peek 12 evenly spaced times per video (3 parallel)
cd /workspace/hema/harvest
for it in "$@"; do id=${it%%:*}; d=${it##*:}
  T=$(python3 -c "d=float($d); print(' '.join(str(round(d*(k+0.5)/12,1)) for k in range(12)))")
  ( [ -s sheets/peek_$id.jpg ] || ./peek.sh $id $T >/dev/null 2>&1 ) &
  while [ $(jobs -r | wc -l) -ge 3 ]; do sleep 1; done
done; wait; echo batch done
