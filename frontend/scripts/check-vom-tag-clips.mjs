// Regression check of the supplied Blender landmark labels, not MediaPipe video inference.
import { createServer } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clipsDir = path.resolve(root, '../test-data/mock-videos/zornhau');
const server = await createServer({ root, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { torsoPixels, normalizePose } = await server.ssrLoadModule('/src/live/normalize.ts');
  const { liveFeatures } = await server.ssrLoadModule('/src/live/features.ts');
  const { matchCheckpoint } = await server.ssrLoadModule('/src/drill/checkpointMatcher.ts');
  const drills = JSON.parse(readFileSync(path.join(root, 'public/content/drills.json'), 'utf8'));
  const guards = drills.flatMap(drill => drill.checkpoints.filter(cp => cp.targetPoseId === 'vom-tag').map(cp => ({ drill: drill.id, cp })));
  const rows = [];
  for (const file of readdirSync(clipsDir).filter(name => name.endsWith('.json')).sort()) {
    const clip = JSON.parse(readFileSync(path.join(clipsDir, file), 'utf8'));
    const guardEnd = clip.timeline_s.filter(([, phase]) => phase === 'guard').at(-1)[0] * 1000;
    const states = guards.map(() => ({ validSince: null }));
    const passes = guards.map(() => null);
    for (const frame of clip.frames.filter(frame => frame.t_ms <= guardEnd)) {
      const raw = { timestampMs: frame.t_ms, width: clip.resolution[0], height: clip.resolution[1],
        landmarks: Object.fromEntries(clip.landmark_format.names.map((name, i) => {
          const [x, y, z, visibility] = frame.landmarks[i];
          return [name, { x, y, z, visibility }];
        })) };
      // Ground-truth labels remain geometrically known even for occluded joints.
      const normalized = normalizePose(raw, 'right', torsoPixels(raw, 0), 0, 'side');
      if (!normalized) throw new Error(`Invalid ground truth in ${file}, frame ${frame.frame}`);
      const features = liveFeatures(normalized.landmarks, 0);
      guards.forEach(({ cp }, i) => {
        const result = matchCheckpoint(features, cp, states[i], frame.t_ms, true);
        states[i] = result.state;
        if (result.match.passed && passes[i] === null) passes[i] = Math.round(frame.t_ms);
      });
    }
    const failed = guards.filter((_, i) => passes[i] === null).map(({ drill }) => drill);
    rows.push({ clip: file.replace('.json', ''), guards: `${passes.filter(p => p !== null).length}/${guards.length}`, latestPassMs: Math.max(...passes.filter(p => p !== null)), failed });
  }
  console.table(rows.map(({ failed, ...row }) => ({ ...row, failed: failed.join(', ') })));
  if (rows.length !== 6 || guards.length !== 6 || rows.some(row => row.failed.length)) process.exitCode = 1;
} finally {
  await server.close();
}
