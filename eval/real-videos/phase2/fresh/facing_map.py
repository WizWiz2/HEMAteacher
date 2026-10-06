# facing_map.py (fresh): {rawframe file: facing} from fresh manifest
import csv, json, glob, os
man = {r['clip_id']: r for r in csv.DictReader(open('/workspace/hema/fresh/manifest.csv'))}
print(json.dumps({os.path.basename(f): man[os.path.basename(f).split('__', 1)[1][:-5]]['facing'] if man[os.path.basename(f).split('__', 1)[1][:-5]]['facing'] in ('left', 'right') else 'right'
                  for f in sorted(glob.glob('/workspace/hema/fresh/rawframes/*.json'))}, indent=0))
