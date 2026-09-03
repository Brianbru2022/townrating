import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/broxburn-and-uphall.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const auditPath = resolve('data/review/broxburn-uphall-visitor-audit-2026-08-07.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-07T00:00:00Z';
const reviewedDate = '2026-08-07';
const auditTag = 'broxburn-uphall-visitor-audit';
const visitorPackTag = 'broxburn-uphall-scotland-visitor-pack';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'OpenStreetMap contributors, Open Database Licence.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing Broxburn and Uphall feature: ${id}`);
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
  licence = editorialMetadataLicence,
): SourceRecord {
  return {
    sourceName,
    sourceOrganisation,
    sourceRecordId,
    sourceUrl,
    accessedAt: reviewedAt,
    licence,
    reliability,
    notes,
  };
}

function replaceCurrentCurationSource(feature: HeritageFeature, source: SourceRecord): void {
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !record.sourceRecordId?.startsWith('visitor-audit:') &&
        !record.sourceRecordId?.startsWith('visitor-pack:') &&
        !record.sourceRecordId?.startsWith('current-context-curation:') &&
        !record.notes?.startsWith('Current-place curation'),
    ),
    source,
  ];
  feature.licence ??= source.licence;
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
    locationType: 'representative_point',
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

function updateFood(
  feature: HeritageFeature,
  options: {
    name: string;
    score: number;
    tagline: string;
    description: string;
    opening: string;
    price: string;
    cuisine: string;
    website: string;
    organisation: string;
    kind: 'cafe' | 'restaurant' | 'pub';
    address: string;
    reliability?: SourceRecord['reliability'];
  },
): HeritageFeature {
  feature.name = options.name;
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
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor information`,
      options.organisation,
      `visitor-audit:food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${options.kind}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}.`,
      options.reliability,
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
  );
  return feature;
}

function updateParking(
  feature: HeritageFeature,
  options: {
    name: string;
    description: string;
    address: string;
    detail: string;
  },
): HeritageFeature {
  feature.name = options.name;
  feature.featureType = 'parking';
  feature.shortDescription = options.description;
  feature.address = options.address;
  addTags(feature, 'current-context', 'service-context-parking', auditTag, visitorPackTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${options.name} visitor parking information`,
      'West Lothian Council',
      `visitor-audit:parking:${feature.id}`,
      'https://www.westlothian.gov.uk/media/66173/West-Lothian-Retail-Study-Main-Report/pdf/West-Lothian-Retail-Study-Main-Report.pdf',
      `Current-place curation: amenity=parking; name=${options.name}; parking=surface; access=public; price_display=Free; payment_required=no; opening_hours:description=Open daily; observe current entrance signs and restrictions; description=${options.description}; parking_details=${options.detail}.`,
      'local_authority',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
  );
  return feature;
}

function updateToilets(
  feature: HeritageFeature,
  options: {
    name: string;
    description: string;
    opening: string;
    address: string;
    fee: string;
    wheelchair: string;
  },
): HeritageFeature {
  feature.name = options.name;
  feature.featureType = 'toilets';
  feature.shortDescription = options.description;
  feature.address = options.address;
  addTags(feature, 'current-context', 'service-context-toilets', auditTag, visitorPackTag);
  replaceCurrentCurationSource(
    feature,
    currentSource(
      'Public toilets in West Lothian',
      'West Lothian Council',
      `visitor-audit:toilets:${feature.id}`,
      'https://www.westlothian.gov.uk/toilets',
      `Current-place curation: amenity=toilets; name=${options.name}; access=public; price_display=${options.fee}; opening_hours:description=${options.opening}; wheelchair=${options.wheelchair}; description=${options.description}; website=https://www.westlothian.gov.uk/toilets.`,
      'local_authority',
      `${editorialMetadataLicence} Geometry derived from ${osmLicence}`,
    ),
  );
  return feature;
}

pkg.project.touristAppeal = {
  rating: 1,
  label: 'Local detour',
  summary:
    'Broxburn and Uphall retain one star as a niche local detour. Scheduled canal trips, the free community museum and a town-spanning heritage art trail can fill a pleasant short visit, supported by canal-side walking and an independent food cluster. Nearby country estates and regional attractions outside the active locality are deliberately excluded.',
};

