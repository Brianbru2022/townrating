# Scotland HES reference-data library

This repository includes the developer-supplied HES spatial-library snapshot used to populate and refresh Scottish towns. It is retained as the compressed `scotland-hes-library.zip` snapshot because the unpacked national Listed Buildings and Canmore databases are too large for ordinary Git hosting.

## Source and use

- Provider: Historic Environment Scotland (HES).
- Access method: developer-supplied download, originally stored at `D:\Map Data\Scotland HES`.
- Access date: 30 July 2026; the precise listed-buildings checksum and upstream URL are recorded in `data/reference/reference-data-catalogue.json`.
- Licence: Open Government Licence v3.0, subject to the upstream HES dataset terms. Retain HES attribution and do not imply that HES endorses this application.
- Purpose: developer-only intake, validation and geometry refresh. The browser never downloads this national source library.

## Contents

- `lb_scotland`: Listed Buildings and Listed Buildings Boundaries.
- `Canmore_Points`: NRHE/Canmore terrestrial and maritime point records.
- `sam_scotland`: Scheduled Monuments.
- `ca_scotland`: Conservation Areas.
- `gdl_scotland`: Gardens and Designed Landscapes.
- `battlefields_scotland`, `HMPA_scotland`, `pic`, and `WHS`: other HES designation/reference layers retained for future town intake.

After cloning, extract `scotland-hes-library.zip` into `data/reference/`, producing `data/reference/scotland-hes/`. Import commands expect these files at that location; set `HES_DATA_DIR` only when using another local mirror.
