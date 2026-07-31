# Importing data

Run `npm run import-data -- <file.geojson> <organisation> <source-url> <licence>` to inspect a GeoJSON FeatureCollection. Convert KML, GPX, Shapefile, GeoPackage, WFS/Ogc API/ArcGIS downloads, and CSV using a documented GDAL/OGR pipeline, map fields to the neutral schema, attach source records, then run `npm run validate-data`. Errors block publication; warnings stay visible in Data Review.