pkg.project.visualIdentity = {
  theme: 'union-canal-and-shale-story',
  badgeImage: '/town-guides/broxburn-uphall-union-canal-watercolour-guide.png',
  badgeAlt:
    'Light ink-and-watercolour illustration of a narrowboat on the Union Canal below a stone bridge, with Broxburn rooftops and a red shale bing beyond',
  heroImage: '/town-guides/broxburn-uphall-union-canal-watercolour-guide.png',
  heroAlt:
    'Light ink-and-watercolour illustration of a narrowboat on the Union Canal below a stone bridge, with Broxburn rooftops and a red shale bing beyond',
  heroObjectPosition: '50% 55%',
  primaryColour: '#173F43',
  accentColour: '#A76A2D',
  backgroundColour: '#EDF3E7',
  motifs: ['Union Canal', 'Shale heritage', 'Public art', 'Woodland paths'],
};

pkg.project.townGuide = {
  headline: 'Canal boats, shale stories and a trail of public art',
  intro:
    'Broxburn and Uphall offer a compact, low-key West Lothian visit built around the Union Canal and the communities shaped by shale oil. Time a visit for a volunteer boat trip, explore the local museum, then follow the heritage artworks between the two town centres or continue onto the canal towpath.',
  bestFor: ['Canal enthusiasts', 'Industrial history', 'Public art', 'Easy local walks'],
  perfectFor: [
    'A two-to-four-hour West Lothian detour',
    'Visitors interested in Scotland\'s shale-oil story',
    'A canal trip paired with an easy town trail',
  ],
  suggestedFirstVisit: {
    title: 'Museum, canal and heritage artworks',
    summary:
      'Begin at Strathbrock Partnership Centre for the community museum, follow the heritage art trail east through Uphall and Broxburn, then reach Port Buchan and the Union Canal. Check Bridge 19-40 dates before travelling if a boat trip is the main draw.',
  },
  dontMiss: [
    'Bridge 19-40 Union Canal boat trips',
    'Broxburn and Uphall Community Museum',
    'Uphall and Broxburn Heritage Art Trail',
  ],
  suggestedTime: 'Two to four hours; longer when a boat trip is running',
  visitorMood:
    'For curious visitors who enjoy industrial stories, waterside wandering and modest places whose character rewards a little attention.',
  sourceUrls: [
    'https://www.visitwestlothian.co.uk/explore/broxburn-uphall/',
    'https://www.scottishcanals.co.uk/visit/things-to-do/boat-tours/bridge-19-40-union-canal-society',
    'https://www.westlothian.gov.uk/article/85409/Broxburn-and-Uphall-Community-Museum',
    'https://www.visitwestlothian.co.uk/things-to-do/walks-old/easy/uphall-broxburn-heritage-art-trail/',
    'https://www.westlothian.gov.uk/article/34246/Broxburn-Community-Woodland',
    'https://www.westlothian.gov.uk/toilets',
  ],
  lastReviewedAt: reviewedDate,
};

const townStudyArea = pkg.project.townStudyArea;
if (!townStudyArea) throw new Error('Broxburn and Uphall town study area is missing');
delete townStudyArea.visitorBoundary;
townStudyArea.notes =
  'The active visitor boundary is the original NRS 2022 Broxburn locality S52000100, preserved unchanged. Every public attraction, food and practical marker is validated inside it. The Galloway Crescent marker gives an in-boundary access point for paths that continue into Broxburn Community Woodland; the main planetary-sculpture cluster lies beyond the locality and is not counted as a town attraction. Houstoun House, Almondell, Oatridge campus attractions and other nearby draws outside the polygon are excluded.';

const boatTrips = featureById('nrhe:49289');
boatTrips.name = 'Bridge 19-40 Union Canal boat trips';
boatTrips.featureType = 'boat_tour';
boatTrips.address = 'Port Buchan, Broxburn';
boatTrips.shortDescription =
  'Volunteer-run narrowboat trips from Port Buchan reveal the Union Canal at its most sociable, with short public sailings offered on selected dates.';
