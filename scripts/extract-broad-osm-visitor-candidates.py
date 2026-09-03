"""Extract broad visitor-attraction candidates from a local OSM PBF.

The output is deliberately a discovery feed rather than published curation. The
TypeScript enrichment pass applies town boundaries, duplicate checks, editorial
scoring and the public 20-place cap.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Iterable

import osmium


DEFAULT_PBF = Path(r"E:\mapdata\howfar\otp\great-britain-latest.osm.pbf")
DEFAULT_OUTPUT = Path(r"E:\Apps\Heatmap\tmp\england-broad-visitor-osm.ndjson")
RELEVANT_KEYS = {
    "amenity",
    "attraction",
    "club",
    "harbour",
    "historic",
    "information",
    "leisure",
    "man_made",
    "natural",
    "railway",
    "shop",
    "sport",
    "tourism",
    "water",
    "waterway",
}


def is_relevant(tags: dict[str, str]) -> bool:
    return bool(tags.get("name") and RELEVANT_KEYS.intersection(tags))


def is_candidate_family(tags: dict[str, str]) -> bool:
    """Cheaply mirror the TypeScript taxonomy before writing NDJSON."""
    name = tags.get("name", "")
    tourism = tags.get("tourism", "")
    leisure = tags.get("leisure", "")
    amenity = tags.get("amenity", "")
    natural = tags.get("natural", "")
    man_made = tags.get("man_made", "")
    visitor_evidence = any(
        tags.get(key)
        for key in ("website", "contact:website", "wikidata", "wikipedia", "operator", "tourism")
    )
    return any(
        (
            tourism in {"theme_park", "zoo", "aquarium", "museum", "gallery", "viewpoint", "attraction"},
            tourism == "information" and tags.get("information") in {"visitor_centre", "office"},
            leisure in {
                "water_park", "amusement_arcade", "miniature_golf", "bowling_alley",
                "escape_game", "trampoline_park", "ice_rink", "water_sports", "marina",
                "slipway", "nature_reserve", "garden", "park", "bird_hide", "indoor_play",
                "high_ropes_course", "swimming_area", "swimming_pool",
            },
            amenity in {"theatre", "cinema", "arts_centre", "planetarium", "museum", "boat_rental", "boat_sharing"},
            amenity == "marketplace" and visitor_evidence,
            natural in {"beach", "cave_entrance"},
            man_made in {"pier", "lighthouse", "observatory", "tower"},
            natural == "peak" and visitor_evidence,
            tags.get("waterway") == "waterfall",
            natural == "water" and tags.get("water") in {"lake", "reservoir", "lagoon"},
            tags.get("harbour") == "yes",
            tags.get("sport") in {"canoe", "kayak", "paddle", "rowing", "sailing", "surfing", "water_ski", "wakeboard"},
            tags.get("sport") in {"axe_throwing", "climbing", "karting", "swimming"} and visitor_evidence,
            tags.get("railway") == "preserved" and visitor_evidence,
        )
    )


def representative_point(obj: Any) -> tuple[float, float] | None:
    if obj.is_node():
        try:
            return float(obj.location.lon), float(obj.location.lat)
        except (RuntimeError, ValueError):
            return None

    locations: Iterable[Any]
    if obj.is_way():
        locations = (node.location for node in obj.nodes)
    elif obj.is_area():
        locations = (
            node.location
            for ring in obj.outer_rings()
            for node in ring
        )
    else:
        return None

    coordinates: list[tuple[float, float]] = []
    for location in locations:
        try:
            if location.valid():
                coordinates.append((float(location.lon), float(location.lat)))
        except (RuntimeError, ValueError):
            continue
    if not coordinates:
        return None
    return (
        sum(coordinate[0] for coordinate in coordinates) / len(coordinates),
        sum(coordinate[1] for coordinate in coordinates) / len(coordinates),
    )


def source_identity(obj: Any) -> tuple[str, int]:
    if obj.is_node():
        return "node", int(obj.id)
    if obj.is_area():
        return ("way" if obj.from_way() else "relation"), int(obj.orig_id())
    return "way", int(obj.id)


def main() -> int:
    pbf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PBF
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT
    if not pbf_path.exists():
        raise FileNotFoundError(f"OSM PBF not found: {pbf_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    index_path = output_path.with_suffix(".node-index")
    if index_path.exists():
        index_path.unlink()

    relevant_key_filter = osmium.filter.KeyFilter(*sorted(RELEVANT_KEYS))
    processor = (
        osmium.FileProcessor(str(pbf_path))
        .with_locations(f"sparse_file_array,{index_path.as_posix()}")
        .with_areas(relevant_key_filter)
        .with_filter(relevant_key_filter)
    )

    written = 0
    seen: set[str] = set()
    try:
        with output_path.open("w", encoding="utf-8", newline="\n") as output:
            for obj in processor:
                tags = dict(obj.tags)
                # FileProcessor custom filters are advisory across pyosmium
                # versions. Keep the publication feed guarded explicitly.
                if not is_relevant(tags) or not is_candidate_family(tags):
                    continue
                coordinates = representative_point(obj)
                if coordinates is None:
                    continue
                lon, lat = coordinates
                if not (-6.6 <= lon <= 2.2 and 49.8 <= lat <= 56.0):
                    continue
                source_type, source_id = source_identity(obj)
                key = f"{source_type}/{source_id}"
                if key in seen:
                    continue
                seen.add(key)
                output.write(
                    json.dumps(
                        {
                            "osmType": source_type,
                            "osmId": source_id,
                            "coordinates": [lon, lat],
                            "tags": tags,
                        },
                        ensure_ascii=True,
                        separators=(",", ":"),
                    )
                    + "\n"
                )
                written += 1
    finally:
        if index_path.exists():
            try:
                index_path.unlink()
            except PermissionError:
                # Windows can retain pyosmium's sparse index handle until the
                # interpreter exits. It is temporary and replaced next run.
                pass

    print(
        json.dumps(
            {
                "source": str(pbf_path),
                "sourceBytes": pbf_path.stat().st_size,
                "output": str(output_path),
                "candidates": written,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
