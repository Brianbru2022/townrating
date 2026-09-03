# Coverage and limitations

## 1. Statutory designations versus Canmore-style records

The core downloads are strongest for **statutory designations**:

- England: National Heritage List for England;
- Wales: Cadw designation layers through DataMapWales.

They do not by themselves equal all of HES/Canmore's broader archaeology, survey, archive and event records.

## 2. England Historic Environment Records

Detailed undesignated archaeology and local historic-environment information are distributed among local-authority Historic Environment Records (HERs). Heritage Gateway is a national discovery route, but formats, APIs, charges and bulk-reuse permissions vary by HER. The package therefore opens the official directories and does not automate mass extraction.

## 3. NMRW, Coflein and Archwilio

The package downloads the open National Monuments Record of Wales terrestrial and maritime point datasets from DataMapWales. These provide broad Canmore-style site records and links back to Coflein. They do not contain every archive image, report, event record or full descriptive resource shown in Coflein. Archwilio remains an essential regional HER source and is included as a portal rather than treated as one unrestricted national bulk database.

## 4. Conservation areas

Conservation areas are designated and maintained locally. Historic England and DataMapWales provide useful national aggregation, but the current local authority remains the authoritative source for boundaries and designation status.

## 5. Dates and building age

A designation date, list-entry date, estimated construction date, archaeological period and map-survey date are different concepts. Keep them in separate fields. Do not use the date a site was listed as the date it was built.

## 6. Geometry accuracy

Designation polygons are legal or administrative representations, not always precise building footprints. For visualisation or building-age analysis, join carefully to Ordnance Survey or other building geometry and retain the original heritage geometry.

## 7. Large datasets

Aerial archaeology, LiDAR, national mapping and address/building datasets can be many gigabytes or delivered as tiles. They are deliberately separated from the core one-click run.

## 8. Live services can change

ArcGIS item IDs, WFS layer names, schemas and download limits can change. The scripts save service metadata and use catalogue discovery where practical, but review warnings and manifests after each run.
