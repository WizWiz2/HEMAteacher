"""Clearance over the whole sampled master/level timeline (as render_sword, no rendering).
blender -b -P probe_path.py -- <drill> <bodies,> [levels,]  (env HEMA_SHAPE / HEMA_GUARD_OVR / HEMA_LEVEL_OVR as in the batch)"""
import bpy, sys, os, json, random, math
G = "/workspace/hema/gen2"; sys.path.insert(0, G)
from hemagen import scene, config, rigpose, motion, swordcuts
from hemagen.clearance import Clearance
for k, v in json.load(open("/workspace/hema/ba3/bodies.json")).items(): config.BODY_TYPES[k] = v
argv = sys.argv[sys.argv.index("--") + 1:]
drill_id, bodies = argv[0], argv[1].split(","); levels = argv[2].split(",") if len(argv) > 2 else ["master"]
fps, NF = 30, 240
for body in bodies:
    scene.clear_scene(); bm, rig, assets = scene.build_character(config.BODY_TYPES[body])
    eyes = next((o for o in assets if "high-poly" in o.name), None)
    scene.build_room(config.ROOM); cam = scene.build_camera(config.CAMERA); sword = scene.build_sword(config.SWORD)
    bpy.context.view_layer.update(); R = rigpose.RigCtl(rig, bm); R.setup_landmarks(eyes)
    hair = next((o for o in assets if o.type == 'MESH' and "hair" in o.name.lower()), None)
    CL = Clearance(bm, hair, sword, config.SWORD)
    master = swordcuts.finalize(drill_id, swordcuts.base_keyframes(drill_id, body), body)
    for level in levels:
        lvl = dict(motion.LEVELS[level], **json.loads(os.environ.get("HEMA_LEVEL_OVR", "{}")))
        rng = random.Random(7); kfs, _ = swordcuts.apply_level(drill_id, master, lvl, rng, {})
        tl = swordcuts.timeline(drill_id, lvl, rng, total=NF / fps, body=body)
        frames = motion.sample(tl, kfs, fps, NF, lvl, rng)
        CL.begin(); bad = {}; mins = {}
        for i, p in enumerate(frames):
            R.pose_frame(motion.to_world(p, R)); sword.matrix_world = R.sword_M; bpy.context.view_layer.update()
            d, fails = CL.frame()
            if os.environ.get('DUMP') and (fails or d['grip_head'] < 0.06): print(f"F{i} t={i/fps:.2f} gh={d['grip_head']:.4f} fp={d['forearm_penetration']:.4f} gt={d['grip_torso']:.4f} lat={p['sword_lat']:.0f} ang={p['sword_ang']:.0f} roll={p['sword_roll']:.0f} hx={p['hand_x']:.2f} hy={p['hand_y']:.2f} hl={p['hand_lat']:.2f} rc={R.reach_clamp:.3f} {fails}", flush=True)
            for k, v in d.items(): mins[k] = max(mins.get(k, 0), v) if k == "forearm_penetration" else min(mins.get(k, 9), v)
            if fails:
                t = i / fps; ph = next((n1 if n0 != n1 else n1 + "_hold") for (t0, n0), (t1, n1) in zip(tl[:-1], tl[1:]) if t <= t1 + 1e-6) if t <= tl[-1][0] else "end"
                for f in fails: bad.setdefault(f, {}).setdefault(ph, 0); bad[f][ph] += 1
        CL.end()
        n = sum(sum(v.values()) for v in bad.values())
        print(f"PATH {drill_id} {body} {level} fail_frame_hits={n} {json.dumps(bad)} min grip_head={mins.get('grip_head', 0):.4f} fpen={mins.get('forearm_penetration', 0):.4f} cross_head={mins.get('cross_head', 0):.4f} blade_head={mins.get('blade_head', 0):.4f}", flush=True)