addTags(boatTrips, 'current-context', 'service-context-visitor', auditTag, visitorPackTag);
replaceCurrentCurationSource(
  boatTrips,
  currentSource(
    'Bridge 19-40 Union Canal Society boat tours',
    'Scottish Canals',
    'visitor-audit:attraction:bridge-19-40',
    'https://www.scottishcanals.co.uk/visit/things-to-do/boat-tours/bridge-19-40-union-canal-society',
    'Current-place curation: tourism=boat_tour; name=Bridge 19-40 Union Canal boat trips; visitor_place_type=Volunteer-run canal boat trip; visit_score=68; opening_hours:description=Public trips operate on selected advertised dates; check the current timetable and pre-book before travelling; entrance_fee=Fares vary by trip; time_to_spend=60-120 minutes; description=Board a volunteer-run narrowboat at Port Buchan and see Broxburn from the water on the historic Union Canal; website=https://www.scottishcanals.co.uk/visit/things-to-do/boat-tours/bridge-19-40-union-canal-society.',
  ),
);

const museum = featureById('osm-community:node-12552024571');
museum.name = 'Broxburn and Uphall Community Museum';
museum.featureType = 'museum';
museum.address = 'Strathbrock Partnership Centre, 189a West Main Street, Broxburn, EH52 5LH';
museum.shortDescription =
  'A free community museum telling the connected story of Broxburn and Uphall through local objects, photographs and the shale-oil industry.';
addTags(museum, 'current-context', 'service-context-heritage', 'service-context-visitor', auditTag);
replaceCurrentCurationSource(
  museum,
  currentSource(
    'Broxburn and Uphall Community Museum visitor information',
    'West Lothian Council',
    'visitor-audit:attraction:community-museum',
    'https://www.westlothian.gov.uk/article/85409/Broxburn-and-Uphall-Community-Museum',
    'Current-place curation: tourism=museum; name=Broxburn and Uphall Community Museum; visitor_place_type=Community and industrial-history museum; visit_score=62; opening_hours:description=Monday-Friday 08:30-18:00, Saturday 10:00-13:00, Sunday closed; confirm holiday hours; entrance_fee=Free; time_to_spend=30-60 minutes; accessibility=Located inside Strathbrock Partnership Centre with accessible facilities; description=Discover how shale oil, work and everyday life shaped the two neighbouring communities; website=https://www.westlothian.gov.uk/article/85409/Broxburn-and-Uphall-Community-Museum.',
    'local_authority',
  ),
);

const artTrail = featureById('visitor-context:uphall-broxburn-heritage-art-trail');
artTrail.name = 'Uphall and Broxburn Heritage Art Trail';
artTrail.featureType = 'walking_route';
artTrail.address = 'Uphall Community Centre to Argyle Court, Broxburn';
artTrail.shortDescription =
  'A self-guided route linking 12 public artworks across Uphall and Broxburn, using planets, industry and local stories to connect the two town centres.';
