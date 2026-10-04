"""Bodies/angles render wrapper (Blender -P). Env HEMA_BA_JSON = {"script", "camera": {"az","h","d","lens"}, "bodies"?: {...}}.
Patches config.CAMERA / BODY_TYPES, then runs the unchanged drill render script."""
import sys, os, json, math, runpy
G = "/workspace/hema/gen"; sys.path.insert(0, G)
from hemagen import config
ov = json.loads(os.environ["HEMA_BA_JSON"])
c = ov["camera"]; az = math.radians(c["az"])
config.CAMERA["cam_loc"] = (0.7 + c["d"] * math.sin(az), -c["d"] * math.cos(az), c["h"])
config.CAMERA["cam_look"] = (0.7, 0.0, 1.12)
config.CAMERA["lens_mm"] = float(c["lens"])
for k, v in ov.get("bodies", {}).items(): config.BODY_TYPES[k] = v
print("BA_OVERRIDES", json.dumps(ov["camera"]), config.CAMERA, flush=True)
os.chdir(G); sys.argv[0] = os.path.join(G, ov["script"])
runpy.run_path(os.path.join(G, ov["script"]), run_name="__main__")
