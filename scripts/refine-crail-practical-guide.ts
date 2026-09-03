import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve('data/projects/crail.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/crail-dog-access-curation.json');
const reviewedAt = '2026-08-25';
const updatedAt = `${reviewedAt}T20:15:00.000Z`;
const methodVersion = '2026-08-13-researched-visitor-value-v1';

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const byId = new Map(pkg.features.map((feature) => [feature.id, feature]));

function feature(id: string): HeritageFeature {
  const item = byId.get(id);
  if (!item) throw new Error(`Missing Crail feature ${id}.`);
  return item;
}

function source(
  name: string,
  organisation: string,
  url: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'secondary',
): SourceRecord {
  return {
    sourceName: name,
    sourceOrganisation: organisation,
    sourceUrl: url,
    accessedAt: updatedAt,
    licence: 'Source-linked editorial record; verify current operator information before travel.',
    notes,
    reliability,
  };
}

function replaceResearchSources(
  item: HeritageFeature,
  sourceNames: string[],
  replacements: SourceRecord[],
): void {
  item.sourceRecords = [
    ...item.sourceRecords.filter((record) => !sourceNames.includes(record.sourceName)),
    ...replacements,
  ];
  item.updatedAt = updatedAt;
  item.reviewed = true;
}

const parkingSourceNames = [
  'Crail visitor-facility curation',
  'Crail parking re-audit',
  'Crail parking EV re-audit',
];

const nethergate = feature('osm-community:way-1367414238');
nethergate.shortDescription =
  'The principal fully documented council car park: a free, 15-space surface car park at Nethergate by the British Legion.';
replaceResearchSources(nethergate, parkingSourceNames, [
  source(
    'Crail parking re-audit',
    'Fife Council',
    'https://www.fife.gov.uk/facilities/car-park/nethergate-car-park%2C-crail',
    'Current-place curation: amenity=parking; operator=Fife Council; parking=surface; capacity=15; fee=no; price_display=Free; payment_required=no; payment_methods=No payment required; maxstay=Not published; confidence=Council facility page checked 25 August 2026.',
    'local_authority',
  ),
]);

const marketgateSouth = feature('osm-community:way-306292353');
marketgateSouth.shortDescription =
  'Central surface parking beside the Town Hall. The council inventory records 19 spaces, including two accessible spaces and one EV charging space.';
replaceResearchSources(marketgateSouth, parkingSourceNames, [
  source(
    'Crail parking re-audit',
    'Fife Council and ParkMe',
    'https://www.parkme.com/en-gb/lot/151202/marketgate-s',
    'Current-place curation: amenity=parking; operator=Fife Council; parking=surface; capacity=19; capacity:disabled=2; capacity:charging=1; fee=no; price_display=Free general parking; payment_required=no; payment_methods=No payment required for general parking; maxstay=Not published; confidence=Capacity from Fife Council inventory; current general tariff cross-checked with ParkMe; check signs.',
    'secondary',
  ),
  source(
    'Crail parking EV re-audit',
    'Zapmap / ChargePlace Scotland',
    'https://www.zapmap.com/charge-points/anstruther/EY34FGS',
    'Current-place curation: ev_charging_price=40p/kWh; ev_payment_methods=Zap-Pay or ChargePlace Scotland app; ev_connectors=2 Type 2 (7kW); ev_last_checked=5 July 2026.',
    'secondary',
  ),
]);

const marketgateNorth = feature('osm-community:way-1367414235');
marketgateNorth.name = 'Marketgate North parking area';
marketgateNorth.shortDescription =
  'Parking along Marketgate near Crail Parish Church and the Treasure Trail start. Space numbers, tariff and time limits are not published, so check the signs on arrival.';
replaceResearchSources(marketgateNorth, parkingSourceNames, [
  source(
    'Crail parking re-audit',
    'Treasure Trails',
    'https://www.treasuretrails.co.uk/products/things-to-do-crail-fife',
    'Current-place curation: amenity=parking; parking=street_side; capacity=Not published; fee=unknown; price_display=Check signs; payment_required=unknown; payment_methods=Check on-site signs; maxstay=Not published; confidence=Treasure Trails confirms parking along Marketgate near Crail Parish Church; detailed restrictions are not published.',
  ),
]);

const harbour = feature('osm-community:way-1479050408');
harbour.name = 'Crail Harbour — no visitor parking';
harbour.featureType = 'access_information';
harbour.shortDescription =
  'Do not plan to park at Crail Harbour: current visitor information says traffic restrictions prohibit visitor parking; use nearby street or public parking instead.';
