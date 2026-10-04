"""Generation QA (no recognition results): clearance-failing frames and face-hidden frames per clip; gate = <= 9 failing."""
import json, glob, sys
rows = []
for f in sorted(glob.glob('/workspace/hema/ba/clips/*/*/*.json')):
    d = json.load(open(f)); c = d['clearance_check']; fv = d.get('face_visibility_check', {})
    hidden = sum(len(e.get('hidden_frames', [])) for e in fv.get('per_phase', {}).values()) if isinstance(fv.get('per_phase'), dict) else None
    rows.append((f.split('clips/')[1][:-5], len(c['failing_frames']), hidden))
bad = [r for r in rows if r[1] > 9]
for r in rows if '-v' in sys.argv else bad: print(*r)
print(len(rows), 'clips;', len(bad), 'fail the clearance gate')
