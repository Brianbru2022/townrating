import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

type PlannerFile = {
  schemaVersion: number;
  description: string;
  projects: Record<string, Record<string, string[]>>;
};

type DogFile = {
  schemaVersion: number;
  reviewedAt: string;
  description: string;
  projects: Record<
    string,
    {
      attraction?: Record<string, unknown>;
      eat?: Record<string, unknown>;
    }
  >;
};

interface CuratedPlace {
  id: string;
  name: string;
  coordinates: [number, number];
  featureType: string;
  score: number;
  tagline: string;
  description: string;
  opening: string;
  price: string;
  priceBand?: string;
  cuisine?: string;
  website: string;
  sourceName: string;
  sourceOrganisation: string;
  osmUrl?: string;
  timeToSpend?: string;
}

interface CuratedPicnic {
  id: string;
  name: string;
  coordinates: [number, number];
  description: string;
  admission: string;
  website: string;
  sourceName: string;
  sourceOrganisation: string;
  sourceRecordId: string;
  sourceUrl: string;
  reliability: SourceRecord['reliability'];
  osmRecordId?: string;
  osmUrl?: string;
}

const projectPath = resolve('data/projects/peterborough.json');
const plannerPath = resolve('data/visitor-planner-curation.json');
const dogPath = resolve('data/dog-access-curation.json');
const auditPath = resolve('data/review/peterborough-visitor-audit-2026-08-07.json');
const reviewedAt = '2026-08-08T00:00:00Z';
const reviewedDate = reviewedAt.slice(0, 10);
const projectId = 'peterborough-england';
const editorialLicence =
  'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';

const attractions: CuratedPlace[] = [
  {
    id: 'curated-attraction:peterborough-new-theatre',
    name: 'New Theatre Peterborough',
    coordinates: [-0.2409053, 52.576793],
    featureType: 'theatre',
    score: 74,
    tagline: 'Art-deco stage',
    description:
      'Catch touring musicals, comedy, drama and family productions in Peterborough’s handsome refurbished art-deco theatre on Broadway.',
    opening: 'Opens for performances; bars normally open 60 minutes before the show.',
    price: 'Ticket prices vary by performance.',
    website: 'https://newtheatre-peterborough.com/',
    sourceName: 'New Theatre Peterborough visitor information',
    sourceOrganisation: 'Landmark Theatres',
    osmUrl: 'https://www.openstreetmap.org/search?query=New%20Theatre%20Peterborough',
    timeToSpend: '2-3 hours for a performance',
  },
  {
    id: 'curated-attraction:peterborough-key-theatre',
    name: 'Key Theatre',
    coordinates: [-0.2384935, 52.568704],
    featureType: 'theatre',
    score: 72,
    tagline: 'Riverside performance',
    description:
      'Pair a play, concert or comedy performance with a riverside walk at this intimate theatre on the Embankment.',
    opening: 'Opens for performances and advertised events.',
    price: 'Ticket prices vary by performance.',
    website: 'https://keytheatre-peterborough.com/',
    sourceName: 'Key Theatre visitor information',
    sourceOrganisation: 'Landmark Theatres',
    osmUrl: 'https://www.openstreetmap.org/search?query=Key%20Theatre%20Peterborough',
    timeToSpend: '2-3 hours for a performance',
  },
  {
    id: 'curated-attraction:peterborough-guildhall',
    name: 'Peterborough Guildhall and Cathedral Square',
    coordinates: [-0.243145044375019, 52.5725828471257],
    featureType: 'civic_building',
    score: 70,
    tagline: 'Civic heart',
    description:
      'Pause beneath the open arches of the 1671 Guildhall and take in Cathedral Square, the natural hinge between the Cathedral, St John’s Church and the city centre.',
    opening: 'Exterior viewable at all times; interior access is limited to special events.',
    price: 'Free exterior viewing.',
    website: 'https://discoverpeterborough.co.uk/things-to-do/peterborough-guildhall/',
    sourceName: 'Peterborough Guildhall visitor information',
    sourceOrganisation: 'Discover Peterborough',
    osmUrl: 'https://www.openstreetmap.org/way/26430630',
    timeToSpend: '10-20 minutes',
  },
  {
    id: 'curated-attraction:peterborough-bishops-gardens',
    name: "Bishop's Gardens",
    coordinates: [-0.2387064, 52.5708636],
    featureType: 'garden',
    score: 64,
    tagline: 'Quiet garden',
    description:
      'Slip behind the Cathedral precinct for a quiet green pause among lawns, mature trees and community garden planting close to the city centre.',
    opening: 'Public outdoor garden; visit in daylight.',
    price: 'Free.',
    website: 'https://www.openstreetmap.org/way/1041239263',
    sourceName: "Bishop's Gardens current map record",
    sourceOrganisation: 'OpenStreetMap contributors',
    osmUrl: 'https://www.openstreetmap.org/way/1041239263',
    timeToSpend: '20-30 minutes',
  },
];