addTags(
  artTrail,
  'current-context',
  'service-context-visitor',
  'service-context-walk',
  'visitor-context-trail',
  auditTag,
  visitorPackTag,
);
replaceCurrentCurationSource(
  artTrail,
  currentSource(
    'Uphall and Broxburn Heritage Art Trail',
    'Visit West Lothian',
    'visitor-audit:trail:heritage-art-trail',
    'https://www.visitwestlothian.co.uk/things-to-do/walks-old/easy/uphall-broxburn-heritage-art-trail/',
    'Current-place curation: route=heritage_trail; name=Uphall and Broxburn Heritage Art Trail; trail_type=Town heritage and public-art trail; visit_score=79; distance=Approximately 5.7 km; time_to_spend=90-120 minutes; accessibility=Pavement and shared-path town route with road crossings; entrance_fee=Free; description=Follow 12 artworks between Uphall and Broxburn to uncover shale, planetary and community stories; website=https://www.visitwestlothian.co.uk/things-to-do/walks-old/easy/uphall-broxburn-heritage-art-trail/; download_url=https://www.visitwestlothian.co.uk/media/2590/heritage-art-trail-map.pdf.',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: boatTrips.id,
    name: boatTrips.name,
    reason: boatTrips.shortDescription,
    tagline: 'Canal by narrowboat',
    visitorScore: 68,
    openingTimes: 'Selected advertised dates; check the current timetable and pre-book.',
    admission: 'Fares vary by trip.',
    freeAdmission: false,
    homeMapEligible: false,
    sourceName: 'Scottish Canals',
    sourceUrl:
      'https://www.scottishcanals.co.uk/visit/things-to-do/boat-tours/bridge-19-40-union-canal-society',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: museum.id,
    name: museum.name,
    reason: museum.shortDescription,
    tagline: 'Shale and community story',
    visitorScore: 62,
    openingTimes:
      'Monday-Friday 08:30-18:00; Saturday 10:00-13:00; Sunday closed. Confirm holiday hours.',
    admission: 'Free.',
    freeAdmission: true,
    homeMapEligible: false,
    sourceName: 'West Lothian Council',
    sourceUrl:
      'https://www.westlothian.gov.uk/article/85409/Broxburn-and-Uphall-Community-Museum',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: artTrail.id,
    name: artTrail.name,
    reason: artTrail.shortDescription,
    tagline: 'Twelve public artworks',
    visitorScore: 56,
    openingTimes: 'Open route; best followed in daylight.',
    admission: 'Free.',
    freeAdmission: true,
    homeMapEligible: false,
    sourceName: 'Visit West Lothian',
    sourceUrl:
      'https://www.visitwestlothian.co.uk/things-to-do/walks-old/easy/uphall-broxburn-heritage-art-trail/',
    verifiedInBoundaryAt: reviewedDate,
  },
];

const woodlandTrail = upsertFeature(
  curatedPoint(
    'visitor-context:broxburn-community-woodland-trail',
    'Broxburn Community Woodland paths',
    'walking_route',
    [-3.4837244, 55.9376941],
    'A choice of informal woodland and bing paths reached from Galloway Crescent, with nearly three miles of routes and broad West Lothian views.',
    currentSource(
      'Broxburn Community Woodland',
      'West Lothian Council',
      'visitor-audit:trail:broxburn-community-woodland',
      'https://www.westlothian.gov.uk/article/34246/Broxburn-Community-Woodland',
      'Current-place curation: route=walking; name=Broxburn Community Woodland paths; trail_type=Woodland and bing paths; visit_score=75; distance=Up to nearly 3 miles; time_to_spend=90-150 minutes; accessibility=Informal paths with gradients and uneven ground; entrance_fee=Free; description=Choose a short woodland wander or a longer circuit across reclaimed shale landscape, starting from the in-boundary Galloway Crescent access; website=https://www.westlothian.gov.uk/article/34246/Broxburn-Community-Woodland.',
      'local_authority',
    ),
    ['current-context', 'service-context-walk', 'visitor-context-trail'],
  ),
);

const gianninos = updateFood(featureById('osm-community:node-4074794136'), {
  name: "Giannino's",
  score: 82,
  tagline: 'Italian favourite',
  description:
    'A long-established, lively Italian restaurant in Broxburn for pasta, pizza, steaks and a more complete evening meal.',
  opening:
    'Lunch and evening service Monday-Saturday; Sunday evening service. Check the current booking page for exact sittings.',
  price: '££',
  cuisine: 'Italian',
  website: 'https://www.opentable.co.uk/r/gianninos',
  organisation: "Giannino's",
  kind: 'restaurant',
  address: 'East Main Street, Broxburn',
  reliability: 'secondary',
});

const oatridge = updateFood(featureById('hes-listed-building:LB14241'), {
  name: 'Oatridge Hotel Restaurant',
  score: 78,
  tagline: 'Traditional dining',
  description:
    'A traditional hotel restaurant in Uphall offering an unhurried sit-down meal, steaks and familiar Scottish favourites.',
  opening:
    'Wednesday-Friday 12:00-14:00 and 16:30-20:30; Saturday 10:00-21:00; Sunday 10:00-19:30. Monday closed; confirm Tuesday service.',
  price: '££',
  cuisine: 'Scottish and British',
  website: 'https://www.theoatridgehotel.co.uk/restaurant/',
  organisation: 'Oatridge Hotel',
  kind: 'restaurant',
  address: '2-4 East Main Street, Uphall, EH52 5DA',
});

