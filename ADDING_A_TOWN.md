# Adding a town

Developers create a source-backed project package with a reviewed boundary, centre, CRS, methodology, and source register. Import and validate authorised data, map it to the neutral schema, seed PostGIS, then deploy. Public visitors cannot add or edit towns or records.

For a Scottish parish project, begin with the National Records of Scotland civil-parish dataset rather than drawing a boundary from OpenStreetMap. Import HES listed buildings, selected statutory polygons and NRHE records into the same package, preserving official source identifiers. Consolidate multi-point listed-building components into one statutory record and review point-location collisions before publishing.

Historic maps must remain publisher-hosted or pass the georeferencing intake: confirmed reuse terms, an authorised local image, at least four independently checked control points and a reviewed EPSG:3857 output. A map catalogue entry is not permission to publish imagery.

Only publish settlement-age polygons with explicit cited evidence and a reviewed geometry. A parish or conservation-area boundary is a study extent, not a historic settlement footprint.
