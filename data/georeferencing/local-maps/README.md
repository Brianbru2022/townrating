# Locally hosted late-Victorian map packs

These four intakes identify the NLS 25-inch late-Victorian sheet centred on each published town. They are research records, not published overlays: the prior four-corner warps used image-sheet extents rather than independently verified neatline control points and did not align sufficiently.

- Alloa: CXXXIX.4, 1900 (`82875201`)
- Alva: XXV.13, 1896 (`82881153`)
- Culross: XXXVII.12, 1896 (`82882002`)
- Kincardine-on-Forth: XXXVII.6, 1896 (`82881969`)

Before changing `approvedForPublication` to `true`, a curator must confirm the NLS reuse statement, crop to the verified map neatline, add four independently checked historic-map control points, record residual error, reviewer and date, and validate the intake:

```powershell
npm run check-local-historic-maps
npm run prepare-local-historic-map -- data/georeferencing/local-maps/alloa-late-victorian.json
npm run prepare-local-historic-map -- data/georeferencing/local-maps/alva-late-victorian.json
npm run prepare-local-historic-map -- data/georeferencing/local-maps/culross-late-victorian.json
npm run prepare-local-historic-map -- data/georeferencing/local-maps/kincardine-late-victorian.json
npm run publish-local-historic-maps
```

The preparation command uses the cited NLS IIIF source with GDAL, writes its ignored working files under `data/runtime/source-maps`, warps the reviewed image to EPSG:3857 and writes MBTiles under `data/runtime/tiles`. No fallback NLS/MapTiler layer is published: the service began returning a visible upgrade watermark. The optional Docker tile service is retained for larger future collections.

Do not use the old MapTiler/NLS tiled API as a source for local packaging. The original NLS map-record URL in each intake is the provenance record for the authorised sheet image and its attribution.