const aroma = updateFood(
  upsertFeature(
    curatedPoint(
      'visitor-context:aroma-broxburn',
      'Aroma Restaurant & Bar',
      'restaurant',
      [-3.4694334, 55.9349006],
      'Nepalese and Indian cooking in a smart town-centre restaurant, with a broad menu suited to an evening meal.',
      currentSource(
        'Aroma Restaurant & Bar information',
        'Aroma Restaurant & Bar',
        'visitor-audit:seed:aroma',
        'https://aroma.restaurant/about/',
        'Current visitor venue and representative map point verified from the operator website.',
      ),
      ['current-context'],
    ),
  ),
  {
    name: 'Aroma Restaurant & Bar',
    score: 77,
    tagline: 'Nepalese and Indian',
    description:
      'Nepalese and Indian cooking in a smart town-centre restaurant, with a broad menu suited to an evening meal.',
    opening: 'Monday-Saturday 16:00-22:00; Sunday 16:00-21:00.',
    price: '££',
    cuisine: 'Nepalese and Indian',
    website: 'https://aroma.restaurant/about/',
    organisation: 'Aroma Restaurant & Bar',
    kind: 'restaurant',
    address: 'East Main Street, Broxburn',
  },
);

const theDine = updateFood(
  upsertFeature(
    curatedPoint(
      'visitor-context:the-dine-broxburn',
      'The Dine',
      'restaurant',
      [-3.471288783802071, 55.934416680602325],
      'A contemporary Indian restaurant offering a broad evening menu in central Broxburn.',
      currentSource(
        'The Dine visitor information',
        'The Dine',
        'visitor-audit:seed:the-dine',
        'https://thedine.co.uk/',
        'Current visitor venue and representative map point verified from the operator website.',
      ),
      ['current-context'],
    ),
  ),
  {
    name: 'The Dine',
    score: 76,
    tagline: 'Indian evening meal',
    description:
      'A contemporary Indian restaurant with a broad menu and dependable evening hours in central Broxburn.',
    opening: 'Tuesday-Sunday 14:00-22:00; Monday closed.',
    price: '££',
    cuisine: 'Indian',
    website: 'https://thedine.co.uk/',
    organisation: 'The Dine',
    kind: 'restaurant',
    address: 'East Main Street, Broxburn',
  },
);

const dottys = updateFood(featureById('osm-community:node-5282198744'), {
  name: "Dotty's Sandwich & Coffee Shop",
  score: 72,
  tagline: 'Breakfast and lunch',
  description:
    'A friendly local cafe for cooked breakfasts, filled rolls, soup, coffee and an uncomplicated daytime stop.',
  opening: 'Daytime opening; confirm the current weekly hours before a special journey.',
  price: '£',
  cuisine: 'Cafe and breakfast',
  website:
    'https://www.tripadvisor.co.uk/Restaurant_Review-g1490852-d7795683-Reviews-Dotty_s_Sandwich_Coffee_Shop-Broxburn_West_Lothian_Scotland.html',
  organisation: "Dotty's Sandwich & Coffee Shop",
  kind: 'cafe',
  address: 'East Main Street, Broxburn',
  reliability: 'secondary',
});

const strathbrockCafe = updateFood(
  upsertFeature(
    curatedPoint(
      'visitor-context:cafe-at-strathbrock',
      'Cafe at Strathbrock',
      'cafe',
      [-3.485987201875267, 55.931617260405],
      'A social-enterprise cafe inside Strathbrock Partnership Centre for coffee, baking and a simple weekday lunch.',
      currentSource(
        'The Larder find-us information',
        'The Larder West Lothian',
        'visitor-audit:seed:cafe-at-strathbrock',
        'https://www.thelarder.org/find-us/',
        'Current social-enterprise cafe and representative map point verified from the operator website.',
      ),
      ['current-context'],
    ),
  ),
  {
    name: 'Cafe at Strathbrock',
    score: 66,
    tagline: 'Social-enterprise cafe',
    description:
      'A useful social-enterprise cafe inside Strathbrock Partnership Centre for coffee, baking and a simple weekday lunch.',
    opening: 'Monday-Friday 08:30-14:00.',
    price: '£',
    cuisine: 'Cafe and light lunch',
    website: 'https://www.thelarder.org/find-us/',
    organisation: 'The Larder West Lothian',
    kind: 'cafe',
    address: 'Strathbrock Partnership Centre, 189a West Main Street, Broxburn, EH52 5LH',
  },
);

