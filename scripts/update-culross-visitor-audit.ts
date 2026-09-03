import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  booleanPointInPolygon,
  buffer,
  featureCollection,
  lineString,
  point,
  polygon,
  union,
} from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/culross.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/culross-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'culross-visitor-audit';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Culross feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function removeTag(feature: HeritageFeature, tag: string): void {
  feature.tags = feature.tags.filter((candidate) => candidate !== tag);
}

function replaceCurrentCurationSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !record.notes?.startsWith('Current-place curation') &&
        !record.notes?.startsWith('Current-context curation'),
    ),
    source,
  ];
  feature.licence ??= editorialMetadataLicence;
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

function currentSource(
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
    licence: editorialMetadataLicence,
    reliability,
    notes,
  };
}

function upsertFeature(feature: HeritageFeature): HeritageFeature {
  const index = pkg.features.findIndex((candidate) => candidate.id === feature.id);
  if (index === -1) pkg.features.push(feature);
  else pkg.features[index] = feature;
  return feature;
}

function curatedPoint(
  id: string,
  name: string,
  featureType: string,
  coordinates: [number, number],
  shortDescription: string,
  source: SourceRecord,
  tags: string[],
  locationType: HeritageFeature['locationType'] = 'exact',
  locationConfidence: HeritageFeature['locationConfidence'] = 'high',
): HeritageFeature {
  return {
    id,
    projectId: pkg.project.id,
    name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType,
    significance: 'local',
    geometry: { type: 'Point', coordinates },
    locationType,
    locationConfidence,
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription,
    sourceRecords: [source],
    tags: [...new Set([...tags, auditTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-06; it is excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

function updateFood(
  feature: HeritageFeature,
  options: {
    name?: string;
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    kind: 'cafe' | 'restaurant' | 'pub' | 'fast_food';
    address: string;
    dogFriendly?: boolean;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  if (options.name) feature.name = options.name;
  feature.featureType = options.kind;
  feature.shortDescription = options.description;
  feature.address = options.address;
  addTags(feature, 'current-context', 'service-context-food', 'visitor-context-food', auditTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor audit`,
      options.organisation,
      `visitor-audit-food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}${options.dogFriendly ? '; dog_friendly=yes' : ''}.`,
      options.reliability ?? 'official_non_statutory',
    ),
  );
  return feature;
}

pkg.project.centre = [-3.629, 56.0558];
pkg.project.touristAppeal = {
  rating: 3,
  label: 'Destination draw',
  summary:
    'Culross is one of Scotland\'s strongest small historic destinations: its remarkably complete Royal Burgh, Palace, abbey ruins and Forth-side setting justify a special journey rather than merely a nearby detour.',
};

pkg.project.visualIdentity = {
  theme: 'royal-burgh-and-forth',
  badgeImage: '/town-guides/culross-royal-burgh-watercolour-guide.png',
  badgeAlt:
    'Editorial ink-and-watercolour illustration of Culross Palace, cobbled wynds, pantiled houses and the Firth of Forth',
  heroImage: '/town-guides/culross-royal-burgh-watercolour-guide.png',
  heroAlt:
    'Editorial ink-and-watercolour illustration of Culross Palace, cobbled wynds, pantiled houses and the Firth of Forth',
  primaryColour: '#16454A',
  accentColour: '#B87826',
  backgroundColour: '#F2F5E9',
  heroObjectPosition: '50% 50%',
  motifs: ['Culross Palace', 'Cobbled wynds', 'Abbey ruins', 'Forth shoreline'],
};

pkg.project.townGuide = {
  headline: 'Ochre palace walls, cobbled wynds and Scotland\'s most complete Royal Burgh',
  intro:
    'Culross feels unusually intact: steep lanes climb between white-harled houses and red pantile roofs, the ochre Palace opens into a productive period garden, and the abbey ruins look back over the Forth. Add independent food, pottery and an easy waterfront pause and the village comfortably fills half a day.',
  bestFor: [
    'Historic streets',
    'Scottish architecture',
    'Outlander locations',
    'Photography',
    'Short heritage walks',
  ],
  perfectFor: [
    'A half-day Royal Burgh wander',
    'Heritage lovers mixing interiors and townscape',
    'Photographers looking for distinctive streets and Forth views',
  ],
  suggestedFirstVisit: {
    title: 'Royal Burgh, Palace and the abbey',
    summary:
      'Begin around the Mercat Cross and Town House, explore the wynds and Palace, then climb to the abbey ruins before returning to Low Causeway for food or a shoreline pause.',
  },
  dontMiss: [
    'Royal Burgh of Culross townscape',
    'Culross Palace and garden',
    'Culross Abbey ruins',
    'Low Causeway and the community pier',
  ],
  suggestedTime: 'Half day; a full day with the Palace, food and a longer trail',
  visitorMood:
    'A special-journey historic village where the streets are as memorable as the formal attractions.',
  sourceUrls: [
    'https://www.nts.org.uk/visit/places/culross',
    'https://www.nts.org.uk/visit/places/culross/planning-your-visit',
    'https://www.historicenvironment.scot/visit/all/culross-abbey/',
    'https://www.visitculross.com/history',
    'https://www.visitculross.com/naturandoutdoors',
    'https://www.visitculross.com/foodanddrink',
    'https://www.visitculross.com/parking',
    'https://www.fife.gov.uk/facilities/park/low-causeway',
    'https://www.fife.gov.uk/facilities/public-toilet/culross-public-toilets',
    'https://www.fife.gov.uk/facilities/car-park/balgownie-west-car-park%2C-culross',
    'https://www.fife.gov.uk/facilities/car-park/east-low-causeway-car-park%2C-culross',
    'https://the-mercat.com/',
    'https://redlionculross.co.uk/',
    'https://www.culrosspotterystudio.com/',
    'https://www.britishpilgrimage.org/portfolio/fife-pilgrims-way',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Culross town study area is missing');
const culrossCore = polygon([
  [
    [-3.6372, 56.0537],
    [-3.6324, 56.0533],
    [-3.627, 56.0535],
    [-3.621, 56.0538],
    [-3.6184, 56.0547],
    [-3.6185, 56.0564],
    [-3.621, 56.0581],
    [-3.6228, 56.0606],
    [-3.6278, 56.0611],
    [-3.6314, 56.0601],
    [-3.634, 56.0587],
    [-3.6362, 56.057],
    [-3.6372, 56.0537],
  ],
]);
const westKirkExtension = buffer(
  lineString([
    [-3.6344, 56.05485],
    [-3.6376, 56.0579],
    [-3.64016, 56.06025],
  ]),
  0.12,
  { units: 'kilometers' },
);
if (!westKirkExtension) throw new Error('Could not build the Culross West Kirk extension');
const visitorBoundary = union(featureCollection([culrossCore, westKirkExtension]));
if (!visitorBoundary) throw new Error('Could not build the Culross visitor boundary');
visitorBoundary.properties = {
  sourceDataset: 'Curated Culross visitor boundary',
  originalSourceDataset: townStudyArea.sourceName,
  basis: 'OpenStreetMap-informed Royal Burgh settlement extent with a narrow West Kirk walking extension',
  reviewedAt: reviewedDate,
  reason:
    'The NRS locality combines Culross with High and Low Valleyfield. The visitor boundary isolates the compact Royal Burgh and adds only the signed heritage approach to West Kirk.',
};
townStudyArea.visitorBoundary = visitorBoundary;
townStudyArea.notes =
  'The original NRS 2022 High Valleyfield, Low Valleyfield and Culross locality is preserved unchanged for provenance. The tourist-facing boundary is a curated OSM-informed Culross Royal Burgh extent with a narrow West Kirk walking extension; it excludes the Valleyfields, Dunimarle, Preston Island, Valleyfield Woods and wider Devilla destinations.';

const royalBurgh = featureById(
  'curated-attraction:culross-royal-burgh-culross-heritage-walk',
);
royalBurgh.name = 'Royal Burgh of Culross townscape';
royalBurgh.featureType = 'historic_townscape';
royalBurgh.shortDescription =
  'Wander one of Scotland\'s most complete 17th- and 18th-century burghs, following cobbled wynds between the Mercat Cross, Town House, white-harled houses and red pantile roofs.';
addTags(royalBurgh, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  royalBurgh,
  currentSource(
    'Royal Burgh of Culross visitor information',
    'National Trust for Scotland',
    'visitor-audit:royal-burgh',
    'https://www.nts.org.uk/visit/places/culross',
    'Current-place curation: tourism=attraction; name=Royal Burgh of Culross townscape; visitor_place_type=Historic Royal Burgh; visit_score=88; opening_hours:description=Open-access streets, daylight gives the best experience; entrance_fee=Free self-guided visit, scheduled NTS town tours are separate; time_to_spend=75-150 minutes; description=Wander one of Scotland\'s most complete 17th- and 18th-century burghs through cobbled wynds, closes and market-place landmarks; website=https://www.nts.org.uk/visit/places/culross.',
  ),
);

const palace = featureById('nrhe:48021');
palace.name = 'Culross Palace and garden';
palace.featureType = 'historic_house';
palace.shortDescription =
  'Step inside an atmospheric early-17th-century merchant\'s house for painted ceilings, tight passageways, period rooms and a productive terraced garden above the Forth.';
addTags(palace, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  palace,
  currentSource(
    'Culross Palace planning information',
    'National Trust for Scotland',
    'visitor-audit:culross-palace',
    'https://www.nts.org.uk/visit/places/culross/planning-your-visit',
    'Current-place curation: tourism=attraction; name=Culross Palace and garden; visitor_place_type=Historic merchant house and period garden; visit_score=86; opening_hours:description=1 April-30 September daily 10:00-17:00, last entry 16:00; 1-31 October daily 10:00-16:00, last entry 15:00; closed November-December; entrance_fee=Adult £14, concession £11, child £8, family £38, one-adult family £25, Young Scot £1, garden-only adult £5, NTS members free; booking=Tickets are issued at the Townhouse shop and entry is limited to eight people per 15 minutes; accessibility=Cobbles, uneven surfaces, steps and spiral stairs make much of the Palace unsuitable for limited mobility; time_to_spend=75-120 minutes; description=See painted interiors and a productive period garden in the ochre house at the heart of the Royal Burgh; website=https://www.nts.org.uk/visit/places/culross/planning-your-visit.',
  ),
);

const abbey = featureById('curated-attraction:culross-culross-abbey-ruins-and-churchyard');
abbey.name = 'Culross Abbey ruins and churchyard';
abbey.featureType = 'abbey_ruins';
abbey.shortDescription =
  'Climb above the burgh to the open ruins of a 13th-century Cistercian monastery, with a peaceful churchyard and broad views back over Culross and the Forth.';
addTags(abbey, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  abbey,
  currentSource(
    'Culross Abbey visitor information',
    'Historic Environment Scotland',
    'visitor-audit:culross-abbey',
    'https://www.historicenvironment.scot/visit/all/culross-abbey/',
    'Current-place curation: tourism=attraction; name=Culross Abbey ruins and churchyard; visitor_place_type=Medieval abbey ruins and churchyard; visit_score=76; opening_hours:description=Open all year; entrance_fee=Free; accessibility=Steep approach and uneven historic ground; time_to_spend=35-70 minutes; description=Explore the open ruins of a 13th-century Cistercian monastery on the hillside above the Royal Burgh; website=https://www.historicenvironment.scot/visit/all/culross-abbey/.',
    'official_statutory',
  ),
);

const pottery = featureById('curated-attraction:culross-culross-pottery-and-gallery');
pottery.name = 'Culross Pottery and Gallery';
pottery.featureType = 'craft_gallery';
pottery.shortDescription =
  'Browse contemporary Scottish pottery and art in a 1624 former granary, or give the stop more depth by booking a practical pottery class.';
addTags(pottery, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  pottery,
  currentSource(
    'Culross Pottery and Gallery visitor information',
    'Culross Pottery and Gallery',
    'visitor-audit:culross-pottery',
    'https://www.culrosspotterystudio.com/',
    'Current-place curation: tourism=attraction; name=Culross Pottery and Gallery; visitor_place_type=Working pottery and contemporary craft gallery; visit_score=58; opening_hours:description=Daily 10:00-17:00; entrance_fee=Free for gallery and shop visitors, classes and workshops are charged; time_to_spend=20-45 minutes for the gallery, allow longer for a booked class; description=Browse contemporary Scottish craft in a historic granary or book a pottery session; website=https://www.culrosspotterystudio.com/.',
  ),
);

const harbour = upsertFeature(
  curatedPoint(
    'curated-attraction:culross-harbour-pier-west-green',
    'Culross harbour, community pier and West Green',
    'historic_harbour',
    [-3.6319, 56.05475],
    'Pause where the old trading burgh meets the Forth, with the community pier, West Green, play area and open estuary views giving the visit a relaxed waterfront finish.',
    currentSource(
      'Culross pier and Low Causeway visitor information',
      'Visit Culross and Fife Council',
      'visitor-audit:culross-harbour',
      'https://www.visitculross.com/naturandoutdoors',
      'Current-place curation: tourism=attraction; name=Culross harbour, community pier and West Green; visitor_place_type=Historic harbour and waterfront; visit_score=57; opening_hours:description=Open access, daylight recommended and take care around water; entrance_fee=Free; time_to_spend=20-45 minutes; description=Combine the community pier, historic harbour setting, West Green and wide Forth views; website=https://www.visitculross.com/naturandoutdoors.',
    ),
    ['current-context', 'service-context-visitor'],
    'representative_point',
    'high',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: royalBurgh.id,
    name: royalBurgh.name,
    reason:
      'The village itself is the headline experience: a nationally distinctive weave of cobbled wynds, closes, white-harled houses, red pantile roofs, the Mercat Cross and Town House.',
    tagline: 'Scotland\'s complete Royal Burgh',
    visitorScore: 88,
    openingTimes: 'Open-access streets. Visit in daylight for the best architecture and photographs.',
    admission: 'Free for a self-guided visit. Scheduled National Trust town tours are separate.',
    freeAdmission: true,
    organisationPills: ['NTS'],
    sourceName: 'National Trust for Scotland',
    sourceUrl: 'https://www.nts.org.uk/visit/places/culross',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: palace.id,
    name: palace.name,
    reason:
      'Painted ceilings, intimate rooms and the productive terraced garden turn the ochre landmark into Culross\'s strongest formal attraction.',
    tagline: 'Painted interiors and period garden',
    visitorScore: 86,
    openingTimes:
      'April-September daily 10:00-17:00, last entry 16:00. October daily 10:00-16:00, last entry 15:00. Closed November-December.',
    admission:
      'Adult £14; concession £11; child £8; family £38; one-adult family £25; Young Scot £1; garden-only adult £5; NTS members free.',
    freeAdmission: false,
    organisationPills: ['NTS'],
    sourceName: 'National Trust for Scotland',
    sourceUrl: 'https://www.nts.org.uk/visit/places/culross/planning-your-visit',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: abbey.id,
    name: abbey.name,
    reason:
      'The free hilltop ruins add a substantial medieval chapter to the merchant-burgh story, with a peaceful churchyard and rewarding views.',
    tagline: 'Medieval ruins above the burgh',
    visitorScore: 76,
    openingTimes: 'Open all year. Visit in daylight and allow for a steep, uneven approach.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://www.historicenvironment.scot/visit/all/culross-abbey/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: pottery.id,
    name: pottery.name,
    reason:
      'A working pottery and Scottish art gallery in a historic granary gives the village a worthwhile living-craft stop beyond its preserved streets.',
    tagline: 'Working pottery and gallery',
    visitorScore: 58,
    openingTimes: 'Daily 10:00-17:00. Check class dates before travelling for a workshop.',
    admission: 'Free gallery and shop; classes and workshops are charged.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Culross Pottery and Gallery',
    sourceUrl: 'https://www.culrosspotterystudio.com/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 5,
    featureId: harbour.id,
    name: harbour.name,
    reason:
      'The old port story becomes tangible at the shoreline, where the community pier and West Green open the village towards the Firth of Forth.',
    tagline: 'Pier and Forth views',
    visitorScore: 57,
    openingTimes: 'Open access. Daylight is recommended and care is needed beside the water.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Visit Culross and Fife Council',
    sourceUrl: 'https://www.visitculross.com/naturandoutdoors',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const mercat = updateFood(featureById('osm-community:node-4995290457'), {
  name: 'The Mercat',
  score: 83,
  tagline: 'Best all-round',
  description:
    'The strongest all-round daytime stop, pairing homemade cakes and a fresh lunch menu with a carefully curated homeware and independent-makers shop beside the Mercat Cross.',
  opening: 'Daily 10:00-17:00; lunch menu 12:00-16:00; no reservations',
  price: '££',
  cuisine: 'Cafe, cakes, lunch and local produce',
  website: 'https://the-mercat.com/',
  organisation: 'The Mercat',
  kind: 'cafe',
  address: 'The Cross, Culross, KY12 8HT',
});

const cobbledLane = updateFood(featureById('osm-community:node-1319913221'), {
  name: 'Cobbled Lane',
  score: 76,
  tagline: 'Gallery cafe',
  description:
    'A dependable daily cafe above Culross Pottery and Gallery for hearty sandwiches, flatbreads, salads, scones and coffee in a characterful historic setting.',
  opening: 'Daily 10:00-17:00',
  price: '££',
  cuisine: 'Cafe, sandwiches, flatbreads, salads and baking',
  website: 'https://www.visitculross.com/foodanddrink',
  organisation: 'Cobbled Lane and Visit Culross',
  kind: 'cafe',
  address: 'Sandhaven, Culross, KY12 8JG',
});

const redLion = updateFood(featureById('curated:hes-lb24039'), {
  score: 75,
  tagline: 'Full meal',
  description:
    'The village\'s most dependable option for a full lunch or evening meal, serving generous pub food, daily specials and locally brewed ale in a historic community-owned inn.',
  opening: 'Food daily 12:00-21:00',
  price: '££',
  cuisine: 'Scottish and British pub food',
  website: 'https://redlionculross.co.uk/',
  organisation: 'Red Lion Inn',
  kind: 'pub',
  address: 'Low Causeway, Culross, KY12 8HN',
});

const bessies = updateFood(featureById('osm-community:node-4995290461'), {
  name: "Bessie's Cafe",
  score: 74,
  tagline: 'Palace cafe',
  description:
    'An atmospheric, dog-friendly Palace cafe for soup, sandwiches, homemade baking, scones and coffee, especially convenient during a Palace and garden visit.',
  opening:
    'June-August daily 10:00-16:00, last orders 15:30; July-August Tuesdays and Wednesdays are takeaway-only; September-October Thursday-Monday 10:00-16:00',
  price: '£',
  cuisine: 'Cafe, soup, sandwiches and home baking',
  website: 'https://www.nts.org.uk/visit/places/culross/highlights/bessies-caf%C3%A9',
  organisation: 'National Trust for Scotland',
  kind: 'cafe',
  address: 'Culross Palace, Culross, KY12 8JH',
  dogFriendly: true,
});

const tealeaf = updateFood(
  upsertFeature(
    curatedPoint(
      'curated-food:culross-tealeaf-kirkbrae-house',
      'Tealeaf at Kirkbrae House',
      'cafe',
      [-3.6262633, 56.0576651],
      'A quiet summer-weekend garden cafe near the abbey, best for a peaceful tea-and-cake pause rather than a dependable year-round meal.',
      currentSource(
        'Tealeaf visitor listing',
        'Visit Culross',
        'visitor-audit-food:tealeaf',
        'https://www.visitculross.com/foodanddrink',
        'Current-place curation: amenity=cafe; name=Tealeaf at Kirkbrae House; location=Kirkbrae House garden near Culross Abbey; visit_score=68; price_band=£; opening_hours:description=Summer Saturdays and Sundays 11:00-16:00; description=Quiet summer-weekend garden cafe near the abbey; website=https://www.visitculross.com/foodanddrink.',
      ),
      ['current-context', 'service-context-food', 'visitor-context-food'],
      'representative_point',
      'medium',
    ),
  ),
  {
    score: 68,
    tagline: 'Garden cafe',
    description:
      'A quiet summer-weekend garden cafe near the abbey, best for a peaceful tea-and-cake pause rather than a dependable year-round meal.',
    opening: 'Summer Saturdays and Sundays 11:00-16:00',
    price: '£',
    cuisine: 'Tea, coffee and home baking',
    website: 'https://www.visitculross.com/foodanddrink',
    organisation: 'Tealeaf and Visit Culross',
    kind: 'cafe',
    address: 'Kirkbrae House, near Culross Abbey, Culross',
  },
);

const stickman = updateFood(featureById('curated-eat:culross-stickman-tacos-culross'), {
  score: 67,
  tagline: 'Weekend tacos',
  description:
    'The village\'s most distinctive casual-food option, with a changing taco menu using fresh local produce, but limited to weekend lunchtime and sometimes selling out.',
  opening: 'Saturday-Sunday 12:00-15:00 or until sold out; check for holiday changes',
  price: '££',
  cuisine: 'Tacos and changing street-food menu',
  website: 'https://www.visitculross.com/foodanddrink',
  organisation: 'Stickman Tacos and Visit Culross',
  kind: 'fast_food',
  address: 'The Stables, Balgownie Mains Farm, Culross',
});

const westKirk = featureById('curated-attraction:culross-west-kirk-and-plague-grave-walk');
westKirk.name = 'West Kirk and Plague Grave walk';
westKirk.featureType = 'walking_route';
westKirk.shortDescription =
  'An atmospheric village-edge walk to the ruined former parish church and plague-grave landscape, using rural paths that can be wet or muddy.';
addTags(westKirk, 'current-context', 'service-context-walk', 'visitor-context-trail', auditTag);
removeTag(westKirk, 'service-context-visitor');
replaceCurrentCurationSource(
  westKirk,
  currentSource(
    'West Kirk and Plague Grave visitor walk',
    'Visit Culross',
    'visitor-audit:trail:west-kirk',
    'https://www.visitculross.com/history',
    'Current-place curation: route=foot; name=West Kirk and Plague Grave walk; trail_type=Village-edge heritage walk; visit_score=78; distance=Flexible out-and-back or short circuit from the Royal Burgh; time_to_spend=60-120 minutes; accessibility=Rural paths can be wet, muddy and uneven; entrance_fee=Free; description=Walk from Culross to an atmospheric ruined former parish church and local burial landscape; website=https://www.visitculross.com/history.',
  ),
);

addTags(royalBurgh, 'service-context-walk', 'visitor-context-trail');
replaceCurrentCurationSource(
  royalBurgh,
  currentSource(
    'Royal Burgh self-guided walking experience',
    'National Trust for Scotland',
    'visitor-audit:trail:royal-burgh',
    'https://www.nts.org.uk/visit/places/culross/planning-your-visit',
    'Current-place curation: tourism=attraction; route=foot; name=Royal Burgh of Culross townscape; visitor_place_type=Historic Royal Burgh; trail_type=Self-guided townscape walk; visit_score=88; opening_hours:description=Open-access streets, daylight gives the best experience; entrance_fee=Free self-guided visit, scheduled 50-minute NTS town tours run on selected Wednesdays and Fridays; time_to_spend=75-150 minutes; description=Follow the Mercat Cross, Town House, cobbled wynds, closes and Palace setting through Scotland\'s most complete 17th- and 18th-century burgh; website=https://www.nts.org.uk/visit/places/culross/planning-your-visit.',
  ),
);

const coastalPath = upsertFeature(
  curatedPoint(
    'curated-trail:culross-fife-coastal-path',
    'Fife Coastal Path from Culross',
    'walking_route',
    [-3.63205, 56.05486],
    'Join the waymarked Fife Coastal Path at Low Causeway for an easy Forth-side out-and-back past the harbour, pier and shoreline greenspace.',
    currentSource(
      'Fife Coastal Path at Low Causeway',
      'Fife Council and Fife Coast & Countryside Trust',
      'visitor-audit:trail:fife-coastal-path',
      'https://www.fife.gov.uk/facilities/park/low-causeway',
      'Current-place curation: route=foot; name=Fife Coastal Path from Culross; trail_type=Waymarked coastal path; visit_score=84; distance=Choose a short shoreline out-and-back or continue on the long-distance route; time_to_spend=45-180 minutes; accessibility=Good path network at Low Causeway, conditions vary beyond the village; entrance_fee=Free; description=Follow the Forth shoreline from Culross on the waymarked Fife Coastal Path; website=https://www.fife.gov.uk/facilities/park/low-causeway.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
    'representative_point',
    'high',
  ),
);

const pilgrimWay = upsertFeature(
  curatedPoint(
    'curated-trail:culross-fife-pilgrim-way',
    'Fife Pilgrim Way from Culross',
    'walking_route',
    [-3.62855, 56.05568],
    'Start the waymarked long-distance pilgrimage route in the Royal Burgh and follow a manageable first section towards Dunfermline, or use Culross as the beginning of the full journey to St Andrews.',
    currentSource(
      'Fife Pilgrim Way route information',
      'British Pilgrimage Trust and Fife Coast & Countryside Trust',
      'visitor-audit:trail:fife-pilgrim-way',
      'https://www.britishpilgrimage.org/portfolio/fife-pilgrims-way',
      'Current-place curation: route=foot; name=Fife Pilgrim Way from Culross; trail_type=Waymarked long-distance pilgrimage route; visit_score=82; distance=The full route is about 70 miles to St Andrews, choose a short first section for a town visit; time_to_spend=60 minutes to multiple days; accessibility=Much of the route uses hard surfaces and is not too hilly, but conditions vary by section; entrance_fee=Free; description=Begin the waymarked Fife Pilgrim Way in Culross and walk towards Dunfermline or St Andrews; website=https://www.britishpilgrimage.org/portfolio/fife-pilgrims-way.',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
    'representative_point',
    'high',
  ),
);

const treasureTrail = upsertFeature(
  curatedPoint(
    'curated-trail:culross-centre-abbey-palace-treasure-trail',
    'Culross Centre, Abbey and Palace Treasure Trail',
    'walking_route',
    [-3.6230949, 56.0555313],
    'Solve a detective mystery on a professionally produced circular trail through the village streets, abbey grounds and Palace area.',
    currentSource(
      'Culross Centre, Abbey and Palace Treasure Trail',
      'Treasure Trails',
      'visitor-audit:trail:treasure-trails-culross',
      'https://www.treasuretrails.co.uk/products/things-to-do-culross-fife',
      'Current-place curation: route=foot; name=Culross Centre, Abbey and Palace Treasure Trail; trail_type=Paid detective mystery trail; visit_score=88; distance=1.5 miles circular; time_to_spend=90 minutes; entrance_fee=Trail booklet £10.99 for up to 4-5 people; dog_friendly=yes; accessibility=Not suitable for wheelchairs or pushchairs because the route includes steep hills, a long flight of steps, old uneven or slippery paths and roads without pavements; start=East Low Causeway Car Park, KY12 8HQ; description=Follow clues through Culross streets, the community garden, abbey grounds, Palace area and Town House square; website=https://www.treasuretrails.co.uk/products/things-to-do-culross-fife.',
      'official_non_statutory',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
    'representative_point',
    'high',
  ),
);

const westParking = featureById('osm-community:way-89947778');
westParking.name = 'Balgownie West Car Park';
westParking.featureType = 'parking';
westParking.shortDescription =
  'Free 108-space public surface car park near the play park, Palace and west side of the Royal Burgh, with three accessible spaces and two EV chargers.';
addTags(westParking, 'current-context', 'service-context-parking', auditTag);
replaceCurrentCurationSource(
  westParking,
  currentSource(
    'Balgownie West Car Park visitor information',
    'Fife Council',
    'visitor-audit:parking:balgownie-west',
    'https://www.fife.gov.uk/facilities/car-park/balgownie-west-car-park%2C-culross',
    'Current-place curation: amenity=parking; name=Balgownie West Car Park; parking=surface; access=public; capacity=108; capacity:disabled=3; capacity:charging=2; price_display=Free; payment_required=no; description=Free public car park near the play park, Palace and west side of the Royal Burgh; website=https://www.fife.gov.uk/facilities/car-park/balgownie-west-car-park%2C-culross.',
    'local_authority',
  ),
);

const eastParking = featureById('osm-community:way-89947779');
eastParking.name = 'East Low Causeway Car Park';
eastParking.featureType = 'parking';
eastParking.shortDescription =
  'Free 62-space public surface car park near the primary school and east side of the Royal Burgh, with three accessible spaces and the principal coach parking area.';
addTags(eastParking, 'current-context', 'service-context-parking', auditTag);
replaceCurrentCurationSource(
  eastParking,
  currentSource(
    'East Low Causeway Car Park visitor information',
    'Fife Council',
    'visitor-audit:parking:east-low-causeway',
    'https://www.fife.gov.uk/facilities/car-park/east-low-causeway-car-park%2C-culross',
    'Current-place curation: amenity=parking; name=East Low Causeway Car Park; parking=surface; access=public; capacity=62; capacity:disabled=3; price_display=Free; payment_required=no; coach_parking=yes; description=Free public car park near the primary school and east side of the Royal Burgh; website=https://www.fife.gov.uk/facilities/car-park/east-low-causeway-car-park%2C-culross.',
    'local_authority',
  ),
);

const toilets = featureById('osm-community:way-876320125');
toilets.name = 'Lower Causeway public toilets';
toilets.featureType = 'public_toilets';
toilets.shortDescription =
  'Council public toilets beside the West Car Park on Lower Causeway, with accessible provision, baby changing, level access and Radar-key facilities.';
addTags(toilets, 'current-context', 'service-context-toilets', auditTag);
replaceCurrentCurationSource(
  toilets,
  currentSource(
    'Culross public toilets',
    'Fife Council',
    'visitor-audit:toilets:lower-causeway',
    'https://www.fife.gov.uk/facilities/public-toilet/culross-public-toilets',
    'Current-place curation: amenity=toilets; name=Lower Causeway public toilets; access=public; opening_hours:description=Daily 09:00-17:00 year-round, closed 25-26 December and 1-2 January; price_display=30p; payment_required=yes; wheelchair=yes; baby_changing=yes; level_access=yes; radar_key=yes; description=Council public toilets beside the West Car Park on Lower Causeway; website=https://www.fife.gov.uk/facilities/public-toilet/culross-public-toilets.',
    'local_authority',
  ),
);

const picnic = upsertFeature(
  curatedPoint(
    'curated-picnic:culross-low-causeway-seafront',
    'Low Causeway seafront picnic area',
    'park',
    [-3.63208, 56.05492],
    'A grouped public picnic stop on the shoreline greenspace beside West Green, with tables, south-facing benches, a play park, Forth views and nearby toilets.',
    currentSource(
      'Low Causeway park and picnic area',
      'Fife Council and OpenStreetMap contributors',
      'visitor-audit:picnic:low-causeway',
      'https://www.fife.gov.uk/facilities/park/low-causeway',
      'Current-place curation: tourism=picnic_site; name=Low Causeway seafront picnic area; access=public; price_display=Free; opening_hours:description=Open public greenspace, daylight use recommended; facilities=Picnic tables, benches, play park, shoreline views and nearby paid public toilets; description=Grouped public picnic area on the Low Causeway shoreline greenspace rather than separate generic table pins; website=https://www.fife.gov.uk/facilities/park/low-causeway.',
      'local_authority',
    ),
    ['current-context', 'service-context-picnic'],
    'representative_point',
    'high',
  ),
);

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [mercat.id, cobbledLane.id, redLion.id, bessies.id, tealeaf.id, stickman.id],
  trails: [royalBurgh.id, treasureTrail.id, coastalPath.id, pilgrimWay.id, westKirk.id],
  picnic: [picnic.id],
  parking: [westParking.id, eastParking.id],
  toilets: [toilets.id],
};

for (const [id, reason] of [
  [
    'osm-community:node-4995290458',
    'Palace-site toilets are seasonal visitor facilities rather than the dependable council public convenience; the planner uses Lower Causeway public toilets.',
  ],
  [
    'osm-community:way-669788029',
    'Unverified central parking is not one of the two public car parks promoted by Visit Culross and Fife Council.',
  ],
  [
    'osm-community:way-879059692',
    'Unverified west-edge parking is not one of the two official public visitor car parks.',
  ],
] as const) {
  const excluded = pkg.features.find((feature) => feature.id === id);
  if (!excluded) continue;
  addTags(excluded, 'visitor-audit-excluded', auditTag);
  excluded.reviewNotes = reason;
  excluded.updatedAt = reviewedAt;
  excluded.reviewed = true;
}

const activeVisitorBoundary = townStudyArea.visitorBoundary;
if (!activeVisitorBoundary) throw new Error('Culross visitor boundary is missing');
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Culross public visitor feature is not a point: ${featureId}`);
  }
  const location = point(feature.geometry.coordinates);
  if (!booleanPointInPolygon(location, activeVisitorBoundary)) {
    throw new Error(`Culross public visitor feature falls outside the visitor boundary: ${featureId}`);
  }
  if (!booleanPointInPolygon(location, pkg.project.boundary)) {
    throw new Error(`Culross public visitor feature falls outside the parish boundary: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  boundaryRule:
    'The original combined NRS Culross and Valleyfield locality is preserved for provenance. Every public Culross planner point was tested against a compact OSM-informed Royal Burgh visitor boundary, with only a narrow walking extension to West Kirk, and against the retained Culross parish boundary.',
  published: {
    attractions: pkg.project.visitorHighlights.map((highlight) => ({
      name: highlight.name,
      score: highlight.visitorScore,
      featureId: highlight.featureId,
    })),
    eat: curationLibrary.projects[pkg.project.id].eat,
    trails: curationLibrary.projects[pkg.project.id].trails,
    parking: curationLibrary.projects[pkg.project.id].parking,
    toilets: curationLibrary.projects[pkg.project.id].toilets,
    picnic: curationLibrary.projects[pkg.project.id].picnic,
  },
  excluded: [
    {
      name: 'High Valleyfield and Low Valleyfield',
      reason: 'Part of the combined NRS statistical locality but not part of the Culross visitor town.',
    },
    {
      name: 'Dunimarle, Valleyfield Woods, Preston Island and Devilla Forest',
      reason: 'Wider-area destinations outside the active Culross visitor boundary.',
    },
    {
      name: 'Unverified private or customer parking',
      reason: 'The planner publishes only the two official public Culross car parks.',
    },
    {
      name: 'Palace-site toilets and generic picnic-table pins',
      reason:
        'The practical planner uses the dependable council toilets and groups Low Causeway tables into one named picnic area.',
    },
    {
      name: 'Occasional community bakery, brunch and market food',
      reason: 'Useful events, but not dependable enough for the core ranked Eat list.',
    },
  ],
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Culross visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, 2 car parks, 1 toilet and 1 picnic area.`,
);
