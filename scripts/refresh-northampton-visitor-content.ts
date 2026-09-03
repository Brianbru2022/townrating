import { booleanPointInPolygon, point } from '@turf/turf';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  HeritageFeature,
  ProjectPackage,
  VisitorHighlight,
} from '../src/domain/models';

const projectPath = resolve('data/projects/northampton-england.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const osmAuditPath = resolve('data/review/all-town-osm-visitor-sweep-2026-08-08.json');
const reviewPath = resolve('data/review/northampton-england-visitor-refresh-2026-08-09.json');
const reviewedAt = '2026-08-09T00:00:00Z';
const reviewedDate = '2026-08-09';

interface OsmCandidate {
  osmId: string;
  name: string;
  coordinates: [number, number];
  category: string;
  tags: Record<string, string>;
  osmUrl: string;
}

interface OsmAudit {
  towns: Array<{
    projectId: string;
    candidates: Record<string, OsmCandidate[]>;
  }>;
}

interface PlannerCurationFile {
  schemaVersion: number;
  description: string;
  projects: Record<string, Record<string, string[]>>;
}

interface CurrentPlaceInput {
  id: string;
  name: string;
  featureType: string;
  coordinates: [number, number];
  description: string;
  sourceName: string;
  sourceOrganisation: string;
  sourceUrl: string;
  sourceRecordId?: string;
  notes: string;
  tags: string[];
}

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curation = JSON.parse(await readFile(curationPath, 'utf8')) as PlannerCurationFile;
const osmAudit = JSON.parse(await readFile(osmAuditPath, 'utf8')) as OsmAudit;
const townAudit = osmAudit.towns.find((town) => town.projectId === pkg.project.id);
if (!townAudit) throw new Error(`No fresh OSM audit found for ${pkg.project.id}.`);

const candidateById = new Map<string, OsmCandidate>();
for (const candidates of Object.values(townAudit.candidates)) {
  for (const candidate of candidates) candidateById.set(candidate.osmId, candidate);
}

function addOrReplaceFeature(input: CurrentPlaceInput): HeritageFeature {
  const existing = pkg.features.find((feature) => feature.id === input.id);
  const feature: HeritageFeature = {
    id: input.id,
    projectId: pkg.project.id,
    name: input.name,
    alternativeNames: existing?.alternativeNames ?? [],
    countryCode: 'GB-ENG',
    region: 'Northamptonshire',
    locality: 'Northampton',
    featureType: input.featureType,
    significance: existing?.significance ?? 'local',
    geometry: { type: 'Point', coordinates: input.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: existing?.dateBasis ?? 'unknown',
    dateConfidence: existing?.dateConfidence ?? 'unknown',
    survival: existing?.survival ?? 'substantially_intact',
    shortDescription: input.description,
    sourceRecords: [
      ...(existing?.sourceRecords ?? []).filter(
        (source) =>
          source.sourceName !== input.sourceName &&
          source.sourceName !== 'OpenStreetMap current community places',
      ),
      {
        sourceName: input.sourceName,
        sourceOrganisation: input.sourceOrganisation,
        sourceRecordId: input.sourceRecordId ?? input.id,
        sourceUrl: input.sourceUrl,
        accessedAt: reviewedAt,
        reliability:
          input.sourceOrganisation === 'OpenStreetMap contributors'
            ? 'discovery_only'
            : 'official_non_statutory',
        licence:
          input.sourceOrganisation === 'OpenStreetMap contributors'
            ? 'Original editorial summary and factual visitor metadata; linked OpenStreetMap content is not redistributed.'
            : 'Original editorial summary and factual visitor metadata; linked source content is not redistributed.',
        notes: input.notes,
      },
    ],
    tags: [...new Set([...(existing?.tags ?? []), ...input.tags])].filter(
      (tag) => tag !== 'home-standalone-place',
    ),
    createdAt: existing?.createdAt ?? reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: `Northampton visitor content and active-boundary inclusion reviewed ${reviewedDate}.`,
    evidenceScope: 'related_context',
    licence:
      'Original editorial summary and factual visitor metadata; linked source content is not redistributed.',
  };

  if (existing) Object.assign(existing, feature);
  else pkg.features.push(feature);
  return feature;
}

function fromOsm(
  osmId: string,
  input: Omit<CurrentPlaceInput, 'id' | 'coordinates' | 'sourceUrl' | 'sourceRecordId'> & {
    sourceUrl?: string;
  },
): HeritageFeature {
  const candidate = candidateById.get(osmId);
  if (!candidate) throw new Error(`Missing fresh OSM candidate ${osmId}.`);
  return addOrReplaceFeature({
    ...input,
    id: `osm-community:${osmId.replace('/', '-')}`,
    coordinates: candidate.coordinates,
    sourceUrl: input.sourceUrl ?? candidate.osmUrl,
    sourceRecordId: osmId,
  });
}

const visitorTags = [
  'northampton-visitor-refresh',
  'current-context',
  'service-context-visitor',
  'osm-current-place',
];
const foodTags = [
  'northampton-visitor-refresh',
  'current-context',
  'service-context-food',
  'visitor-context-food',
  'osm-current-place',
];
const picnicTags = [
  'northampton-visitor-refresh',
  'current-context',
  'service-context-picnic',
  'osm-current-place',
];

const parkFeatures = [
  addOrReplaceFeature({
    id: 'curated-attraction:northampton-abington-park',
    name: 'Abington Park',
    featureType: 'park',
    coordinates: [-0.8628827, 52.2465483],
    description:
      "Northampton's oldest and most popular park combines lakes, flower displays, a museum, a cafe and traces of a medieval village.",
    sourceName: 'Abington Park visitor information',
    sourceOrganisation: 'West Northamptonshire Council',
    sourceUrl: 'https://www.westnorthants.gov.uk/major-parks/abington-park',
    notes:
      'tourism=attraction; visitor_place_type=Historic public park; entrance_fee=Free; opening_hours:description=Public park; visit in daylight; toilets=yes; cafe=yes; visit_score=72.',
    tags: visitorTags,
  }),
  addOrReplaceFeature({
    id: 'curated-attraction:northampton-racecourse',
    name: 'The Racecourse',
    featureType: 'park',
    coordinates: [-0.8885556, 52.248706],
    description:
      'A broad historic urban park with tree-lined paths, sports space and room for an easy walk just north of the centre.',
    sourceName: 'Northampton parks directory',
    sourceOrganisation: 'West Northamptonshire Council',
    sourceUrl:
      'https://www.westnorthants.gov.uk/directory/local-offer/438f3f4f-828d-4fc4-940a-6228eb320477',
    notes:
      'tourism=attraction; visitor_place_type=Historic urban park; entrance_fee=Free; opening_hours:description=Public park; visit in daylight; visit_score=64.',
    tags: visitorTags,
  }),
  addOrReplaceFeature({
    id: 'curated-attraction:northampton-beckets-park',
    name: "Becket's Park",
    featureType: 'park',
    coordinates: [-0.8892816, 52.2336394],
    description:
      'A riverside green beside the marina and university, useful for a quiet pause or a short River Nene walk from the centre.',
    sourceName: 'Northampton parks directory',
    sourceOrganisation: 'West Northamptonshire Council',
    sourceUrl:
      'https://www.westnorthants.gov.uk/directory/local-offer/438f3f4f-828d-4fc4-940a-6228eb320477',
    notes:
      'tourism=attraction; visitor_place_type=Riverside public park; entrance_fee=Free; opening_hours:description=Public park; visit in daylight; visit_score=62.',
    tags: visitorTags,
  }),
];

const queenEleanorCross = fromOsm('node/1214239638', {
  name: 'Queen Eleanor Cross',
  featureType: 'monument',
  description:
    "One of only three surviving Eleanor Crosses, this medieval monument is Northampton's strongest outdoor heritage stop beyond the centre.",
  sourceName: 'Northampton Eleanor Cross visitor research',
  sourceOrganisation: 'Northampton Museums and Art Gallery',
  sourceUrl: 'https://www.northamptonmuseums.com/info/6/visit/152/eleanor-cross-study-day/7',
  notes:
    'tourism=attraction; visitor_place_type=Medieval monument; entrance_fee=Free; opening_hours:description=Outdoor monument with no formal opening hours; visit_score=77.',
  tags: visitorTags,
});

const stortonsPits = fromOsm('way/490380180', {
  name: "Storton's Pits Local Nature Reserve",
  featureType: 'park',
  description:
    'Former gravel workings beside the River Nene now form a meadow, wetland and fen-ditch nature reserve for a quieter local walk.',
  sourceName: "Storton's Pits current mapping",
  sourceOrganisation: 'OpenStreetMap contributors',
  notes:
    'leisure=nature_reserve; visitor_place_type=Local nature reserve; entrance_fee=Free; opening_hours:description=Open-air reserve; visit in daylight; visit_score=60.',
  tags: visitorTags,
});

const currentFeatureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
const requiredExistingIds = [
  'osm-community:way-647173095',
  'historic-england:nhle:1039791',
  'osm-community:way-59194378',
  'osm-community:way-90607742',
  'historic-england:nhle:1052407',
  'historic-england:nhle:1052399',
  'historic-england:nhle:1052417',
  'standalone-attraction:hunsbury-hill-country-park',
  'historic-england:nhle:1372129',
  'historic-england:nhle:1293593',
  'historic-england:nhle:1052403',
  'historic-england:nhle:1031518',
  'historic-england:nhle:1371878',
];
for (const id of requiredExistingIds) {
  if (!currentFeatureById.has(id)) throw new Error(`Missing required Northampton feature ${id}.`);
}

const hunsbury = currentFeatureById.get('standalone-attraction:hunsbury-hill-country-park');
if (hunsbury) {
  hunsbury.tags = [...new Set([...hunsbury.tags, 'northampton-visitor-refresh'])].filter(
    (tag) => tag !== 'home-standalone-place',
  );
  hunsbury.shortDescription =
    'Woodland paths, broad views and the earthworks of an Iron Age hillfort make this the city’s strongest combined green-space and archaeology stop.';
  hunsbury.updatedAt = reviewedAt;
}

const highlights: VisitorHighlight[] = [
  [1, 'osm-community:way-647173095', '78 Derngate', 90, 'Mackintosh masterpiece', 'Charles Rennie Mackintosh’s only major English domestic commission is an exceptional architecture and design visit.', 'https://www.78derngate.org.uk/'],
  [2, 'historic-england:nhle:1039791', 'Delapré Abbey', 87, 'Abbey and parkland', 'A restored historic house and abbey set in extensive parkland, with exhibitions, gardens and a strong daytime food offer.', 'https://delapreabbey.org/'],
  [3, 'osm-community:way-59194378', 'Northampton Museum and Art Gallery', 86, 'World-class shoe collection', 'The internationally important shoe collection and local galleries make this the city’s essential museum.', 'https://www.northamptonmuseums.com/'],
  [4, 'osm-community:way-90607742', 'Abington Park Museum', 80, 'Museum in the park', 'A compact local-history museum in a 500-year-old manor house, paired naturally with a walk around Abington Park.', 'https://www.northamptonmuseums.com/info/6/visit/8/abington-park-museum'],
  [5, 'historic-england:nhle:1052407', 'The Holy Sepulchre Church', 78, 'Rare round church', 'One of England’s few surviving medieval round churches and a distinctive part of Northampton’s skyline.', 'https://www.holysepulchre.co.uk/'],
  [6, queenEleanorCross.id, 'Queen Eleanor Cross', 77, 'Medieval royal monument', queenEleanorCross.shortDescription, 'https://www.northamptonmuseums.com/info/6/visit/152/eleanor-cross-study-day/7'],
  [7, 'historic-england:nhle:1052399', 'Northampton Guildhall', 75, 'Victorian civic landmark', 'A richly detailed Gothic Revival civic building that gives the centre architectural drama.', 'https://www.westnorthants.gov.uk/'],
  [8, 'historic-england:nhle:1052417', "St Peter's Church", 74, 'Norman stonework', 'A nationally important Norman church whose carved stonework rewards a close architectural look.', 'https://historicengland.org.uk/listing/the-list/list-entry/1052417'],
  [9, 'standalone-attraction:hunsbury-hill-country-park', 'Hunsbury Hill Country Park', 73, 'Hillfort and woodland', hunsbury?.shortDescription ?? 'Woodland and Iron Age earthworks on Northampton’s southern ridge.', 'https://www.westnorthants.gov.uk/directory/local-offer/438f3f4f-828d-4fc4-940a-6228eb320477'],
  [10, parkFeatures[0].id, 'Abington Park', 72, 'Lakes, gardens and history', parkFeatures[0].shortDescription, 'https://www.westnorthants.gov.uk/major-parks/abington-park'],
  [11, 'historic-england:nhle:1372129', 'All Saints Church', 70, 'Town-centre landmark', 'A prominent rebuilt church and terrace overlooking the Market Square.', 'https://www.allsaintsnorthampton.co.uk/'],
  [12, 'historic-england:nhle:1293593', 'Northampton Market Square', 68, 'Historic market', 'One of England’s largest market squares remains the civic heart of the centre.', 'https://www.westnorthants.gov.uk/northampton-market'],
  [13, 'historic-england:nhle:1052403', "St Giles' Church", 66, 'Medieval parish church', 'A substantial medieval church with a long town-centre story and an attractive churchyard setting.', 'https://historicengland.org.uk/listing/the-list/list-entry/1052403'],
  [14, parkFeatures[1].id, 'The Racecourse', 64, 'Broad urban park', parkFeatures[1].shortDescription, 'https://www.westnorthants.gov.uk/directory/local-offer/438f3f4f-828d-4fc4-940a-6228eb320477'],
  [15, parkFeatures[2].id, "Becket's Park", 62, 'Riverside pause', parkFeatures[2].shortDescription, 'https://www.westnorthants.gov.uk/directory/local-offer/438f3f4f-828d-4fc4-940a-6228eb320477'],
  [16, stortonsPits.id, "Storton's Pits Local Nature Reserve", 60, 'Wetland nature walk', stortonsPits.shortDescription, stortonsPits.sourceRecords[0]?.sourceUrl ?? 'https://www.openstreetmap.org/way/490380180'],
  [17, 'historic-england:nhle:1031518', 'National Lift Tower', 58, 'Skyline landmark', 'A striking 127-metre test tower and modern Northampton landmark, best appreciated from the surrounding streets and parks.', 'https://www.nationallifttower.co.uk/'],
  [18, 'historic-england:nhle:1371878', 'Northampton Castle Postern Gate', 55, 'Last castle fragment', 'The surviving postern gate and wall mark the footprint of Northampton’s lost royal castle beside the railway.', 'https://historicengland.org.uk/listing/the-list/list-entry/1371878'],
].map(([rank, featureId, name, visitorScore, tagline, reason, sourceUrl]) => ({
  rank: rank as number,
  featureId: featureId as string,
  name: name as string,
  visitorScore: visitorScore as number,
  tagline: tagline as string,
  reason: reason as string,
  sourceName: 'Northampton visitor research',
  sourceUrl: sourceUrl as string,
  verifiedInBoundaryAt: reviewedDate,
}));
pkg.project.visitorHighlights = highlights;

const foodInputs = [
  ['node/5154220425', 'The Good Loaf', 86, '££', 'Artisan bakery cafe', 'Hand-crafted bread, local ingredients and a social-enterprise mission make this the city’s most distinctive daytime cafe.', 'https://thegoodloaf.co.uk/locations/overstone-road/', 'opening_hours:description=Tuesday-Friday 09:00-14:30; Saturday 08:30-14:30'],
  ['node/5148481659', 'Saints on St Giles', 83, '££', 'Independent brunch stop', 'An independent St Giles Street cafe for coffee, brunch and cakes in the most appealing part of the centre.', undefined, ''],
  ['node/5153725323', 'Matchbox Cafe', 82, '£', 'Central coffee stop', 'A compact independent cafe close to the Market Square for coffee, cake and a light lunch.', undefined, ''],
  ['node/6581745490', 'The Orangery', 81, '££', 'Abbey cafe', 'A relaxed cafe in Delapré Abbey’s grounds, well placed for lunch or cake alongside the abbey and park.', 'https://delapreabbey.org/', ''],
  ['way/928841806', 'The Park Café', 80, '£', 'Park cafe', 'Drinks, snacks and full daytime meals beside Abington Park’s lakes, museum and gardens.', 'https://www.westnorthants.gov.uk/major-parks/abington-park', 'opening_hours:description=Monday-Friday 09:00-17:00; Saturday-Sunday 09:00-18:00'],
  ['way/1126808208', 'Cafe 1850', 79, '££', 'Heritage-quarter cafe', 'A useful independent daytime stop in the historic Boot and Shoe Quarter.', undefined, ''],
  ['node/13954043600', "Genevieve's", 78, '££', 'Neighbourhood cafe', 'A polished neighbourhood cafe and deli for breakfast, lunch, coffee and cakes on the western side of town.', 'https://www.genevievescafe.com/', ''],
  ['node/5175455160', 'The Bread and Butter Factory', 77, '£', 'Bakery lunch', 'A local bakery cafe for filled rolls, baked treats and an unfussy daytime stop.', undefined, ''],
  ['node/853127167', 'All Saints Bistro', 76, '££', 'Market-square lunch', 'A central bistro stop by All Saints and the Market Square, convenient for a museum-and-heritage day.', undefined, ''],
  ['node/5642658982', 'Brewsta', 75, '£', 'Local coffee stop', 'A small local cafe for coffee and a straightforward daytime bite east of the centre.', undefined, ''],
  ['way/803824626', 'Zapato Lounge', 74, '££', 'All-day brunch', 'An all-day cafe-bar with brunch and lighter lunch choices beside the Market Square.', 'https://thelounges.co.uk/zapato/', 'opening_hours:description=Sunday-Wednesday 09:00-23:00; Thursday-Saturday 09:00-midnight'],
] as const;

const eatIds: string[] = [];
for (const [osmId, name, score, price, tagline, description, website, opening] of foodInputs) {
  const candidate = candidateById.get(osmId);
  if (!candidate) throw new Error(`Missing food candidate ${osmId}.`);
  const feature = fromOsm(osmId, {
    name,
    featureType: candidate.tags.amenity === 'restaurant' ? 'restaurant' : 'cafe',
    description,
    sourceName: 'OpenStreetMap current community places',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: website,
    notes: [
      'Current daytime food curation:',
      `amenity=${candidate.tags.amenity ?? 'cafe'}`,
      `visit_score=${score}`,
      `price_band=${price}`,
      `tagline=${tagline}`,
      `description=${description}`,
      opening,
      website ? `website=${website}` : '',
    ]
      .filter(Boolean)
      .join('; '),
    tags: foodTags,
  });
  eatIds.push(feature.id);
}

for (const [id, score, tagline, description] of [
  ['osm-community:node-13521665732', 73, 'Neighbourhood brunch', 'A friendly neighbourhood cafe for sandwiches, cakes and brunch west of the centre.'],
  ['osm-community:node-5204644871', 72, 'Village coffee stop', 'A small independent coffee shop for a simple daytime pause in Duston.'],
  ['osm-community:node-5196661101', 70, 'Outdoor cafe', 'An informal cafe with outdoor seating for coffee and a light daytime stop.'],
  ["osm-community:node-5633797010", 68, 'Cake and coffee', 'A central independent cafe for coffee, cake and a light lunch.'],
] as const) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing retained Northampton cafe ${id}.`);
  const source = feature.sourceRecords[0];
  if (!source) throw new Error(`Missing current-place source for Northampton cafe ${id}.`);
  const sourceDetails = (source.notes ?? '')
    .replace(/^Current daytime food curation:?\s*/i, '')
    .replace(/;\s*visit_score=.*$/i, '')
    .replace(/\s*\.$/, '');
  feature.shortDescription = description;
  source.notes = `Current daytime food curation: ${sourceDetails}; visit_score=${score}; price_band=£; tagline=${tagline}; description=${description}`;
  feature.tags = [...new Set([...feature.tags, ...foodTags])];
  feature.updatedAt = reviewedAt;
  eatIds.push(id);
}

const picnicGroups = [
  {
    id: 'osm-community:node-12208552991',
    name: "St Crispin's Square picnic tables",
    coordinates: [-0.9422308, 52.2337688] as [number, number],
    description: "A cluster of public picnic tables around The Square in St Crispin's.",
    osmId: 'node/12208552991',
  },
  {
    id: 'osm-community:node-12436895356',
    name: 'Marina Park picnic tables',
    coordinates: [-0.94942, 52.2388323] as [number, number],
    description: 'Public picnic tables by Marina Park and Kent Road South.',
    osmId: 'node/12436895356',
  },
  {
    id: 'osm-community:node-5339202724',
    name: 'York Way and Harlestone picnic table',
    coordinates: [-0.9542692, 52.2636827] as [number, number],
    description: 'A public picnic table beside York Way on the Harlestone edge of Northampton.',
    osmId: 'node/5339202724',
  },
];
const picnicIds = picnicGroups.map((place) =>
  addOrReplaceFeature({
    id: place.id,
    name: place.name,
    featureType: 'picnic_site',
    coordinates: place.coordinates,
    description: place.description,
    sourceName: 'OpenStreetMap current community places',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: `https://www.openstreetmap.org/${place.osmId}`,
    sourceRecordId: place.osmId,
    notes: `tourism=picnic; access=public; description=${place.description}`,
    tags: picnicTags,
  }),
).map((feature) => feature.id);

