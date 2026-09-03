import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  booleanPointInPolygon,
  buffer,
  featureCollection,
  lineString,
  point,
  union,
} from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/tillicoultry.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/tillicoultry-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'tillicoultry-visitor-audit';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Tillicoultry feature: ${id}`);
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
  id: string,
  options: {
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    kind: 'cafe' | 'restaurant' | 'fast_food' | 'ice_cream_shop';
    address: string;
    dogFriendly?: boolean;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  const feature = featureById(id);
  feature.featureType = options.kind;
  feature.shortDescription = options.description;
  feature.address = options.address;
  addTags(feature, 'service-context-food', 'visitor-context-food', auditTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor audit`,
      options.organisation,
      `visitor-audit-food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}${options.dogFriendly ? '; dog_friendly=yes' : ''}.`,
      options.reliability ?? 'secondary',
    ),
  );
  return feature;
}

pkg.project.touristAppeal = {
  rating: 1,
  label: 'Local detour',
  summary:
    'Tillicoultry is a useful local detour for a booked Firpark activity, a cautious glen visit, outlet shopping or a short look at its mill-town heritage. Its general visitor offer is varied but too modest and specialist for a higher town rating.',
};

pkg.project.visualIdentity = {
  theme: 'ochil-mill-town',
  badgeImage: '/town-guides/tillicoultry-clock-mill-watercolour-guide.png',
  badgeAlt:
    'Editorial ink-and-watercolour illustration of Tillicoultry Clock Mill, the burn and the Ochil slopes',
  heroImage: '/town-guides/tillicoultry-clock-mill-watercolour-guide.png',
  heroAlt:
    'Editorial ink-and-watercolour illustration of Tillicoultry Clock Mill, the burn and the Ochil slopes',
  primaryColour: '#17464A',
  accentColour: '#B7792B',
  backgroundColour: '#EEF4E8',
  heroObjectPosition: '50% 48%',
  motifs: ['Tillicoultry Glen', 'Clock Mill', 'Firpark skiing', 'Devon Way'],
};

