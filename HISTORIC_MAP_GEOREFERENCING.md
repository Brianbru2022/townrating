# Historic map georeferencing

Curators enter and confirm ground-control points; no automatic points are accepted. Record transformation, residual error, count, source, date semantics, attribution, licence, and bounds. Use `gdal_translate`, `gdalwarp -t_srs EPSG:3857`, and `gdal2tiles` in a repeatable logged job. Four-corner overlays are temporary, approximate layers and must be labelled as such.