const food: CuratedPlace[] = [
  { id: 'curated-food:peterborough-the-chalkboard', name: 'The Chalkboard', coordinates: [-0.2388925, 52.5686182], featureType: 'cafe', score: 85, tagline: 'Afternoon-tea favourite', description: 'A polished independent tea room by the Key Theatre, known for made-to-order afternoon tea, locally sourced food and river-facing surroundings.', opening: 'Current hours vary with bookings and events; check the operator before travelling.', price: 'Mid-range cafe and afternoon-tea pricing.', priceBand: '££', cuisine: 'tea room;british', website: 'https://www.thechalkboardpeterborough.co.uk/', sourceName: 'The Chalkboard visitor information', sourceOrganisation: 'The Chalkboard', osmUrl: 'https://www.openstreetmap.org/node/8861048759' },
  { id: 'curated-food:peterborough-momoz-and-more', name: 'Momoz & More', coordinates: [-0.2447838, 52.5752738], featureType: 'restaurant', score: 84, tagline: 'Nepalese lunch', description: 'A compact independent lunch choice for Nepalese momos, curries and street-food flavours just north of the city centre.', opening: 'Sunday-Thursday 12:00-22:00; Friday-Saturday 12:00-23:00.', price: 'Mid-range restaurant pricing.', priceBand: '££', cuisine: 'nepalese', website: 'https://www.momozandmore.uk/menu-5', sourceName: 'Momoz & More opening times and menu', sourceOrganisation: 'Momoz & More', osmUrl: 'https://www.openstreetmap.org/node/5927562193' },
  { id: 'curated-food:peterborough-east', name: 'East', coordinates: [-0.242019, 52.5681639], featureType: 'restaurant', score: 82, tagline: 'Barge lunch', description: 'Pan-Asian lunch on the upper deck of a converted Dutch barge makes this one of Peterborough’s most distinctive daytime meal settings.', opening: 'Open for lunch and evening service; check current lunch sittings online.', price: 'Mid-range restaurant pricing.', priceBand: '££', cuisine: 'pan-asian;thai', website: 'https://www.east-restaurant.co.uk/', sourceName: 'East restaurant information', sourceOrganisation: 'East', osmUrl: 'https://www.openstreetmap.org/node/915768396' },
  { id: 'curated-food:peterborough-1498-spice-affair', name: '1498 The Spice Affair', coordinates: [-0.2442573, 52.5716612], featureType: 'restaurant', score: 81, tagline: 'Goan and Indian', description: 'A central independent restaurant with a broad Goan and Indian menu, useful for a more substantial meal after the Cathedral or museum.', opening: 'Check the current lunch and dinner sittings online.', price: 'Mid-range restaurant pricing.', priceBand: '££', cuisine: 'goan;indian', website: 'https://1498-thespiceaffair.co.uk/', sourceName: '1498 The Spice Affair', sourceOrganisation: '1498 The Spice Affair', osmUrl: 'https://www.openstreetmap.org/way/119791295' },
  { id: 'curated-food:peterborough-ferry-meadows-cafe', name: 'Ferry Meadows Cafe', coordinates: [-0.3071113, 52.5632268], featureType: 'cafe', score: 80, tagline: 'Best after a park walk', description: 'Freshly made lunches, house-baked cakes and coffee beside Overton Lake make this the natural pause during a Ferry Meadows visit.', opening: 'Daily 08:00-16:00; recheck seasonal hours.', price: 'Affordable cafe pricing.', priceBand: '££', cuisine: 'cafe;coffee_shop', website: 'https://www.lakesidekitchenandbar.co.uk/ferrymeadowscafe', sourceName: 'Ferry Meadows Cafe information', sourceOrganisation: 'Meadow Brown Restaurants', osmUrl: 'https://www.openstreetmap.org/node/11971972377' },
  { id: 'curated-food:peterborough-lakeside-kitchen', name: 'Lakeside Kitchen & Bar', coordinates: [-0.315238, 52.5660657], featureType: 'restaurant', score: 79, tagline: 'Lake-view lunch', description: 'Made-to-order food, cakes and drinks with wide Gunwade Lake views and an outdoor deck in the heart of Ferry Meadows.', opening: 'Daily 08:00-17:00; recheck seasonal hours.', price: 'Mid-range cafe and restaurant pricing.', priceBand: '££', cuisine: 'british;cafe', website: 'https://www.lakesidekitchenandbar.co.uk/', sourceName: 'Lakeside Kitchen & Bar information', sourceOrganisation: 'Meadow Brown Restaurants', osmUrl: 'https://www.openstreetmap.org/node/11155950087' },
  { id: 'curated-food:peterborough-bombay-brasserie', name: 'Bombay Brasserie', coordinates: [-0.2399604, 52.5773257], featureType: 'restaurant', score: 77, tagline: 'Broadway curry house', description: 'A long-standing Broadway restaurant with a wide Indian menu and both lunch and evening service.', opening: 'Monday-Saturday 12:00-15:00 and 17:30-23:00; Sunday 12:00-15:00 and 17:00-22:30.', price: 'Mid-range restaurant pricing.', priceBand: '££', cuisine: 'indian', website: 'http://thebombaybrasseriepeterborough.co.uk/', sourceName: 'Bombay Brasserie information', sourceOrganisation: 'Bombay Brasserie', osmUrl: 'https://www.openstreetmap.org/way/651234815' },
  { id: 'curated-food:peterborough-wildwood', name: 'Wildwood Peterborough', coordinates: [-0.2428591, 52.572298], featureType: 'restaurant', score: 74, tagline: 'Family-friendly fallback', description: 'A reliable central option for pizza, pasta and grills when a mixed group needs an easy menu close to Cathedral Square.', opening: 'Open daily; check current service hours online.', price: 'Mid-range chain restaurant pricing.', priceBand: '££', cuisine: 'pizza;pasta;grill', website: 'https://wildwoodrestaurants.co.uk/restaurant/peterborough/', sourceName: 'Wildwood Peterborough information', sourceOrganisation: 'Wildwood', osmUrl: 'https://www.openstreetmap.org/node/6193504670' },
  { id: 'curated-food:peterborough-cote', name: 'Côte Peterborough', coordinates: [-0.2438435, 52.5723444], featureType: 'restaurant', score: 73, tagline: 'French brasserie', description: 'A convenient Cathedral Square brasserie for breakfast, set menus and familiar French dishes in a polished central setting.', opening: 'Open daily; check current breakfast, lunch and dinner hours online.', price: 'Mid-range brasserie pricing.', priceBand: '££', cuisine: 'french', website: 'https://www.cote.co.uk/restaurant/peterborough', sourceName: 'Côte Peterborough information', sourceOrganisation: 'Côte', osmUrl: 'https://www.openstreetmap.org/node/12390475423' },
  { id: 'curated-food:peterborough-pizza-house', name: 'Pizza House', coordinates: [-0.2449782, 52.5727565], featureType: 'restaurant', score: 72, tagline: 'Independent pizza', description: 'A long-established independent close to Cathedral Square for pizza, pasta and an uncomplicated family meal.', opening: 'Check current lunch and evening service before travelling.', price: 'Affordable to mid-range restaurant pricing.', priceBand: '££', cuisine: 'pizza;italian', website: 'https://www.visitpeterborough.com/food-and-drink/pizza-house-p874861', sourceName: 'Pizza House visitor listing', sourceOrganisation: 'Visit Peterborough', osmUrl: 'https://www.openstreetmap.org/node/11971972404' },
  { id: 'curated-food:peterborough-black-sheep-coffee', name: 'Black Sheep Coffee - Queensgate', coordinates: [-0.2448683, 52.5734916], featureType: 'cafe', score: 66, tagline: 'Quick central coffee', description: 'A practical speciality-coffee stop inside Queensgate for espresso drinks, pastries and a quick break between the station and Cathedral Square.', opening: 'Open with Queensgate shopping hours; check the current listing.', price: 'Typical coffee-shop pricing.', priceBand: '££', cuisine: 'coffee_shop', website: 'https://blacksheepcoffee.co.uk/blogs/locations/queensgate-mall', sourceName: 'Black Sheep Coffee Queensgate', sourceOrganisation: 'Black Sheep Coffee', osmUrl: 'https://www.openstreetmap.org/way/1291154259' },
];

