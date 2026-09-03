import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T20:45:00Z';
const projectId = 'stonehaven-scotland';
const projectPath = resolve('data/projects/stonehaven.json');
const plannerPath = resolve('data/stonehaven-coast-visitor-planner-curation.json');
const dogPath = resolve('data/stonehaven-coast-dog-access-curation.json');

const urls = {
  destination: 'https://visitabdn.com/places/stonehaven',
  pool: 'https://www.stonehavenopenairpool.co.uk/',
  pool2026:
    'https://www.stunningstonehaven.com/home/news/read/the-stonehaven-open-air-pool-opens-this-weekend-30-may_1561',
  harbour: 'https://visitabdn.com/businesses/stonehaven-harbour',
  harbourTrail: 'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/archaeology/sites-to-visit/historic-harbours',
  tolbooth: 'https://www.stonehaventolbooth.co.uk/',
  tolboothHes: 'https://portal.historicenvironment.scot/designation/LB41655',
  treasureTrail:
    'https://www.treasuretrails.co.uk/products/what-to-do-stonehaven-aberdeenshire',
  townWalk: 'https://www.stunningstonehaven.com/virtualdirectorys/downloads/maps/568.pdf',
  councilWalking:
    'https://www.aberdeenshire.gov.uk/media/25407/stonehavenwalkingandcyclingmap.pdf',
  ship: 'https://shipinnstonehaven.com/lounge-bar/',
  shipVisit: 'https://visitabdn.com/businesses/the-ship-inn',
  bay: 'https://thebayfishandchips.co.uk/',
  bayFind: 'https://thebayfishandchips.co.uk/find-us/',
  bayVisit: 'https://www.visitabdn.com/listing/the-bay-fish-and-chips',
  carron: 'https://www.carronfishbar.com/',
  carronAbout: 'https://www.carronfishbar.com/about-us',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  toilets:
    'https://www.aberdeenshire.gov.uk/news/2026/jun/council-to-engage-with-community-on-future-options-for-stonehaven-beach-toilets',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & {
  project: ProjectPackage['project'] & Record<string, any>;
  features: MutableFeature[];
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const feature = (id: string) => {
  const found = pkg.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Stonehaven feature ${id}`);
  return found;
};
const upsert = (item: MutableFeature) => {
  const index = pkg.features.findIndex((candidate) => candidate.id === item.id);
  if (index >= 0) pkg.features[index] = item;
  else pkg.features.push(item);
  return item;
};

const pool = feature('curated-attraction:stonehaven-open-air-pool');
const harbour = feature('curated-attraction:stonehaven-harbour-auld-toon');
const beach = feature('curated-attraction:stonehaven-beach-promenade');
const museum = feature('curated-attraction:stonehaven-tolbooth-museum');
const treasureTrail = feature('curated-trails:stonehaven-parks-harbour-treasure-trail');
const ship = feature('curated-eat:stonehaven-ship-inn');

pkg.project.touristAppeal = {
  score: 88,
  dogOwnerScore: 85,
  dogAccessScoreAdjustment: -3,
  rating: 0,
  label: 'Strong Destination',
  summary:
    'A complete seaside town with a working 1825 harbour, rare 1934 Art Deco seawater lido, broad bay, free museum, strong independent food and two useful town walks—scored without borrowing Dunnottar Castle.',
  dogAccessRating: 3,
  dogAccessSummary:
    'The beach, promenade and explicitly dog-friendly Treasure Trail make a strong outdoor day, and the Ship Inn welcomes dogs in its bar. The pool and museum are not ordinary pet-dog visits, takeaway interiors are unconfirmed and harbour roads and quay edges require close control.',
  methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1',
  reviewedAt: reviewedDate,
  sourceUrls: Object.values(urls),
};

pkg.project.visualIdentity = {
  theme: 'stonehaven-sheltered-harbour-and-waterfront',
  badgeImage: '/town-guides/stonehaven-harbour-watercolour-guide-v1.png',
  badgeAlt: 'Watercolour illustration of Stonehaven harbour and its stone waterfront',
  heroImage: '/town-guides/stonehaven-harbour-watercolour-guide-v1.png',
  heroAlt:
    'Watercolour illustration from Stonehaven harbour wall across small boats to the beach, stone waterfront and clock tower',
  heroObjectPosition: '50% 54%',
  motifs: ['Sheltered harbour', 'Stone waterfront', 'Traditional boats', 'Clock tower'],
  primaryColour: '#174A50',
  accentColour: '#B67620',
  backgroundColour: '#EEF3EC',
};

pkg.project.townGuide = {
  characterTag: 'Working harbour, Art Deco lido and long town bay',
  headline: 'A genuinely complete seaside day before the castle is even considered',
  intro:
    'Stonehaven earns its score inside its own boundary: swim in the 1934 seawater lido, circle the harbour and Auld Toon, explore the free Tolbooth Museum, walk the bay and choose between a clue trail and a free heritage loop. Dunnottar Castle remains a separate See attraction.',
  bestFor: ['Harbour atmosphere', 'Outdoor swimming', 'Family seaside days', 'Food by the water'],
  perfectFor: ['A full independent day trip', 'A rail-accessible coastal break'],
  suggestedFirstVisit: {
    title: 'Start at the harbour, follow the heritage loop and finish on the bay',
    summary: 'Allow a full day when adding the pool, museum, Treasure Trail or a proper food stop.',
  },
  dontMiss: [pool.name, harbour.name, museum.name, treasureTrail.name],
  suggestedTime: 'A full day; longer with swimming and food',
  visitorMood:
    'Lively but characterful, with enough indoor, outdoor, food and family variety for changing weather.',
  sourceUrls: Object.values(urls),
  lastReviewedAt: reviewedDate,
};

pool.shortDescription =
  'The UK’s only Art Deco Olympic-size heated seawater lido, opened in 1934 and operating a varied 2026 summer programme.';
pool.documentedDateText = 'Opened 1934';
pool.attractionGuide = {
  ...pool.attractionGuide,
  headline: 'Swim in a heated 1934 Art Deco seawater lido',
  intro:
    'The 2026 season runs 30 May–6 September. Session patterns vary across early, peak and late season; daytime sessions are generally walk-in, while midnight swims require advance booking.',
  parking:
    'Beach Promenade car park has 41 spaces plus 4 disabled spaces; voluntary cashless charges use RingGo or PayByPhone code 985533.',
  toilets:
    'Pool changing and toilet facilities are for customers. Stonehaven Leisure Centre in Queen Elizabeth Park includes Changing Places facilities.',
};

harbour.documentedDateText = 'Rebuilt to Robert Stevenson’s plan; completed 1825';
harbour.shortDescription =
  'A three-basin working and recreational harbour completed in 1825, framed by the Auld Toon, Tolbooth Museum and strong independent food.';
harbour.attractionGuide = {
  ...harbour.attractionGuide,
  parking:
    'Backies car park has 42 free spaces and 2 disabled spaces. Do not obstruct harbour operations or use unmarked working areas as visitor parking.',
  toilets:
    'Current public provision includes the Old Pier harbour toilets; the council also identifies Margaret Street and Stonehaven Leisure Centre.',
};

beach.shortDescription =
  'A broad shingle-and-sand bay with a long promenade, recreation park, open-air pool and convenient takeaway food.';
beach.attractionGuide = {
  ...beach.attractionGuide,
  toilets:
    'Stonehaven Leisure Centre provides public toilets and Changing Places facilities. The former beach toilet remains closed; do not show it as available.',
};

museum.documentedDateText =
  'Late 16th century; civic use from 1600; courthouse and prison until 1767; restored 1963';
museum.shortDescription =
  'A free harbour-front museum inside Stonehaven’s late-16th-century Category A tolbooth, courthouse and former prison.';
museum.attractionGuide = {
  ...museum.attractionGuide,
  intro:
    'The volunteer museum is compact but specific: prison material and local collections inside the town’s likely oldest surviving building. Current hours are Monday and Wednesday–Sunday 1.30–4.30pm; Tuesday closed.',
};

treasureTrail.shortDescription =
  'A current £9.99, dog-friendly 3.7-mile circular treasure hunt through Queen Elizabeth Park, Mineralwell Park, Market Square and the harbour; allow about three hours.';

ship.shortDescription =
  'Harbour-front Scottish seafood and pub food in an inn established in 1771; the operator explicitly welcomes dogs in the lounge bar.';
ship.sourceRecords = [
  {
    sourceName: 'The Ship Inn lounge bar',
    sourceOrganisation: 'The Ship Inn',
    sourceUrl: urls.ship,
    accessedAt: reviewedAt,
    licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
    reliability: 'official_non_statutory',
    notes:
      'Current-place curation: visitor_place_type=Eat; visit_score=84; food_score=84; price_band=££; cuisine=Scottish seafood, pub meals and local produce; opening_hours:description=Monday–Thursday 07:00–00:00, Friday 07:00–01:00, Saturday 08:00–01:00 and Sunday 08:00–00:00; last food orders 20:30; dog_friendly=Operator welcomes dogs in lounge bar; description=Harbour seafood and whisky: Established 1771 harbour inn with a directly published indoor dog policy.',
  },
  {
    sourceName: 'The Ship Inn',
    sourceOrganisation: 'VisitAberdeenshire',
    sourceUrl: urls.shipVisit,
    accessedAt: reviewedAt,
    reliability: 'official_non_statutory',
    notes: 'Official destination listing confirms the harbour setting, local food and bar dog access.',
  },
];

const bay = upsert({
  id: 'curated-eat:stonehaven-the-bay-fish-chips',
  projectId,
  name: 'The Bay Fish & Chips',
  alternativeNames: [],
  countryCode: 'GB-SCT',
  region: 'Aberdeenshire',
  locality: 'Stonehaven',
  featureType: 'commercial_building',
  significance: 'regional',
  geometry: { type: 'Point', coordinates: [-2.2080893, 56.9685284] },
  locationType: 'exact',
  dateBasis: 'unknown',
  dateConfidence: 'unknown',
  locationConfidence: 'high',
  survival: 'substantially_intact',
  shortDescription:
    'Award-winning seafront takeaway specialising in sustainably sourced North Sea fish, with gluten-free options and daily noon–8pm opening.',
  sourceRecords: [
    {
      sourceName: 'The Bay Fish & Chip Shop',
      sourceOrganisation: 'The Bay Fish & Chip Shop',
      sourceUrl: urls.bayFind,
      accessedAt: reviewedAt,
      licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
      reliability: 'official_non_statutory',
      notes:
        'Current-place curation: visitor_place_type=Eat; visit_score=86; food_score=86; price_band=£; cuisine=Sustainably sourced North Sea fish and chips, including gluten-free choices; opening_hours:description=Monday–Sunday 12:00–20:00; dog_friendly=Takeaway collection and beach eating are practical but indoor pet policy is not published; description=Fish supper by the bay: Award-winning seafront takeaway with strong provenance and all-week daytime relevance.',
    },
    {
      sourceName: 'The Bay Fish and Chips',
      sourceOrganisation: 'VisitAberdeenshire',
      sourceUrl: urls.bayVisit,
      accessedAt: reviewedAt,
      reliability: 'official_non_statutory',
      notes: 'Official destination listing confirms the Beach Road location and visitor relevance.',
    },
  ],
  tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'],
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  reviewed: true,
  evidenceScope: 'parish_evidence',
  visitorWebsiteUrl: urls.bay,
  editorialReview: {
    status: 'editorially_researched',
    category: 'food',
    methodVersion: '2026-08-13-researched-visitor-value-v1',
    reviewedAt: reviewedDate,
    scoreRationale:
      'A nationally recognised seafront fish-and-chip stop with strong ingredient provenance, all-week daytime opening and excellent fit with the beach visit.',
    evidenceUrls: [urls.bay, urls.bayFind, urls.bayVisit],
    foodAssessment: {
      foodAndDrinkQuality: 25,
      daytimeRelevance: 18,
      distinctiveness: 15,
      consistency: 12,
      visitorFit: 9,
      evidenceConfidence: 7,
    },
  },
} as MutableFeature);

const carron = upsert({
  id: 'curated-eat:stonehaven-carron-fish-bar',
  projectId,
  name: 'Carron Fish Bar',
  alternativeNames: [],
  countryCode: 'GB-SCT',
  region: 'Aberdeenshire',
  locality: 'Stonehaven',
  featureType: 'commercial_building',
  significance: 'regional',
  geometry: { type: 'Point', coordinates: [-2.2083532, 56.9628547] },
  locationType: 'exact',
  documentedDateText: 'Deep-fried Mars bar associated with this shop from 1992',
  earliestPossibleYear: 1992,
  latestPossibleYear: 1992,
  dateBasis: 'documented_event',
  dateConfidence: 'medium',
  locationConfidence: 'high',
  survival: 'substantially_intact',
  shortDescription:
    'Award-winning family-run town-centre fish bar, culturally associated with the 1992 invention of the deep-fried Mars bar.',
  sourceRecords: [
    {
      sourceName: 'Carron Fish Bar',
      sourceOrganisation: 'Carron Fish Bar',
      sourceUrl: urls.carron,
      accessedAt: reviewedAt,
      licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
      reliability: 'official_non_statutory',
      notes:
        'Current-place curation: visitor_place_type=Eat; visit_score=79; food_score=79; price_band=£; cuisine=Fish and chips and the deep-fried Mars bar; opening_hours:description=Monday–Thursday 12:00–13:30 and 16:00–20:00; Friday–Sunday 12:00–20:00; dog_friendly=Takeaway only; indoor pet policy not published; description=The deep-fried Mars bar stop: Award-winning family-run fish bar with a distinctive place in Scottish food culture.',
    },
    {
      sourceName: 'About Carron Fish Bar',
      sourceOrganisation: 'Carron Fish Bar',
      sourceUrl: urls.carronAbout,
      accessedAt: reviewedAt,
      reliability: 'official_non_statutory',
      notes: 'Operator account of ownership, awards and current business identity.',
    },
  ],
  tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'],
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  reviewed: true,
  evidenceScope: 'parish_evidence',
  visitorWebsiteUrl: urls.carron,
  editorialReview: {
    status: 'editorially_researched',
    category: 'food',
    methodVersion: '2026-08-13-researched-visitor-value-v1',
    reviewedAt: reviewedDate,
    scoreRationale:
      'A strong and culturally distinctive town-centre takeaway, reduced below The Bay for shorter split weekday opening and a less complete seafront visitor setting.',
    evidenceUrls: [urls.carron, urls.carronAbout],
    foodAssessment: {
      foodAndDrinkQuality: 23,
      daytimeRelevance: 16,
      distinctiveness: 15,
      consistency: 11,
      visitorFit: 8,
      evidenceConfidence: 6,
    },
  },
} as MutableFeature);

const heritageLoop = upsert({
  id: 'curated-trails:stonehaven-market-square-harbour-loop',
  projectId,
  name: 'Stonehaven Market Square to Harbour Heritage Loop',
  alternativeNames: [],
  countryCode: 'GB-SCT',
  region: 'Aberdeenshire',
  locality: 'Stonehaven',
  featureType: 'other',
  significance: 'local',
  geometry: { type: 'Point', coordinates: [-2.2087577, 56.9637408] },
  locationType: 'exact',
  dateBasis: 'unknown',
  dateConfidence: 'unknown',
  locationConfidence: 'high',
  survival: 'substantially_intact',
  shortDescription:
    'A free self-guided town loop linking Market Square, the 1781 Carron bridge, High Street, plague stones, 1790 Town House, harbour, Tolbooth and boardwalk.',
  sourceRecords: [
    {
      sourceName: 'Walk 3: Market Square to Harbour loop',
      sourceOrganisation: 'Stunning Stonehaven',
      sourceUrl: urls.townWalk,
      accessedAt: reviewedAt,
      licence: 'Source-linked editorial evidence; verify route conditions before travel.',
      reliability: 'official_non_statutory',
      notes:
        'Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=68; trail_score=68; trail_type=Free self-guided heritage loop; fee=Free; price_display=Free; distance=Compact town-centre loop; duration=60–90 minutes; difficulty=Pavements, crossings, slopes and harbour edges; dog_friendly=Suitable with close control but no operator dog claim; description=Old town to harbour: A free narrative walk connecting Stonehaven’s dated civic and maritime landmarks.',
    },
    {
      sourceName: 'Stonehaven Walking and Cycling',
      sourceOrganisation: 'Aberdeenshire Council',
      sourceUrl: urls.councilWalking,
      accessedAt: reviewedAt,
      reliability: 'local_authority',
      notes: 'Council walking map corroborates the Market Square, boardwalk and harbour circuit.',
    },
  ],
  tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  reviewed: true,
  evidenceScope: 'parish_evidence',
  attractionGuide: {
    headline: 'Join Stonehaven’s old and new towns on a free harbour loop',
    intro:
      'Use the downloadable narrative to identify the 1781 bridge, plague stones, 1790 Town House, Tolbooth, 1710 sundial and historic Shorehead before returning by the boardwalk.',
    bestFor: ['Local history', 'Architecture', 'Harbour views', 'Free walks'],
  },
  visitorWebsiteUrl: urls.townWalk,
  editorialReview: {
    status: 'editorially_researched',
    category: 'trail',
    methodVersion: '2026-08-13-researched-visitor-value-v1',
    reviewedAt: reviewedDate,
    scoreRationale:
      'A free, specific and information-rich town loop with good public transport and food integration, reduced for road crossings, slopes and the lack of a formal accessibility statement.',
    evidenceUrls: [urls.townWalk, urls.councilWalking],
  },
} as MutableFeature);

const foodCards = [
  {
    name: bay.name,
    visitorScore: 86,
    summary: 'Award-winning sustainable fish and chips designed to be eaten beside the beach.',
    openingTimes: 'Daily noon–8pm.',
    priceBand: '£',
    externalUrl: urls.bayFind,
  },
  {
    name: ship.name,
    visitorScore: 84,
    summary: 'Harbour seafood and pub food; dogs are explicitly welcome in the lounge bar.',
    openingTimes: 'Daily from breakfast; last food orders 8.30pm.',
    priceBand: '££',
    externalUrl: urls.ship,
  },
  {
    name: carron.name,
    visitorScore: 79,
    summary: 'Award-winning fish bar associated with the deep-fried Mars bar.',
    openingTimes: 'Mon–Thu split lunch/evening; Fri–Sun noon–8pm.',
    priceBand: '£',
    externalUrl: urls.carron,
  },
];
harbour.attractionGuide = { ...harbour.attractionGuide, food: foodCards };
beach.attractionGuide = { ...beach.attractionGuide, food: foodCards };
museum.attractionGuide = { ...museum.attractionGuide, food: foodCards };

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as {
  projects: Record<string, Record<string, string[]>>;
};
planner.projects[projectId] = {
  eat: [bay.id, ship.id, carron.id],
  trails: [treasureTrail.id, heritageLoop.id],
  parking: [
    'curated-parking:stonehaven-beach-promenade',
    'curated-parking:stonehaven-market-square',
    'curated-parking:stonehaven-railway-station',
    'curated-parking:stonehaven-backies',
  ],
  toilets: [
    'curated-toilets:stonehaven-old-pier',
    'curated-toilets:stonehaven-margaret-street',
    'curated-toilets:stonehaven-leisure-centre',
  ],
  picnic: [],
};
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as {
  reviewedAt: string;
  projects: Record<string, any>;
};
dog.reviewedAt = reviewedDate;
const existingDog = dog.projects[projectId];
dog.projects[projectId] = {
  attraction: {
    ...existingDog.attraction,
    [heritageLoop.id]: {
      rating: 2,
      status: 'restricted',
      label: 'Dog-suitable town loop with road and harbour care',
      summary:
        'Dogs can accompany the public street and harbour route, but use a short lead beside roads, crowds, food stops, quay edges and the working harbour.',
      sourceName: 'Scottish Outdoor Access Code dog-owner guidance',
      sourceUrl: urls.outdoorCode,
      reviewedAt: reviewedDate,
    },
  },
  eat: {
    ...existingDog.eat,
    [bay.id]: {
      rating: 2,
      status: 'restricted',
      label: 'Good takeaway stop; indoor policy unconfirmed',
      summary:
        'Collection and eating outdoors on the beachfront can work well with a dog. The operator does not publish an indoor pet policy, so no indoor access is claimed.',
      sourceName: 'The Bay Fish & Chip Shop',
      sourceUrl: urls.bayFind,
      reviewedAt: reviewedDate,
    },
    [carron.id]: {
      rating: 1,
      status: 'restricted',
      label: 'Takeaway only; indoor policy unconfirmed',
      summary:
        'This can be used as a quick collection stop when one person waits outside with the dog. The operator does not publish an indoor pet policy.',
      sourceName: 'Carron Fish Bar',
      sourceUrl: urls.carron,
      reviewedAt: reviewedDate,
    },
  },
};
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) {
  throw new Error(
    `Stonehaven audit introduced ${errors.length} validation error(s): ${errors
      .map((item) => item.message)
      .join('; ')}`,
  );
}
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const heritagePins = pkg.features.filter(
  (item) =>
    item.designationType ||
    item.sourceRecords.some((record) => record.sourceUrl?.includes('historicenvironment.scot')),
);
const undated = heritagePins.filter((item) => !item.documentedDateText?.trim());
await writeFile(
  resolve('data/review/stonehaven-full-visitor-audit-2026-08-27.json'),
  `${JSON.stringify(
    {
      reviewedAt,
      townScore: 88,
      townBand: 'Strong Destination',
      dogOwnerScore: 85,
      dogAccessRating: 3,
      publicationRule:
        'Town score measures Stonehaven itself. Publish only in-boundary visitor places scoring 60 or more; Dunnottar Castle remains a separate regional See attraction.',
      attractions: [pool.id, harbour.id, beach.id, museum.id],
      eats: [bay.id, ship.id, carron.id],
      trails: [treasureTrail.id, heritageLoop.id],
      parking: planner.projects[projectId].parking,
      toilets: planner.projects[projectId].toilets,
      heritagePins: heritagePins.length,
      datedHeritagePins: heritagePins.length - undated.length,
      undatedHeritagePinIds: undated.map((item) => item.id),
      notes: [
        'The former Stonehaven beach toilets remain closed and are not published.',
        'The Bay and Carron Fish Bar pet policies are unconfirmed; outdoor/takeaway usefulness is recorded without inventing indoor access.',
        'Treasure Trails currently exposes one Stonehaven product page; the apparent Town & Seafront search label resolves to the Parks & Harbour trail, so it is not duplicated.',
      ],
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Stonehaven full audit complete: score 88, dog 85, 4 attractions, 3 eats, 2 trails, ${heritagePins.length - undated.length}/${heritagePins.length} dated heritage pins.`,
);
