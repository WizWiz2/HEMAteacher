import json
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


def _load_yaml_dir(name: str):
    folder = ROOT / "data" / name
    return sorted(
        [_canonical(yaml.safe_load(path.read_text(encoding="utf-8"))) for path in folder.glob("*.yaml")],
        key=lambda item: item["id"],
    )


def _load_json(name: str):
    path = ROOT / "frontend" / "public" / "content" / name
    return sorted([_canonical(item) for item in json.loads(path.read_text(encoding="utf-8"))], key=lambda item: item["id"])


def _canonical(value):
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value).strip()
    if isinstance(value, list):
        return [_canonical(item) for item in value]
    if isinstance(value, dict):
        return {key: _canonical(item) for key, item in value.items()}
    return value


def test_static_drill_catalog_matches_yaml_source():
    assert _load_json("drills.json") == _load_yaml_dir("drills")


def test_static_movement_catalog_matches_yaml_source():
    assert _load_json("movements.json") == _load_yaml_dir("movements")