const excludedFoodIds = new Set([
  'curated-food:peterborough-kathmandu-lounge',
  'curated-food:peterborough-baan-thai',
  'curated-food:peterborough-charters',
  'curated-food:peterborough-bumble-inn',
]);

const publishedFoodIds = [
  'curated-food:peterborough-tap-and-tandoor',
  'curated-food:peterborough-the-chalkboard',
  'curated-food:peterborough-momoz-and-more',
  'curated-food:peterborough-black-and-bloom',
  'curated-food:peterborough-east',
  'curated-food:peterborough-embe-soul-food',
  'curated-food:peterborough-1498-spice-affair',
  'curated-food:peterborough-bewiched-bridge-street',
  'curated-food:peterborough-argo-lounge',
  'curated-food:peterborough-ferry-meadows-cafe',
  'curated-food:peterborough-lakeside-kitchen',
  'curated-food:peterborough-bombay-brasserie',
  'curated-food:peterborough-wildwood',
  'curated-food:peterborough-cote',
  'curated-food:peterborough-pizza-house',
  'curated-food:peterborough-black-sheep-coffee',
];

const picnicPlaces: CuratedPicnic[] = [
  {
    id: 'curated-picnic:peterborough-embankment',
    name: 'Peterborough Embankment picnic area',
    coordinates: [-0.237835, 52.5700008],
    description: 'Riverside grass and a mapped picnic area beside the Lido and Key Theatre, within an easy walk of the city centre.',
    admission: 'Free',
    website: 'https://www.peterborough.gov.uk/libraries-leisure-culture-facilities/parks-and-open-spaces',
    sourceName: 'Peterborough parks and open spaces',
    sourceOrganisation: 'Peterborough City Council',
    sourceRecordId: 'peterborough-embankment',
    sourceUrl: 'https://www.peterborough.gov.uk/libraries-leisure-culture-facilities/parks-and-open-spaces',
    reliability: 'official_non_statutory',
    osmRecordId: 'node/10887204129',
    osmUrl: 'https://www.openstreetmap.org/node/10887204129',
  },
  {
    id: 'curated-picnic:peterborough-pleasure-fair-meadow',
    name: 'Pleasure Fair Meadow picnic tables',
    coordinates: [-0.24249, 52.56445],
    description: 'A grouped set of public picnic tables on the riverside meadow south of the city centre.',
    admission: 'Free',
    website: 'https://www.openstreetmap.org/node/5731793949',
    sourceName: 'OpenStreetMap current community places',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceRecordId: 'nodes/5731793949-5731793953',
    sourceUrl: 'https://www.openstreetmap.org/node/5731793949',
    reliability: 'secondary',
  },
  {
    id: 'curated-picnic:peterborough-railworld',
    name: 'Railworld Wildlife Haven picnic area',
    coordinates: [-0.2487, 52.56895],
    description: 'Picnic tables and benches within Railworld Wildlife Haven, intended for visitors exploring the paid wildlife and railway attraction.',
    admission: 'Attraction admission applies',
    website: 'https://www.railworldwildlifehaven.org.uk/visit-us',
    sourceName: 'Railworld Wildlife Haven visitor information',
    sourceOrganisation: 'Railworld Wildlife Haven',
    sourceRecordId: 'railworld-picnic-areas',
    sourceUrl: 'https://www.railworldwildlifehaven.org.uk/visit-us',
    reliability: 'official_non_statutory',
  },
];

