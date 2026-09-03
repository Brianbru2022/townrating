import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  AttractionGuide,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
  VisitorHighlight,
} from '../src/domain/models';

const projectId = 'ludlow-shropshire-england';
const reviewedAt = '2026-08-13T00:00:00.000Z';
const reviewedDate = '2026-08-13';
const projectPath = resolve('data/projects/ludlow-shropshire-england.json');
const plannerPath = resolve('data/visitor-planner-curation.json');
const dogPath = resolve('data/dog-access-curation.json');
const trailRegistryPath = resolve('data/trail-source-registry.json');
const evidencePath = resolve('data/research/england/ludlow-shropshire-england-2026-08-13.json');

interface PlannerCuration {
  schemaVersion: number;
  projects: Record<string, Record<string, string[] | undefined>>;
}

interface DogAccessRecord {
  rating: number;
  status: string;
  label: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  reviewedAt: string;
}

interface DogAccessCuration {
  projects: Record<
    string,
    {
      attraction?: Record<string, DogAccessRecord>;
      eat?: Record<string, DogAccessRecord>;
    }
  >;
  [key: string]: unknown;
}

interface TrailRegistryEntry {
  projectId: string;
  projectFile: string;
  featureId: string;
  name: string;
  provider: string;
  url: string;
  sourceTier: string;
  score: number;
  boundaryStatus: string;
  coordinates: [number, number];
  shortDescription: string;
  trailType: string;
  distance?: string;
  timeToSpend?: string;
  difficulty?: string;
  accessibility?: string;
  entranceFee?: string;
  sourceRecordId: string;
  licence: string;
  reliability: string;
  reviewNotes: string;
}

interface TrailRegistry {
  schemaVersion: number;
  description: string;
  trails: TrailRegistryEntry[];
}

function source(
  sourceName: string,
  sourceOrganisation: string,
  sourceRecordId: string,
  sourceUrl: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'official_non_statutory',
): SourceRecord {
  return {
    sourceName,
    sourceOrganisation,
    sourceRecordId,
    sourceUrl,
    accessedAt: reviewedAt,
    reliability,
    licence: 'Original editorial summary and factual visitor metadata; linked source content is not redistributed.',
    notes,
  };
}

function upsertSource(feature: HeritageFeature, record: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (candidate) => candidate.sourceRecordId !== record.sourceRecordId,
    ),
    record,
  ];
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

