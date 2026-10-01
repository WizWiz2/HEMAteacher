# Continuous movement engine

The engine recognizes whole movements for Zornhau, advance, retreat, and forward/backward passing steps. Other drills retain pose checkpoints. “Разбор поз” keeps that separate practice mode available.

Movement recognition now starts from the learner's stable position and compares the path relative to that position, rather than demanding a master guard. Recognition and heuristic technique feedback are separate results; tracking loss and incomplete/unrecognized attempts are not technique grades.

See [video-motion.md](video-motion.md) for the shared camera/MP4 path, the pixel-based CPU MediaPipe test, browser verification that remains outstanding, feedback limitations, and reproduction instructions. `continuous-motion-results.json` is the ground-truth-only regression result, not evidence of MediaPipe or camera performance.

Master labels generate the trajectory references. Beginners and experienced clips are not reference templates, but all levels were used to iterate the thresholds. The corpus shares one synthetic generator and is not an independent real-student validation set.
