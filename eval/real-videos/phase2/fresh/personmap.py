# personmap.py all|clean -> {clip_id: person} for personal.mjs
import csv, json, sys
print(json.dumps({r['clip_id']: r['clip_id'].split('_')[0] for r in csv.DictReader(open('/workspace/hema/fresh/manifest.csv')) if sys.argv[1] == 'all' or r['clean'] == 'yes'}))
