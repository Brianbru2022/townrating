import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/whitburn.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/whitburn-visitor-audit-2026-08-07.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-07T00:00:00Z';
const reviewedDate = '2026-08-07';
const auditTag = 'whitburn-visitor-audit';
const visitorPackTag = 'whitburn-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Whitburn feature: ${id}`);
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
        !record.sourceRecordId?.startsWith('visitor-audit:') &&
        !record.sourceRecordId?.startsWith('visitor-context-curation:') &&
        !record.notes?.startsWith('Current-place curation'),
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
    locationType: 'exact',
    locationConfidence: 'high',
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
      'Curated as present-day visitor information on 2026-08-07; excluded from historic dating and heat-map evidence.',
    evidenceScope: 'related_context',
    licence: editorialMetadataLicence,
  };
}

pkg.project.centre = [-3.68555, 55.86645];
pkg.project.touristAppeal = {
  rating: 0,
  label: 'Not a tourist town',
  summary:
    'Whitburn remains a zero-star town on the app\'s destination scale. Its community museum and mining memorials make a worthwhile local-history pause, and there are useful independent food stops, but the in-town offer is too small to justify a tourist journey. Polkemmet Country Park and the Scottish Owl Centre are immediately west of Whitburn but outside the active NRS locality, so they do not count towards this rating.',
};

pkg.project.visualIdentity = {
  theme: 'mining-heritage-and-burgh-clock',
  badgeImage: '/town-guides/whitburn-baillie-institute-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of Whitburn\'s former Baillie Public Institute and clock tower',
  heroImage: '/town-guides/whitburn-baillie-institute-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of Whitburn\'s former Baillie Public Institute and clock tower',
  primaryColour: '#214A4A',
  accentColour: '#A66A2D',
  backgroundColour: '#F3F2E6',
  heroObjectPosition: '50% 48%',
  motifs: ['Mining stories', 'Community museum', 'Burgh clock', 'Local food'],
};