function featureSource(place: CuratedPlace): SourceRecord[] {
  const amenity = ['cafe', 'restaurant', 'pub'].includes(place.featureType)
    ? place.featureType
    : undefined;
  const details = [
    amenity ? `amenity=${amenity}` : 'tourism=attraction',
    `visitor_place_type=${place.featureType.replaceAll('_', ' ')}`,
    `visit_score=${place.score}`,
    place.priceBand ? `price_band=${place.priceBand}` : undefined,
    place.cuisine ? `cuisine=${place.cuisine}` : undefined,
    `opening_hours:description=${place.opening}`,
    `entrance_fee=${place.price}`,
    place.timeToSpend ? `time_to_spend=${place.timeToSpend}` : undefined,
    `description=${place.tagline}: ${place.description}`,
    `website=${place.website}`,
  ]
    .filter(Boolean)
    .join('; ');
  const sources: SourceRecord[] = [
    {
      sourceName: place.sourceName,
      sourceOrganisation: place.sourceOrganisation,
      sourceRecordId: place.id,
      sourceUrl: place.website,
      accessedAt: reviewedAt,
      reliability: 'official_non_statutory',
      licence: editorialLicence,
      notes: `Current-place curation: ${details}.`,
    },
  ];
  if (place.osmUrl) {
    sources.push({
      sourceName: 'OpenStreetMap current community places',
      sourceOrganisation: 'OpenStreetMap contributors',
      sourceRecordId: place.osmUrl.split('/').slice(-2).join('/'),
      sourceUrl: place.osmUrl,
      accessedAt: reviewedAt,
      reliability: 'secondary',
      licence: osmLicence,
      notes: `Current OSM: ${details}.`,
    });
  }
  return sources;
}

