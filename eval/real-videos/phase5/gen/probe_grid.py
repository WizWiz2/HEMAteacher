"""Static clearance grid for the real-shape finish/cross keyframes.  blender -b -P probe_grid.py -- <drill> <bodies,> <kfs,> <grid.json>
grid.json: {"param": [values...]} -> every combination applied to each listed keyframe (master, ba bodies)."""
import bpy, sys, os, json, itertools, math
G = "/workspace/hema/gen2"; sys.path.insert(0, G)
from hemagen import scene, config, rigpose, motion, swordcuts
from hemagen.clearance import Clearance, THR
for k, v in json.load(open("/workspace/hema/ba3/bodies.json")).items(): config.BODY_TYPES[k] = v
argv = sys.argv[sys.argv.index("--") + 1:]
drill_id, bodies, kfn, grid = argv[0], argv[1].split(","), argv[2].split(","), json.load(open(argv[3]))
keys = list(grid); combos = list(itertools.product(*[grid[k] for k in keys]))
res = {}
for body in bodies:
    scene.clear_scene(); bm, rig, assets = scene.build_character(config.BODY_TYPES[body])
    eyes = next((o for o in assets if "high-poly" in o.name), None)
    scene.build_room(config.ROOM); cam = scene.build_camera(config.CAMERA); sword = scene.build_sword(config.SWORD)
    bpy.context.view_layer.update(); R = rigpose.RigCtl(rig, bm); R.setup_landmarks(eyes)
    hair = next((o for o in assets if o.type == 'MESH' and "hair" in o.name.lower()), None)
    CL = Clearance(bm, hair, sword, config.SWORD)
    kfs = swordcuts.finalize(drill_id, swordcuts.base_keyframes(drill_id, body))
    for ci, c in enumerate(combos):
        worst = 9.0; info = {}
        for n in kfn:
            k = dict(kfs[n], **dict(zip(keys, c))); k["lift_l"] = k["lift_r"] = 0.0
            R.pose_frame(motion.to_world(k, R)); sword.matrix_world = R.sword_M; bpy.context.view_layer.update()
            CL.begin(); d, fails = CL.frame(); CL.end()
            m = min((THR[x] - d[x]) if x == "forearm_penetration" else (d[x] - THR[x]) for x in THR if x in d)
            lw = R.landmarks_world(); hc = (lw["left_hip"] + lw["right_hip"]) / 2
            hy = ((lw["left_wrist"].z + lw["right_wrist"].z) / 2 - lw["nose"].z) / R.L
            fa = math.degrees(math.atan2(lw["right_wrist"].z - lw["right_elbow"].z, lw["right_wrist"].x - lw["right_elbow"].x))
            info[n] = dict(margin=round(m, 4), fails=fails, over_head=round(hy, 3), forearm=round(fa, 1), hand_x=round(((lw["left_wrist"].x + lw["right_wrist"].x) / 2 - hc.x) / R.L, 3), rc=round(R.reach_clamp, 3))
            worst = min(worst, m)
        res.setdefault(ci, {"params": dict(zip(keys, c)), "bodies": {}})["bodies"][body] = {"worst": round(worst, 4), **info}
json.dump(res, open(os.environ.get("GRID_OUT", "/tmp/grid.json"), "w"))
print("GRID_DONE", len(combos), "combos")
