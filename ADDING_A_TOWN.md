# Adding a town

Developers create a source-backed project package with a reviewed boundary, centre, CRS, methodology, and source register. Import and validate authorised data, map it to the neutral schema, seed PostGIS, then deploy. Public visitors cannot add or edit towns or records.

For a Scottish parish project, begin with the National Records of Scotland civil-parish dataset rather than drawing a boundary from OpenStreetMap. Import HES listed buildings, selected statutory polygons and NRHE records into the same package, preserving official source identifiers. Consolidate multi-point listed-building components into one statutory record and review point-location collisions before publishing.

Historic maps must remain publisher-hosted or pass the georeferencing intake: confirmed reuse terms, an authorised local image, at least four independently checked control points and a reviewed EPSG:3857 output. A map catalogue entry is not permission to publish imagery.

Only publish settlement-age polygons with explicit cited evidence and a reviewed geometry. A parish or conservation-area boundary is a study extent, not a historic settlement footprint.

## Visitor planner completion gate

Every new town must complete the visitor audit before it is added to `publishedProjectPackages`:

- preserve the official or source boundary for provenance, then record any curated visitor-boundary adjustment separately;
- verify every public planner item against the active visitor polygon;
- curate up to 20 genuine visitor attractions for `See` and up to 20 current food and drink places for `Eat`;
- include every reviewed in-boundary trail, public picnic place, visitor-relevant car park and public toilet, with no arbitrary display cap;
- treat `amenity=parking` as a research candidate, not proof of a publishable visitor car park;
- publish parking only when a meaningful name plus public access, a public operator, charging/capacity data or equivalent visitor-use evidence makes its status defensible;
- reject private, customer-only, resident, permit, staff, venue and specialist parking, unnamed OSM polygons, generated numbered parking labels and duplicate facilities;
- treat a parking list over 20 as a mandatory manual-review warning, not as permission to cap a genuine list;
- replace generic practical names such as `Parking`, `Public toilets` and `Picnic table` with a checked street, park or landmark location;
- retain current opening, price, access, operator and dog-access details where a defensible source exists;
- run `npm run audit-online-trails` after publishing the town; this checks the full current Treasure Trails catalogue, the bundled verified-route registry and any completed place-specific wider-web research already in the evidence cache;
- do not treat Treasure Trails as the trail catalogue: also check councils, destination organisations, civic and heritage societies, Ramblers/LDWA or another established walking provider; add verified non-commercial routes to `data/trail-source-registry.json`, then run `npm run apply-verified-trails`;
- treat every discovered route as a research candidate, not as polygon proof: open the route description or map, verify its full visitor experience against the active town boundary, and record an in-boundary approval or exclusion;
- never interpret `no_online_match_found` as proof that no trail exists; manually check the report's wider official-source queries before recording a reviewed no-trail outcome;
- use `npm run research-town-trails -- --projects=<project-id>` for an individual town, or `npm run research-town-trails -- --batch-start=<n> --batch-size=<small-n>` for a controlled search; each researched town records separate heritage-trail, town-trail, council/civic heritage-walk, established walking-provider, Treasure Trails and official-source queries, and partial failures remain visible;
- add an in-boundary Treasure Trail to `trails`, not `See`, and link to the current product page without redistributing commercial clue content.

Run `npm run audit:parking -- --write` after importing or regenerating town POIs. Commit the generated `data/review/public-visitor-parking-audit-2026-08-12.json` report with the updated curation library. An empty reviewed parking list is preferable to publishing unverified OSM geometry.

The public planner shows at most 20 `See` and 20 `Eat` entries. `Trails`, `Picnic`, `Parking` and `Toilets` show all bundled reviewed entries. A low count is acceptable only when the audit found no additional defensible in-boundary places; do not pad a category with weak, generic or nearby-outside records.

## Default town tourist rating

Use the shared policy in `src/domain/townRating.ts`; do not assign a star level by intuition, an OSM count or a town-specific override. Complete the web research contract in `docs/ENGLAND_EDITORIAL_RESEARCH_STANDARD.md` before treating a generated or legacy rating as re-certified:

- `0 - Not a tourist town`: minor heritage records, ordinary amenities or one modest site cluster;
- `1 - Local detour`: at least one independent attraction scoring 75+, or two genuinely independent attractions scoring 60+;
- `2 - Worth a planned stop`: an 85+ anchor, at least two 70+ attractions and enough independent 60+ attraction or 75+ trail depth for a coherent half day;
- `3 - Destination draw`: a 90+ highlight, at least three 80+ attractions and enough 70+ attraction or 80+ trail depth for most of a day.

Food, parking, toilets, picnic provision and other practical amenities can support a visit but never create a town rating. A trail contributes to depth only when it has an explicit numeric score and a responsible non-OpenStreetMap route link. A mapped path alone does not count, and trails cannot create a rating of `1` without qualifying attractions.

Run `npm run apply-town-rating-policy` after changing town visitor highlights or trails. Commit the generated `data/review/town-rating-policy-audit-2026-08-09.json` report with the affected project files.

During migration, the runtime preserves an existing town classification when
no current-method editorial attraction or trail evidence exists. This is only a
guard against falsely turning `not yet reassessed` into `0 - Not a tourist
town`; it is not editorial approval. The town remains in the research queue
until its `See`, `Eat`, trails, practical categories and town rating are signed
off in `data/editorial-research-status.json`.
## Town character subtitle

Every town guide displays one concise character line directly beneath the town name, such as
`Traditional seaside town` or `Victorian harbour town`. Add a researched `townGuide.characterTag`
where possible. Keep it factual, distinctive and preferably under 55 characters. If it is omitted,
the app supplies a conservative descriptor from the town's curated visitor and heritage data.
