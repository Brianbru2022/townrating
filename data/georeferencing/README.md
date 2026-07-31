# Alloa historic-map georeferencing intake

The supplied heritage packs contain catalogue metadata only; no historic-map image,
licence confirmation, or control points were supplied. Do not publish a four-corner
overlay from that material.

To prepare a map for publication, copy `alloa-map-georeference.template.json`, fill in
the original file and licence details, and enter at least four independently checked
ground-control points in WGS84. Then run `npm run check-georeference -- <manifest>`.
The map can be turned into tiles only after the manifest validates and GDAL is installed.

The existing NLS six-inch layer is publisher-hosted and already georeferenced. It is
available for visual comparison, but it is not evidence for a settlement-age polygon
unless a curator digitises and reviews that polygon against the map.

The alloa-os-first-edition-1862-1866 intake documents the source-backed First Edition
OS map workflow for Alloa. It deliberately does not add a selector entry until the
correct NLS sheets have been downloaded, their control points checked, and the
resulting raster has passed the validation gate.