pkg.project.townGuide = {
  headline: 'An Ochil glen, a mill-town story and an unusual ski slope',
  intro:
    'Tillicoultry sits hard beneath the Ochils, where a textile town grew around the burn. Firpark gives it an unusual bookable activity, the glen and Devon Way add outdoor options, and Clock Mill, independent cafes and Sterling Mills make a varied short stop.',
  bestFor: ['Ochil scenery', 'Dry-slope skiing', 'Mill-town heritage', 'Cafe stops'],
  perfectFor: [
    'A 2-4 hour Hillfoots stop',
    'Families booking Firpark',
    'Walkers adding the Devon Way',
  ],
  suggestedFirstVisit: {
    title: 'Firpark, Clock Mill and the glen',
    summary:
      'Book Firpark or use the signed glen route, then return through Upper Mill Street for a cafe stop.',
  },
  dontMiss: [
    'Firpark Ski Centre',
    'Tillicoultry Glen east-side route',
    'Clock Mill and Upper Mill Street',
    'The Devon Way',
  ],
  suggestedTime: '2-4 hours; longer with a booked Firpark session or an extended trail',
  visitorMood:
    'A characterful local detour mixing outdoor activity, mill heritage, cafes and shopping rather than major formal attractions.',
  currentAdvisory: {
    title: 'Tillicoultry Glen path closure',
    summary:
      'The main path remains closed from the first bridge because of erosion. Use the signed east-side alternative and follow all barriers and ranger advice.',
    sourceUrl: 'https://www.clacks.gov.uk/visiting/tillicoultryglen/',
    linkLabel: 'Check the current glen update',
  },
  sourceUrls: [
    'https://www.clacks.gov.uk/visiting/tillicoultryglen/',
    'https://www.clacks.gov.uk/culture/firparkskicentre/',
    'https://www.clacks.gov.uk/culture/firparkprices/',
    'https://www.clacks.gov.uk/culture/firparkactivities/',
    'https://www.sterlingmills.com/sterling-mills-introduction',
    'https://www.sterlingmills.com/find-us',
    'https://www.clacks.gov.uk/property/tillicoultryconservationarea/',
    'https://www.clacks.gov.uk/transport/cycling/',
    'https://www.clacks.gov.uk/transport/parking/',
    'https://www.clacks.gov.uk/form/1128.pdf',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Tillicoultry town study area is missing');
const glenExtension = buffer(
  lineString([
    [-3.7448, 56.1598],
    [-3.7444, 56.1638],
  ]),
  0.15,
  { units: 'kilometers' },
);
if (!glenExtension) throw new Error('Could not build the Tillicoultry Glen visitor extension');
const visitorBoundary = union(
  featureCollection([townStudyArea.localityBoundary, glenExtension]),
);
if (!visitorBoundary) throw new Error('Could not build the Tillicoultry visitor boundary');
visitorBoundary.properties = {
  ...townStudyArea.localityBoundary.properties,
  sourceDataset: 'Curated Tillicoultry visitor boundary',
  originalSourceDataset: townStudyArea.sourceName,
  visitorExtensionReviewedAt: reviewedDate,
  visitorExtensionReason:
    'Narrow extension follows the council-advised east-side approach into lower Tillicoultry Glen, which rises directly from the town. Firpark is already inside the official locality.',
};
townStudyArea.visitorBoundary = visitorBoundary;
townStudyArea.notes =
  'The original NRS 2022 Tillicoultry locality is preserved unchanged for provenance and statutory-register transparency. The tourist-facing map adds only a narrow extension into lower Tillicoultry Glen for the current east-side route; it does not extend west to the golf club or broadly into the Ochils.';

const firpark = upsertFeature(
  curatedPoint(
    'curated-attraction:tillicoultry-firpark-ski-centre',
    'Firpark Ski Centre',
    'other',
    [-3.73886, 56.15735],
    'Book tuition or recreational time on a 120-metre dry ski slope beneath the Ochils, with equipment included and sessions for a range of abilities.',
    currentSource(
      'Firpark Ski Centre visitor information and prices',
      'Clackmannanshire Council',
      'visitor-audit:firpark-ski-centre',
      'https://www.clacks.gov.uk/culture/firparkskicentre/',
      'Current-place curation: tourism=attraction; leisure=sports_centre; name=Firpark Ski Centre; visitor_place_type=Dry ski slope; visit_score=78; booking=Advance booking required for activities and tuition; opening_hours:description=Monday 16:00-21:30, Tuesday 09:00-21:30, Wednesday 09:00-21:00, Thursday 09:00-21:30, Friday 09:00-20:30, Saturday-Sunday 08:30-17:30; entrance_fee=Recreational skiing per hour adult £12.40 and child £6.50, equipment included, tuition prices vary; time_to_spend=60-120 minutes; description=Book a ski session or tuition on Tillicoultry\'s distinctive year-round 120-metre dry slope; website=https://www.clacks.gov.uk/culture/firparkskicentre/.',
      'local_authority',
    ),
    ['current-context', 'curated-visitor-place', 'service-context-visitor'],
    'representative_point',
    'high',
  ),
);
firpark.address = 'Fir Park, Tillicoultry, FK13 6PL';

const glen = featureById('curated-attraction:tillicoultry-tillicoultry-glen');
glen.name = 'Tillicoultry Glen east-side route';
glen.featureType = 'walking_route';
glen.geometry = { type: 'Point', coordinates: [-3.7444, 56.1638] };
glen.locationType = 'representative_point';
glen.locationConfidence = 'medium';
glen.shortDescription =
  'A dramatic burn-cut glen immediately above the town, currently experienced via the council-advised east-side alternative because the main path is closed from the first bridge.';
addTags(glen, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  glen,
  currentSource(
    'Tillicoultry Glen current visitor update',
    'Clackmannanshire Council',
    'visitor-audit:tillicoultry-glen',
    'https://www.clacks.gov.uk/visiting/tillicoultryglen/',
    'Current-place curation: tourism=attraction; name=Tillicoultry Glen east-side route; visitor_place_type=Wooded glen; visit_score=70; opening_hours:description=Open access subject to conditions, the main path is closed from the first bridge and visitors must use the signed east-side alternative; entrance_fee=Free; accessibility=Steep and uneven ground with cliff, rockfall, erosion and water hazards, unsuitable for wheels; time_to_spend=45-90 minutes; description=Follow the permitted east side for burn and Ochil scenery while the damaged main path remains closed; website=https://www.clacks.gov.uk/visiting/tillicoultryglen/.',
    'local_authority',
  ),
);

const sterlingMills = featureById('visitor-context:sterling-mills');
sterlingMills.name = 'Affinity Sterling Mills Outlet Shopping';
sterlingMills.shortDescription =
  'An accessible outlet centre with more than a conventional shopping stop: family events, a play park, food choices and free untimed parking beneath the Ochils.';
addTags(sterlingMills, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  sterlingMills,
  currentSource(
    'Affinity Sterling Mills visitor information',
    'Affinity Sterling Mills',
    'visitor-audit:sterling-mills',
    'https://www.sterlingmills.com/sterling-mills-introduction',
    'Current-place curation: tourism=attraction; name=Affinity Sterling Mills Outlet Shopping; visitor_place_type=Outlet shopping centre; visit_score=64; opening_hours:description=Open daily 10:00-18:00, several food and larger retail units open earlier; entrance_fee=Free admission; parking=Free with no time limit; time_to_spend=60-180 minutes; description=Combine outlet shopping, food, family events and an outdoor play park beneath the Ochils; website=https://www.sterlingmills.com/sterling-mills-introduction.',
    'official_non_statutory',
  ),
);

const clockMill = featureById('curated:hes-lb42054');
clockMill.name = 'Clock Mill and Upper Mill Street';
clockMill.shortDescription =
  'The most legible surviving fragment of Tillicoultry\'s textile-town story, pairing the Clock Mill frontage with the burn, bridge and weavers\' streets below the glen.';
addTags(clockMill, 'current-context', 'service-context-visitor', auditTag);
removeTag(clockMill, 'current-context');
replaceCurrentCurationSource(
  clockMill,
  currentSource(
    'Clock Mill designation and conservation-area evidence',
    'Historic Environment Scotland and Clackmannanshire Council',
    'visitor-audit:clock-mill',
    'https://portal.historicenvironment.scot/designation/LB42054',
    'Current-place curation: tourism=attraction; name=Clock Mill and Upper Mill Street; visitor_place_type=Mill-town landmark; visit_score=56; opening_hours:description=Exterior viewing at any time, daylight gives the best context; entrance_fee=Free exterior visit; time_to_spend=20-40 minutes; description=Read Tillicoultry\'s textile history in the Clock Mill, burn bridge and compact Upper Mill Street townscape; website=https://portal.historicenvironment.scot/designation/LB42054.',
  ),
);

const oldChurchyard = featureById(
  'curated-attraction:tillicoultry-tillicoultry-old-churchyard',
);
oldChurchyard.name = 'Tillicoultry Old Churchyard and medieval stones';
oldChurchyard.shortDescription =
  'A quiet specialist stop for the medieval hogback grave cover, carved grave slabs and the remains of Tillicoultry\'s early church setting.';
addTags(oldChurchyard, 'current-context', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  oldChurchyard,
  currentSource(
    'Tillicoultry Old Churchyard designation',
    'Historic Environment Scotland',
    'visitor-audit:old-churchyard',
    'https://portal.historicenvironment.scot/designation/LB42056',
    'Current-place curation: tourism=attraction; name=Tillicoultry Old Churchyard and medieval stones; visitor_place_type=Historic churchyard; visit_score=50; opening_hours:description=No formal visitor hours are published, visit respectfully in daylight; entrance_fee=Free; time_to_spend=20-35 minutes; description=Look for medieval stonework and carved memorials in Tillicoultry\'s early church setting; website=https://portal.historicenvironment.scot/designation/LB42056.',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: firpark.id,
    name: firpark.name,
    reason:
      'Tillicoultry\'s most distinctive bookable experience: a council-run 120-metre dry ski slope with equipment included and tuition for a range of abilities.',
    tagline: 'Year-round dry-slope skiing',
    visitorScore: 78,
    openingTimes:
      'Monday 16:00-21:30; Tuesday 09:00-21:30; Wednesday 09:00-21:00; Thursday 09:00-21:30; Friday 09:00-20:30; weekends 08:30-17:30. Book activities in advance.',
    admission:
      'Recreational skiing per hour: adult £12.40, child £6.50, equipment included. Tuition prices vary.',
    freeAdmission: false,
    organisationPills: [],
    sourceName: 'Clackmannanshire Council',
    sourceUrl: 'https://www.clacks.gov.uk/culture/firparkskicentre/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: glen.id,
    name: glen.name,
    reason:
      'The glen is the town\'s strongest natural setting, but the visit is currently reduced by the main-path closure and must use the signed east-side alternative.',
    tagline: 'Wooded burn beneath the Ochils',
    visitorScore: 70,
    openingTimes:
      'Open access subject to conditions. The main path remains closed from the first bridge; use the signed east-side alternative and avoid poor weather or high water.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Clackmannanshire Council',
    sourceUrl: 'https://www.clacks.gov.uk/visiting/tillicoultryglen/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: sterlingMills.id,
    name: sterlingMills.name,
    reason:
      'A genuine reason many people travel to Tillicoultry, combining outlet shopping with food, a play park, seasonal events and easy access at the foot of the Ochils.',
    tagline: 'Outlet shopping and family stop',
    visitorScore: 64,
    openingTimes: 'Open daily 10:00-18:00; several food and larger retail units open earlier.',
    admission: 'Free admission and free parking with no time limit.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Affinity Sterling Mills',
    sourceUrl: 'https://www.sterlingmills.com/sterling-mills-introduction',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: clockMill.id,
    name: clockMill.name,
    reason:
      'The clearest surviving piece of the textile town, best appreciated with the burn bridge, weavers\' cottages and the compact Upper Mill Street conservation area.',
    tagline: 'Textile-town landmark',
    visitorScore: 56,
    openingTimes: 'Exterior viewing at any time; daylight gives the best townscape context.',
    admission: 'Free exterior visit.',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/LB42054',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 5,
    featureId: oldChurchyard.id,
    name: oldChurchyard.name,
    reason:
      'A short specialist heritage stop for medieval stonework and unusually carved memorials, rather than a formal visitor attraction.',
    tagline: 'Medieval stones and memorials',
    visitorScore: 50,
    openingTimes: 'No formal visitor hours are published; visit respectfully in daylight.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/LB42056',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const devonWay = featureById('visitor-context:devon-way');
devonWay.name = 'The Devon Way from Tillicoultry';
devonWay.featureType = 'walking_route';
devonWay.shortDescription =
  'Join National Cycle Network Route 767 beside the River Devon for a largely traffic-free family route towards Dollar or west towards Alloa.';
addTags(devonWay, 'current-context', 'service-context-walk', 'visitor-context-trail', auditTag);
removeTag(devonWay, 'service-context-visitor');
replaceCurrentCurationSource(
  devonWay,
  currentSource(
    'The Devon Way active-travel route',
    'Clackmannanshire Council',
    'visitor-audit:trail:devon-way',
    'https://www.clacks.gov.uk/transport/cycling/',
    'Current-place curation: route=foot; bicycle=yes; trail_type=Traffic-free riverside active-travel route; visit_score=84; distance=Choose a short out-and-back or continue on the seven-mile Alloa-to-Dollar route; time_to_spend=45-180 minutes; accessibility=Mostly traffic-free shared path with an easy riverside section towards Dollar; entrance_fee=Free; description=Walk, wheel or cycle from Tillicoultry beside the River Devon on National Cycle Network Route 767; website=https://www.clacks.gov.uk/transport/cycling/.',
    'local_authority',
  ),
);

const glenTrail = upsertFeature(
  curatedPoint(
    'curated-trail:tillicoultry-glen-east-side',
    'Tillicoultry Glen east-side walk',
    'walking_route',
    [-3.7444, 56.1638],
    'A cautious short glen route using the permitted east side while the eroded main path remains closed from the first bridge.',
    currentSource(
      'Tillicoultry Glen walking update',
      'Clackmannanshire Council',
      'visitor-audit:trail:tillicoultry-glen-east-side',
      'https://www.clacks.gov.uk/visiting/tillicoultryglen/',
      'Current-place curation: route=foot; trail_type=Wooded glen walk with current diversion; visit_score=78; distance=Flexible short out-and-back on the permitted east side; time_to_spend=45-90 minutes; accessibility=Steep and uneven ground with cliff, rockfall, erosion and water hazards, unsuitable for wheels; entrance_fee=Free; description=Use the council-advised east-side route for burn and Ochil scenery while the damaged main path remains closed; website=https://www.clacks.gov.uk/visiting/tillicoultryglen/.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
    'representative_point',
    'medium',
  ),
);

const textileTrail = upsertFeature(
  curatedPoint(
    'curated-trail:tillicoultry-textile-town',
    'Tillicoultry textile-town walk',
    'walking_route',
    [-3.7452285, 56.1552202],
    'A flexible self-guided circuit linking the Clock Tower, Upper Mill Street, Clock Mill, weavers\' cottages and Murray Square.',
    currentSource(
      'Tillicoultry Conservation Area character appraisal',
      'Clackmannanshire Council',
      'visitor-audit:trail:tillicoultry-textile-town',
      'https://www.clacks.gov.uk/property/tillicoultryconservationarea/',
      'Current-place curation: route=foot; trail_type=Self-guided conservation-area walk; visit_score=68; distance=Flexible town-centre circuit of about 1.5 kilometres; time_to_spend=45-75 minutes; accessibility=Town pavements with normal kerbs and road crossings, Upper Mill Street rises towards the glen; entrance_fee=Free; description=Trace the clock towers, mills, burn and weavers\' streets that shaped Tillicoultry\'s textile-town character; website=https://www.clacks.gov.uk/property/tillicoultryconservationarea/.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail', 'heritage trail'],
    'representative_point',
    'medium',
  ),
);

const lauras = updateFood('osm-community:way-993045924', {
  score: 82,
  tagline: 'Best all-round',
  description:
    'Tillicoultry\'s strongest independent daytime food stop, known for breakfasts, light lunches, soups, home baking and afternoon tea in a central tearoom.',
  opening: 'Monday-Saturday 09:00-16:00, Sunday 10:00-16:00',
  price: '££',
  cuisine: 'Cafe, Scottish, British and home baking',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g551955-d2410726-Reviews-Laura_s_Tilly_Tearoom-Tillicoultry_Clackmannanshire_Scotland.html',
  organisation: "Laura's Tilly Tearoom and Tripadvisor",
  kind: 'cafe',
  address: '10A Bank Street, Tillicoultry, FK13 6DP',
});

const pennyLicks = updateFood('osm-community:way-320099376', {
  score: 79,
  tagline: 'Ice cream & cake',
  description:
    'A bright dog-friendly artisan ice-cream parlour that also does good coffee, waffles, cakes, sandwiches and light lunches after a town or glen walk.',
  opening: 'Tuesday-Sunday 10:00-17:00, Monday closed',
  price: '££',
  cuisine: 'Artisan ice cream, coffee and light lunches',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g551955-d25088404-Reviews-Penny_Licks-Tillicoultry_Clackmannanshire_Scotland.html',
  organisation: 'Penny Licks and Tripadvisor',
  kind: 'ice_cream_shop',
  address: '120 High Street, Tillicoultry, FK13 6DX',
  dogFriendly: true,
});

const millCafe = updateFood('osm-community:way-1022597762', {
  score: 74,
  tagline: 'Family cafe',
  description:
    'A spacious family-friendly cafe for breakfast, lunch, baking and an easy shopping-day pause, with dogs welcome on the outside patio.',
  opening: 'Daily 10:00-16:00',
  price: '£',
  cuisine: 'Cafe, Scottish, British and home baking',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g551955-d8524600-Reviews-Mill_Cafe-Tillicoultry_Clackmannanshire_Scotland.html',
  organisation: 'Mill Cafe and Tripadvisor',
  kind: 'cafe',
  address: '76 Moss Road, Tillicoultry, FK13 6NS',
  dogFriendly: true,
});

const smugglers = updateFood('osm-community:way-389616952', {
  score: 72,
  tagline: 'Full meal',
  description:
    'The best central option for a sit-down lunch or evening meal, with table service, fresh pub-and-bistro cooking and bookings advisable at busy times.',
  opening: 'Monday-Tuesday and Thursday-Sunday 12:00-21:00, Wednesday closed',
  price: '££',
  cuisine: 'British pub and bistro',
  website: 'https://camra.org.uk/pubs/smugglers-bar-bistro-tillicoultry-168554',
  organisation: 'Smugglers Bar & Bistro and CAMRA',
  kind: 'restaurant',
  address: '148 High Street, Tillicoultry, FK13 6DU',
});

const bakersBaristas = updateFood('osm-community:node-9431156493', {
  score: 67,
  tagline: 'Shopping break',
  description:
    'A reliable Sterling Mills cafe for barista coffee, freshly made muffins and savoury snacks when an outlet-shopping visit needs a pause.',
  opening: 'Monday-Sunday 09:00-18:00',
  price: '££',
  cuisine: 'Coffee, muffins and light lunches',
  website: 'https://www.sterlingmills.com/stores-at-sterling-mills/bbs-coffee-and-muffins',
  organisation: 'Bakers + Baristas and Affinity Sterling Mills',
  kind: 'cafe',
  address: 'Unit M3A, Sterling Mills, Moss Road, Tillicoultry, FK13 6HQ',
  reliability: 'official_non_statutory',
});
bakersBaristas.name = 'Bakers + Baristas';

const baynes = updateFood('osm-community:way-926391362', {
  score: 63,
  tagline: 'Budget bakery',
  description:
    'A practical High Street bakery for an early roll, pastry, coffee or simple takeaway lunch when a full cafe stop is unnecessary.',
  opening: 'Daytime bakery opening varies by day, check the current shop finder before relying on it',
  price: '£',
  cuisine: 'Bakery and takeaway',
  website: 'https://baynes.co.uk/our-shops/',
  organisation: "Bayne's",
  kind: 'fast_food',
  address: '102 High Street, Tillicoultry, FK13 6DY',
  reliability: 'official_non_statutory',
});

const parkingSourceUrl = 'https://www.clacks.gov.uk/transport/parking/';
const parkingPlaces: Array<{
  id: string;
  name: string;
  coordinates: [number, number];
  description: string;
}> = [
  {
    id: 'curated-parking:tillicoultry-upper-mill-street',
    name: 'Upper Mill Street Car Park',
    coordinates: [-3.7491119, 56.1576795],
    description: 'Free council car park for Upper Mill Street, Clock Mill and the lower glen approach.',
  },
  {
    id: 'curated-parking:tillicoultry-park-street',
    name: 'Park Street Car Park',
    coordinates: [-3.7484217, 56.1534748],
    description: 'Free council car park on Park Street, convenient for the west side of the town centre.',
  },
  {
    id: 'curated-parking:tillicoultry-bank-street',
    name: 'Bank Street Car Park',
    coordinates: [-3.7426322, 56.1529096],
    description: 'Free council car park close to Bank Street, the High Street and Laura\'s Tilly Tearoom.',
  },
  {
    id: 'curated-parking:tillicoultry-murray-place',
    name: 'Murray Place Car Park',
    coordinates: [-3.7398487, 56.1529489],
    description: 'Free council car park beside Murray Square at the east end of the town centre.',
  },
  {
    id: 'curated-parking:tillicoultry-stirling-street',
    name: 'Stirling Street Car Park',
    coordinates: [-3.7465921, 56.153959],
    description: 'Free council car park on Stirling Street for the central conservation-area streets.',
  },
];

const parkingIds = parkingPlaces.map((place) =>
  upsertFeature(
    curatedPoint(
      place.id,
      place.name,
      'parking',
      place.coordinates,
      place.description,
      currentSource(
        'Tillicoultry public parking audit',
        'Clackmannanshire Council',
        `visitor-audit:parking:${place.id}`,
        parkingSourceUrl,
        `Current-place curation: amenity=parking; name=${place.name}; parking=surface; access=public; price_display=Free; payment_required=no; maxstay=No time restriction published; description=${place.description}; website=${parkingSourceUrl}.`,
        'local_authority',
      ),
      ['current-context', 'service-context-parking'],
      'representative_point',
      'medium',
    ),
  ).id,
);

const murraySquareToilets = upsertFeature(
  curatedPoint(
    'curated-toilets:tillicoultry-murray-square',
    'Murray Square automated public toilets',
    'other',
    [-3.7403076, 56.1527717],
    'Operational council automated public convenience at Murray Square in the town centre.',
    currentSource(
      'Clackmannanshire estates asset register',
      'Clackmannanshire Council',
      'visitor-audit:toilets:murray-square',
      'https://www.clacks.gov.uk/form/1128.pdf',
      'Current-place curation: amenity=toilets; name=Murray Square automated public toilets; access=public; opening_hours:description=Operational council facility, daily hours are not published, check locally before relying on it; description=Automated public convenience at Murray Square in Tillicoultry town centre; website=https://www.clacks.gov.uk/form/1128.pdf.',
      'local_authority',
    ),
    ['current-context', 'service-context-toilets'],
    'representative_point',
    'medium',
  ),
);

const cemeteryToilets = upsertFeature(
  curatedPoint(
    'curated-toilets:tillicoultry-cemetery-dollar-road',
    'Tillicoultry Cemetery public toilets, Dollar Road',
    'other',
    [-3.7308479, 56.1540009],
    'Operational council public convenience within Tillicoultry Cemetery on Dollar Road.',
    currentSource(
      'Clackmannanshire estates asset register',
      'Clackmannanshire Council',
      'visitor-audit:toilets:cemetery-dollar-road',
      'https://www.clacks.gov.uk/form/1128.pdf',
      'Current-place curation: amenity=toilets; name=Tillicoultry Cemetery public toilets, Dollar Road; access=public; opening_hours:description=Operational council facility within the cemetery, daily hours are not published, visit in cemetery opening hours and check locally before relying on it; description=Public toilets within Tillicoultry Cemetery on Dollar Road; website=https://www.clacks.gov.uk/form/1128.pdf.',
      'local_authority',
    ),
    ['current-context', 'service-context-toilets'],
    'representative_point',
    'medium',
  ),
);

const recreationPicnic = upsertFeature(
  curatedPoint(
    'curated-picnic:tillicoultry-upper-mill-recreation-ground',
    'Upper Mill Street burnside picnic bench',
    'park',
    [-3.7492802, 56.1566797],
    'Mapped public seating beside Upper Mill Street and Tillicoultry Burn, just below Clock Mill and the recreation ground.',
    currentSource(
      'Upper Mill Street recreation ground and OpenStreetMap seating',
      'Clackmannanshire Council and OpenStreetMap contributors',
      'visitor-audit:picnic:upper-mill-recreation-ground',
      'https://www.openstreetmap.org/node/11805019172',
      'Current-place curation: tourism=picnic_site; name=Upper Mill Street burnside picnic bench; access=public; price_display=Free; opening_hours:description=Open public seating, daylight use recommended; description=Public seating beside Upper Mill Street and Tillicoultry Burn, just below Clock Mill and the recreation ground; website=https://www.openstreetmap.org/node/11805019172.',
      'local_authority',
    ),
    ['current-context', 'service-context-picnic'],
    'representative_point',
    'medium',
  ),
);

for (const [id, reason] of [
  [
    'curated-attraction:tillicoultry-tillicoultry-golf-club',
    'Excluded from the Tillicoultry town planner because its mapped visitor point falls west of the active NRS locality and the golf round is a specialist experience.',
  ],
  [
    'curated-attraction:tillicoultry-tillicoultry-cemetery-war-memorials',
    'Retained as local evidence but excluded from the main attraction list because it is a respectful minor stop rather than a general visitor draw.',
  ],
] as const) {
  const excluded = featureById(id);
  addTags(excluded, 'map-hidden', 'visitor-audit-excluded', auditTag);
  excluded.reviewNotes = reason;
  excluded.updatedAt = reviewedAt;
  excluded.reviewed = true;
}

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [lauras.id, pennyLicks.id, millCafe.id, smugglers.id, bakersBaristas.id, baynes.id],
  trails: [devonWay.id, glenTrail.id, textileTrail.id],
  picnic: [recreationPicnic.id],
  parking: parkingIds,
  toilets: [murraySquareToilets.id, cemeteryToilets.id],
};

const activeVisitorBoundary = pkg.project.townStudyArea?.visitorBoundary;
if (!activeVisitorBoundary) throw new Error('Tillicoultry visitor boundary is missing');
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Tillicoultry public visitor feature is not a point: ${featureId}`);
  }
  const location = point(feature.geometry.coordinates);
  if (!booleanPointInPolygon(location, activeVisitorBoundary)) {
    throw new Error(
      `Tillicoultry public visitor feature falls outside the visitor boundary: ${featureId}`,
    );
  }
  if (!booleanPointInPolygon(location, pkg.project.boundary)) {
    throw new Error(
      `Tillicoultry public visitor feature falls outside the retained parish study boundary: ${featureId}`,
    );
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  boundaryRule:
    'Every public town-planner point was tested against the curated Tillicoultry visitor boundary and the retained Tillicoultry parish study boundary. The visitor boundary preserves the NRS locality and adds only a narrow extension for the current east-side route into lower Tillicoultry Glen.',
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
      name: 'Tillicoultry Golf Club visitor round',
      reason: 'Mapped outside the active NRS Tillicoultry locality and specialist in appeal.',
    },
    {
      name: 'Tillicoultry Cemetery and war memorials',
      reason: 'Retained as evidence but not promoted as a main general attraction.',
    },
    {
      name: 'Customer-only and private OSM parking',
      reason: 'The public planner uses the five council-listed free public car parks only.',
    },
    {
      name: 'Generic OSM benches and picnic-table pins',
      reason: 'Grouped into one named recreation-ground picnic stop instead of publishing duplicates.',
    },
  ],
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Tillicoultry visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, ${parkingIds.length} car parks, 2 toilets and 1 picnic place.`,
);
