# England and Wales National Heritage Data Downloader

Prepared: 3 August 2026

This Windows-ready package downloads the strongest national equivalents of Historic Environment Scotland (HES) data for England and Wales, plus selected supporting historical-geography layers.

## What is included

### England — Historic England

`scripts/01_download_england_heritage.ps1` downloads:

- National Heritage List for England (NHLE):
  - listed building points and polygons;
  - scheduled monuments;
  - registered parks and gardens;
  - registered battlefields;
  - protected wreck sites;
  - World Heritage Sites;
  - Building Preservation Notices;
  - Certificates of Immunity.
- the latest Historic England **Heritage at Risk** Feature Service found in the ArcGIS catalogue;
- Historic England conservation-area data, where the current national service is discoverable.

The fixed NHLE service is downloaded in paged GeoJSON files so very large layers do not have to be held in memory.

### Wales — Cadw / DataMapWales

`scripts/02_download_wales_heritage.ps1` reads the live DataMapWales WFS catalogue and downloads matching national heritage layers, including:

- listed buildings;
- scheduled monuments;
- protected wrecks;
- registered historic landscapes;
- conservation areas;
- registered historic parks and gardens and their component layers;
- World Heritage layers when their current WFS names are identifiable;
- **National Monuments Record of Wales (NMRW) terrestrial and maritime heritage assets**, the closest downloadable Welsh equivalent to Canmore's broad site-record layer.

### Wales — historical administrative geography

`scripts/03_download_wales_historical_boundaries.ps1` downloads useful RCAHMW/DataMapWales historical boundary layers such as:

- historic counties;
- historic hundreds;
- historic municipal boundaries;
- historic parliamentary boundaries;
- other RCAHMW historical-boundary layers matching the supplied patterns.

### Optional Historic England material

`scripts/04_download_optional_historic_england.ps1` attempts to discover and download optional national services such as:

- Aerial Investigation and Mapping archaeology;
- Historic England Research Reports;
- Historic Environment Record boundaries;
- Greater London Archaeological Priority Areas;
- de-designated heritage sites.

Some optional layers are very large. Run this script separately after checking your disk space.

### Searchable portals and material not included in the open NMRW GIS extract

`scripts/05_open_nonbulk_and_large_portals.ps1` opens the official portals for:

- England's local Historic Environment Records and Heritage Gateway;
- Coflein, for fuller NMRW descriptions, archive references and media beyond the downloadable GIS extracts;
- Archwilio, the Welsh Historic Environment Records;
- the List of Historic Place Names of Wales;
- Ordnance Survey OpenData;
- England and Wales LiDAR/elevation data;
- ONS geography and other large supporting datasets.

These sources are included in the package manifest, but the script does not scrape them or imply bulk-reuse rights that may not exist.

## Recommended first run

1. Extract this ZIP.
2. Double-click `run_core_downloads.cmd`.
3. Allow PowerShell to run the three core scripts.
4. Data will be written below the `downloads` folder.

Alternatively, from PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
cd "PATH_TO_THIS_FOLDER"
.\scripts\01_download_england_heritage.ps1
.\scripts\02_download_wales_heritage.ps1
.\scripts\03_download_wales_historical_boundaries.ps1
```

Use `-Force` to replace files that already exist:

```powershell
.\scripts\01_download_england_heritage.ps1 -Force
```

## Output format

Large ArcGIS and WFS layers are saved as folders containing:

- `part_0001.geojson`, `part_0002.geojson`, etc.;
- `_layer_info.json` or `_metadata.json` where available;
- a CSV manifest showing the source layer and download result.

QGIS can load all page files together. A simple merge utility is included:

```powershell
py .\tools\merge_geojson_pages.py `
  .\downloads\england\nhle\00_listed_building_points `
  .\downloads\merged\listed_building_points.geojson
```

## Updating

The NHLE service is live and is normally updated by Historic England. The discovery-based scripts search the official ArcGIS and DataMapWales catalogues each time, reducing reliance on dated filenames. Re-run the scripts to refresh your local copy.

## Important limits

England's undesignated archaeological and historic-building records are held largely by local Historic Environment Records. There is no single unrestricted national Canmore-style bulk file covering all of them. Wales is better covered: the package downloads the open quarterly NMRW terrestrial and maritime site layers. Coflein remains necessary for fuller descriptions, archive references, photographs and other media, whose reuse conditions can differ. Archwilio's regional HER content is still treated as a portal rather than an unrestricted national bulk file.

Read `LIMITATIONS.md` and `ATTRIBUTION.md` before putting the data into a public app.