function requiredFeature(pkg: ProjectPackage, id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Ludlow feature ${id}.`);
  return feature;
}

function updateAttraction(
  pkg: ProjectPackage,
  definition: {
    id: string;
    name: string;
    description: string;
    guide: AttractionGuide;
    sourceRecord: SourceRecord;
  },
): void {
  const feature = requiredFeature(pkg, definition.id);
  feature.name = definition.name;
  feature.shortDescription = definition.description;
  feature.attractionGuide = definition.guide;
  feature.reviewNotes = `Visitor editorial and current planning information reviewed from the named operator or responsible body on ${reviewedDate}.`;
  upsertSource(feature, definition.sourceRecord);
}

function trailFeature(definition: TrailRegistryEntry): HeritageFeature {
  const metadata = [
    'route=foot',
    `name=${definition.name}`,
    `trail_type=${definition.trailType}`,
    `trail_score=${definition.score}`,
    definition.distance ? `distance=${definition.distance}` : undefined,
    definition.timeToSpend ? `duration=${definition.timeToSpend}` : undefined,
    `difficulty=${definition.difficulty ?? 'Check the published route guide'}`,
    `entrance_fee=${definition.entranceFee ?? 'Free'}`,
    `description=${definition.shortDescription}`,
    `external_url=${definition.url}`,
  ].filter(Boolean);
  return {
    id: definition.featureId,
    projectId,
    name: definition.name,
    alternativeNames: [],
    countryCode: 'GB-ENG',
    region: 'Shropshire',
    locality: 'Ludlow',
    featureType: 'walking_route',
    significance: definition.score >= 80 ? 'recognised' : 'local',
    geometry: { type: 'Point', coordinates: definition.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: definition.shortDescription,
    sourceRecords: [
      source(
        definition.name,
        definition.provider,
        definition.sourceRecordId,
        definition.url,
        `Current-place curation: ${metadata.join('; ')}.`,
      ),
    ],
    licence: definition.licence,
    tags: [
      'current-context',
      'curated-trail-place',
      'service-context-walk',
      'service-context-visitor',
      'visitor-context-trail',
    ],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: definition.reviewNotes,
    evidenceScope: 'related_context',
  };
}

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as PlannerCuration;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as DogAccessCuration;
const registry = JSON.parse(await readFile(trailRegistryPath, 'utf8')) as TrailRegistry;

pkg.project.touristAppeal = {
  rating: 3,
  label: 'Destination draw',
  summary:
    'Ludlow earns destination status through a rare combination of a major medieval castle, an outstanding parish church, a coherent historic centre, independent food culture and strong walks from the town itself.',
};
pkg.project.townGuide = {
  headline: 'A medieval hill town built for slow wandering and serious appetites',
  intro:
    "Ludlow's castle, market streets and riverside paths form one of England's most satisfying compact town visits. Start with the fortress and St Laurence's, browse the market and independent shops, then descend to the River Teme for a different view of the old town.",
  bestFor: ['Medieval history', 'Independent food', 'Markets and festivals', 'Riverside walks'],
  perfectFor: ['A full heritage day', 'Food-led short breaks', 'Walkers who like history with scenery'],
  suggestedFirstVisit: {
    title: "Castle, market and St Laurence's",
    summary:
      "Begin at Ludlow Castle, cross Castle Square for the market, visit St Laurence's and finish with the Breadwalk or Millennium Green if time and weather allow.",
  },
  dontMiss: ['Ludlow Castle', "St Laurence's Church", 'The market and Butter Cross', 'The Whitcliffe and Breadwalk views'],
  suggestedTime: 'Full day',
  visitorMood: 'A richly layered historic town where the streets, food and river setting are part of the attraction.',
  sourceUrls: [
    'https://www.ludlow.gov.uk/visit-ludlow',
    'https://www.ludlowcastle.com/visit-us/opening-times-prices-book-tickets/',
    'https://stlaurences.org.uk/visit-us/',
    'https://www.ludlowmuseum.co.uk/visit-us',
    'https://www.ludlow.org.uk/walking.html',
  ],
  lastReviewedAt: reviewedDate,
};

const castleId = 'historic-england:nhle:1004778';
const churchId = 'historic-england:nhle:1202794';
const museumId = 'osm-community:node-12556918877';
const butterCrossId = 'historic-england:nhle:1289674';

updateAttraction(pkg, {
  id: castleId,
  name: 'Ludlow Castle',
  description:
    'Explore substantial medieval ruins, towers, courtyards and viewpoints at the landmark that gives Ludlow its dramatic historic centre.',
  guide: {
    headline: 'The essential Ludlow visit',
    intro:
      'A remarkably complete castle complex with Norman, medieval and Tudor layers, broad views and enough surviving spaces to reward an unhurried visit.',
    motifs: ['Medieval fortress', 'Panoramic views', 'Royal history'],
    bestFor: ['Castle enthusiasts', 'Families', 'Photography'],
    foodNote: 'The Castle Cafe has indoor seating and a dog-friendly terrace; check current service before travelling.',
    toilets: 'Visitor toilets are available within the castle complex.',
    thingsToDo: [
      { name: 'Climb the surviving towers for views across Ludlow' },
      { name: 'Trace the Norman keep and medieval inner bailey' },
      { name: 'Explore the round chapel and royal apartments' },
      { name: 'Look across the roofs to the Shropshire Hills' },
      { name: 'Pause in the courtyards and castle grounds' },
    ],
  },
  sourceRecord: source(
    'Ludlow Castle visitor information',
    'Ludlow Castle',
    'ludlow-castle-visitor-information-2026',
    'https://www.ludlowcastle.com/visit-us/opening-times-prices-book-tickets/',
    'Current-place curation: opening_hours:description=Daily 10am-5pm, last entry 4.15pm; admission=Adult £10, child aged 5-15 £5, family £28, under 5s free; time_to_spend=90 minutes-3 hours; dog_policy=Dogs are welcome in the castle and cafe terrace when kept on leads; toilets=yes; cafe=yes; website=https://www.ludlowcastle.com/visit-us/opening-times-prices-book-tickets/.',
  ),
});

updateAttraction(pkg, {
  id: churchId,
  name: "St Laurence's Church",
  description:
    "Ludlow's great parish church combines an imposing tower, exceptional medieval fittings and a calm interior at the heart of the old town.",
  guide: {
    headline: "Ludlow's landmark church",
    intro:
      'Step inside for medieval misericords, stained glass, monuments and the scale of a building often described as the cathedral of the Marches.',
    motifs: ['Medieval church', 'Stained glass', 'Town landmark'],
    bestFor: ['Architecture', 'Quiet reflection', 'Local history'],
    toilets: 'An accessible toilet is available for visitors.',
    foodNote: 'Icon Coffee operates in the church during published daytime hours.',
    thingsToDo: [
      { name: 'See the medieval misericords and choir stalls' },
      { name: 'Look for the Palmers window and historic glass' },
      { name: 'Explore the monuments and local stories' },
      { name: 'Appreciate the scale of the nave and tower crossing' },
      { name: 'Pause at Icon Coffee when open' },
    ],
  },
  sourceRecord: source(
    "St Laurence's visitor information",
    "St Laurence's Church Ludlow",
    'st-laurences-ludlow-visitor-information-2026',
    'https://stlaurences.org.uk/visit-us/',
    'Current-place curation: opening_hours:description=Usually Monday-Saturday 10am-5pm and Sunday 11am-5pm; admission=Free, suggested donation £3; time_to_spend=30-60 minutes; toilets=yes; wheelchair_access=yes; cafe=Icon Coffee usually Monday-Saturday 10am-4.30pm; dog_policy=Not confirmed, check directly; website=https://stlaurences.org.uk/visit-us/.',
  ),
});

updateAttraction(pkg, {
  id: museumId,
  name: 'Ludlow Museum at the Butter Cross',
  description:
    "A compact local museum that explains Ludlow's geology, archaeology, trades and civic history from an atmospheric building in the town centre.",
  guide: {
    headline: 'The town story in one compact stop',
    intro:
      'Use the museum to connect the castle and streets with the people, industries and landscape that shaped Ludlow.',
    motifs: ['Local history', 'Archaeology', 'Town stories'],
    bestFor: ['First-time visitors', 'Rainy-day interest', 'Families'],
    toilets: 'Visitor toilets are available in the museum building.',
    thingsToDo: [
      { name: "Discover Ludlow's archaeological finds" },
      { name: 'Explore the geology of the surrounding area' },
      { name: 'Learn about local trades and civic life' },
      { name: 'See changing displays and community stories' },
      { name: 'Use the displays to orient a town-centre walk' },
    ],
  },
  sourceRecord: source(
    'Ludlow Museum visitor information',
    'Ludlow Museum',
    'ludlow-museum-visitor-information-2026',
    'https://www.ludlowmuseum.co.uk/visit-us',
    'Current-place curation: opening_hours:description=Friday-Sunday 10am-4pm; admission=Paid adult admission, under 16s free, check the current adult price because official pages differ; time_to_spend=45-75 minutes; toilets=yes; wheelchair_access=Lift access is available; dog_policy=Not confirmed, check directly; website=https://www.ludlowmuseum.co.uk/visit-us.',
  ),
});

updateAttraction(pkg, {
  id: butterCrossId,
  name: 'The Butter Cross',
  description:
    'This elegant eighteenth-century civic landmark anchors the meeting point between Castle Square, Broad Street and the market streets.',
  guide: {
    headline: 'The crossroads of old Ludlow',
    intro:
      'Pause here for the architecture and orientation: the Butter Cross sits where several of the most rewarding historic streets meet.',
    motifs: ['Civic landmark', 'Historic streets', 'Architecture'],
    bestFor: ['A brief orientation stop', 'Architecture', 'Street photography'],
    thingsToDo: [
      { name: 'Admire the classical civic architecture' },
      { name: 'Look down Broad Street towards Broad Gate' },
      { name: 'Use the junction to explore the market streets' },
    ],
  },
  sourceRecord: source(
    'Ludlow visitor information',
    'Ludlow Town Council',
    'ludlow-butter-cross-visitor-context-2026',
    'https://www.ludlow.gov.uk/visit-ludlow',
    'Current-place curation: opening_hours:description=Outdoor landmark visible at all times; admission=Free; time_to_spend=10-20 minutes; dog_policy=Open public-street setting, normal local controls apply; website=https://www.ludlow.gov.uk/visit-ludlow.',
  ),
});

const highlights: VisitorHighlight[] = [
  {
    rank: 1,
    featureId: castleId,
    name: 'Ludlow Castle',
    reason: 'Substantial medieval ruins, towers and viewpoints make this the defining Ludlow attraction and a genuine destination-scale castle visit.',
    tagline: 'Medieval fortress',
    visitorScore: 92,
    timeToSpend: '90 minutes-3 hours',
    openingTimes: 'Daily 10am-5pm; last entry 4.15pm.',
    admission: 'Adult £10; child aged 5-15 £5; family £28; under 5s free.',
    organisationPills: ['Pay'],
    attractionGuide: requiredFeature(pkg, castleId).attractionGuide,
    sourceName: 'Ludlow Castle',
    sourceUrl: 'https://www.ludlowcastle.com/visit-us/opening-times-prices-book-tickets/',
    verifiedInBoundaryAt: reviewedAt,
  },
  {
    rank: 2,
    featureId: churchId,
    name: "St Laurence's Church",
    reason: 'A grand medieval parish church with outstanding fittings, stained glass and monuments, right in the centre of Ludlow.',
    tagline: 'Medieval landmark',
    visitorScore: 85,
    timeToSpend: '30-60 minutes',
    openingTimes: 'Usually Monday-Saturday 10am-5pm and Sunday 11am-5pm.',
    admission: 'Free; suggested donation £3.',
    freeAdmission: true,
    organisationPills: ['Free'],
    attractionGuide: requiredFeature(pkg, churchId).attractionGuide,
    sourceName: "St Laurence's Church Ludlow",
    sourceUrl: 'https://stlaurences.org.uk/visit-us/',
    verifiedInBoundaryAt: reviewedAt,
  },
  {
    rank: 3,
    featureId: museumId,
    name: 'Ludlow Museum at the Butter Cross',
    reason: "A compact, useful introduction to Ludlow's archaeology, geology, trades and civic history in the heart of town.",
    tagline: 'Town story',
    visitorScore: 82,
    timeToSpend: '45-75 minutes',
    openingTimes: 'Friday-Sunday 10am-4pm.',
    admission: 'Paid adult admission; under 16s free. Check the current adult price because official pages differ.',
    organisationPills: ['Pay'],
    attractionGuide: requiredFeature(pkg, museumId).attractionGuide,
    sourceName: 'Ludlow Museum',
    sourceUrl: 'https://www.ludlowmuseum.co.uk/visit-us',
    verifiedInBoundaryAt: reviewedAt,
  },
  {
    rank: 4,
    featureId: butterCrossId,
    name: 'The Butter Cross',
    reason: 'An elegant civic landmark and useful orientation point where Ludlow’s castle, market and historic streets come together.',
    tagline: 'Historic crossroads',
    visitorScore: 78,
    timeToSpend: '10-20 minutes',
    openingTimes: 'Outdoor landmark visible at all times.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: ['Free'],
    attractionGuide: requiredFeature(pkg, butterCrossId).attractionGuide,
    sourceName: 'Ludlow Town Council',
    sourceUrl: 'https://www.ludlow.gov.uk/visit-ludlow',
    verifiedInBoundaryAt: reviewedAt,
  },
];
pkg.project.visitorHighlights = highlights;

const parkingDefinitions = [
  {
    id: 'osm-community:way-27112498',
    name: 'Galdeford Car Park (Zones A and B)',
    description:
      'Large central council car park with cheaper all-day parking in Zone B and shorter-stay central access in Zone A.',
    sourceId: 'shropshire-ludlow-galdeford-parking-2026',
    url: 'https://next.shropshire.gov.uk/parking/find-my-nearest-car-park/ludlow-galdeford-zone-a-upper/',
    notes:
      'Current-place curation: amenity=parking; parking=surface; access=yes; fee=yes; payment_required=yes; opening_hours=Zone A 24 hours, Zone B council page lists 8am-6pm; price_display=Zone A 70p per hour up to £5.60 daily, Zone B 40p per hour up to £3.20 daily, free Sundays and public holidays; payment_methods=Coins, contactless and MiPermit; max_stay=All day; capacity=297 across Zones A and B; disabled_spaces=15 across both zones; mipermit_codes=740030 and 740031.',
  },
  {
    id: 'osm-community:way-93926241',
    name: 'Castle Street Car Park',
    description:
      'The closest large council car park to the castle and market, charging daily during the daytime with overnight parking free.',
    sourceId: 'shropshire-ludlow-castle-street-parking-2026',
    url: 'https://next.shropshire.gov.uk/parking/find-my-nearest-car-park/ludlow-castle-street/',
    notes:
      'Current-place curation: amenity=parking; parking=surface; access=yes; fee=yes; payment_required=yes; opening_hours=24 hours; price_display=£1.40 per hour 8am-6pm, Sundays and public holidays half price, free 6pm-8am; payment_methods=Coins, contactless and MiPermit; max_stay=All day; capacity=135; disabled_spaces=6; motorcycle_spaces=7; mipermit_code=740029.',
  },
  {
    id: 'osm-community:way-122885226',
    name: 'Smithfield Car Park',
    description:
      'Lower-cost council parking east of the centre, suitable for a longer daytime visit and free on Sundays and public holidays.',
    sourceId: 'shropshire-ludlow-smithfield-parking-2026',
    url: 'https://next.shropshire.gov.uk/parking/find-my-nearest-car-park/ludlow-smithfield/',
    notes:
      'Current-place curation: amenity=parking; parking=surface; access=yes; fee=yes; payment_required=yes; opening_hours=24 hours; price_display=40p per hour up to £3.20 daily, free Sundays and public holidays; payment_methods=Coins, contactless and MiPermit; max_stay=All day; capacity=100; disabled_spaces=1; coach_hgv_spaces=9; mipermit_code=740032.',
  },
] as const;

for (const definition of parkingDefinitions) {
  const feature = requiredFeature(pkg, definition.id);
  feature.name = definition.name;
  feature.shortDescription = definition.description;
  feature.reviewNotes = `Council parking terms reviewed on ${reviewedDate}; tariffs can change, so visitors should recheck the linked council page.`;
  upsertSource(
    feature,
    source(
      `${definition.name} visitor parking`,
      'Shropshire Council',
      definition.sourceId,
      definition.url,
      definition.notes,
    ),
  );
}

const newTrails: TrailRegistryEntry[] = [
  {
    projectId,
    projectFile: 'ludlow-shropshire-england.json',
    featureId: 'curated-trail:ludlow-whitcliffe-breadwalk',
    name: 'Whitcliffe and Breadwalk',
    provider: 'Ludlow Visitor Information',
    url: 'https://www.ludlow.org.uk/walking.html',
    sourceTier: 'destination_website',
    score: 84,
    boundaryStatus: 'confirmed_in_active_boundary',
    coordinates: [-2.7239581, 52.3658848],
    shortDescription:
      'A short, scenic town walk descending from the castle side towards Dinham Bridge, the River Teme and the Breadwalk below Whitcliffe.',
    trailType: 'Scenic town walk',
    distance: 'Short town circuit; use the published map for the exact route',
    timeToSpend: '15-30 minutes',
    difficulty: 'Easy, with steep steps',
    accessibility: 'Includes steep steps and is unsuitable for wheelchairs and pushchairs',
    entranceFee: 'Free',
    sourceRecordId: 'ludlow-whitcliffe-breadwalk-2026',
    licence: 'Link and original editorial summary only; route content remains with Ludlow Visitor Information.',
    reliability: 'official_non_statutory',
    reviewNotes: 'Destination walking page and downloadable walking map checked on 2026-08-13. Representative point is within the active Ludlow visitor boundary.',
  },
  {
    projectId,
    projectFile: 'ludlow-shropshire-england.json',
    featureId: 'curated-trail:ludlow-castle-gardens-millennium-green',
    name: 'Castle Gardens and Millennium Green Walk',
    provider: 'Ludlow Visitor Information',
    url: 'https://www.ludlow.org.uk/walking.html',
    sourceTier: 'destination_website',
    score: 78,
    boundaryStatus: 'confirmed_in_active_boundary',
    coordinates: [-2.72295688284964, 52.367202855881445],
    shortDescription:
      'An easy short walk linking the castle setting with Dinham, the River Teme and Millennium Green below the old town.',
    trailType: 'Easy riverside town walk',
    distance: 'Short town circuit; use the published map for the exact route',
    timeToSpend: '15-30 minutes',
    difficulty: 'Easy',
    accessibility: 'Easy walking, though local gradients and surfaces should be checked on the route map',
    entranceFee: 'Free',
    sourceRecordId: 'ludlow-castle-gardens-millennium-green-2026',
    licence: 'Link and original editorial summary only; route content remains with Ludlow Visitor Information.',
    reliability: 'official_non_statutory',
    reviewNotes: 'Destination walking page and downloadable walking map checked on 2026-08-13. Representative point is within the active Ludlow visitor boundary.',
  },
];

for (const trail of newTrails) {
  pkg.features = pkg.features.filter((feature) => feature.id !== trail.featureId);
  pkg.features.push(trailFeature(trail));
  registry.trails = registry.trails.filter((candidate) => candidate.featureId !== trail.featureId);
  registry.trails.push(trail);
}

const projectCuration = planner.projects[projectId] ?? {};
projectCuration.trails = [
  ...newTrails.map((trail) => trail.featureId),
  ...(projectCuration.trails ?? []).filter(
    (id) => !newTrails.some((trail) => trail.featureId === id),
  ),
];
planner.projects[projectId] = projectCuration;

const dogProject = dog.projects[projectId] ?? {};
dogProject.attraction ??= {};
dogProject.attraction[castleId] = {
  rating: 3,
  status: 'welcoming',
  label: 'Dogs welcomed on leads',
  summary:
    'Dogs are welcome throughout the castle and on the cafe terrace when kept on leads. Water bowls and dog-waste bins are provided.',
  sourceName: 'Ludlow Castle dog policy',
  sourceUrl: 'https://www.ludlowcastle.com/visit-us/dogs-are-welcome/',
  reviewedAt: reviewedDate,
};
dog.projects[projectId] = dogProject;

const evidence = {
  schemaVersion: 1,
  projectId,
  reviewedAt,
  status: 'partial_editorial_pilot',
  completedCategories: ['parking'],
  substantiallyResearchedCategories: ['see', 'trails'],
  incompleteCategories: ['see', 'eat', 'trails', 'toilets', 'picnic'],
  editorialDecisions: [
    'Reduced the public See list from twenty records to four independent visitor experiences.',
    'Castle substructures, gates and minor fragments remain in the historic dataset but no longer masquerade as separate visitor attractions.',
    'Kept unconfirmed dog policies explicitly unconfirmed rather than guessing from venue type.',
    'Added two short destination-published walks and retained existing longer responsible-body routes pending a later full trail reconciliation.',
    'Replaced generic OSM parking summaries with current council tariffs, payment methods, spaces and maximum-stay information.',
  ],
  sources: [
    { category: 'destination', url: 'https://www.ludlow.gov.uk/visit-ludlow' },
    { category: 'castle', url: 'https://www.ludlowcastle.com/visit-us/opening-times-prices-book-tickets/' },
    { category: 'castle_dogs', url: 'https://www.ludlowcastle.com/visit-us/dogs-are-welcome/' },
    { category: 'church', url: 'https://stlaurences.org.uk/visit-us/' },
    { category: 'museum', url: 'https://www.ludlowmuseum.co.uk/visit-us' },
    { category: 'walks', url: 'https://www.ludlow.org.uk/walking.html' },
    { category: 'parking', url: 'https://next.shropshire.gov.uk/parking/find-my-nearest-car-park/ludlow-castle-street/' },
    { category: 'parking', url: 'https://next.shropshire.gov.uk/parking/find-my-nearest-car-park/ludlow-galdeford-zone-a-upper/' },
    { category: 'parking', url: 'https://next.shropshire.gov.uk/parking/find-my-nearest-car-park/ludlow-galdeford-zone-b-lower/' },
    { category: 'parking', url: 'https://next.shropshire.gov.uk/parking/find-my-nearest-car-park/ludlow-smithfield/' },
  ],
  rejectedAsStandaloneAttractions: highlights.length === 4
    ? (pkg.project.visitorHighlights ?? []).filter((highlight) => highlight.rank > 4).map((highlight) => highlight.name)
    : [],
  notes:
    'This is a visible reference conversion, not a claim that Ludlow or England is fully editorially complete. Eat requires operator-by-operator daytime and dog-policy research before sign-off.',
};

await mkdir(resolve('data/research/england'), { recursive: true });
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(trailRegistryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log('Applied the Ludlow editorial research pilot.');
