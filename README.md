# Historic Town Explorer

A self-hosted, source-backed public explorer for historical town projects. The repository contains curated public packages for Alloa, Alva, Culross, Kincardine-on-Forth, Tillicoultry, Quarrier's Village, Biggar and Killin, together with the repeatable import and review tooling used to create them.

## Quick start

`npm install`, optionally copy `.env.example` to `.env`, then run `npm run dev`. The map uses OpenStreetMap raster tiles by default for local development; configure a permitted self-hosted map style for production traffic. Run `npm run api` in another terminal for the read-only API. `npm run validate-data`, `npm run lint`, `npm run test`, and `npm run build` validate the workspace.

Historic-map overlays use locally built MBTiles rather than a MapTiler browser key. The read-only API serves approved packages from `data/runtime/tiles`; the optional Docker `tiles` profile remains available for larger future map collections. Use `npm run check-local-historic-maps`, review the four control points in the intake manifest, run `npm run prepare-local-historic-map -- <manifest>`, and finally run `npm run publish-local-historic-maps`.

Use `docker compose up --build` for the web/API/PostGIS stack. Add the `tiles` and `geocoder` profiles only after supplying lawful OSM extracts and indexes.

See [ARCHITECTURE.md](ARCHITECTURE.md), [ADDING_A_TOWN.md](ADDING_A_TOWN.md), and [DEPLOYMENT.md](DEPLOYMENT.md).

## Reference data

The versioned `data/reference/scotland-hes-library.zip` archive is the local HES source collection used by the Scottish import commands. Extract it to `data/reference/scotland-hes/` after cloning. It remains source data rather than published app payload: `data/projects/` holds the curated town records and `data/runtime/` remains local deployment output.

See [the HES library register](data/reference/SCOTLAND_HES_LIBRARY.md) for provenance, permitted use and the expected local paths.
