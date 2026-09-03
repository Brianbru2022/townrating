"""Extract public picnic/rest candidates and useful naming anchors from a local OSM PBF."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import osmium


DEFAULT_PBF = Path(r"E:\mapdata\howfar\otp\great-britain-latest.osm.pbf")
DEFAULT_OUTPUT = Path("data/review/gb-picnic-rest-osm-2026-08-11.json")

RELEVANT_TAGS = {
    "access",
    "addr:place",
    "addr:street",
    "amenity",
    "backrest",
    "covered",
    "description",
    "fee",
    "historic",
    "inscription",
    "landuse",
    "leisure",
    "loc_name",
    "memorial",
    "name",
    "name:en",
    "operator",
    "place",
    "shelter",
    "tourism",
    "waterway",
}

ANCHOR_LEISURE = {
    "common",
    "garden",
    "nature_reserve",
    "park",
    "playground",
    "recreation_ground",
}
ANCHOR_LANDUSE = {"recreation_ground", "village_green"}
ANCHOR_AMENITY = {"community_centre", "marketplace", "townhall"}
ANCHOR_TOURISM = {"attraction", "museum", "viewpoint"}


def clean_tags(tags: osmium.osm.TagList) -> dict[str, str]:
    return {tag.k: tag.v for tag in tags if tag.k in RELEVANT_TAGS}


def candidate_kind(tags: dict[str, str]) -> str | None:
    if tags.get("tourism") == "picnic_site":
        return "picnic_site"
    if tags.get("leisure") == "picnic_table" or tags.get("amenity") == "picnic_table":
        return "picnic_table"
    if tags.get("amenity") == "bbq":
        return "barbecue"
    if tags.get("leisure") == "outdoor_seating":
        return "outdoor_seating"
    if tags.get("amenity") == "bench":
        return "bench"
    return None


def is_anchor(tags: dict[str, str]) -> bool:
    if not (tags.get("name") or tags.get("name:en") or tags.get("loc_name")):
        return False
    return bool(
        tags.get("leisure") in ANCHOR_LEISURE
        or tags.get("landuse") in ANCHOR_LANDUSE
        or tags.get("amenity") in ANCHOR_AMENITY
        or tags.get("tourism") in ANCHOR_TOURISM
        or tags.get("place") == "square"
        or tags.get("man_made") == "pier"
    )


class PicnicRestHandler(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.candidates: list[dict[str, Any]] = []
        self.anchors: list[dict[str, Any]] = []

    def _append(
        self,
        osm_type: str,
        osm_id: int,
        longitude: float,
        latitude: float,
        tags: dict[str, str],
        location_type: str,
    ) -> None:
        kind = candidate_kind(tags)
        record = {
            "osmId": f"{osm_type}/{osm_id}",
            "osmType": osm_type,
            "id": osm_id,
            "coordinates": [longitude, latitude],
            "locationType": location_type,
            "tags": tags,
        }
        if kind:
            self.candidates.append({**record, "kind": kind})
        if is_anchor(tags):
            self.anchors.append(record)

    def node(self, node: osmium.osm.Node) -> None:
        tags = clean_tags(node.tags)
        if not candidate_kind(tags) and not is_anchor(tags):
            return
        if not node.location.valid():
            return
        self._append("node", node.id, node.location.lon, node.location.lat, tags, "exact")

    def way(self, way: osmium.osm.Way) -> None:
        tags = clean_tags(way.tags)
        if not candidate_kind(tags) and not is_anchor(tags):
            return
        locations = [node.location for node in way.nodes if node.location.valid()]
        if not locations:
            return
        longitude = sum(location.lon for location in locations) / len(locations)
        latitude = sum(location.lat for location in locations) / len(locations)
        self._append("way", way.id, longitude, latitude, tags, "site_centroid")


def main() -> None:
    pbf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(os.environ.get("TOWNSCAPE_OSM_PBF", DEFAULT_PBF))
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT
    if not pbf_path.exists():
        raise SystemExit(f"OSM PBF not found: {pbf_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    handler = PicnicRestHandler()
    handler.apply_file(str(pbf_path), locations=True, idx="flex_mem")

    payload = {
        "schemaVersion": 1,
        "generatedAt": "2026-08-11T00:00:00Z",
        "sourceFile": pbf_path.name,
        "candidateCount": len(handler.candidates),
        "anchorCount": len(handler.anchors),
        "candidates": handler.candidates,
        "anchors": handler.anchors,
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=True, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(handler.candidates):,} candidates and {len(handler.anchors):,} anchors to {output_path}")


if __name__ == "__main__":
    main()
