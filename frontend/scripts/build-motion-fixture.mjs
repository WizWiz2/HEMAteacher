// Packs browser MediaPipe Lite pose dumps (from the in-app MP4 regression page, one JSON per clip with
// {frames:[RawPose]}) into a compact gzip fixture used by the recognition tests and the template builder.
// Usage: node frontend/scripts/build-motion-fixture.mjs <outGz> <dumpDir>:<variant>:<labelRoot> ...
// variant 'ba' = bodies/angles clips (names <drill>__<split>__<name>.json, sidecars <labelRoot>/<split>/<drill>/<name>.json).
// labelRoot holds the generator sidecars (<drill>/<body>_<level>.json, or <variant>/<drill>/... for held-out);
// only the labelled movement interval is taken from them (initial hold end -> drill end phase).
// Dump file names: <drill>__[<variant>_]<body>_<level>.json. z is dropped (side view never uses depth).
import {readFileSync, readdirSync, writeFileSync, existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const [out, ...dirs] = process.argv.slice(2);
const NAMES = ['nose','left_eye_inner','left_eye','left_eye_outer','right_eye_inner','right_eye','right_eye_outer','left_ear','right_ear','mouth_left','mouth_right','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_pinky','right_pinky','left_index','right_index','left_thumb','right_thumb','left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle','left_heel','right_heel','left_foot_index','right_foot_index'];
const clips = [];
// per frame: 33 x [x*1e4, y*1e4, visibility*100] (missing pose -> empty array)
const packFrames = frames => frames.map(fr => Object.keys(fr.landmarks).length ? NAMES.flatMap(n => { const l = fr.landmarks[n]; return [Math.round(l.x * 1e4), Math.round(l.y * 1e4), Math.round(l.visibility * 100)]; }) : []);
const endLabelOf = drill => drill.endsWith('hau') ? 'finish' : drill.startsWith('passing') ? 'settle' : ['advance', 'retreat'].includes(drill) ? 'recover' : null;
// Bodies/angles clips (docs/bodies-angles-split.md): dump <drill>__<split>__<name>.json, sidecar <labels>/<split>/<drill>/<name>.json
function baClip(f, d, labels) {
  const [drill, split, name] = f.replace('.json', '').split('__');
  const side = JSON.parse(readFileSync(`${labels}/${split}/${drill}/${name}.json`));
  const tl = side.timeline_s, end = endLabelOf(drill);
  return {id: `ba:${split}/${drill}/${name}`, drill, variant: `ba:${split}`, body: side.body_type, level: side.level,
    camera: side.ba_camera, degradation: side.ba_degradation, source: 'browser MediaPipe Lite (in-app MP4 regression page, 30 fps)',
    move: end ? [Math.round(tl[1][0] * 1000), Math.round(tl.find(([, n]) => n === end)[0] * 1000)] : null,
    width: d.frames[0].width, height: d.frames[0].height, t: d.frames.map(fr => fr.timestampMs), p: packFrames(d.frames)};
}
for (const spec of dirs) {
  const [dir, variant = 'main', labels] = spec.split(':');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const d = JSON.parse(readFileSync(`${dir}/${f}`));
    if (variant === 'ba') { clips.push(baClip(f, d, labels)); continue; }
    const [drill, rest] = f.replace('.json', '').split('__');
    const m = rest.match(/^(?:(\w+?)_)?(tall_slim_male|short_broad_female|medium_stocky_male)_(master|experienced|beginner)$/);
    const first = d.frames[0];
    const sub = m[1] ? `${labels}/${m[1]}/${drill}` : `${labels}/${drill}`;
    const endLabel = drill.endsWith('hau') ? 'finish' : drill.startsWith('passing') ? 'settle' : ['advance', 'retreat'].includes(drill) ? 'recover' : null;
    const tl = endLabel ? JSON.parse(readFileSync(`${sub}/${m[2]}_${m[3]}.json`)).timeline_s : null;
    const move = endLabel ? [Math.round(tl[1][0] * 1000), Math.round(tl.find(([, n]) => n === endLabel)[0] * 1000)] : null;
    clips.push({id: `${variant}/${drill}/${rest}`, drill, variant: m[1] ? `${variant}:${m[1]}` : variant, body: m[2], level: m[3],
      source: 'browser MediaPipe Lite (in-app MP4 regression page, 30 fps)', move, width: first.width, height: first.height,
      t: d.frames.map(fr => fr.timestampMs),
      // per frame: 33 x [x*1e4, y*1e4, visibility*100] (missing pose -> empty array)
      p: packFrames(d.frames)});
  }
}
writeFileSync(out, gzipSync(JSON.stringify({version: 1, names: NAMES, clips}), {level: 9}));
console.log(`${clips.length} clips -> ${out}`);
