// fxfilter.mjs <in.gz> <out.gz> <drills,comma> [keepTest=1]: REPLACE variant - drop the old synthetic TRAIN clips
// (main + ba:train, every render style) of the given drills; real-shape clips (id contains "_rs") and test clips stay.
import {readFileSync, writeFileSync} from 'node:fs'; import {gzipSync, gunzipSync} from 'node:zlib';
const [inp, out, drills] = process.argv.slice(2); const D = drills.split(',');
const fx = JSON.parse(gunzipSync(readFileSync(inp))); const n0 = fx.clips.length;
fx.clips = fx.clips.filter(c => !(D.includes(c.drill) && (c.variant === 'main' || c.variant.startsWith('main:') || c.variant === 'ba:train') && !/_rs(_|$)/.test(c.id)));
writeFileSync(out, gzipSync(JSON.stringify(fx), {level: 9})); console.log(`${n0} -> ${fx.clips.length} clips -> ${out}`);