const greendykesParking = updateParking(featureById('osm-community:way-686807399'), {
  name: 'Greendykes Road Car Park',
  description:
    'A central public surface car park opposite the Greendykes Road public toilets and close to East Main Street.',
  address: 'Greendykes Road, Broxburn',
  detail: 'The council retail study records 99 spaces. No public tariff was identified; observe current signs.',
});

const argyleParking = updateParking(featureById('osm-community:way-456453665'), {
  name: 'Argyle Court Car Park',
  description: 'A short-stay public car park serving Broxburn town centre and the east end of the art trail.',
  address: 'Argyle Court, East Main Street, Broxburn',
  detail: 'The council retail study records a 90-minute maximum stay. Observe current entrance signs.',
});

const gallowayParking = upsertFeature(
  curatedPoint(
    'visitor-context:galloway-crescent-layby',
    'Galloway Crescent woodland layby',
    'parking',
    [-3.4837244, 55.9376941],
    'A small free layby at the in-town access point for Broxburn Community Woodland paths.',
    currentSource(
      'Broxburn Community Woodland access and parking',
      'West Lothian Council',
      'visitor-audit:parking:galloway-crescent',
      'https://www.westlothian.gov.uk/article/34246/Broxburn-Community-Woodland',
      'Current-place curation: amenity=parking; name=Galloway Crescent woodland layby; parking=layby; access=public; price_display=Free; payment_required=no; opening_hours:description=Open access; observe current signs and avoid obstructing residents; description=Small free layby for the community woodland paths.',
      'local_authority',
    ),
    ['current-context', 'service-context-parking'],
  ),
);

const greendykesToilets = updateToilets(featureById('osm-community:node-6437939546'), {
  name: 'Greendykes Road public toilets',
  description: 'The council-listed automatic public convenience beside Greendykes Road Car Park.',
  opening: 'Automatic public convenience; check the facility notice for current access hours',
  address: 'Greendykes Road Car Park, Broxburn',
  fee: 'Check facility notice',
  wheelchair: 'yes',
});

const xciteToilets = updateToilets(
  upsertFeature(
    curatedPoint(
      'visitor-context:xcite-broxburn-toilets',
      'Xcite Broxburn Sports Centre toilets',
      'toilets',
      [-3.4679699, 55.9364464],
      'Visitor toilets inside Xcite Broxburn Sports Centre, available during venue opening hours.',
      currentSource(
        'Public toilets in West Lothian',
        'West Lothian Council',
        'visitor-audit:seed:xcite-toilets',
        'https://www.westlothian.gov.uk/toilets',
        'Council-listed public toilet facility and representative venue point.',
        'local_authority',
      ),
      ['current-context'],
    ),
  ),
  {
    name: 'Xcite Broxburn Sports Centre toilets',
    description:
      'Visitor toilets inside Xcite Broxburn Sports Centre, available during venue opening hours.',
    opening: 'Available during Xcite Broxburn Sports Centre opening hours',
    address: 'Church Street, Broxburn, EH52 5EL',
    fee: 'Free for venue visitors',
    wheelchair: 'yes',
  },
);

const strathbrockToilets = updateToilets(
  upsertFeature(
    curatedPoint(
      'visitor-context:strathbrock-toilets',
      'Strathbrock Partnership Centre toilets',
      'toilets',
      [-3.4855803, 55.9315143],
      'Accessible visitor toilets inside Strathbrock Partnership Centre, beside the community museum.',
      currentSource(
        'Public toilets in West Lothian',
        'West Lothian Council',
        'visitor-audit:seed:strathbrock-toilets',
        'https://www.westlothian.gov.uk/toilets',
        'Council-listed public toilet facility and representative venue point.',
        'local_authority',
      ),
      ['current-context'],
    ),
  ),
  {
    name: 'Strathbrock Partnership Centre toilets',
    description:
      'Accessible visitor toilets inside Strathbrock Partnership Centre, beside the community museum.',
    opening: 'Available during Strathbrock Partnership Centre opening hours',
    address: '189a West Main Street, Broxburn, EH52 5LH',
    fee: 'Free for centre visitors',
    wheelchair: 'yes',
  },
);