pkg.project.townGuide = {
  headline: 'Mining stories and a small museum at Whitburn Cross',
  intro:
    'Whitburn is a working West Lothian town whose strongest visitor thread is its community history. The compact museum inside the Partnership Centre brings together coal-mining memories, local industry, social history and objects chosen with residents, while the retained Burgh Hall clock and nearby mining memorials add context outside. It is best approached as a short local-history stop rather than a full sightseeing destination.',
  bestFor: ['Mining heritage', 'Community history', 'A brief museum stop', 'Independent food'],
  perfectFor: [
    'Visitors tracing West Lothian\'s mining communities',
    'A short cultural stop while already in the area',
    'Anyone curious about Whitburn\'s industrial and social history',
  ],
  suggestedFirstVisit: {
    title: 'Community Museum and Market Place memorials',
    summary:
      'Start at Whitburn Community Museum in the Partnership Centre, look at the retained Burgh Hall clock and public art, then pause at the mining memorials around Market Place.',
  },
  dontMiss: ['Whitburn Community Museum and historic Burgh Halls', 'Market Place mining memorials'],
  suggestedTime: '45-90 minutes',
  visitorMood:
    'A modest but genuine local-history pause for visitors already travelling through central West Lothian.',
  sourceUrls: [
    'https://www.westlothian.gov.uk/article/44864/Whitburn-Community-Museum',
    'https://www.westlothian.gov.uk/whitburnpartnershipcentre',
    'https://www.visitwestlothian.co.uk/explore/whitburn/',
    'https://nationalminingmuseum.com/wp-content/uploads/2021/11/MINING-MEMORIALS-A-Z-By-National-Grid-and-by-LA-14.5.2025.pdf',
    'https://www.visitwestlothian.co.uk/food-drink/restaurants/karma/',
    'https://casaamiga.co.uk/',
    'https://www.locallinkswestlothian.co.uk/andyscoffeeshop',
    'https://www.westlothian.gov.uk/article/70748/Whitrigg-Community-Woodland-East-Whitburn',
    'https://www.geograph.org.uk/photo/4489701',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Whitburn town study area is missing');
townStudyArea.notes =
  'The original NRS 2022 Whitburn locality is preserved unchanged and is the active visitor boundary. The Community Museum, Partnership Centre, Market Place memorials, curated town-centre food stops and Armadale Road facilities are inside it. Polkemmet Country Park, the Scottish Owl Centre, Whitrigg Community Woodland, East Whitburn and motorway services remain outside-town context and do not contribute to Whitburn\'s planner or rating.';

const museum = featureById('osm-community:node-7028426014');
museum.name = 'Whitburn Community Museum and historic Burgh Halls';
museum.featureType = 'museum';
museum.shortDescription =
  'A compact community-curated museum inside the Partnership Centre, with coal-mining, industrial and social-history displays alongside the retained historic Burgh Hall clock.';
museum.address = 'Whitburn Partnership Centre, 2 Armadale Road, Whitburn, EH47 0EX';
addTags(
  museum,
  'current-context',
  'service-context-heritage',
  'service-context-visitor',
  auditTag,
  visitorPackTag,
);
replaceCurrentCurationSource(
  museum,
  currentSource(
    'Whitburn Community Museum visitor information',
    'West Lothian Council',
    'visitor-audit:whitburn-community-museum',
    'https://www.westlothian.gov.uk/article/44864/Whitburn-Community-Museum',
    'Current-place curation: tourism=attraction; name=Whitburn Community Museum and historic Burgh Halls; visitor_place_type=Community museum and retained civic heritage; visit_score=56; opening_hours:description=Monday-Friday 09:00-17:00, Saturday 09:00-13:00, Sunday closed; time_to_spend=30-45 minutes; description=Discover Whitburn through community-chosen objects, coal-mining and industrial stories, a signed Fender guitar and the retained Burgh Hall clock; website=https://www.westlothian.gov.uk/article/44864/Whitburn-Community-Museum; accessibility=Level access, automatic entrance doors, wheelchair-accessible toilets and assistance dogs welcome.',
  ),
);

const miningMemorial = featureById('osm-community:node-12922878298');
miningMemorial.name = 'Whitburn mining memorials, Market Place';
miningMemorial.featureType = 'memorial';
miningMemorial.shortDescription =
  'A small group of outdoor memorials at Market Place recalling Whitburn\'s mining community and the 1984-85 strike.';
addTags(
  miningMemorial,
  'current-context',
  'service-context-heritage',
  'service-context-visitor',
  auditTag,
  visitorPackTag,
);
replaceCurrentCurationSource(
  miningMemorial,
  currentSource(
    'Mining Memorials by local-authority area',
    'National Mining Museum Scotland',
    'visitor-audit:whitburn-mining-memorials',
    'https://nationalminingmuseum.com/wp-content/uploads/2021/11/MINING-MEMORIALS-A-Z-By-National-Grid-and-by-LA-14.5.2025.pdf',
    'Current-place curation: tourism=attraction; name=Whitburn mining memorials, Market Place; visitor_place_type=Mining memorial group; visit_score=40; opening_hours:description=Open-access outdoor memorials, best viewed in daylight; entrance_fee=Free; time_to_spend=10-20 minutes; description=Pause at the Market Place memorials for a concise reminder of the mining industry and the 1984-85 strike that shaped modern Whitburn; website=https://nationalminingmuseum.com/wp-content/uploads/2021/11/MINING-MEMORIALS-A-Z-By-National-Grid-and-by-LA-14.5.2025.pdf.',
  ),
);

for (const id of [
  'nrhe:374746',
  'osm-community:node-13357509293',
  'nrhe:275462',
  'osm-community:way-1456488006',
]) {
  const feature = featureById(id);
  addTags(feature, 'visitor-audit-combined', auditTag);
  feature.reviewNotes =
    'Retained for provenance but combined into the researched Community Museum or Market Place visitor card to avoid duplicate public recommendations.';
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

for (const id of ['osm-community:node-3687965855', 'osm-park:way-562335167']) {
  const feature = featureById(id);
  addTags(feature, 'visitor-audit-excluded', auditTag);
  feature.reviewNotes =
    'Reviewed for the Whitburn visitor audit but not promoted as a standalone tourist recommendation.';
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: museum.id,
    name: museum.name,
    reason:
      'Community-chosen objects, mining and industrial stories and the retained Burgh Hall fabric give the most coherent introduction to Whitburn\'s identity.',
    tagline: 'Whitburn\'s local story',
    visitorScore: 56,
    openingTimes:
      'Monday-Friday 09:00-17:00; Saturday 09:00-13:00; Sunday closed. Check for holiday changes.',
    organisationPills: ['West Lothian Council'],
    homeMapEligible: false,
    sourceName: 'West Lothian Council',
    sourceUrl: 'https://www.westlothian.gov.uk/article/44864/Whitburn-Community-Museum',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: miningMemorial.id,
    name: miningMemorial.name,
    reason:
      'The compact memorial group gives a direct outdoor link to the coal industry and strike history that shaped the town.',
    tagline: 'Mining memory at Market Place',
    visitorScore: 40,
    openingTimes: 'Open-access outdoor memorials. Daylight is best.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    homeMapEligible: false,
    sourceName: 'National Mining Museum Scotland',
    sourceUrl:
      'https://nationalminingmuseum.com/wp-content/uploads/2021/11/MINING-MEMORIALS-A-Z-By-National-Grid-and-by-LA-14.5.2025.pdf',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const casaAmiga = featureById('osm-community:node-12127646316');
casaAmiga.name = 'Casa Amiga';
casaAmiga.featureType = 'cafe';
casaAmiga.shortDescription =
  'An independent Portuguese bakery-cafe known for pastries, cakes, savouries and coffee.';
casaAmiga.address = '32A West Main Street, Whitburn, EH47 0QZ';
addTags(casaAmiga, 'current-context', 'service-context-food', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  casaAmiga,
  currentSource(
    'Casa Amiga visitor information',
    'Casa Amiga',
    'visitor-audit:food:casa-amiga-whitburn',
    'https://casaamiga.co.uk/',
    'Current-place curation: amenity=cafe; name=Casa Amiga; cuisine=Portuguese bakery and cafe; visit_score=79; price_band=£; opening_hours:description=Daily 09:00-16:00; description=Portuguese bakery: An independent cafe for Portuguese pastries, cakes, savouries and coffee, with a stronger sense of place than a routine chain stop; website=https://casaamiga.co.uk/; dog_friendly=unknown.',
  ),
);

const karma = featureById('osm-community:way-494115095');
karma.name = 'Karma Indian Cuisine';
karma.featureType = 'restaurant';
karma.shortDescription =
  'A long-running independent Indian restaurant serving freshly prepared regional dishes in the town centre.';
karma.address = '154 West Main Street, Whitburn, EH47 0QR';
addTags(karma, 'current-context', 'service-context-food', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  karma,
  currentSource(
    'Karma visitor information',
    'Visit West Lothian and Karma Indian Cuisine',
    'visitor-audit:food:karma-whitburn',
    'https://www.visitwestlothian.co.uk/food-drink/restaurants/karma/',
    'Current-place curation: amenity=restaurant; name=Karma Indian Cuisine; cuisine=Indian; visit_score=78; price_band=££; opening_hours:description=Tuesday-Saturday 16:30-21:30, Sunday 16:30-21:00, Monday closed; description=Established Indian dining: A long-running independent restaurant with freshly prepared regional dishes and a substantial local reputation; website=https://www.karmawhitburn.co.uk/; dog_friendly=unknown.',
  ),
);

const andys = featureById('osm-community:node-12142091940');
andys.name = 'Andy\'s Coffee House';
andys.featureType = 'cafe';
andys.shortDescription =
  'A straightforward local cafe for Scottish breakfasts, filled rolls, soups, light lunches, coffee and cakes.';
andys.address = '34D West Main Street, Whitburn, EH47 0QX';
addTags(andys, 'current-context', 'service-context-food', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  andys,
  currentSource(
    'Andy\'s Coffee House listing',
    'Local Links West Lothian',
    'visitor-audit:food:andys-coffee-house-whitburn',
    'https://www.locallinkswestlothian.co.uk/andyscoffeeshop',
    'Current-place curation: amenity=cafe; name=Andy\'s Coffee House; cuisine=Breakfast and light lunch cafe; visit_score=66; price_band=£; opening_hours:description=Monday-Saturday 07:00-15:30, Sunday closed; description=Breakfast & lunch: A practical local cafe for a full Scottish breakfast, filled rolls, soups, paninis, baked potatoes, coffee and cakes; website=https://www.locallinkswestlothian.co.uk/andyscoffeeshop; dog_friendly=unknown.',
    'secondary',
  ),
);

const parking = featureById('osm-community:way-1019746049');
parking.name = 'Armadale Road / Partnership Centre car park';
parking.featureType = 'parking';
parking.shortDescription =
  'The public car park beside Whitburn Partnership Centre, Community Museum and Market Place.';
parking.address = 'Armadale Road, Whitburn, EH47 0RA';
addTags(parking, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  parking,
  currentSource(
    'Whitburn Partnership Centre facilities',
    'West Lothian Council and OpenStreetMap contributors',
    'visitor-audit:parking:whitburn-armadale-road',
    'https://www.westlothian.gov.uk/whitburnpartnershipcentre',
    'Current-place curation: amenity=parking; name=Armadale Road / Partnership Centre car park; parking=surface; access=public; price_display=Check signs; payment_required=unknown; spaces=Not published; disabled_spaces=3 free allocated disabled bays in front of the Partnership Centre; ev_charging=yes; opening_hours:description=Access follows current car-park signs and centre arrangements; description=Central surface car park beside the Partnership Centre, Community Museum and Market Place; website=https://www.westlothian.gov.uk/whitburnpartnershipcentre.',
  ),
);

const toilets = upsertFeature(
  curatedPoint(
    'curated-toilets:whitburn-armadale-road',
    'Armadale Road public toilets, Whitburn',
    'toilets',
    [-3.68496, 55.8672],
    'Automated public toilets in the Council car park on Armadale Road, beside the Partnership Centre.',
    currentSource(
      'Whitrigg Community Woodland visitor facilities',
      'West Lothian Council',
      'visitor-audit:toilets:whitburn-armadale-road',
      'https://www.westlothian.gov.uk/article/70748/Whitrigg-Community-Woodland-East-Whitburn',
      'Current-place curation: amenity=toilets; name=Armadale Road public toilets, Whitburn; access=public; price_display=Check on arrival; opening_hours:description=Automated public toilets; hours are not published, so do not rely on late-evening access; wheelchair=The adjacent Partnership Centre has accessible toilets during its opening hours; description=Automated public toilets in the Council car park on Armadale Road, EH47 0RA; website=https://www.westlothian.gov.uk/article/70748/Whitrigg-Community-Woodland-East-Whitburn.',
    ),
    ['current-context', 'service-context-toilets'],
  ),
);
toilets.address = 'Council car park, Armadale Road, Whitburn, EH47 0RA';

curationLibrary.projects[pkg.project.id] = {
  ...(curationLibrary.projects[pkg.project.id] ?? {}),
  eat: [casaAmiga.id, karma.id, andys.id],
  trails: [],
  picnic: [],
  parking: [parking.id],
  toilets: [toilets.id],
};

const activeVisitorBoundary = townStudyArea.visitorBoundary ?? townStudyArea.localityBoundary;
const publicFeatureIds = [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publicFeatureIds)) {
  const feature = featureById(featureId);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Whitburn public visitor feature is not a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeVisitorBoundary)) {
    throw new Error(`Whitburn public visitor feature falls outside the NRS locality: ${featureId}`);
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    rating: pkg.project.touristAppeal.rating,
    rationale:
      'Zero stars is retained. The in-boundary visitor offer consists of one compact community museum, a small memorial group and useful food stops. The strongest advertised nearby draws, Polkemmet Country Park and the Scottish Owl Centre, lie west of the NRS locality and were not used to raise the town rating.',
  },
  boundaryRule:
    'The official NRS 2022 Whitburn locality is preserved unchanged and used as the active visitor boundary. Every public planner marker is inside it. Nearby country-park, woodland, motorway and East Whitburn places are excluded.',
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
      name: 'Polkemmet Country Park and the Scottish Owl Centre',
      reason:
        'Visit West Lothian describes Polkemmet as immediately west of Whitburn; it falls outside the active NRS locality and does not count towards the town planner or rating.',
    },
    {
      name: 'Whitrigg Community Woodland and East Whitburn',
      reason: 'Outside the active Whitburn locality and retained as wider-area context only.',
    },
    {
      name: 'Proposed 2015-17 Whitburn heritage trail',
      reason:
        'The council placemaking material describes a proposed trail rather than a currently published, followable visitor route, so the Trails category is left empty.',
    },
    {
      name: 'Generic picnic tables, benches and unverified parking',
      reason:
        'Not published without a defensible named location and public-access details. Customer-only, motorway and residential parking are excluded.',
    },
  ],
  artwork: {
    asset: '/town-guides/whitburn-baillie-institute-watercolour-guide.png',
    referenceSource: 'Former Baillie Public Institute, Main Street, Whitburn by Leslie Barrie',
    referenceUrl: 'https://www.geograph.org.uk/photo/4489701',
    referenceLicence: 'CC BY-SA 2.0',
    treatment: 'Text-free original ink-and-watercolour visitor-guide illustration.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Whitburn visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, 0 trails, 1 car park, 1 public toilet and 0 picnic sites. Rating: ${pkg.project.touristAppeal.rating} stars.`,
);
