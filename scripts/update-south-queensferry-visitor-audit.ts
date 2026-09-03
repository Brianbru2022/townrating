import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerCuration = Record<string, Record<string, string[]>>;

const projectPath = resolve('data/projects/south-queensferry.json');
const curationPath = resolve('data/visitor-planner-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const curationLibrary = JSON.parse(await readFile(curationPath, 'utf8')) as {
  projects: PlannerCuration;
};
const reviewedAt = '2026-08-05T00:00:00Z';
const reviewedDate = '2026-08-05';
const editorialMetadataLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';

function featureById(id: string): HeritageFeature {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing South Queensferry feature: ${id}`);
  return feature;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
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
    tags,
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes:
      'Curated as present-day visitor information on 2026-08-05; it is excluded from historic dating and heat-map evidence.',
    evidenceScope: 'parish_evidence',
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
    coordinates?: [number, number];
    dogFriendly?: 'yes' | 'no';
  },
): void {
  const feature = featureById(id);
  if (options.coordinates && feature.geometry?.type === 'Point') {
    feature.geometry.coordinates = options.coordinates;
    feature.locationType = 'exact';
    feature.locationConfidence = 'high';
  }
  feature.shortDescription = options.description;
  addTags(
    feature,
    'service-context-food',
    'south-queensferry-visitor-context-curated',
    'visitor-context-food',
  );
  const dog = options.dogFriendly ? `; dog_friendly=${options.dogFriendly}` : '';
  replaceCurrentCurationSource(
    feature,
    currentSource(
      `${feature.name} visitor audit`,
      options.organisation,
      `visitor-audit-food:${feature.id}`,
      options.website,
      `Current-place curation: amenity=${feature.featureType === 'restaurant' ? 'restaurant' : 'cafe'}; name=${feature.name}; cuisine=${options.cuisine}; visit_score=${options.score}; price_band=${options.price}; opening_hours:description=${options.opening}; description=${options.tagline}: ${options.description}; website=${options.website}${dog}.`,
    ),
  );
}

pkg.project.touristAppeal = {
  ...pkg.project.touristAppeal!,
  label: 'Destination draw',
};

if (pkg.project.townGuide) {
  pkg.project.townGuide.intro =
    "South Queensferry is one of the Forth's strongest short-break stops: a compact historic waterfront framed by the UNESCO World Heritage Forth Bridge, boat trips from Hawes Pier, bridge walks, marina views and a cluster of cafes made for lingering by the water.";
  pkg.project.townGuide.suggestedFirstVisit = {
    title: 'Hawes Pier, the bridge view and the old waterfront',
    summary:
      'Start at Hawes Pier for the classic close-up Forth Bridge view, add a cruise or the South Queensferry stops on the Forth Bridges Trail, then wander back through the High Street, harbour and Queensferry Museum.',
  };
  pkg.project.townGuide.dontMiss = [
    'Forth Bridge and Hawes waterfront viewpoint',
    'Forth cruises from Hawes Pier',
    'Forth Road Bridge pedestrian and cycle crossing',
    'Historic High Street, harbour, Tolbooth and closes',
    'Queensferry Museum',
  ];
  pkg.project.townGuide.currentAdvisory = {
    title: 'High Street works',
    summary: 'Town-centre works may temporarily affect parking and access along the High Street.',
    sourceUrl:
      'https://www.edinburgh.gov.uk/roads-travel-parking/queensferry-town-centre-improvements/6',
    linkLabel: 'Check access',
  };
  pkg.project.townGuide.sourceUrls = [
    ...new Set([
      ...pkg.project.townGuide.sourceUrls,
      'https://cultureedinburgh.com/our-venues/queensferry-museum',
      'https://www.edinburgh.gov.uk/roads-travel-parking/queensferry-town-centre-improvements/6',
    ]),
  ];
  pkg.project.townGuide.lastReviewedAt = reviewedDate;
}

const cruises = upsertFeature(
  curatedPoint(
    'curated-visitor:south-queensferry-forth-cruises',
    'Forth cruises from Hawes Pier',
    'harbour',
    [-3.385413, 55.9905855],
    'Choose from sightseeing cruises beneath the three bridges or longer seasonal sailings towards Inchcolm, with Maid of the Forth and Forth Boat Tours both operating locally.',
    currentSource(
      'South Queensferry boat trips',
      'Forth Bridges',
      'visitor-audit:forth-cruises-hawes-pier',
      'https://www.theforthbridges.org/visit-the-local-area-forth-bridges/see-do/south-queensferry/boat-trips/',
      'Current-place curation: tourism=attraction; name=Forth cruises from Hawes Pier; visit_score=86; opening_hours:description=Seasonal sailings, check the chosen operator timetable before travelling; entrance_fee=Prices vary by operator and cruise; time_to_spend=90-180 minutes; description=See the three bridges from water level or make a longer seasonal trip towards Inchcolm, with two local operators to compare; website=https://www.theforthbridges.org/visit-the-local-area-forth-bridges/see-do/south-queensferry/boat-trips/.',
      'official_non_statutory',
    ),
    [
      'current-context',
      'curated-visitor-place',
      'service-context-visitor',
      'south-queensferry-visitor-context-curated',
    ],
  ),
);

const museum = featureById('osm-community:node-2661485251');
museum.shortDescription =
  'A compact waterfront museum connecting Queensferry traditions, local life and the engineering story of the Forth bridges, with excellent views from the building.';
addTags(museum, 'service-context-visitor', 'visitor-context-museum');
replaceCurrentCurationSource(
  museum,
  currentSource(
    'Queensferry Museum visitor information',
    'Culture Edinburgh and City of Edinburgh Council',
    'visitor-audit:queensferry-museum',
    'https://cultureedinburgh.com/our-venues/queensferry-museum',
    "Current-place curation: tourism=museum; name=Queensferry Museum; visit_score=71; opening_hours:description=Published opening information currently varies, check today's venue notice before travelling; entrance_fee=Free; time_to_spend=30-60 minutes; description=Step inside for the town's social history, bridge engineering and local traditions, with one of the best indoor views of the Forth Bridge; website=https://cultureedinburgh.com/our-venues/queensferry-museum.",
    'local_authority',
  ),
);

const priory = featureById('hes-listed-building:LB40391');
priory.shortDescription =
  'A rare surviving medieval Carmelite church, still active today and especially rewarding for visitors interested in the old town beyond the bridges.';
replaceCurrentCurationSource(
  priory,
  currentSource(
    'Priory Church visitor information',
    'Priory Church Queensferry',
    'priory_church_st_mary_mount_carmel',
    'https://priorychurch.org/',
    'Current-place curation: tourism=attraction; name=Priory Church of St Mary of Mount Carmel; visit_score=66; opening_hours:description=Active church, casual visitor access is not guaranteed. Sunday worship 10:30. The separate cafe opens Monday, Tuesday, Wednesday and Friday 09:00-14:00; entrance_fee=Free, donations welcome; time_to_spend=20-40 minutes; description=Discover an unusually complete medieval Carmelite church still serving its community beside the Binks; website=https://priorychurch.org/.',
  ),
);

const roadBridge = featureById('curated-visitor:south-queensferry-forth-road-bridge-walk');
roadBridge.shortDescription =
  'A high, exposed pedestrian crossing with exceptional views of the Forth Bridge and Queensferry Crossing; check the live path status and wind restrictions before setting out.';
replaceCurrentCurationSource(
  roadBridge,
  currentSource(
    'Forth Road Bridge visitor access',
    'Forth Bridges',
    'visitor-audit:forth-road-bridge-access',
    'https://www.theforthbridges.org/visit-the-forth-bridges/visiting-the-bridges-faqs/',
    'Current-place curation: tourism=attraction; name=Forth Road Bridge pedestrian and cycle crossing; visit_score=77; opening_hours:description=Path availability can change for maintenance and high winds, check live bridge status before setting out; entrance_fee=Free; time_to_spend=60-90 minutes for an out-and-back walk; description=Walk high above the Forth for dramatic views of all three bridges, remembering that the open path can change during maintenance; website=https://www.theforthbridges.org/visit-the-forth-bridges/visiting-the-bridges-faqs/.',
    'official_non_statutory',
  ),
);

const townscape = featureById('osm-community:node-10557250205');
townscape.name = 'Historic High Street, harbour, Tolbooth and closes';
townscape.shortDescription =
  'A compact old-town wander through the setted High Street, harbour, historic Tolbooth, closes and layered waterfront buildings.';
replaceCurrentCurationSource(
  townscape,
  currentSource(
    'South Queensferry historic townscape visitor audit',
    'Forth Bridges',
    'visitor-audit:historic-high-street',
    'https://www.theforthbridges.org/visit-the-local-area-forth-bridges/see-do/south-queensferry/',
    'Current-place curation: tourism=attraction; name=Historic High Street, harbour, Tolbooth and closes; visit_score=75; opening_hours:description=Open access, current improvement works may temporarily alter sections of the High Street; entrance_fee=Free; time_to_spend=45-75 minutes; description=Wander the setted waterfront street, harbour, closes and historic Tolbooth for the part of Queensferry that rewards looking beyond the bridge view; website=https://www.theforthbridges.org/visit-the-local-area-forth-bridges/see-do/south-queensferry/.',
    'official_non_statutory',
  ),
);

pkg.project.visitorHighlights = [
  {
    rank: 1,
    featureId: 'osm-community:node-5393391364',
    name: 'Forth Bridge and Hawes waterfront viewpoint',
    reason:
      "Stand almost beneath Scotland's great red cantilevers for the town's defining UNESCO World Heritage view.",
    tagline: 'UNESCO bridge view',
    visitorScore: 87,
    openingTimes: 'Open access year-round; daylight and clear weather give the best experience.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Forth Bridges',
    sourceUrl:
      'https://www.theforthbridges.org/visit-the-local-area-forth-bridges/see-do/top-10-forth-bridge-viewpoints/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 2,
    featureId: cruises.id,
    name: cruises.name,
    reason:
      'See the bridges from water level or choose a longer seasonal cruise towards Inchcolm, comparing two local operators and sailing styles.',
    tagline: 'See the bridges from below',
    visitorScore: 86,
    openingTimes: 'Seasonal sailings; check the chosen operator timetable before travelling.',
    admission: 'Prices vary by operator and cruise.',
    freeAdmission: false,
    organisationPills: [],
    sourceName: 'Forth Bridges',
    sourceUrl:
      'https://www.theforthbridges.org/visit-the-local-area-forth-bridges/see-do/south-queensferry/boat-trips/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 3,
    featureId: roadBridge.id,
    name: roadBridge.name,
    reason:
      'An exposed but memorable crossing with panoramic views of the Forth Bridge, Queensferry Crossing and both shores.',
    tagline: 'High-level bridge walk',
    visitorScore: 77,
    openingTimes: 'Check live path and wind restrictions before setting out.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Forth Bridges',
    sourceUrl: 'https://www.theforthbridges.org/visit-the-forth-bridges/visiting-the-bridges-faqs/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 4,
    featureId: townscape.id,
    name: townscape.name,
    reason:
      'The setted waterfront street, harbour, closes and Tolbooth give South Queensferry a real historic-town visit beyond its famous bridges.',
    tagline: 'Old-town wander',
    visitorScore: 75,
    openingTimes: 'Open access; improvement works may temporarily affect parts of the High Street.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Forth Bridges',
    sourceUrl:
      'https://www.theforthbridges.org/visit-the-local-area-forth-bridges/see-do/south-queensferry/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 5,
    featureId: museum.id,
    name: museum.name,
    reason:
      "The best indoor introduction to Queensferry's social history, traditions and bridge engineering, with excellent views across the Forth.",
    tagline: 'Town and bridge stories',
    visitorScore: 71,
    openingTimes: "Published hours currently vary; check today's venue notice before travelling.",
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Culture Edinburgh',
    sourceUrl: 'https://cultureedinburgh.com/our-venues/queensferry-museum',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 6,
    featureId: priory.id,
    name: priory.name,
    reason:
      'A rare surviving medieval Carmelite church that adds depth to an old-town wander when visitor access is available.',
    tagline: 'Medieval Queensferry',
    visitorScore: 66,
    openingTimes: 'Active church; casual visitor access varies. Sunday worship is at 10:30.',
    admission: 'Free, donations welcome.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Priory Church Queensferry',
    sourceUrl: 'https://priorychurch.org/',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 7,
    featureId: 'osm-community:node-10557250199',
    name: 'Port Edgar Marina waterfront',
    reason:
      'A working marina with wide bridge views, boat activity and useful food stops at the western end of the town visit.',
    tagline: 'Marina and bridge views',
    visitorScore: 64,
    openingTimes: 'Public access year-round; individual businesses keep their own hours.',
    admission: 'Free general access; activities vary by operator.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Port Edgar Marina',
    sourceUrl: 'https://www.portedgar.co.uk/visit',
    verifiedInBoundaryAt: reviewedDate,
  },
  {
    rank: 8,
    featureId: 'osm-community:node-4320512547',
    name: 'Briggers Memorial and Guardian of the Bridges',
    reason:
      'A brief but affecting memorial to the people who died building the Forth Bridge, paired with a contemporary sculpture.',
    tagline: 'Human story of the bridge',
    visitorScore: 56,
    openingTimes: 'Open access year-round.',
    admission: 'Free.',
    freeAdmission: true,
    organisationPills: [],
    sourceName: 'Forth Bridges',
    sourceUrl: 'https://www.theforthbridges.org/visit-the-forth-bridges/forth-bridges-trail/',
    verifiedInBoundaryAt: reviewedDate,
  },
];

updateFood('osm-community:node-2158074189', {
  score: 82,
  tagline: 'Waterfront dining',
  description:
    'An independent waterfront restaurant with a more distinctive menu than most of the town, backed by bridge views and a strong sense of place.',
  opening:
    'Tuesday-Thursday and Sunday 12:00-22:00, Friday-Saturday 12:00-23:00. Closed Monday. Kitchen last orders 20:30',
  price: '£££',
  cuisine: 'modern_scottish',
  website: 'https://theboathouse.online/',
  organisation: 'Rogue Bros at The Boathouse',
});
updateFood('osm-community:node-12046519297', {
  score: 81,
  tagline: 'Best pastries',
  description:
    'A small specialist bakery worth seeking out for inventive pastries, excellent coffee and fresh seasonal bakes, particularly as a waterfront takeaway.',
  opening: 'Thursday-Monday 09:00-15:00. Closed Tuesday-Wednesday. Check operator social updates',
  price: '££',
  cuisine: 'artisan_bakery',
  website: 'https://www.instagram.com/dunebakery/',
  organisation: 'Dune Bakery',
  dogFriendly: 'yes',
});
updateFood('osm-community:node-1529914813', {
  score: 79,
  tagline: 'Bridge-view dining',
  description:
    'A dependable all-day choice almost beneath the Forth Bridge, combining a takeaway coffee stop with breakfast, lunch and dinner beside the water.',
  opening: 'CoffeeStop daily 08:00-21:00. Kitchen daily 09:00-21:00',
  price: '££',
  cuisine: 'scottish_restaurant',
  website: 'https://www.railbridge.co.uk/',
  organisation: 'The Railbridge',
});
updateFood('osm-community:node-4006159812', {
  score: 78,
  tagline: 'Canadian comfort food',
  description:
    'A lively marina lunch stop for poutine, burgers and generous Canadian-inspired dishes, with heated outdoor seating and family appeal.',
  opening:
    'Daily 08:30-17:00. Breakfast bookings to 11:00, all-day menu bookings from 12:15. Card only',
  price: '££',
  cuisine: 'canadian_diner',
  website: 'https://www.downthehatchdiner.com/',
  organisation: 'Down the Hatch',
  dogFriendly: 'yes',
});
updateFood('osm-community:node-6017919651', {
  score: 78,
  tagline: 'Best marina setting',
  description:
    'Polished all-day dining with broad menus and striking views across Port Edgar to the three bridges, well suited to groups and longer meals.',
  opening: 'Daily 09:00-21:00 for food. Venue hours may continue later',
  price: '£££',
  cuisine: 'modern_scottish',
  website: 'https://www.scotts-southqueensferry.co.uk/',
  organisation: 'Scotts South Queensferry',
  dogFriendly: 'no',
});

const hawes = featureById('hes-listed-building:LB40354');
hawes.name = 'The Hawes Inn';
hawes.shortDescription =
  'A historic inn beneath the Forth Bridge with Robert Louis Stevenson connections, country-pub food, fireside character and a dog-friendly bar area.';
addTags(
  hawes,
  'service-context-food',
  'south-queensferry-visitor-context-curated',
  'visitor-context-food',
);
replaceCurrentCurationSource(
  hawes,
  currentSource(
    'The Hawes Inn visitor information',
    'Vintage Inns',
    'visitor-audit-food:hawes-inn',
    'https://www.vintageinn.co.uk/restaurants/scotland-northern-ireland/thehawesinnsouthqueensferry/',
    'Current-place curation: amenity=pub; name=The Hawes Inn; cuisine=country_pub; visit_score=77; price_band=££; opening_hours:description=Monday-Friday 07:00-23:00, Saturday 08:00-23:00, Sunday 08:00-22:30. Confirm food-service times for a special journey; description=Historic pub: A characterful stop beneath the Forth Bridge, with country-pub food and a Robert Louis Stevenson connection to Kidnapped; website=https://www.vintageinn.co.uk/restaurants/scotland-northern-ireland/thehawesinnsouthqueensferry/; dog_friendly=yes.',
  ),
);

const ferryTap = upsertFeature(
  curatedPoint(
    'curated-food:south-queensferry-ferry-tap',
    'The Ferry Tap',
    'restaurant',
    [-3.395141, 55.9897531],
    'A characterful 17th-century High Street pub with cask ale, a large whisky selection, live music and a genuinely local atmosphere.',
    currentSource(
      'The Ferry Tap visitor information',
      'The Ferry Tap',
      'visitor-audit-food:ferry-tap',
      'https://www.ferrytap.co.uk/',
      'Current-place curation: amenity=pub; name=The Ferry Tap; cuisine=traditional_pub; visit_score=76; price_band=££; opening_hours:description=Monday-Thursday and Sunday 12:00-23:00, Friday-Saturday 11:00-00:00; description=Historic pub: A cosy High Street pub dating to 1683, with cask ale, more than 50 single malts, food and regular live music; website=https://www.ferrytap.co.uk/; dog_friendly=yes.',
    ),
    [
      'current-context',
      'curated-food-place',
      'service-context-food',
      'south-queensferry-visitor-context-curated',
      'visitor-context-food',
    ],
  ),
);

updateFood('osm-community:node-2661485246', {
  score: 76,
  tagline: 'Bakery lunch',
  description:
    'A well-established High Street bakery-cafe for breads, pastries, salads, coffee and a light lunch, with sit-in tables and bridge views.',
  opening:
    'Wednesday-Sunday 09:00-17:00. Sit in until 16:00, takeaway until 17:00. Closed Monday-Tuesday',
  price: '££',
  cuisine: 'bakery_cafe',
  website: 'https://www.themannahousebakery.com/contact',
  organisation: 'Manna House Bakery',
  dogFriendly: 'yes',
});
updateFood('osm-community:node-2661485248', {
  score: 75,
  tagline: 'All-day bakery cafe',
  description:
    'A broad daytime menu covering cakes, breakfast, lunch and afternoon tea, useful for groups who want more choice than a specialist pastry stop.',
  opening: 'Daily 09:00-17:00',
  price: '££',
  cuisine: 'bakery_cafe',
  website: 'https://littlebakery.co.uk/',
  organisation: 'The Little Bakery',
});
updateFood('curated-food:south-queensferry-thirty-knots', {
  score: 74,
  tagline: 'Good for groups',
  description:
    'A broad breakfast-to-dinner pub-restaurant with waterfront views and long hours, useful when a mixed group wants plenty of menu choice.',
  opening: 'Monday-Thursday 09:00-23:30, Friday-Saturday 09:00-00:00, Sunday 09:00-22:30',
  price: '£££',
  cuisine: 'pub_restaurant',
  website: 'https://www.thirtyknots-southqueensferry.co.uk/',
  organisation: 'Thirty Knots and Buzzworks',
  coordinates: [-3.3876775, 55.9897254],
});

const littleParlour = upsertFeature(
  curatedPoint(
    'curated-food:south-queensferry-little-parlour',
    'The Little Parlour',
    'cafe',
    [-3.3935665, 55.9896188],
    'A cheerful High Street gelato stop with more than 60 artisan flavours, shakes and coffee, especially useful for families and a waterfront treat.',
    currentSource(
      'The Little Parlour visitor listing',
      'Forever Edinburgh',
      'visitor-audit-food:little-parlour',
      'https://edinburgh.org/point-of-interest/the-little-parlour/',
      'Current-place curation: amenity=ice_cream; name=The Little Parlour; cuisine=gelato_coffee; visit_score=73; price_band=£; opening_hours:description=Daily 10:00-20:00, confirm seasonal changes before a special journey; description=Family treat: Choose from more than 60 artisan gelato flavours, shakes and coffee on the historic High Street; website=https://edinburgh.org/point-of-interest/the-little-parlour/.',
      'local_authority',
    ),
    [
      'current-context',
      'curated-food-place',
      'service-context-food',
      'south-queensferry-visitor-context-curated',
      'visitor-context-food',
    ],
  ),
);

updateFood('osm-community:way-1083846163', {
  score: 68,
  tagline: 'Casual marina stop',
  description:
    'A relaxed dog-friendly marina option for coffee, pastries and casual food, with covered outdoor seating and open bridge views.',
  opening: 'Sunday-Thursday 09:00-17:00, Friday-Saturday 09:00-21:00',
  price: '££',
  cuisine: 'casual_cafe',
  website: 'https://www.outboardbyscotts.co.uk/',
  organisation: 'Outboard by Scotts and Buzzworks',
  dogFriendly: 'yes',
});

const antico = featureById('curated-food:south-queensferry-antico-cafe-bar');
antico.licence ??= editorialMetadataLicence;
if (antico.geometry?.type === 'Point') {
  antico.geometry.coordinates = [-3.3964391, 55.9902692];
  antico.locationType = 'exact';
  antico.locationConfidence = 'high';
  antico.updatedAt = reviewedAt;
}

featureById('curated-food:south-queensferry-cafe-at-the-priory').licence ??=
  editorialMetadataLicence;

const binksCarPark = featureById('osm-community:way-260629261');
binksCarPark.shortDescription =
  'Free public surface car park at Rose Lane, convenient for The Binks, the Priory and the west end of the High Street.';
replaceCurrentCurationSource(
  binksCarPark,
  currentSource(
    'The Binks Car Park directions and parking status',
    'Queensferry Podiatry',
    'visitor-audit-parking:the-binks',
    'https://www.queensferrypodiatry.com/directions/',
    'Current-place curation: amenity=parking; name=The Binks Car Park; access=public; parking=surface; capacity=48; price_display=Free; payment_required=no; description=Free public car park at Rose Lane, convenient for The Binks, the Priory and the west end of the High Street. Check current entrance signs for temporary restrictions; confidence=Medium because the free status is stated by a local town-centre business rather than the car-park operator.',
    'secondary',
  ),
);

const highStreetToilets = featureById('osm-community:node-10300195913');
replaceCurrentCurationSource(
  highStreetToilets,
  currentSource(
    'South Queensferry public toilet opening times',
    'City of Edinburgh Council',
    'visitor-audit-toilets:high-street',
    'https://www.edinburgh.gov.uk/leisure-sport-culture/public-toilets/1',
    'Current-place curation: amenity=toilets; name=High Street public toilets; opening_hours:description=Daily 10:00-19:30, subject to short-notice closure; wheelchair=yes; description=Accessible public toilets close to Queensferry Museum, the High Street and waterfront.',
    'local_authority',
  ),
);
const hawesToilets = featureById('osm-community:node-13088892512');
replaceCurrentCurationSource(
  hawesToilets,
  currentSource(
    'South Queensferry public toilet opening times',
    'City of Edinburgh Council',
    'visitor-audit-toilets:hawes-pier',
    'https://www.edinburgh.gov.uk/leisure-sport-culture/public-toilets/1',
    'Current-place curation: amenity=toilets; name=Hawes Pier public toilets; opening_hours:description=Daily 10:00-20:00, subject to short-notice closure; wheelchair=yes; changing_places=yes; description=Accessible public toilets with Changing Places facilities beside Hawes Pier car park and boat departures.',
    'local_authority',
  ),
);
const marinaToilets = featureById('osm-community:node-9932295752');
marinaToilets.name = 'Port Edgar Marina public toilets';
marinaToilets.shortDescription =
  'Public toilets beside Outboard and the marina visitor area at Port Edgar.';
addTags(
  marinaToilets,
  'service-context-toilets',
  'south-queensferry-visitor-context-curated',
  'visitor-context-toilets',
);
replaceCurrentCurationSource(
  marinaToilets,
  currentSource(
    'Port Edgar public facilities',
    'Port Edgar Marina',
    'visitor-audit-toilets:port-edgar',
    'https://www.portedgar.co.uk/visit',
    'Current-place curation: amenity=toilets; name=Port Edgar Marina public toilets; opening_hours:description=Available with the public marina facilities, check locally for seasonal or short-notice changes; description=Public toilets beside Outboard and the marina visitor area at Port Edgar; website=https://www.portedgar.co.uk/visit.',
  ),
);

const eastPicnic = featureById('osm-community:node-7609664976');
eastPicnic.name = 'The Binks east picnic table';
eastPicnic.shortDescription =
  'Waterfront picnic table at the eastern side of The Binks, close to the harbour and Priory.';
const westPicnic = featureById('osm-community:node-10764563863');
westPicnic.name = 'The Binks west picnic table';
westPicnic.shortDescription =
  'Waterfront picnic table at the western side of The Binks, on the route towards Port Edgar.';

const publicPlanner = curationLibrary.projects[pkg.project.id];
if (!publicPlanner) throw new Error('Missing bundled South Queensferry planner curation');
publicPlanner.eat = [
  'osm-community:node-2158074189',
  'osm-community:node-12046519297',
  'osm-community:node-1529914813',
  'osm-community:node-4006159812',
  'osm-community:node-6017919651',
  hawes.id,
  ferryTap.id,
  'osm-community:node-2661485246',
  'osm-community:node-2661485248',
  'curated-food:south-queensferry-thirty-knots',
  littleParlour.id,
  'osm-community:way-1083846163',
];
publicPlanner.toilets = [
  'osm-community:node-10300195913',
  'osm-community:node-13088892512',
  'osm-community:node-14003506933',
  marinaToilets.id,
];

for (const id of [
  ...pkg.project.visitorHighlights.map((highlight) => highlight.featureId),
  ...publicPlanner.eat,
  ...publicPlanner.parking,
  ...publicPlanner.toilets,
  ...publicPlanner.picnic,
  ...publicPlanner.trails,
]) {
  const feature = featureById(id);
  if (feature.geometry?.type !== 'Point') {
    throw new Error(`Curated feature is not a point: ${id}`);
  }
  if (!booleanPointInPolygon(point(feature.geometry.coordinates), pkg.project.boundary)) {
    throw new Error(`Curated feature is outside the South Queensferry boundary: ${id}`);
  }
}

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(curationPath, `${JSON.stringify(curationLibrary, null, 2)}\n`, 'utf8');

console.log(
  `Updated South Queensferry: ${pkg.project.visitorHighlights.length} See, ${publicPlanner.eat.length} Eat, ${publicPlanner.toilets.length} toilets; every curated point is inside the supplied boundary.`,
);
