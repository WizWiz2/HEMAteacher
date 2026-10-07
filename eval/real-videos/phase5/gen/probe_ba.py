"""probe_sword.py with the ba bodies (ba3/bodies.json) patched into config.BODY_TYPES. blender -b -P probe_ba.py -- <drill> <body> [level]"""
import sys, os, json, runpy
G = "/workspace/hema/gen2"; sys.path.insert(0, G)
from hemagen import config
for k, v in json.load(open("/workspace/hema/ba3/bodies.json")).items(): config.BODY_TYPES[k] = v
os.chdir(G); sys.argv[0] = os.path.join(G, "probe_sword.py")
runpy.run_path(os.path.join(G, "probe_sword.py"), run_name="__main__")
