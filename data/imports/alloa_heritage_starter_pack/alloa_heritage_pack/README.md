# Alloa Heritage Starter Pack

Created: 2026-07-28

## Contents

- `alloa_heritage_records.json` — the complete curated dataset, including mapped
  heritage points and non-spatial historical-development records.
- `alloa_heritage_points.geojson` — only the verified point records, ready for
  MapLibre or another GIS client.
- `alloa_source_config.json` — HES live-layer configuration and query templates.

## Record counts

- Total records: 37
- Point records: 28
- Records intentionally awaiting official geometry or digitisation:
  9

## Recommended import order

1. Import `alloa_heritage_records.json` into the app's project database.
2. Import `alloa_heritage_points.geojson` as the initial visible point layer.
3. Query the live HES Listed Buildings, Conservation Areas and Scheduled
   Monuments layers using `alloa_source_config.json`.
4. Match statutory features by `designationReference`.
5. Replace or supplement point geometry with official boundary polygons where
   available.
6. Digitise settlement-age polygons only from properly georeferenced historic
   maps and retain the evidence-map ID on every polygon.

## Important limitations

This is a curated starter pack, not a complete substitute for the live statutory
register or a local Historic Environment Record export.

No conservation-area boundary, historic street line or former-building footprint
has been guessed. Those records deliberately contain `geometry: null` and a
review note explaining what must be imported or digitised.

The heat-map weights are provisional. They do not assess the present condition,
architectural integrity or survival of every building. A separate reviewed
survival survey is required before calling the output a definitive
historic-character assessment.

## Date wording

The data distinguishes:

- `documented_construction`
- `documented_date_range`
- `present_by`
- `estimated_from_authoritative_source`
- `first_mapped`

A first appearance on a historical map is not treated as a construction date.

## Attribution

Contains Historic Environment Scotland and OS data © Historic Environment Scotland and Crown Copyright and database right 2026, licensed under the Open Government Licence v3.0.

Check Clackmannanshire Council document terms and historical-map licences before
redistributing source documents or imagery.
