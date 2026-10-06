#!/bin/bash
# sweep_accept.sh <fixture.gz> <tag> <acc...>: build model (current hema-gap code) from fixture, then seen replay per acceptDistance override
cd /workspace/hema-gap; cp $1 frontend/test-fixtures/motion-poses.json.gz; node frontend/scripts/build-motion-patterns.mjs > /dev/null 2>&1
cp frontend/src/drill/motionModel.json /tmp/mm_$2.json; T=$2; shift 2
for a in "$@"; do python3 -c "import json;m=json.load(open('/tmp/mm_$T.json'));m['acceptDistance']=$a;open('frontend/src/drill/motionModel.json','w').write(json.dumps(m)+'\n')"
  echo "## accept $a"; /workspace/hema/real/eval_seen.sh /workspace/hema-gap ${T}_a$a; done
git checkout -- frontend/test-fixtures frontend/src/drill/motionModel.json frontend/src/drill/motionPatterns.json
