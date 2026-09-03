# England Editorial Research Standard

This standard separates **place discovery** from **published visitor advice**.
OpenStreetMap is useful for locating candidate places and practical facilities,
but it is not sufficient evidence for a finished `See`, `Eat`, parking or trail
card.

## Source Order

Use sources in this order wherever they exist:

1. Venue, attraction or trail operator.
2. Local authority, national body, official destination organisation or land manager.
3. Established walking, heritage, tourism or local-news source.
4. Current secondary listings and social pages, clearly marked as secondary evidence.
5. OpenStreetMap only for discovery, coordinates and a starting list of amenities.

Every researched fact must retain a URL and review date. Conflicting or unclear
facts remain `unconfirmed`; they are not filled by inference.

Evidence links and visitor websites are separate fields. OSM, Wikidata,
Wikipedia, Geograph, statutory designation records and mapping pages may be
retained as evidence, but they must never power the public `Open website`
button. Save an operator or genuinely visitor-helpful page in
`visitorWebsiteUrl`; if none exists, omit the button.

## Saved publication contract

A numeric score is public only when the record contains an
`editorialReview` with status `editorially_researched`, the current
`methodVersion`, a review date, concise rationale, opened evidence URLs and the
category's scoring dimensions. The app recalculates the score from those saved
dimensions at build/runtime. A mismatched, old-method or unreviewed score is not
published and cannot contribute to a town rating or Home recommendation.

During migration, an existing hand-curated legacy record may remain public
only when it has a boundary verification date, specific visitor copy, useful
opening and price information, and responsible non-mapping web evidence. This
compatibility rule does not mark the record fully reviewed: the audit continues
to queue it for conversion to the current scoring dimensions. Generated,
boilerplate, OSM-only and evidence-only records never qualify for this route.

Every public `See` and `Eat` card must also pass the shared runtime publication
gate. It requires a defensible score, a specific short highlight pill, useful
opening information, explicit price/free information, and a dated source-backed
dog policy. Attraction cards additionally require a realistic visit duration;
food cards require a consistent `£`/`££`/`£££` band and food style. Repeated
highlight pills within one town/category are rejected so each card has a
distinct editorial reason to exist.

The attraction formula totals 100:

- experience depth: 0-30;
- distinctiveness: 0-20;
- presentation and interpretation: 0-20;
- journey worth: 0-15;
- access and reliability: 0-10;
- evidence confidence: 0-5.

Visitability then caps historic-site scores: no visible remains `34`,
earthworks/site `44`, fragmentary remains `59`, substantial remains `84`, and
a full visitor experience may use the complete range. A castle name,
designation grade or historic association earns no points by itself.

The daytime food formula also totals 100:

- food and drink quality: 0-30;
- daytime relevance: 0-20;
- distinctiveness: 0-15;
- consistency: 0-15;
- visitor fit: 0-10;
- evidence confidence: 0-10.

## See

Search beyond historic registers. Consider museums, galleries, performance and
family venues, parks and gardens, nature reserves, beaches, lakes, waterways,
viewpoints, industrial heritage, visitor centres, boat trips, watersports,
amusement venues and other genuine daytime visitor experiences.

Each published card needs:

- an editorial score and recommendation;
- a specific visitor-facing reason to go;
- realistic time to spend;
- current opening pattern or an explicit source-backed open-access statement;
- current admission or a source-backed free statement;
- official/responsible website where available;
- a researched dog policy with 0-3 paws, restrictions and source;
- visitor facts appropriate to the place, including parking, toilets, picnic,
  food and named trails for standalone attractions.

Historic-list descriptions and generated phrases such as "nationally recorded
historic landmark" are research leads, not publishable tourist copy.

The attraction score must describe the experience available now. Before
scoring a castle, abbey, fort, archaeological site or ruin, establish whether
the visitor sees a staffed attraction, substantial remains, fragments,
earthworks or no visible remains. Do not turn historical importance into
visitor value without a visitable experience.

## Eat

Curate daytime coffee, cake, breakfast, brunch and lunch stops only. Do not use
an automatic OSM amenity score as an editorial score.

Each published card needs:

- a researched score and compact recommendation/tagline;
- current opening pattern;
- a consistent price band;
- food style and concise, specific visitor copy;
- official website or current responsible listing;
- a researched dog policy and source.

If dog access cannot be established, use `unconfirmed`; never infer it from
outdoor seating or a generic directory category.

Food research covers daytime coffee, cake, breakfast, brunch and lunch. Evening
restaurants, generic OSM amenities and review-volume guesses are not automatic
visitor recommendations.

## Parking

OSM may identify candidates, but the council/operator source must establish that
the car park is genuinely public and visitor-appropriate. Record:

- official name and location;
- free or paid status;
- current tariff where paid;
- payment methods;
- opening/access restrictions and maximum stay;
- capacity, accessible bays and EV provision when published;
- council/operator source and review date.

Customer-only, permit-only, loading, staff and private parking must not appear in
the public planner.

## Trails

Search the general web for every town, even when Treasure Trails has no product.
Queries should cover the town name with `walk`, `heritage trail`, `town trail`,
`circular walk`, `walking route`, `nature trail`, `art trail` and `treasure trail`.
Check destination sites, councils, land managers, walking providers, heritage
groups and downloadable route PDFs.

A mapped path is not automatically a visitor trail. A published trail needs a
responsible external link, score, route type, distance, duration and difficulty
where the source provides them. A no-trail result is valid only after the search
has been explicitly recorded.

## Completion Gate

`data/editorial-research-status.json` is the town/category sign-off ledger.
Individual public records also require the saved inline `editorialReview`
contract described above. A category is complete only after a human/editorial
web pass records:

- `status`: `complete` or `no_suitable_results`;
- `reviewedAt`;
- `searches`: the queries or source classes checked;
- `sourceUrls`: the strongest sources used;
- `notes`: exclusions, uncertainty and scope decisions.

Automated generation, an OSM import or a populated field alone never marks a
category complete.

## Batch Workflow

1. Run `npm run audit:england-editorial` to regenerate the strict gap report.
2. Run `npm run research:england-editorial-packets` to create a source-search
   packet for every English town, ordered by destination rating and gap count.
3. Research a controlled town batch from those packets. Retain accepted source
   URLs, rejected candidates and uncertainty notes; never publish search-result
   snippets as facts without opening the source.
4. Update the bundled project and curation records, then add an explicit category
   sign-off to `data/editorial-research-status.json`.
5. Re-run the audit. A category becomes complete only when its records have no
   strict gaps and the sign-off ledger records the completed web pass.

For a targeted batch, pass comma-separated project IDs:

`npm run research:england-editorial-packets -- --projects=ludlow-shropshire-england,cambridge-england`
