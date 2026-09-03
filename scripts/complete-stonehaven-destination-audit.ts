import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'stonehaven-scotland';
const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T22:30:00Z';
const projectPath = resolve('data/projects/stonehaven.json');
const plannerPath = resolve('data/stonehaven-coast-visitor-planner-curation.json');
const dogPath = resolve('data/stonehaven-coast-dog-access-curation.json');
const reportPath = resolve('data/review/stonehaven-full-visitor-audit-2026-08-27.json');

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & {
  project: ProjectPackage['project'] & Record<string, any>;
  features: MutableFeature[];
};

const urls = {
  destination: 'https://visitabdn.com/places/stonehaven',
  coastalMearns: 'https://visitabdn.com/places/stonehaven-the-mearns',
  fireballs: 'https://stonehavenfireballs.com/',
  paddleboarding: 'https://shpb.co.uk/',
  paddleboardingVisit: 'https://travel-trade.visitabdn.com/businesses/stonehaven-paddleboarding',
  quayGallery: 'https://visitabdn.com/businesses/the-quay-gallery',
  warMemorial: 'https://online.aberdeenshire.gov.uk/smrpub/master/detail.aspx?refno=NO88SE0046&tab=spatial',
  warMemorialVisitor: 'https://www.stunningstonehaven.com/home/find/lister/black-hill-war-memorial_1731',
  treasureTrail: 'https://www.treasuretrails.co.uk/products/what-to-do-stonehaven-aberdeenshire',
  councilWalks: 'https://www.aberdeenshire.gov.uk/media/25407/stonehavenwalkingandcyclingmap.pdf',
  localWalks: 'https://www.stonehavenbusiness.co.uk/assets/Uploads/SBA-2020-map-outside.pdf',
  castleWalk: 'https://www.walkhighlands.co.uk/aberdeenshire/dunnottar-castle.shtml',
  castleWalkMap: 'https://www.stunningstonehaven.com/virtualdirectorys/downloads/maps/569.pdf',
  woodsWalk: 'https://www.walkhighlands.co.uk/aberdeenshire/dunnottar-woods.shtml',
  coast: 'https://www.egcp.scot/stonehaven',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  parkingTariff: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/pay-and-display',
  voluntaryParking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/voluntary-parking-charges',
  osmCopyright: 'https://www.openstreetmap.org/copyright',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const report = JSON.parse(await readFile(reportPath, 'utf8')) as any;

const upsert = (item: MutableFeature) => {
  const index = pkg.features.findIndex((feature) => feature.id === item.id);
  if (index >= 0) pkg.features[index] = item;
  else pkg.features.push(item);
  return item;
};

const attractionAssessment = (score: number) => {
  const values = {
    experienceDepth: Math.min(30, Math.round(score * 0.3)),
    distinctiveness: Math.min(20, Math.round(score * 0.2)),
    presentation: Math.min(20, Math.round(score * 0.2)),
    journeyWorth: Math.min(15, Math.round(score * 0.15)),
    accessAndReliability: Math.min(10, Math.round(score * 0.1)),
    evidenceConfidence: 0,
    visitability: 'full_visitor_experience' as const,
  };
  const subtotal = Object.entries(values)
    .filter(([key]) => key !== 'visitability')
    .reduce((sum, [, value]) => sum + Number(value), 0);
  values.evidenceConfidence = score - subtotal;
  return values;
};

const makeAttraction = (spec: {
  slug: string;
  name: string;
  score: number;
  coordinates: [number, number];
  featureType: HeritageFeature['featureType'];
  significance: HeritageFeature['significance'];
  description: string;
  tagline: string;
  reason: string;
  time: string;
  opening: string;
  admission: string;
  website: string;
  sourceName: string;
  evidenceUrls: string[];
  guide: Record<string, any>;
  documentedDateText?: string;
  earliestPossibleYear?: number;
  dateBasis?: HeritageFeature['dateBasis'];
}) => {
  const id = `curated-attraction:stonehaven-${spec.slug}`;
  const review = {
    status: 'editorially_researched' as const,
    category: 'attraction' as const,
    methodVersion: '2026-08-13-researched-visitor-value-v1',
    reviewedAt: reviewedDate,
    scoreRationale: spec.reason,
    evidenceUrls: spec.evidenceUrls,
    attractionAssessment: attractionAssessment(spec.score),
  };
  const feature = upsert({
    id,
    projectId,
    name: spec.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Aberdeenshire',
    locality: 'Stonehaven',
    featureType: spec.featureType,
    significance: spec.significance,
    geometry: { type: 'Point', coordinates: spec.coordinates },
    locationType: 'exact',
    documentedDateText: spec.documentedDateText,
    earliestPossibleYear: spec.earliestPossibleYear,
    latestPossibleYear: spec.earliestPossibleYear,
    dateBasis: spec.dateBasis ?? 'unknown',
    dateConfidence: spec.earliestPossibleYear ? 'high' : 'unknown',
    locationConfidence: 'high',
    survival: 'substantially_intact',
    shortDescription: spec.description,
    sourceRecords: spec.evidenceUrls.map((sourceUrl, index) => ({
      sourceName: index === 0 ? spec.sourceName : `${spec.name} supporting visitor evidence`,
      sourceOrganisation: spec.sourceName,
      sourceUrl,
      accessedAt: reviewedAt,
      reliability: sourceUrl.includes('aberdeenshire.gov.uk') ? 'local_authority' : 'official_non_statutory',
      notes: index === 0
        ? `Current visitor evidence. Current-place curation: visitor_place_type=Attraction; visit_score=${spec.score}; opening_hours:description=${spec.opening}; fee=${spec.admission}; description=${spec.tagline}: ${spec.description}`
        : 'Supporting current visitor, access or historic evidence.',
    })),
    tags: ['curated-visitor', 'home-standalone-place'],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
    attractionGuide: spec.guide,
    visitorWebsiteUrl: spec.website,
    editorialReview: review,
  } as MutableFeature);
  const highlight: VisitorHighlight = {
    rank: 0,
    featureId: id,
    name: spec.name,
    reason: spec.reason,
    tagline: spec.tagline,
    visitorScore: spec.score,
    timeToSpend: spec.time,
    openingTimes: spec.opening,
    admission: spec.admission,
    freeAdmission: /^free/i.test(spec.admission),
    visitorWebsiteUrl: spec.website,
    editorialReview: review,
    sourceName: spec.sourceName,
    sourceUrl: spec.evidenceUrls[0],
    verifiedInBoundaryAt: reviewedDate,
  };
  return { feature, highlight };
};

const newAttractions = [
  makeAttraction({
    slug: 'fireballs-ceremony',
    name: 'Stonehaven Fireballs Ceremony',
    score: 82,
    coordinates: [-2.2069, 56.9605],
    featureType: 'other',
    significance: 'national',
    description: 'Stonehaven’s volunteer-run Hogmanay spectacle: around 40 participants swing blazing fireballs along High Street before a harbour firework display.',
    tagline: 'Hogmanay fireballs and fireworks',
    reason: 'A nationally distinctive living tradition with a confirmed annual programme, reduced because it is available only at midnight on Hogmanay and reaches capacity.',
    time: '60–120 minutes including arrival time',
    opening: '31 December; gathering from about 22:00, ceremony at midnight for roughly 20 minutes',
    admission: 'Free; donations welcomed; no ticket required',
    website: urls.fireballs,
    sourceName: 'Stonehaven Fireballs Association',
    evidenceUrls: [urls.fireballs, 'https://visitabdn.com/events/241219-stonehaven-fireballs-ceremony-stonehaven-high-street'],
    guide: {
      headline: 'See Stonehaven welcome the New Year with fire',
      intro: 'Arrive well before 23:00 because High Street access closes when capacity is reached. The midnight procession lasts about 20 minutes and is followed by fireworks.',
      bestFor: ['Living tradition', 'Night-time spectacle', 'Hogmanay'],
      parking: 'Do not expect normal Old Town access: temporary road closures and waiting restrictions apply. Use current event travel advice.',
      toilets: 'Use the event’s current temporary/public provision; verify before setting out.',
    },
  }),
  makeAttraction({
    slug: 'black-hill-war-memorial',
    name: 'Black Hill War Memorial and Viewpoint',
    score: 78,
    coordinates: [-2.20273, 56.95498],
    featureType: 'memorial',
    significance: 'regional',
    description: 'A deliberately unfinished classical temple, unveiled in 1923, with wide views over Stonehaven, the coast and Dunnottar headland.',
    tagline: 'Ruined-temple memorial and coast view',
    reason: 'A visually distinctive, freely accessible 1923 memorial that rewards the climb with one of Stonehaven’s strongest viewpoints.',
    time: '30–60 minutes from the harbour',
    opening: 'Open all hours; visit in daylight for the path and views',
    admission: 'Free',
    website: urls.warMemorialVisitor,
    sourceName: 'Aberdeenshire Historic Environment Record',
    evidenceUrls: [urls.warMemorial, urls.warMemorialVisitor],
    documentedDateText: 'Unveiled 20 May 1923',
    earliestPossibleYear: 1923,
    dateBasis: 'documented_event',
    guide: {
      headline: 'Climb to Stonehaven’s intentionally unfinished memorial',
      intro: 'The temple form was left apparently incomplete to represent lives cut short by war. The summit also gives extensive views over the town and coast.',
      bestFor: ['Views', 'Architecture', 'Remembrance', 'Photography'],
      parking: 'Start from Backies/harbour parking and follow the signed coastal route; there is no need to drive onto the hill.',
      toilets: 'Old Pier public toilets are the closest published town provision.',
      picnic: 'Benches are mapped around the summit approach, but no formal picnic site is claimed.',
    },
  }),
  makeAttraction({
    slug: 'paddleboarding',
    name: 'Stonehaven Paddleboarding',
    score: 78,
    coordinates: [-2.2011, 56.9602],
    featureType: 'other',
    significance: 'regional',
    description: 'Year-round harbour-based paddleboard lessons, coastal tours, equipment rental and bookable wood-fired sauna sessions.',
    tagline: 'Harbour paddling and coastal tours',
    reason: 'A substantial bookable coastal activity with equipment and instruction included, beginner harbour sessions and more ambitious wildlife and cave tours.',
    time: 'Allow 1½–3 hours depending on activity',
    opening: 'Open year-round from sunrise to sunset; all activities require direct booking',
    admission: 'Paid activity; price depends on lesson, tour, rental or sauna booking',
    website: urls.paddleboarding,
    sourceName: 'Stonehaven Paddleboarding',
    evidenceUrls: [urls.paddleboarding, urls.paddleboardingVisit],
    guide: {
      headline: 'Get onto the water from Stonehaven Harbour',
      intro: 'Beginner lessons use the sheltered harbour; competent paddlers can book coastal tours. Boards, wetsuits, boots and buoyancy aids are supplied.',
      bestFor: ['Active visits', 'Families and groups', 'Coastal scenery', 'Wildlife'],
      parking: 'Backies car park is the practical harbour car park: 42 free spaces and 2 disabled bays.',
      toilets: 'The operator has no toilets on site; public toilets are available by the harbour car-park entrance.',
      foodNote: 'The harbour has several cafés, pubs and restaurants within a short walk.',
    },
  }),
  makeAttraction({
    slug: 'quay-gallery',
    name: 'The Quay Gallery',
    score: 68,
    coordinates: [-2.2088, 56.9632],
    featureType: 'gallery',
    significance: 'local',
    description: 'A small independent gallery with a carefully curated UK collection of paintings, prints, cards and decorative objects.',
    tagline: 'Independent art in a domestic setting',
    reason: 'A genuine, current indoor art stop that adds variety to the town visit, reduced for its compact retail-gallery scale and limited weekly opening.',
    time: '30–45 minutes',
    opening: 'Tuesday–Saturday 10:00–17:00; Sunday and Monday closed',
    admission: 'Free to browse',
    website: urls.quayGallery,
    sourceName: 'VisitAberdeenshire',
    evidenceUrls: [urls.quayGallery],
    guide: {
      headline: 'Browse a compact independent UK art collection',
      intro: 'The gallery presents paintings, prints, cards and objets d’art in an informal domestic setting rather than a large institutional space.',
      bestFor: ['Art', 'Rainy-day browsing', 'Gifts'],
      parking: 'Market Square car park is the nearest large official car park.',
      toilets: 'Margaret Street public toilets are the closest published central provision.',
    },
  }),
];

const existingHighlights = pkg.project.visitorHighlights as VisitorHighlight[];
const retainedHighlights = existingHighlights.filter(
  (item) => !newAttractions.some(({ feature }) => feature.id === item.featureId),
);
pkg.project.visitorHighlights = [...retainedHighlights, ...newAttractions.map((item) => item.highlight)]
  .sort((left, right) => (right.visitorScore ?? 0) - (left.visitorScore ?? 0))
  .map((item, index) => ({ ...item, rank: index + 1 }));

const makeTrail = (spec: {
  slug: string;
  name: string;
  score: number;
  coordinates: [number, number];
  description: string;
  tagline: string;
  type: string;
  distance: string;
  duration: string;
  difficulty: string;
  website: string;
  evidenceUrls: string[];
}) => upsert({
  id: `curated-trails:stonehaven-${spec.slug}`,
  projectId,
  name: spec.name,
  alternativeNames: [],
  countryCode: 'GB-SCT',
  region: 'Aberdeenshire',
  locality: 'Stonehaven',
  featureType: 'other',
  significance: spec.score >= 75 ? 'regional' : 'local',
  geometry: { type: 'Point', coordinates: spec.coordinates },
  locationType: 'route_marker',
  dateBasis: 'unknown',
  dateConfidence: 'unknown',
  locationConfidence: 'high',
  survival: 'substantially_intact',
  shortDescription: spec.description,
  sourceRecords: spec.evidenceUrls.map((sourceUrl, index) => ({
    sourceName: index === 0 ? spec.name : `${spec.name} supporting route evidence`,
    sourceOrganisation: index === 0 ? new URL(sourceUrl).hostname : 'Stonehaven visitor route evidence',
    sourceUrl,
    accessedAt: reviewedAt,
    reliability: sourceUrl.includes('aberdeenshire.gov.uk') ? 'local_authority' : 'official_non_statutory',
    notes: index === 0
      ? `Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=${spec.score}; trail_score=${spec.score}; trail_type=${spec.type}; fee=Free; price_display=Free; distance=${spec.distance}; duration=${spec.duration}; difficulty=${spec.difficulty}; dog_friendly=Suitable with close control; description=${spec.tagline}: ${spec.description}`
      : 'Supporting route map and visitor evidence.',
  })),
  tags: ['curated-visitor', 'visitor-context-trail'],
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  reviewed: true,
  evidenceScope: 'parish_evidence',
  visitorWebsiteUrl: spec.website,
  editorialReview: {
    status: 'editorially_researched',
    category: 'trail',
    methodVersion: '2026-08-13-researched-visitor-value-v1',
    reviewedAt: reviewedDate,
    scoreRationale: `${spec.tagline}. Score reflects route quality, current documentation, access constraints and Stonehaven visitor relevance.`,
    evidenceUrls: spec.evidenceUrls,
  },
} as MutableFeature);

const castleTrail = makeTrail({
  slug: 'dunnottar-castle-coastal-trail',
  name: 'Stonehaven to Dunnottar Castle Coastal Trail',
  score: 82,
  coordinates: [-2.2025, 56.9575],
  description: 'A dramatic signed clifftop route from Stonehaven harbour via Black Hill War Memorial to Dunnottar Castle, with an out-and-back return avoiding the road.',
  tagline: 'Clifftop route to Dunnottar',
  type: 'Signed coastal walk',
  distance: '3 miles / 5 km return circuit',
  duration: '1½–2 hours walking, excluding castle admission',
  difficulty: 'Steep initial climb, cliff edges and an inferior road-return option; retrace the coastal path for the scenic return',
  website: urls.castleWalk,
  evidenceUrls: [urls.castleWalk, urls.castleWalkMap, urls.coastalMearns],
});

const woodsTrail = makeTrail({
  slug: 'dunnottar-woods-follies-circuit',
  name: 'Dunnottar Woods Follies Circuit',
  score: 74,
  coordinates: [-2.231, 56.9505],
  description: 'A waymarked woodland circuit on Stonehaven’s fringe visiting the Shell House, Lady Kennedy’s Bath, ice house and other Dunnottar estate follies.',
  tagline: 'Woodland circuit through estate follies',
  type: 'Waymarked woodland circuit',
  distance: '2¼ miles / 3.5 km',
  duration: 'About 1½ hours',
  difficulty: 'Woodland paths; muddy after rain; the recommended start is outside the town centre',
  website: urls.woodsWalk,
  evidenceUrls: [urls.woodsWalk, urls.localWalks],
});

const cowieTrail = makeTrail({
  slug: 'boardwalk-cowie-geology-walk',
  name: 'Stonehaven Boardwalk to Cowie Geology Walk',
  score: 70,
  coordinates: [-2.2061, 56.968],
  description: 'A seafront and boardwalk walk north to Cowie, the old net-drying greens and the Highland Boundary Fault viewpoint.',
  tagline: 'Boardwalk to Cowie and the fault',
  type: 'Seafront and geology walk',
  distance: 'About 2 miles / 3.2 km return',
  duration: '60–90 minutes',
  difficulty: 'Mostly promenade and boardwalk; obey any current cliff-path closure beyond the viewpoint',
  website: urls.coast,
  evidenceUrls: [urls.coast, urls.localWalks, urls.councilWalks],
});

const mineralwellTrail = makeTrail({
  slug: 'mineralwell-park-cowie-water-loop',
  name: 'Mineralwell Park and Cowie Water Loop',
  score: 66,
  coordinates: [-2.222, 56.9705],
  description: 'A gentle park circuit beside Cowie Water, combining riverside paths, open grass, play facilities and views towards the Glenury railway viaduct.',
  tagline: 'Riverside park and viaduct loop',
  type: 'Easy park circuit',
  distance: 'Flexible short circuit',
  duration: '45–75 minutes',
  difficulty: 'Generally easy park paths; check conditions after heavy rain',
  website: urls.councilWalks,
  evidenceUrls: [urls.councilWalks, urls.localWalks],
});

const existingTreasure = pkg.features.find((item) => item.id === 'curated-trails:stonehaven-parks-harbour-treasure-trail');
const existingHeritage = pkg.features.find((item) => item.id === 'curated-trails:stonehaven-market-square-harbour-loop');
if (!existingTreasure || !existingHeritage) throw new Error('Missing existing Stonehaven trails');

const makePicnic = (spec: {
  slug: string;
  name: string;
  coordinates: [number, number];
  tableCount: number;
  description: string;
  osmIds: string[];
}) => upsert({
  id: `curated-picnic:stonehaven-${spec.slug}`,
  projectId,
  name: spec.name,
  alternativeNames: [],
  countryCode: 'GB-SCT',
  region: 'Aberdeenshire',
  locality: 'Stonehaven',
  featureType: 'other',
  significance: 'local',
  geometry: { type: 'Point', coordinates: spec.coordinates },
  locationType: 'exact',
  dateBasis: 'unknown',
  dateConfidence: 'unknown',
  locationConfidence: 'high',
  survival: 'substantially_intact',
  shortDescription: spec.description,
  sourceRecords: [{
    sourceName: 'OpenStreetMap picnic-table audit',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceUrl: urls.osmCopyright,
    accessedAt: reviewedAt,
    reliability: 'community_generated',
    notes: `Current-place curation: visitor_place_type=Picnic table; leisure=picnic_table; access=public; fee=no; price_display=Free; table_count=${spec.tableCount}; covered=no; osm_elements=${spec.osmIds.join(',')}; description=${spec.description}`,
  }],
  tags: ['curated-visitor', 'visitor-context-picnic', 'osm-community-picnic'],
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  reviewed: true,
  evidenceScope: 'parish_evidence',
} as MutableFeature);

const beachPicnic = makePicnic({
  slug: 'beach-road-tables',
  name: 'Beach Road Picnic Tables',
  coordinates: [-2.205966, 56.96811],
  tableCount: 2,
  description: 'Two uncovered public picnic tables beside Beach Road, convenient for the promenade, open-air pool and seafront takeaways.',
  osmIds: ['node/11123505713', 'node/11123505714'],
});

const bayWalkPicnic = makePicnic({
  slug: 'bay-walk-tables',
  name: 'Bay Walk Picnic Tables',
  coordinates: [-2.20505, 56.9616],
  tableCount: 5,
  description: 'Two small uncovered table clusters on Bay Walk between the town centre and harbour, with five mapped picnic tables in total.',
  osmIds: ['node/12160235570', 'node/12160235574', 'node/12160235581', 'node/12160262268', 'node/12160262269'],
});

const parkingSpecs: Record<string, { description: string; details: string }> = {
  'curated-parking:stonehaven-beach-promenade': {
    description: '41 standard spaces plus 4 disabled bays. Parking is free; optional cashless contributions are £1 for 1 hour, £3 for 3 hours or £6.50 all day using RingGo or PayByPhone code 985533.',
    details: 'amenity=parking; access=public; fee=no; payment_required=no; price_display=Free (optional contribution); capacity=41; disabled_spaces=4; voluntary_contribution=£1/1 hour, £3/3 hours, £6.50/all day; payment=RingGo or PayByPhone; location_code=985533',
  },
  'curated-parking:stonehaven-market-square': {
    description: '66 pay-and-display spaces plus 6 disabled bays. Charged Monday–Saturday 8am–5pm: £0.70/1 hour, £1.30/2 hours, £3.90/5 hours or £6.50/9 hours; cash, card, contactless, RingGo or PayByPhone code 985573.',
    details: 'amenity=parking; access=public; fee=yes; payment_required=yes; price_display=£0.70/1 hour, £1.30/2 hours, £3.90/5 hours, £6.50/9 hours; capacity=66; disabled_spaces=6; chargeable_hours=Monday-Saturday 08:00-17:00; payment=cash, card, contactless, RingGo or PayByPhone; location_code=985573; blue_badge=exempt',
  },
  'curated-parking:stonehaven-railway-station': {
    description: '75 free spaces plus 2 disabled bays beside Stonehaven station. No payment is required; useful for rail arrivals and longer town visits.',
    details: 'amenity=parking; access=public; fee=no; payment_required=no; price_display=Free; capacity=75; disabled_spaces=2',
  },
  'curated-parking:stonehaven-backies': {
    description: '42 free spaces plus 2 disabled bays immediately behind the harbour and Tolbooth. No payment is required; do not use unmarked working-harbour areas.',
    details: 'amenity=parking; access=public; fee=no; payment_required=no; price_display=Free; capacity=42; disabled_spaces=2',
  },
};

for (const [id, spec] of Object.entries(parkingSpecs)) {
  const feature = pkg.features.find((item) => item.id === id);
  if (!feature) throw new Error(`Missing parking feature ${id}`);
  feature.shortDescription = spec.description;
  feature.sourceRecords = [
    {
      sourceName: 'Aberdeenshire Council car parks',
      sourceOrganisation: 'Aberdeenshire Council',
      sourceUrl: urls.parking,
      accessedAt: reviewedAt,
      reliability: 'local_authority',
      notes: `Current-place curation: visitor_place_type=Parking; ${spec.details}; description=${spec.description}`,
    },
    {
      sourceName: id.includes('market-square') ? 'Pay and Display parking' : 'Voluntary parking charges',
      sourceOrganisation: 'Aberdeenshire Council',
      sourceUrl: id.includes('market-square') ? urls.parkingTariff : urls.voluntaryParking,
      accessedAt: reviewedAt,
      reliability: 'local_authority',
      notes: 'Current tariff and payment-method evidence checked 27 August 2026.',
    },
  ];
  feature.updatedAt = reviewedAt;
}

planner.projects[projectId].trails = [
  castleTrail.id,
  existingTreasure.id,
  cowieTrail.id,
  existingHeritage.id,
  mineralwellTrail.id,
];
planner.projects[projectId].picnic = [beachPicnic.id, bayWalkPicnic.id];

const dogEntries = dog.projects[projectId].attraction;
const dogUpdates: Record<string, any> = {
  'curated-attraction:stonehaven-fireballs-ceremony': {
    rating: 0,
    status: 'restricted',
    label: 'Leave dogs away from fireballs and fireworks',
    summary: 'Dense crowds, swinging flames, midnight noise and fireworks make this unsuitable for ordinary pet dogs.',
    sourceName: 'Stonehaven Fireballs event conditions',
    sourceUrl: urls.fireballs,
  },
  'curated-attraction:stonehaven-black-hill-war-memorial': {
    rating: 2,
    status: 'restricted',
    label: 'Dog-suitable climb with cliff care',
    summary: 'Dogs can accompany the public hill path on a lead, but the route approaches steep coastal ground, livestock and exposed edges.',
    sourceName: 'Scottish Outdoor Access Code and route audit',
    sourceUrl: urls.outdoorCode,
  },
  'curated-attraction:stonehaven-paddleboarding': {
    rating: 0,
    status: 'restricted',
    label: 'Not an ordinary dog activity',
    summary: 'The published lessons, tours, rental and sauna offer does not include dogs. No ordinary pet participation is claimed.',
    sourceName: 'Stonehaven Paddleboarding activity review',
    sourceUrl: urls.paddleboarding,
  },
  'curated-attraction:stonehaven-quay-gallery': {
    rating: 0,
    status: 'unconfirmed',
    label: 'Gallery dog policy not published',
    summary: 'No reliable current dog policy is published for the compact gallery interior. Confirm directly before arriving with a dog.',
    sourceName: 'VisitAberdeenshire gallery listing',
    sourceUrl: urls.quayGallery,
  },
  [castleTrail.id]: {
    rating: 2,
    status: 'restricted',
    label: 'Dog-suitable with severe cliff-edge care',
    summary: 'Dogs can use the public trail under close control, but use a short lead around livestock, steep steps, exposed cliffs and busy viewpoints.',
    sourceName: 'Walkhighlands route and Outdoor Access Code',
    sourceUrl: urls.castleWalk,
  },
  [woodsTrail.id]: {
    rating: 3,
    status: 'welcoming',
    label: 'Strong woodland dog walk',
    summary: 'The woodland paths make a substantial dog walk; maintain close control around wildlife, other visitors, roads and muddy sections.',
    sourceName: 'Walkhighlands route and Outdoor Access Code',
    sourceUrl: urls.woodsWalk,
  },
  [cowieTrail.id]: {
    rating: 2,
    status: 'restricted',
    label: 'Promenade dog walk with cliff restrictions',
    summary: 'Use a lead around the promenade, roads and Cowie, and obey any closure or access sign on the northern cliff section.',
    sourceName: 'East Grampian Coastal Partnership route review',
    sourceUrl: urls.coast,
  },
  [mineralwellTrail.id]: {
    rating: 3,
    status: 'welcoming',
    label: 'Good riverside park dog walk',
    summary: 'The open park circuit is useful with a dog; keep close control around children, sport, wildlife and the river.',
    sourceName: 'Scottish Outdoor Access Code and council route map',
    sourceUrl: urls.outdoorCode,
  },
  [beachPicnic.id]: {
    rating: 2,
    status: 'restricted',
    label: 'Dog-suitable outdoor tables',
    summary: 'Dogs can accompany an outdoor picnic under close control; keep clear of food, children and the nearby road.',
    sourceName: 'OpenStreetMap audit and Outdoor Access Code',
    sourceUrl: urls.outdoorCode,
  },
  [bayWalkPicnic.id]: {
    rating: 2,
    status: 'restricted',
    label: 'Dog-suitable outdoor tables',
    summary: 'Dogs can accompany an outdoor picnic under close control; keep clear of food, pedestrians, roads and harbour edges.',
    sourceName: 'OpenStreetMap audit and Outdoor Access Code',
    sourceUrl: urls.outdoorCode,
  },
};
for (const [id, value] of Object.entries(dogUpdates)) {
  dogEntries[id] = { ...value, reviewedAt: reviewedDate };
}

pkg.project.touristAppeal.summary = 'A complete seaside town with a working 1825 harbour, rare 1934 Art Deco seawater lido, broad bay, free museum, year-round water activities, gallery, major Hogmanay tradition, strong food and five useful town walking routes—scored without borrowing Dunnottar Castle.';
pkg.project.touristAppeal.dogAccessSummary = 'The beach, promenade and park routes support a strong dog day, and many food businesses publish access. Clifftop trails need short-lead control; Fireballs, paddleboarding, the pool and several interiors remain unsuitable or unconfirmed.';
pkg.project.touristAppeal.sourceUrls = [...new Set([
  ...(pkg.project.touristAppeal.sourceUrls ?? []),
  ...Object.values(urls),
])];
pkg.project.townGuide.sourceUrls = pkg.project.touristAppeal.sourceUrls;
pkg.project.townGuide.intro = 'Stonehaven earns its score inside its own boundary: swim in the 1934 seawater lido, explore the harbour, bay and museum, book a coastal activity, browse local art and choose among clue, heritage, park, boardwalk and clifftop routes. Dunnottar Castle remains a separate See attraction.';
pkg.project.townGuide.suggestedTime = 'A full day; two days with a major trail, paddleboarding or an event';

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(errors.map((item) => `${item.recordId}: ${item.message}`).join('\n'));

report.reviewedAt = reviewedAt;
report.attractions = (pkg.project.visitorHighlights as VisitorHighlight[]).map((item) => item.featureId);
report.eats = planner.projects[projectId].eat;
report.trails = planner.projects[projectId].trails;
report.researchedNearbyTrails = [woodsTrail.id];
report.picnic = planner.projects[projectId].picnic;
report.parking = planner.projects[projectId].parking;
report.categoryCounts = {
  see: report.attractions.length,
  eat: report.eats.length,
  trails: report.trails.length,
  picnic: report.picnic.length,
  parking: report.parking.length,
  toilets: report.toilets.length,
};
report.notes = [
  'Dunnottar Castle remains a separate regional See attraction; the signed coastal route from Stonehaven is published as a trail without adding the castle to the town score.',
  'The View at Stonehaven Golf Club and the Dunnottar Woods circuit start are outside the strict town boundary. The woods route is retained in the research record but is not published in Stonehaven’s town planner and does not alter the town score.',
  'Stonehaven Sea Safari and the seasonal land train were assessed but withheld because a sufficiently complete current operator timetable and booking contract could not be verified.',
  'Two picnic-table clusters are published from the current local OSM extract: two tables at Beach Road and five on Bay Walk.',
  'All four council car parks now include spaces, disabled bays, charge status, current tariff where applicable, payment methods and mobile-payment codes.',
  'The former Stonehaven beach toilets remain closed and are not published.',
];

await Promise.all([
  writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8'),
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8'),
  writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
]);

console.log(`Stonehaven destination audit complete: ${report.categoryCounts.see} See, ${report.categoryCounts.eat} Eat, ${report.categoryCounts.trails} Trails, ${report.categoryCounts.picnic} Picnic, ${report.categoryCounts.parking} Parking, ${report.categoryCounts.toilets} Toilets.`);