harbour.tags = [
  ...harbour.tags.filter(
    (tag) => tag !== 'service-context-parking' && tag !== 'osm-community-parking',
  ),
  'visitor-parking-prohibited',
];
harbour.homeMapEligible = false;
replaceResearchSources(harbour, parkingSourceNames, [
  source(
    'Crail parking re-audit',
    'Crail Festival',
    'https://www.crailfestival.org/venue/crail-harbour',
    'Current-place curation: visitor_place_type=Access information; access=no visitor parking; parking_note=Traffic restrictions prohibit visitor parking at the harbour; description=Use nearby street or public parking and allow extra time.',
  ),
]);

const westgate = feature('osm-community:way-1367414236');
westgate.shortDescription =
  'Mapped parking area at Westgate, but no sufficiently detailed current visitor source confirms capacity, charges, payment methods or restrictions.';
westgate.tags = westgate.tags.filter((tag) => tag !== 'service-context-parking');
replaceResearchSources(westgate, parkingSourceNames, [
  source(
    'Crail parking re-audit',
    'OpenStreetMap review',
    'https://www.openstreetmap.org/way/1367414236',
    'Current-place curation: amenity=parking; parking=surface; capacity=Not confirmed; fee=unknown; price_display=Not confirmed; payment_required=unknown; payment_methods=Not confirmed; confidence=OSM-mapped only; withheld from the public visitor parking list pending a current operator or on-site source.',
    'discovery_only',
  ),
]);

const foodResearch: Array<{
  id: string;
  score: number;
  price: string;
  style: string;
  opening: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
}> = [
  {
    id: 'curated-food:crail-shoregate',
    score: 88,
    price: '£££',
    style: 'Modern Scottish dining and traditional pub',
    opening: 'Lunch and dinner Wednesday-Sunday; booking recommended',
    description:
      'Best special meal. Award-winning, locally sourced modern Scottish cooking; lunch is served in the bar or dining room and dinner in the dining room.',
    sourceName: 'The Shoregate and Welcome to Fife',
    sourceUrl: 'https://theshoregate.com/',
  },
  {
    id: 'osm-community:node-7657404154',
    score: 84,
    price: '££',
    style: 'Coffee, cakes, light lunches and takeaway',
    opening: 'Open seven days; check the operator page for short seasonal closures',
    description:
      'Harbour coffee and art. Coffee, cakes and light lunches inside a restored fisherman’s cottage or in its sea-view courtyard.',
    sourceName: 'Crail Harbour Gallery and Tearoom',
    sourceUrl: 'https://www.crailharbourgallery.co.uk/',
  },
  {
    id: 'curated-food:crail-golf-hotel',
    score: 82,
    price: '££',
    style: 'Scottish pub food, local seafood and breakfast',
    opening: 'Food daily 12:00-20:00; non-resident breakfast 08:00-10:30; winter variation',
    description:
      'Best all-day choice. A broad pub menu with locally sourced meat and seafood, breakfast and outdoor garden dining.',
    sourceName: 'The Golf Hotel',
    sourceUrl: 'https://www.thegolfhotelcrail.com/restaurant',
  },
  {
    id: 'osm-community:node-5902078913',
    score: 78,
    price: '££',
    style: 'Freshly cooked Scottish pub food',
    opening: 'Current menu published online; book or telephone for service hours',
    description:
      'Relaxed pub dinner. Freshly cooked pub classics, local seafood, burgers and daily specials; the operator warns that menus can change.',
    sourceName: 'Balcomie Links Hotel',
    sourceUrl: 'https://www.balcomielinkshotel.com/eat-balcomielinkshotel',
  },
  {
    id: 'osm-community:way-225526906',
    score: 76,
    price: '£',
    style: 'Fish and chips, takeaway and limited cafe seating',
    opening: 'Current hours vary by day and season; check before travelling',
    description:
      'Classic fish supper. A well-reviewed, family-run fish-and-chip stop with takeaway and limited indoor cafe service.',
    sourceName: 'Crail Fish Bar and Café visitor listing',
    sourceUrl:
      'https://www.tripadvisor.co.uk/Restaurant_Review-g551745-d4578430-Reviews-Crail_Fish_Bar_Cafe-Crail_Fife_Scotland.html',
  },
];

