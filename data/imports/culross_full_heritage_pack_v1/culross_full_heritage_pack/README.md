# Culross Full Heritage Project Pack

Created: 2026-07-29

## Scope

This package covers the compact Royal Burgh and its immediate setting, while
also retaining the wider Culross parish statutory inventory, including
Dunimarle, Blair, Bordie, Valleyfield and the northern granges.

## Contents

- `culross_full_heritage_pack.json` — master application import.
- `culross_full_heritage_points.geojson` — 143 mapped records.
- `culross_query_envelope.geojson` — technical retrieval envelope only.
- `culross_context_and_thematic_records.json` — conservation area, harbour,
  industrial landscape, historic street pattern and NTS property-group records.
- `culross_settlement_evidence.json` — evidence stages for a separate settlement-age layer.
- `culross_historic_map_catalogue.json` — archival map candidates and preparation status.
- `culross_source_registry.json` — source and licence register.
- `culross_live_import_profiles.json` — HES ArcGIS REST profiles for listed
  buildings, conservation areas, designed landscapes, scheduled monuments and
  listed-building boundaries.
- `culross_methodology.json` — date language and heat-map methodology.
- `culross_data_dictionary.json` — field definitions and merge rules.
- `culross_coverage_report.json` — completeness and limitations.
- `validation_report.json` — structural and geographic QA.

## Counts

- All records: 148
- Listed-building inventory records: 138
- Scheduled monuments: 3
- Designed landscapes: 2
- Contextual/thematic records: 5
- Mapped points: 143
- Records with source-backed or estimated dates: 18
- Historic-map source entries: 5
- Settlement-evidence stages: 8

## Recommended import process

1. Import `culross_full_heritage_pack.json`.
2. Display `culross_full_heritage_points.geojson`.
3. Run all profiles in `culross_live_import_profiles.json`.
4. Match records by official designation reference.
5. Replace snapshot geometry and designation status with current HES data.
6. Use the current official Culross Conservation Area polygon.
7. Import official scheduled-monument and designed-landscape polygons.
8. Resolve exact NLS historic-map sheets and service URLs.
9. Digitise period-specific harbour, shoreline and settlement-age geometries.
10. Keep settlement age separate from surviving historic character.

## Important limitations

No official polygon has been hand-drawn. The former Sandhaven shoreline,
industrial landscape and historic settlement extents remain evidence-led
digitisation tasks.

Older `C(S)` categories are preserved as legacy labels and normalised to
Category C. Records with conflicting older and current category information are
flagged for live review.

The wider parish inventory is useful for a complete Culross project, but the app
should allow users to filter to the compact Royal Burgh.

## Attribution

Contains Historic Environment Scotland and OS data © Historic Environment Scotland and Crown Copyright and database right 2026, licensed under the Open Government Licence v3.0.
