"""Path clearance for candidate shape patches. blender -b -P probe_search.py -- <drill> <bodies,> <levels,> <cands.json> <base_shape.json>
cands.json: [{"name": .., "patch": {"kfs": {kf: {..}}, "post_kfs": {kf: {..}}}}] merged into base_shape[drill]. Prints SEARCH lines."""
import bpy, sys, os, json, random, copy
G = "/workspace/hema/gen2"; sys.path.insert(0, G)
from hemagen import scene, config, rigpose, motion, swordcuts
from hemagen.clearance import Clearance
for k, v in json.load(open("/workspace/hema/ba3/bodies.json")).items(): config.BODY_TYPES[k] = v
argv = sys.argv[sys.argv.index("--") + 1:]
drill_id, bodies, levels, cands, base = argv[0], argv[1].split(","), argv[2].split(","), json.load(open(argv[3])), json.load(open(argv[4]))
def merged(patch):
    s = copy.deepcopy(base); d = s.setdefault(drill_id, {})
    for sec in ("kfs", "post_kfs"):
        for k, ov in patch.get(sec, {}).items(): d.setdefault(sec, {}).setdefault(k, {}).update(ov)
    for b, bp in patch.get("body", {}).items():
        for sec in ("kfs", "post_kfs"):
            for k, ov in bp.get(sec, {}).items(): d.setdefault("body", {}).setdefault(b, {}).setdefault(sec, {}).setdefault(k, {}).update(ov)
    return s
fps, NF = 30, 240
for body in bodies:
    scene.clear_scene(); bm, rig, assets = scene.build_character(config.BODY_TYPES[body])
    eyes = next((o for o in assets if "high-poly" in o.name), None)
    scene.build_room(config.ROOM); cam = scene.build_camera(config.CAMERA); sword = scene.build_sword(config.SWORD)
    bpy.context.view_layer.update(); R = rigpose.RigCtl(rig, bm); R.setup_landmarks(eyes)
    hair = next((o for o in assets if o.type == 'MESH' and "hair" in o.name.lower()), None)
    CL = Clearance(bm, hair, sword, config.SWORD)
    for c in cands:
        p = f"/tmp/shape_cand_{os.getpid()}.json"; json.dump(merged(c["patch"]), open(p, "w")); os.environ["HEMA_SHAPE"] = p
        master = swordcuts.finalize(drill_id, swordcuts.base_keyframes(drill_id, body), body)
        for level in levels:
            lvl = dict(motion.LEVELS[level], **json.loads(os.environ.get("HEMA_LEVEL_OVR", "{}")))
            rng = random.Random(7); kfs, _ = swordcuts.apply_level(drill_id, master, lvl, rng, {})
            tl = swordcuts.timeline(drill_id, lvl, rng, total=NF / fps, body=body)
            frames = motion.sample(tl, kfs, fps, NF, lvl, rng)
            CL.begin(); bad = {}
            for i, pp in enumerate(frames):
                R.pose_frame(motion.to_world(pp, R)); sword.matrix_world = R.sword_M; bpy.context.view_layer.update()
                d, fails = CL.frame()
                if fails:
                    t = i / fps; ph = next(((n1 if n0 != n1 else n1 + "_hold") for (t0, n0), (t1, n1) in zip(tl[:-1], tl[1:]) if t <= t1 + 1e-6), "end")
                    for f in fails: k = f + ":" + ph; bad[k] = bad.get(k, 0) + 1
            CL.end()
            nfail = len({i for i in range(0)}) or sum(bad.values())
            print(f"SEARCH {c['name']} {body} {level} hits={nfail} {json.dumps(bad)}", flush=True)