for (const research of foodResearch) {
  const item = feature(research.id);
  item.shortDescription = research.description;
  item.visitorWebsiteUrl = research.sourceUrl;
  replaceResearchSources(item, ['Researched Crail food curation', 'Crail eatery re-audit'], [
    source(
      'Crail eatery re-audit',
      research.sourceName,
      research.sourceUrl,
      `Current daytime food curation: amenity=restaurant; visit_score=${research.score}; price_band=${research.price}; food_style=${research.style}; opening_hours:description=${research.opening}; description=${research.description}`,
      research.sourceName.includes('visitor listing') ? 'secondary' : 'official_non_statutory',
    ),
  ]);
  if (item.editorialReview) {
    item.editorialReview.reviewedAt = reviewedAt;
    item.editorialReview.scoreRationale = research.description;
    item.editorialReview.evidenceUrls = [research.sourceUrl];
  }
}

const treasureTrailId = 'curated-trail:crail-castle-walk-harbour-treasure-trail';
let treasureTrail = byId.get(treasureTrailId);
if (!treasureTrail) {
  treasureTrail = {
    id: treasureTrailId,
    projectId: 'crail-scotland',
    name: 'Crail Castle Walk & Harbour Treasure Trail',
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Fife',
    locality: 'Crail',
    featureType: 'walking_route',
    geometry: { type: 'Point', coordinates: [-2.6252, 56.2614] },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    significance: 'local',
    survival: 'substantially_intact',
    sourceRecords: [],
    tags: ['service-context-trail', 'visitor-context-trail', 'current-context'],
    createdAt: updatedAt,
    updatedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
  };
  pkg.features.push(treasureTrail);
  byId.set(treasureTrail.id, treasureTrail);
}
treasureTrail.shortDescription =
  'A paid, self-guided family treasure hunt from Marketgate through the churchyard, Castle Walk, harbour and historic streets, available as an app trail, PDF or printed booklet.';
treasureTrail.visitorWebsiteUrl =
  'https://www.treasuretrails.co.uk/products/things-to-do-crail-fife';
treasureTrail.editorialReview = {
  status: 'editorially_researched',
  category: 'trail',
  methodVersion,
  reviewedAt,
  scoreRationale:
    'A well-defined 1.5-mile circular family trail with current operator route, price, dog and app information, offset by steps, cobbles and poor wheelchair/pushchair access.',
  evidenceUrls: [
    treasureTrail.visitorWebsiteUrl,
    'https://www.treasuretrails.co.uk/pages/treasure-trails-app',
  ],
};
replaceResearchSources(treasureTrail, ['Crail Treasure Trail re-audit'], [
  source(
    'Crail Treasure Trail re-audit',
    'Treasure Trails',
    treasureTrail.visitorWebsiteUrl,
    'Current-place curation: visitor_place_type=Treasure trail; trail_score=84; trail_type=Self-guided treasure hunt; best_for=Families and puzzle solvers aged 6+; distance=1.5-mile circular route; time_to_spend=1.5 hours; accessibility=Not wheelchair or pushchair accessible; fee=£10.99 per Trail; dog=yes; app=Treasure Trails app; app_note=Buy on the website, then sync to the app; offline_after_download=yes; description=Solve clues from Marketgate through the churchyard, Castle Walk, harbour and historic streets.',
    'official_non_statutory',
  ),
  source(
    'Treasure Trails app',
    'Treasure Trails',
    'https://www.treasuretrails.co.uk/pages/treasure-trails-app',
    'The free companion app can deliver purchased Trails and works offline after download; Trails cannot be purchased inside the app.',
    'official_non_statutory',
  ),
]);

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as {
  schemaVersion: number;
  projects: Record<string, Record<string, string[]>>;
};
const crailPlanner = planner.projects['crail-scotland'] ?? {};
crailPlanner.parking = [nethergate.id, marketgateSouth.id, marketgateNorth.id];
crailPlanner.trails = [
  'curated-trail:crail-heritage-walk',
  'curated-trail:crail-fife-coastal-path',
  treasureTrail.id,
];
planner.projects['crail-scotland'] = crailPlanner;

