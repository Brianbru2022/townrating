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

const projectPath = resolve('data/projects/bridge-of-earn.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/bridge-of-earn-visitor-audit-2026-08-06.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-06T00:00:00Z';
const reviewedDate = '2026-08-06';
const auditTag = 'bridge-of-earn-visitor-audit';
const visitorPackTag = 'bridge-of-earn-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Bridge of Earn feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
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
  locationType: HeritageFeature['locationType'] = 'representative_point',
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
    tags: [...new Set([...tags, auditTag, visitorPackTag])],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-06; excluded from historic dating and heat-map evidence.',
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
    kind: 'cafe' | 'restaurant' | 'fast_food' | 'bakery';
    address: string;
    dogFriendly?: boolean;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  if (options.name) feature.name = options.name;
  feature.featureType = options.kind;
  feature.shortDescription = options.description;
  feature.address = options.address;
  addTags(
    feature,
    'current-context',
    'service-context-food',
    'visitor-context-food',
    auditTag,
    visitorPackTag,
  );
  const dogMetadata = options.dogFriendly ? '; dog_friendly=yes' : '';
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor audit`,
      options.organisation,
      `visitor-audit-food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}${dogMetadata}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
      options.reliability ?? 'official_non_statutory',
    ),
  );
  return feature;
}

pkg.project.centre = [-3.4055, 56.3492];
pkg.project.touristAppeal = {
  rating: 0,
  label: 'Not a tourist town',
  summary:
    'Bridge of Earn is a useful village pause rather than a tourist destination. Dunbarney Church, the fragmentary old bridge, Victory Park and two good food stops support a pleasant short break, but the village does not have enough destination-scale sights to merit a journey on its own.',
};

pkg.project.visualIdentity = {
  theme: 'perthshire-church-and-river-crossing',
  badgeImage: '/town-guides/bridge-of-earn-dunbarney-church-2026-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of Dunbarney Parish Church in Bridge of Earn',
  heroImage: '/town-guides/bridge-of-earn-dunbarney-church-2026-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of Dunbarney Parish Church in Bridge of Earn',
  primaryColour: '#204E50',
  accentColour: '#B97835',
  backgroundColour: '#EFF5EE',
  heroObjectPosition: '50% 50%',
  motifs: ['Dunbarney', 'Old bridge', 'Country walks', 'Local food'],
};

