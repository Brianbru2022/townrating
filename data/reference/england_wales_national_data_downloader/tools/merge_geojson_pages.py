#!/usr/bin/env python3
"""Merge paged GeoJSON FeatureCollections without holding all features in memory.

Usage:
    python merge_geojson_pages.py INPUT_FOLDER OUTPUT.geojson
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


def merge(input_folder: Path, output_file: Path) -> int:
    pages = sorted(input_folder.glob("part_*.geojson"))
    if not pages:
        raise FileNotFoundError(f"No part_*.geojson files found in {input_folder}")

    output_file.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    first_feature = True

    with output_file.open("w", encoding="utf-8", newline="") as out:
        out.write('{"type":"FeatureCollection","features":[')
        for page in pages:
            with page.open("r", encoding="utf-8-sig") as src:
                data = json.load(src)
            features = data.get("features")
            if not isinstance(features, list):
                raise ValueError(f"{page} is not a GeoJSON FeatureCollection")
            for feature in features:
                if not first_feature:
                    out.write(",")
                json.dump(feature, out, ensure_ascii=False, separators=(",", ":"))
                first_feature = False
                total += 1
        out.write(']}')

    return total


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_folder", type=Path)
    parser.add_argument("output_file", type=Path)
    args = parser.parse_args()

    try:
        count = merge(args.input_folder, args.output_file)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"Merged {count:,} features into {args.output_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
