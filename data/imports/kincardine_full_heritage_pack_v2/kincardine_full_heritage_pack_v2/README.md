# Kincardine-on-Forth Full Heritage Project Pack — All-Dated Edition

Updated: 2026-07-29

## Date-completeness result

Every one of the **72 heritage and contextual records**
now has:

- human-readable date wording;
- an earliest and latest year;
- a date-evidence basis;
- a confidence level; and
- source provenance.

No entry has been excluded.

The previously unresolved **5 Excise Lane** record is retained with a date of
**1712**, based on a published architectural survey that describes a dated
panel on the building.

## How to interpret the dates

Dates are not forced into false precision. They include:

- exact inscribed or documented years;
- documented construction and rebuilding phases;
- authoritative century or part-century ranges;
- date ranges where sources disagree;
- settlement or infrastructure event dates; and
- the 1971 designation date for Kincardine Conservation Area.

A dated lintel may apply to one component or rebuilding phase rather than the
entire listed group. The app should display `documentedDateText`,
`dateBasis`, `dateConfidence` and `datePrecision` together.

## Main files

- `kincardine_full_heritage_pack.json` — master import with all records dated.
- `kincardine_full_heritage_points.geojson` — mapped records with date fields.
- `kincardine_all_dated_records_index.json` — compact chronological index.
- `kincardine_date_enrichment_sources.json` — research audit trail and sources.
- `kincardine_excluded_undated_records.json` — confirms that no records were excluded.
- `kincardine_coverage_report.json` — updated completeness metrics.
- `validation_report.json` — structural and date-completeness validation.

All other project files from version 1 remain included.

## Validation

- Total retained records: 72
- Dated records: 72
- Undated records: 0
- Excluded records: 0
- Mapped point records: 64
- Validation passed: true

## Important limitations

This edition ensures every record has the best published date found during the
research pass. It does not imply that every building has an exact construction
year. Broad ranges remain broad and are labelled accordingly.

Official HES data should still be refreshed at application runtime for current
designation status, category and geometry.

## Attribution

Contains Historic Environment Scotland and OS data © Historic Environment Scotland and Crown Copyright and database right 2026, licensed under the Open Government Licence v3.0.