pkg.project.townGuide = {
  headline: 'A quiet village with an old crossing story',
  intro:
    'Bridge of Earn works best as an unhurried pause south of Perth. Dunbarney Parish Church, the fragmentary medieval crossing and village memorial provide a light heritage thread, while nearby country paths and two good food stops give reasons to linger.',
  bestFor: ['Short village pauses', 'Historic churches', 'Country walks', 'Coffee and lunch stops'],
  perfectFor: [
    'A relaxed hour between larger Perthshire sights',
    'Walkers beginning a local circular route',
    'Visitors who enjoy small villages without a formal attraction circuit',
  ],
  suggestedFirstVisit: {
    title: 'Dunbarney Church, Victory Park and the old crossing',
    summary:
      'Begin at Dunbarney Parish Church, pass the memorial and Victory Park, then make the short northward link towards the surviving Old Bridge of Earn remains before choosing a village meal or coffee stop.',
  },
  dontMiss: [
    'Dunbarney Parish Church',
    'Old Bridge of Earn remains',
    'Victory Park',
    'Bridge of Earn War Memorial and Institute',
  ],
  suggestedTime: '1-2 hours; half a day with a rural walk',
  visitorMood:
    'A low-key Perthshire pause for a church, a short walk and a good local cafe.',
  sourceUrls: [
    'https://www.nationalchurchestrust.org/church/bridge-earn-dunbarney-church',
    'https://portal.historicenvironment.scot/designation/SM9468',
    'https://consult.pkc.gov.uk/communities/bridge-of-earn-management-plan/',
    'https://www.foundationscotland.org.uk/about-us/our-news/bridge-of-earn-children-benefit-from-victory-park-victory',
    'https://theearncoffeeshop.co.uk/',
    'https://www.thevillageinn-bridgeofearn.foodndrinkscotland.co.uk/',
    'https://spicegardeninbridgeofearn.co.uk/',
    'https://www.towerbakery.co.uk/shops/',
    'https://www.pkc.gov.uk/media/49518/Walking-the-Perth-Kinross-Council-Core-paths/pdf/WalkPKCPBookFINAL.pdf?m=637858801155000000',
    'https://www.ramblers.org.uk/go-walking/routes/circular-walk-west-bridge-earn-perth',
    'https://liveactive.co.uk/whats-on-offer/wellbeing/stride-for-life/',
    'https://www.pkc.gov.uk/wcmap',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Bridge of Earn town study area is missing');
const oldBridgeExtension = buffer(
  lineString([
    [-3.40512, 56.35145],
    [-3.40482, 56.35182],
  ]),
  0.1,
  { units: 'kilometers' },
);
if (!oldBridgeExtension) throw new Error('Could not build the Old Bridge visitor extension');
const coffeeShopExtension = buffer(
  lineString([
    [-3.412, 56.35225],
    [-3.411598, 56.3553455],
  ]),
  0.12,
  { units: 'kilometers' },
);
if (!coffeeShopExtension) throw new Error('Could not build the Earn Coffee Shop extension');
const visitorBoundary = union(
  featureCollection([
    townStudyArea.localityBoundary,
    oldBridgeExtension,
    coffeeShopExtension,
  ]),
);
if (!visitorBoundary) throw new Error('Could not build the Bridge of Earn visitor boundary');
visitorBoundary.properties = {
  sourceDataset: 'Curated Bridge of Earn visitor boundary',
  originalSourceDataset: townStudyArea.sourceName,
  basis:
    'NRS Bridge of Earn locality with narrow Old Bridge of Earn and Earn Coffee Shop visitor extensions',
  reviewedAt: reviewedDate,
  reason:
    'The statistical locality is retained unchanged. Two narrow extensions include the namesake historic crossing and the food business that uses a Bridge of Earn address immediately beyond the locality edge.',
};
townStudyArea.visitorBoundary = visitorBoundary;
townStudyArea.notes =
  'The original NRS 2022 Bridge of Earn locality is preserved unchanged for provenance and historic selection. The tourist-facing boundary adds only narrow links to the Old Bridge of Earn remains and The Earn Coffee Shop. It excludes Moncreiffe Hill, wider Perth attractions, estate houses and places beyond those visitor corridors.';

const church = featureById('hes-listed-building:LB4537');
church.name = 'Dunbarney Parish Church';
church.featureType = 'historic_church';
church.shortDescription =
  'A handsome 1787 red-sandstone parish church whose simple Georgian exterior and historic interior provide the village\'s strongest architectural stop.';
addTags(church, 'current-context', 'service-context-visitor', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  church,
  currentSource(
    'Dunbarney Parish Church visitor information',
    'National Churches Trust',
    'visitor-audit:dunbarney-parish-church',
    'https://www.nationalchurchestrust.org/church/bridge-earn-dunbarney-church',
    'Current-place curation: tourism=attraction; name=Dunbarney Parish Church; visitor_place_type=Historic parish church; visit_score=52; opening_hours:description=Normally open by arrangement on Wednesday and Friday, contact the church before travelling specifically; entrance_fee=Free; time_to_spend=20-40 minutes if open, or 10-15 minutes for the exterior; description=See Bridge of Earn\'s strongest architectural landmark, a warm red-sandstone church dating from 1787; website=https://www.nationalchurchestrust.org/church/bridge-earn-dunbarney-church.',
  ),
);

const oldBridge = upsertFeature(
  curatedPoint(
    'curated-attraction:bridge-of-earn-old-bridge-remains',
    'Old Bridge of Earn remains',
    'historic_bridge',
    [-3.40482, 56.35182],
    'The surviving fragments and approach of the medieval crossing that gave the village its name, best appreciated as a brief historic stop rather than an intact bridge.',
    currentSource(
      'Old Bridge of Earn scheduled monument',
      'Historic Environment Scotland',
      'visitor-audit:old-bridge-of-earn',
      'https://portal.historicenvironment.scot/designation/SM9468',
      'Current-place curation: tourism=attraction; name=Old Bridge of Earn remains; visitor_place_type=Scheduled medieval bridge remains; visit_score=46; opening_hours:description=Open outdoor setting, visit in daylight and keep to public access; entrance_fee=Free; time_to_spend=10-20 minutes; description=See the fragmentary remains and approach of the historic crossing that gave Bridge of Earn its name; website=https://portal.historicenvironment.scot/designation/SM9468.',
      'official_statutory',
    ),
    ['current-context', 'service-context-visitor'],
  ),
);

const victoryPark = upsertFeature(
  curatedPoint(
    'curated-attraction:bridge-of-earn-victory-park',
    'Victory Park and play area',
    'park',
    [-3.40806, 56.34843],
    'A refreshed community park with play equipment, open grass and a picnic area, most useful to families pausing in the village.',
    currentSource(
      'Victory Park regeneration and visitor facilities',
      'Perth and Kinross Council and Foundation Scotland',
      'visitor-audit:victory-park',
      'https://consult.pkc.gov.uk/communities/bridge-of-earn-management-plan/',
      'Current-place curation: tourism=attraction; leisure=park; name=Victory Park and play area; visitor_place_type=Community park and play area; visit_score=42; opening_hours:description=Open outdoor park, daylight use recommended; entrance_fee=Free; time_to_spend=30-75 minutes; facilities=Play area, open grass and picnic area; description=A regenerated community park suited to a family pause rather than a standalone tourist journey; website=https://consult.pkc.gov.uk/communities/bridge-of-earn-management-plan/.',
      'local_authority',
    ),
    ['current-context', 'service-context-visitor', 'service-context-park'],
  ),
);

const memorial = featureById('osm-community:node-3301519291');
memorial.name = 'Bridge of Earn War Memorial and Institute';
memorial.featureType = 'memorial';
memorial.shortDescription =
  'A brief civic-history stop beside the Institute, commemorating local service and anchoring the older Station Road village centre.';
addTags(memorial, 'current-context', 'service-context-visitor', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  memorial,
  currentSource(
    'Bridge of Earn War Memorial record',
    'Historic Environment Scotland and OpenStreetMap contributors',
    'visitor-audit:bridge-of-earn-war-memorial',
    'https://www.trove.scot/place/192713',
    'Current-place curation: tourism=attraction; historic=memorial; name=Bridge of Earn War Memorial and Institute; visitor_place_type=War memorial and civic landmark; visit_score=38; opening_hours:description=Open-access outdoor memorial, daylight recommended; entrance_fee=Free; time_to_spend=5-10 minutes; description=A modest civic landmark beside the village Institute; website=https://www.trove.scot/place/192713.',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: church.id,
    name: church.name,
    reason:
      'The handsome 1787 church is the best place to begin Bridge of Earn\'s small heritage story.',
    tagline: 'Georgian sandstone church',
    visitorScore: 52,
    openingTimes:
      'Normally open by arrangement on Wednesday and Friday. Contact the church before travelling specifically.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'National Churches Trust',
    sourceUrl: 'https://www.nationalchurchestrust.org/church/bridge-earn-dunbarney-church',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: oldBridge.id,
    name: oldBridge.name,
    reason:
      'These fragmentary remains preserve the crossing behind the village name, although visitors should expect an archaeological trace rather than an intact bridge.',
    tagline: 'The village namesake',
    visitorScore: 46,
    openingTimes: 'Open outdoor setting. Visit in daylight and keep to public access.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: ['HES'],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/SM9468',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: victoryPark.id,
    name: victoryPark.name,
    reason:
      'The regenerated park is the village\'s most useful family stop, with play equipment, open grass and space for a picnic.',
    tagline: 'Family pause',
    visitorScore: 42,
    openingTimes: 'Open outdoor park. Daylight use recommended.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Perth and Kinross Council',
    sourceUrl: 'https://consult.pkc.gov.uk/communities/bridge-of-earn-management-plan/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: memorial.id,
    name: memorial.name,
    reason:
      'A short civic-history pause beside the Institute, adding a local remembrance marker to a Station Road wander.',
    tagline: 'Village remembrance',
    visitorScore: 38,
    openingTimes: 'Open-access outdoor memorial. Daylight recommended.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Historic Environment Scotland',
    sourceUrl: 'https://www.trove.scot/place/192713',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const villageInn = updateFood(featureById('osm-community:node-3886480375'), {
  name: 'The Village Inn and Restaurant',
  score: 82,
  tagline: 'Best sit-down meal',
  description:
    'The strongest all-round meal in the village, combining a relaxed pub setting, lunch and evening menus, and a genuinely useful dog-friendly welcome.',
  opening:
    'Wednesday-Thursday 12:00-20:00 / Friday-Sunday 12:00-20:30 / Monday-Tuesday closed. Published closing times are last food orders.',
  price: '££',
  cuisine: 'Scottish and British pub dining',
  website: 'https://www.thevillageinn-bridgeofearn.foodndrinkscotland.co.uk/',
  organisation: 'The Village Inn and Restaurant',
  kind: 'restaurant',
  address: 'Main Street, Bridge of Earn, PH2 9PL',
  dogFriendly: true,
});

const earnCoffee = updateFood(featureById('osm-community:node-3301456255'), {
  name: 'The Earn Coffee Shop',
  score: 81,
  tagline: 'Best coffee & cake',
  description:
    'A bright farm cafe by the River Earn with speciality coffee, generous baking and light food in a memorable rural-edge setting.',
  opening: 'Monday and Thursday-Sunday 09:00-16:00 / Tuesday-Wednesday closed.',
  price: '££',
  cuisine: 'Coffee, home baking and light cafe food',
  website: 'https://theearncoffeeshop.co.uk/',
  organisation: 'The Earn Coffee Shop',
  kind: 'cafe',
  address: 'Gateside Home Farm, Bridge of Earn, PH2 9NG',
  dogFriendly: true,
});

const spiceGarden = updateFood(featureById('osm-community:node-4460996150'), {
  name: 'Spice Garden',
  score: 67,
  tagline: 'Indian evening option',
  description:
    'A useful village option for Indian dishes and takeaway food after daytime cafes close, best treated as a convenient local evening meal rather than destination dining.',
  opening: 'Check the current online ordering hours before visiting.',
  price: '££',
  cuisine: 'Indian restaurant and takeaway',
  website: 'https://spicegardeninbridgeofearn.co.uk/',
  organisation: 'Spice Garden',
  kind: 'restaurant',
  address: 'Main Street, Bridge of Earn, PH2 9PL',
});

const towerBakery = updateFood(featureById('osm-community:node-4460996154'), {
  name: 'Tower Bakery',
  score: 62,
  tagline: 'Quick bakery stop',
  description:
    'A straightforward bakery for filled rolls, savouries, sweet baking and takeaway coffee, particularly useful for an early or inexpensive village stop.',
  opening: 'Monday-Friday 07:00-16:00 / Saturday 07:00-15:00 / Sunday closed.',
  price: '£',
  cuisine: 'Bakery, filled rolls, savouries and takeaway coffee',
  website: 'https://www.towerbakery.co.uk/shops/',
  organisation: 'Tower Bakery and current business listings',
  kind: 'bakery',
  address: 'Main Street, Bridge of Earn, PH2 9PL',
  reliability: 'secondary',
});

const forgandennyTrail = upsertFeature(
  curatedPoint(
    'curated-trail:bridge-of-earn-forgandenny-circular',
    'Bridge of Earn-Forgandenny Circular',
    'walking_route',
    [-3.40736, 56.34872],
    'A substantial rural circuit using the official core-path network through Dunbarney, the old windmill, Forgandenny, Glenearn and Kintillo.',
    currentSource(
      'Bridge of Earn-Forgandenny Circular',
      'Perth and Kinross Council',
      'visitor-audit:trail:forgandenny-circular',
      'https://www.pkc.gov.uk/media/49518/Walking-the-Perth-Kinross-Council-Core-paths/pdf/WalkPKCPBookFINAL.pdf?m=637858801155000000',
      'Current-place curation: route=foot; name=Bridge of Earn-Forgandenny Circular; trail_type=Rural core-path circuit; visit_score=82; best_for=Experienced countryside walkers; distance=14.5 kilometres / 9 miles; time_to_spend=4-4.5 hours; accessibility=Tracks, field paths and minor roads, with muddy sections possible and a short stretch beside faster traffic on the B935; entrance_fee=Free; description=Follow a substantial official core-path circuit through Dunbarney, Forgandenny, Glenearn and Kintillo; website=https://www.pkc.gov.uk/media/49518/Walking-the-Perth-Kinross-Council-Core-paths/pdf/WalkPKCPBookFINAL.pdf?m=637858801155000000.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const westCircular = upsertFeature(
  curatedPoint(
    'curated-trail:bridge-of-earn-west-circular',
    'West of Bridge of Earn circular',
    'walking_route',
    [-3.4100122, 56.3490228],
    'An easy, mostly flat two-hour countryside circuit passing an old churchyard and the site of Pitkeathly Wells spa.',
    currentSource(
      'Circular walk west of Bridge of Earn',
      'Ramblers',
      'visitor-audit:trail:west-circular',
      'https://www.ramblers.org.uk/go-walking/routes/circular-walk-west-bridge-earn-perth',
      'Current-place curation: route=foot; name=West of Bridge of Earn circular; trail_type=Easy rural circular walk; visit_score=77; best_for=An easy countryside walk with local-history interest; distance=7 kilometres / 4.3 miles; time_to_spend=About 2 hours; accessibility=Flat leisurely farmland route, but surfaces can be uneven or muddy; entrance_fee=Free; description=Follow an easy rural circuit past an old churchyard and the former Pitkeathly Wells spa site; website=https://www.ramblers.org.uk/go-walking/routes/circular-walk-west-bridge-earn-perth.',
      'official_non_statutory',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const victoryParkPicnic = upsertFeature(
  curatedPoint(
    'curated-picnic:bridge-of-earn-victory-park',
    'Victory Park picnic area',
    'picnic_site',
    [-3.40825, 56.34838],
    'The named picnic area inside Victory Park, grouped as one useful visitor stop rather than exposing generic individual furniture pins.',
    currentSource(
      'Victory Park concept plan picnic area',
      'Perth and Kinross Council',
      'visitor-audit:picnic:victory-park',
      'https://consult.pkc.gov.uk/communities/bridge-of-earn-management-plan/',
      'Current-place curation: tourism=picnic_site; name=Victory Park picnic area; access=public; price_display=Free; opening_hours:description=Open outdoor picnic area, daylight use recommended; facilities=Picnic area, open grass and nearby play equipment; description=Named picnic stop within Victory Park; website=https://consult.pkc.gov.uk/communities/bridge-of-earn-management-plan/.',
      'local_authority',
    ),
    ['current-context', 'service-context-picnic'],
  ),
);

const parking = featureById('osm-community:way-1107763327');
parking.name = 'Victory Park / Institute car park';
parking.featureType = 'parking';
parking.shortDescription =
  'Public surface parking opposite the Institute and beside Victory Park, used as the meeting point for local walking groups.';
parking.address = 'Station Road, Bridge of Earn, PH2 9EA';
addTags(parking, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  parking,
  currentSource(
    'Victory Park and Institute car park visitor information',
    'Live Active Leisure and Perth and Kinross Council',
    'visitor-audit:parking:victory-park-institute',
    'https://liveactive.co.uk/whats-on-offer/wellbeing/stride-for-life/',
    'Current-place curation: amenity=parking; name=Victory Park / Institute car park; parking=surface; access=public; price_display=Free; payment_required=no; opening_hours:description=Open-access outdoor car park, observe any current signs; description=Public surface car park opposite the Institute and beside Victory Park, used as the official meeting point for the Bridge of Earn walking group; website=https://liveactive.co.uk/whats-on-offer/wellbeing/stride-for-life/.',
    'official_non_statutory',
  ),
);

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [villageInn.id, earnCoffee.id, spiceGarden.id, towerBakery.id],
  trails: [forgandennyTrail.id, westCircular.id],
  picnic: [victoryParkPicnic.id],
  parking: [parking.id],
  toilets: [],
};

for (const feature of pkg.features) {
  const uncuratedParking =
    feature.featureType === 'parking' && feature.id !== parking.id;
  const genericPlayground =
    feature.tags.includes('service-context-playground') && feature.id !== victoryPark.id;
  if (!uncuratedParking && !genericPlayground) continue;
  addTags(feature, 'visitor-audit-excluded', auditTag);
  feature.reviewNotes = uncuratedParking
    ? 'Excluded from the public planner because this OSM parking is private, customer-only, residential or lacks verified public visitor access. Victory Park / Institute is the only curated public car park.'
    : 'Excluded as a separate public card. The curated Victory Park entry groups the useful family park and play-area experience.';
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

const activeVisitorBoundary = townStudyArea.visitorBoundary;
if (!activeVisitorBoundary) throw new Error('Bridge of Earn visitor boundary is missing');
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Bridge of Earn public visitor feature is not a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeVisitorBoundary)) {
    throw new Error(`Bridge of Earn public visitor feature falls outside visitor boundary: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'Zero stars is retained. Bridge of Earn has a pleasant church, a namesake archaeological crossing, good food and useful walks, but no attraction cluster strong enough to make it a tourist town or planned destination.',
  },
  boundaryRule:
    'The original NRS 2022 locality is preserved unchanged. Every public planner point was tested against that locality plus narrow visitor links to the Old Bridge remains and The Earn Coffee Shop. These extensions do not alter historic heat scoring.',
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
      name: 'Moncreiffe Hill, Elcho Castle and wider Perth attractions',
      reason: 'Outside the active Bridge of Earn visitor polygon and suitable only for wider-area discovery.',
    },
    {
      name: 'Private, customer-only and anonymous parking',
      reason:
        'Only the public Victory Park / Institute car park is published. The Earn Coffee Shop customer parking is not presented as general visitor parking.',
    },
    {
      name: 'Generic playground pins',
      reason: 'The useful facilities are grouped into the named Victory Park visitor stop.',
    },
    {
      name: 'Public toilets',
      reason:
        'No dependable Bridge of Earn public convenience appears in the council public-toilet/comfort-scheme map; venue customer toilets are not published as public facilities.',
    },
  ],
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Bridge of Earn visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, 1 car park, 0 toilets and 1 picnic area.`,
);