function toFeature(place: CuratedPlace, kind: 'attraction' | 'food'): HeritageFeature {
  return {
    id: place.id,
    projectId,
    name: place.name,
    alternativeNames: [],
    countryCode: 'GB-ENG',
    region: 'Cambridgeshire',
    locality: 'Peterborough',
    featureType: place.featureType,
    significance: 'local',
    geometry: { type: 'Point', coordinates: place.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: place.description,
    sourceRecords: featureSource(place),
    tags:
      kind === 'food'
        ? ['peterborough-visitor-audit', 'current-context', 'service-context-food', 'visitor-context-food']
        : ['peterborough-visitor-audit', 'current-context', 'service-context-visitor', 'visitor-context-attraction'],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: `Visitor information and representative location audited ${reviewedDate}.`,
    evidenceScope: 'related_context',
    licence: editorialLicence,
  };
}

function toPicnicFeature(place: CuratedPicnic): HeritageFeature {
  const details = [
    'tourism=picnic_site',
    'visitor_place_type=Picnic area',
    'access=public',
    `entrance_fee=${place.admission}`,
    `description=${place.description}`,
    `website=${place.website}`,
  ].join('; ');
  const sourceRecords: SourceRecord[] = [
    {
      sourceName: place.sourceName,
      sourceOrganisation: place.sourceOrganisation,
      sourceRecordId: place.sourceRecordId,
      sourceUrl: place.sourceUrl,
      accessedAt: reviewedAt,
      reliability: place.reliability,
      licence:
        place.sourceOrganisation === 'OpenStreetMap contributors'
          ? osmLicence
          : editorialLicence,
      notes: `Current-place curation: ${details}.`,
    },
  ];
  if (place.osmRecordId && place.osmUrl) {
    sourceRecords.push({
      sourceName: 'OpenStreetMap current community places',
      sourceOrganisation: 'OpenStreetMap contributors',
      sourceRecordId: place.osmRecordId,
      sourceUrl: place.osmUrl,
      accessedAt: reviewedAt,
      reliability: 'secondary',
      licence: osmLicence,
      notes: `Current OSM: ${details}.`,
    });
  }
  return {
    id: place.id,
    projectId,
    name: place.name,
    alternativeNames: [],
    countryCode: 'GB-ENG',
    region: 'Cambridgeshire',
    locality: 'Peterborough',
    featureType: 'park',
    significance: 'local',
    geometry: { type: 'Point', coordinates: place.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: place.description,
    sourceRecords,
    tags: ['peterborough-visitor-audit', 'current-context', 'service-context-picnic'],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: `Picnic location and access context audited ${reviewedDate}.`,
    evidenceScope: 'related_context',
    licence: editorialLicence,
  };
}

function addOrReplaceFeature(pkg: ProjectPackage, feature: HeritageFeature): void {
  const index = pkg.features.findIndex((item) => item.id === feature.id);
  if (index === -1) pkg.features.push(feature);
  else pkg.features[index] = feature;
}

function defaultDog(sourceUrl: string) {
  return {
    rating: 0,
    status: 'unconfirmed',
    label: 'Dog policy not confirmed',
    summary:
      'No reliable current policy confirming pet-dog access was found. Check directly before making a dog-dependent journey; assistance-dog access is separate.',
    sourceName: 'Reviewed visitor information',
    sourceUrl,
    reviewedAt: reviewedDate,
  };
}

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as PlannerFile;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as DogFile;
const activeBoundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;

for (const place of [...attractions, ...food, ...picnicPlaces]) {
  if (!booleanPointInPolygon(point(place.coordinates), activeBoundary)) {
    throw new Error(`${place.name} is outside the active Peterborough visitor boundary.`);
  }
}

for (const place of attractions) addOrReplaceFeature(pkg, toFeature(place, 'attraction'));
for (const place of food) addOrReplaceFeature(pkg, toFeature(place, 'food'));
for (const place of picnicPlaces) addOrReplaceFeature(pkg, toPicnicFeature(place));
pkg.features = pkg.features.filter((feature) => !excludedFoodIds.has(feature.id));

const existingHighlights = pkg.project.visitorHighlights ?? [];
const addedIds = new Set(attractions.map((place) => place.id));
pkg.project.visitorHighlights = [
  ...existingHighlights.filter((highlight) => !addedIds.has(highlight.featureId)),
  ...attractions.map((place) => ({
    rank: 0,
    featureId: place.id,
    name: place.name,
    reason: place.description,
    tagline: place.tagline,
    visitorScore: place.score,
    openingTimes: place.opening,
    admission: place.price,
    freeAdmission: /^free\b/i.test(place.price),
    organisationPills: [],
    sourceName: place.sourceName,
    sourceUrl: place.website,
    verifiedInBoundaryAt: reviewedDate,
  })),
]
  .sort(
    (left, right) =>
      (right.visitorScore ?? 0) - (left.visitorScore ?? 0) || left.name.localeCompare(right.name),
  )
  .slice(0, 20)
  .map((highlight, index) => ({ ...highlight, rank: index + 1 }));

const peterboroughPlanner = (planner.projects[projectId] ??= {});
peterboroughPlanner.eat = publishedFoodIds;
peterboroughPlanner.picnic = [
  'curated-picnic:peterborough-central-park',
  'curated-picnic:peterborough-embankment',
  'curated-picnic:peterborough-pleasure-fair-meadow',
  'curated-picnic:peterborough-railworld',
  'curated-picnic:peterborough-ferry-meadows',
];

const peterboroughDog = (dog.projects[projectId] ??= {});
const attractionDog = (peterboroughDog.attraction ??= {});
const eatDog = (peterboroughDog.eat ??= {});
for (const place of attractions) attractionDog[place.id] = defaultDog(place.website);
attractionDog['curated-attraction:peterborough-guildhall'] = {
  rating: 3,
  status: 'welcoming',
  label: 'Excellent with a dog',
  summary:
    'The main experience is an outdoor look around Cathedral Square and the Guildhall exterior, making it easy to include on a town walk with a dog.',
  sourceName: 'Peterborough Guildhall visitor information',
  sourceUrl: 'https://discoverpeterborough.co.uk/things-to-do/peterborough-guildhall/',
  reviewedAt: reviewedDate,
};
attractionDog['curated-attraction:peterborough-bishops-gardens'] = {
  rating: 3,
  status: 'welcoming',
  label: 'Excellent with a dog',
  summary:
    'This is an open-air garden stop suited to a short dog walk. Keep dogs under close control around planting and other visitors.',
  sourceName: "Bishop's Gardens current map record",
  sourceUrl: 'https://www.openstreetmap.org/way/1041239263',
  reviewedAt: reviewedDate,
};
for (const place of food) eatDog[place.id] = defaultDog(place.website);
for (const id of excludedFoodIds) delete eatDog[id];
eatDog['curated-food:peterborough-ferry-meadows-cafe'] = {
  rating: 3,
  status: 'welcoming',
  label: 'Excellent with a dog',
  summary:
    'The cafe explicitly welcomes dogs and provides water bowls and space for them to settle, making it an easy stop during a Ferry Meadows walk.',
  sourceName: 'Ferry Meadows Cafe dog-friendly FAQ',
  sourceUrl: 'https://www.lakesidekitchenandbar.co.uk/ferry-meadows-cafe-faqs',
  reviewedAt: reviewedDate,
};
eatDog['curated-food:peterborough-lakeside-kitchen'] = {
  rating: 2,
  status: 'welcoming',
  label: 'Dog friendly',
  summary:
    'The operator promotes the venue as part of a dog walk at Ferry Meadows, with water bowls outside and a lakeside deck. Ask about indoor seating when the weather is poor.',
  sourceName: 'Lakeside Kitchen & Bar information',
  sourceUrl: 'https://www.lakesidekitchenandbar.co.uk/about-us',
  reviewedAt: reviewedDate,
};
dog.reviewedAt = reviewedDate;

pkg.project.researchNotes = [
  pkg.project.researchNotes,
  'Peterborough See and practical coverage was expanded on 2026-08-08 after a complete boundary-aware bundled-data and current OSM discrepancy sweep. Eat was refined to daytime lunch, coffee, cake and afternoon-tea choices only; dinner-led restaurants and drink-led pubs were excluded. Individual OSM picnic-table nodes were grouped into five recognisable visitor locations rather than published as duplicate generic cards.',
]
  .filter(Boolean)
  .join(' ');

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);

try {
  const audit = JSON.parse(await readFile(auditPath, 'utf8')) as {
    counts?: Record<string, number>;
    notes?: string[];
    [key: string]: unknown;
  };
  audit.counts = {
    ...(audit.counts ?? {}),
    attractions: pkg.project.visitorHighlights.length,
    food: peterboroughPlanner.eat.length,
    picnic: peterboroughPlanner.picnic.length,
  };
  audit.notes = [
    ...(audit.notes ?? []),
    'See coverage expanded and Eat refined to daytime lunch, coffee and cake after a full boundary-aware discrepancy sweep on 2026-08-08.',
    'Picnic tables were grouped into five named visitor locations rather than published as duplicate individual OSM nodes.',
  ];
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
} catch {
  // The project and bundled curation are authoritative if a review note is absent.
}

console.log(
  JSON.stringify(
    {
      projectId,
      attractions: pkg.project.visitorHighlights.length,
      food: peterboroughPlanner.eat.length,
      picnic: peterboroughPlanner.picnic.length,
    },
    null,
    2,
  ),
);
