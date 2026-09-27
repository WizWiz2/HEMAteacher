from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "frontend" / "public" / "content"


def read_yaml(path: Path):
    return _normalize(yaml.safe_load(path.read_text(encoding="utf-8")))


def _normalize(value):
    if isinstance(value, str):
        if "\n" in value:
            return " ".join(value.split())
        return value
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    if isinstance(value, dict):
        return {key: _normalize(item) for key, item in value.items()}
    return value


def render() -> dict[Path, str]:
    drills = [read_yaml(path) for path in sorted((DATA / "drills").glob("*.yaml"))]
    movements = [read_yaml(path) for path in sorted((DATA / "movements").glob("*.yaml"))]
    files: dict[Path, str] = {
        OUT / "drills.json": json.dumps(drills, ensure_ascii=False, indent=2) + "\n",
        OUT / "movements.json": json.dumps(movements, ensure_ascii=False, indent=2) + "\n",
    }
    for path in sorted((DATA / "profiles").glob("*.yaml")):
        profile = read_yaml(path)
        files[OUT / f"{path.stem}.json"] = json.dumps(profile, ensure_ascii=False, indent=2) + "\n"
    return files


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    files = render()

    if args.check:
        mismatches = []
        for path, expected in files.items():
            actual = path.read_text(encoding="utf-8") if path.exists() else ""
            if actual != expected:
                mismatches.append(path.relative_to(ROOT).as_posix())
        if mismatches:
            print("Static browser content is stale:")
            for item in mismatches:
                print(f"  {item}")
            print("Run: python scripts/export_static_content.py")
            return 1
        print("Static browser content is in sync.")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    for path, content in files.items():
        path.write_text(content, encoding="utf-8")
        print(path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