const dogLibrary = JSON.parse(await readFile(dogPath, 'utf8')) as {
  schemaVersion: number;
  reviewedAt: string;
  projects: Record<string, { attraction?: Record<string, unknown>; eat?: Record<string, unknown> }>;
};
dogLibrary.reviewedAt = reviewedAt;
dogLibrary.projects['crail-scotland'] = {
  attraction: {
    'osm-community:node-7657404154': {
      rating: 3,
      status: 'welcoming',
      label: 'Dogs welcomed inside and outside',
      summary:
        'Multiple recent visitor reports specifically describe dogs being welcomed at indoor tables and in the sea-view outdoor area; the operator site itself does not publish a formal policy.',
      sourceName: 'Recent Crail Harbour Gallery visitor reports',
      sourceUrl:
        'https://www.tripadvisor.com/Restaurant_Review-g551745-d32729939-Reviews-Crail_Harbour_Gallery_And_Tea_Room-Crail_Fife_Scotland.html',
      reviewedAt,
    },
  },
  eat: {
    'curated-food:crail-shoregate': {
      rating: 2,
      status: 'restricted',
      label: 'Dogs welcome in the bar',
      summary:
        'Dogs are explicitly welcome in the historic bar, where lunch is available, but not in the dining room; dinner is dining-room only.',
      sourceName: 'Welcome to Fife - The Shoregate',
      sourceUrl: 'https://www.welcometofife.com/view-catering/the-shoregate-1',
      reviewedAt,
    },
    'osm-community:node-7657404154': {
      rating: 3,
      status: 'welcoming',
      label: 'Dogs welcomed inside and outside',
      summary:
        'Multiple recent visitor reports specifically describe dogs being welcomed at indoor tables and in the sea-view outdoor area; the operator site itself does not publish a formal policy.',
      sourceName: 'Recent Crail Harbour Gallery visitor reports',
      sourceUrl:
        'https://www.tripadvisor.com/Restaurant_Review-g551745-d32729939-Reviews-Crail_Harbour_Gallery_And_Tea_Room-Crail_Fife_Scotland.html',
      reviewedAt,
    },
    'curated-food:crail-golf-hotel': {
      rating: 2,
      status: 'restricted',
      label: 'Dogs welcome in bar and garden',
      summary:
        'A current local dog-friendly guide specifically confirms dogs in the public bar and beer garden; the main restaurant policy remains unconfirmed.',
      sourceName: 'Crail Posthouse dog-friendly Crail guide',
      sourceUrl: 'https://www.crailposthouse.co.uk/guest-info',
      reviewedAt,
    },
    'osm-community:node-5902078913': {
      rating: 2,
      status: 'restricted',
      label: 'Designated dog-friendly dining area',
      summary:
        'Recent visitor evidence identifies a dog-friendly restaurant area and reports water and treats; request that area when booking because the operator does not publish a site-wide policy.',
      sourceName: 'Recent Balcomie Links Hotel visitor reports',
      sourceUrl:
        'https://www.tripadvisor.com/Hotel_Feature-g551745-d569616-zft9165-Balcomie_Links_Hotel.html',
      reviewedAt,
    },
    'osm-community:way-225526906': {
      rating: 1,
      status: 'restricted',
      label: 'Takeaway is the dependable dog option',
      summary:
        'The current search did not find a published indoor dog policy. The takeaway service works with a dog, but check directly before relying on cafe seating.',
      sourceName: 'Crail Fish Bar dog-access search',
      sourceUrl: 'https://crail-fish-bar-cafe.goto-where.com/',
      reviewedAt,
    },
  },
};

pkg.sources = [
  ...pkg.sources.filter((item) => item.id !== 'crail-2026-practical-research'),
  {
    id: 'crail-2026-practical-research',
    name: 'Crail parking, food, dog-access and Treasure Trail re-audit',
    organisation: 'Fife Council, Crail visitor bodies and individual operators',
    coverage:
      'Public visitor parking, current eating choices, place-specific dog access and the paid Crail Treasure Trail',
    accessMethod: 'Current web research against named operator and visitor sources',
    sourceUrl: 'https://www.treasuretrails.co.uk/products/things-to-do-crail-fife',
    reliability: 'secondary',
    limitations:
      'Marketgate North restrictions and Westgate details require on-site confirmation. Dog policies based on recent visitor evidence are labelled where the operator publishes no formal policy.',
  },
];
pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.some((item) => item.severity === 'error')) {
  throw new Error('Crail practical-guide refinement introduced validation errors.');
}

await Promise.all([
  writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8'),
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dogLibrary, null, 2)}\n`, 'utf8'),
]);

console.log('Refined Crail: 3 verified parking choices, 5 researched Eats and 3 trails.');