const projectCuration = (curation.projects[pkg.project.id] ??= {});
projectCuration.eat = eatIds;
projectCuration.picnic = picnicIds;

const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
const publishedIds = new Set([
  ...highlights.map((highlight) => highlight.featureId),
  ...Object.values(projectCuration).flat(),
]);
const outsideBoundary: string[] = [];
for (const id of publishedIds) {
  const feature = featureById.get(id);
  const geometry = feature?.geometry;
  if (!geometry || geometry.type !== 'Point') {
    outsideBoundary.push(`${id} (missing or not a point)`);
    continue;
  }
  if (!booleanPointInPolygon(point(geometry.coordinates), pkg.project.boundary)) {
    outsideBoundary.push(id);
  }
}
if (outsideBoundary.length) {
  throw new Error(`Public Northampton places outside active boundary: ${outsideBoundary.join(', ')}`);
}

const notes = pkg.project.researchNotes ?? '';
const refreshSentence =
  'Northampton visitor-content refresh completed 2026-08-09 after the active visitor boundary was corrected: generic low-value highlights and chain-heavy food entries were replaced with source-backed parks, heritage, nature and independent daytime food stops; repeated OSM picnic tables were consolidated into named locations.';
pkg.project.researchNotes = notes.includes(refreshSentence)
  ? notes
  : `${notes} ${refreshSentence}`.trim();

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(curationPath, `${JSON.stringify(curation, null, 2)}\n`, 'utf8');
await writeFile(
  reviewPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      boundaryRule: 'All public town-planner places must be inside the active curated visitor boundary.',
      changes: {
        visitorHighlights: highlights.length,
        daytimeFood: eatIds.length,
        picnicLocations: picnicIds.length,
        removedGenericHighlights: 12,
      },
      parklandAddedToSee: parkFeatures.map((feature) => feature.name),
      publishedIdsChecked: publishedIds.size,
      outsideBoundary,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Refreshed Northampton: ${highlights.length} See, ${eatIds.length} Eat and ${picnicIds.length} named picnic locations; ${publishedIds.size} public markers checked inside the active boundary.`,
);