curationLibrary.projects[pkg.project.id] = {
  eat: [gianninos.id, oatridge.id, aroma.id, theDine.id, dottys.id, strathbrockCafe.id],
  trails: [artTrail.id, woodlandTrail.id],
  picnic: [],
  parking: [greendykesParking.id, argyleParking.id, gallowayParking.id],
  toilets: [greendykesToilets.id, xciteToilets.id, strathbrockToilets.id],
};

for (const id of [
  'osm-community:node-10550596197',
  'osm-community:node-5399030897',
  'osm-community:node-6437939561',
]) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) continue;
  addTags(feature, auditTag, 'visitor-audit-excluded', 'map-hidden');
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes =
    id === 'osm-community:node-10550596197'
      ? 'Reviewed on 2026-08-07 and excluded because The Bulldog Bistro has closed.'
      : 'Reviewed on 2026-08-07 and excluded from the curated public food list because current visitor evidence was too weak or stale.';
}

const activeBoundary = townStudyArea.localityBoundary;
const publishedFeatureIds = [
  ...(pkg.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
  ...Object.values(curationLibrary.projects[pkg.project.id]).flat(),
];
for (const featureId of new Set(publishedFeatureIds)) {
  const feature = pkg.features.find((candidate) => candidate.id === featureId);
  if (!feature || feature.geometry?.type !== 'Point') {
    throw new Error(`Broxburn and Uphall public visitor feature is missing a point: ${featureId}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary)) {
    throw new Error(
      `Broxburn and Uphall public visitor feature falls outside the active boundary: ${featureId}`,
    );
  }
}

const audit = {
  projectId: pkg.project.id,
  reviewedAt,
  townRating: {
    previous: 1,
    rating: 1,
    rationale:
      'One star is retained. The canal society, free museum and heritage art trail support a credible short local detour, but limited opening and the absence of a destination-scale attraction cluster inside the locality keep the combined town below two stars.',
  },
  boundary: {
    active: 'Original NRS 2022 Broxburn locality S52000100, unchanged.',
    rule: 'All public attraction, food and practical markers are inside the locality. The community woodland trail starts at an in-boundary access point but continues beyond the statistical locality; its outer sculpture cluster is not counted as a town attraction.',
  },
  published: {
    attractions: (pkg.project.visitorHighlights ?? []).map((highlight) => ({
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
      name: 'Houstoun House, Almondell and other nearby visitor draws',
      reason: 'Outside the active Broxburn locality polygon and excluded from the town rating and planner.',
    },
    {
      name: 'Main Kirkhill planetary-sculpture cluster',
      reason:
        'Outside the locality. The in-boundary Galloway Crescent woodland access is retained only as a trail start.',
    },
    {
      name: 'The Bulldog Bistro',
      reason: 'Closed and removed from the public food list.',
    },
    {
      name: 'Supermarket, retail, school, staff and customer-only car parks',
      reason: 'Only useful public parking is published.',
    },
  ],
  practicalCorrections: {
    parking:
      'Three public options are published: Greendykes Road, short-stay Argyle Court and the small Galloway Crescent woodland layby. Customer-only retail and Strathbrock car parks are excluded.',
    toilets:
      'Generic toilet records were replaced with Greendykes Road, Xcite Broxburn Sports Centre and Strathbrock Partnership Centre location-led names.',
    picnic:
      'No defensible dedicated public picnic site was found inside the town boundary, so the category is intentionally empty.',
  },
  sourceUrls: pkg.project.townGuide.sourceUrls,
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`);
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);

console.log(
  `Updated Broxburn and Uphall visitor audit: ${pkg.project.visitorHighlights.length} attractions, ${curationLibrary.projects[pkg.project.id].eat.length} food stops, ${curationLibrary.projects[pkg.project.id].trails.length} trails, ${curationLibrary.projects[pkg.project.id].parking.length} car parks, ${curationLibrary.projects[pkg.project.id].toilets.length} toilets and no invented picnic sites. Rating: 1 star.`,
);
