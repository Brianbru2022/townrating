import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve('data/projects/crail.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/crail-dog-access-curation.json');
const reviewedAt = '2026-08-25';
const updatedAt = `${reviewedAt}T21:15:00.000Z`;

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const byId = new Map(pkg.features.map((item) => [item.id, item]));

function feature(id: string): HeritageFeature {
  const item = byId.get(id);
  if (!item) throw new Error(`Missing Crail feature ${id}.`);
  return item;
}

function source(
  sourceName: string,
  sourceOrganisation: string,
  sourceUrl: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'secondary',
): SourceRecord {
  return {
    sourceName,
    sourceOrganisation,
    sourceUrl,
    accessedAt: updatedAt,
    licence: 'Source-linked editorial record; verify current operator information before travel.',
    notes,
    reliability,
  };
}

function replaceSources(
  item: HeritageFeature,
  names: string[],
  replacements: SourceRecord[],
): void {
  item.sourceRecords = [
    ...item.sourceRecords.filter((record) => !names.includes(record.sourceName)),
    ...replacements,
  ];
  item.updatedAt = updatedAt;
  item.reviewed = true;
}

const parkingAuditSources = [
  'Crail parking re-audit',
  'Crail parking EV re-audit',
  'Parkopedia Crail scrape',
];
const nethergate = feature('osm-community:way-1367414238');
nethergate.alternativeNames = [...new Set([...nethergate.alternativeNames, 'British Legion Club'])];
nethergate.shortDescription =
  'Free, all-day surface parking at the British Legion. Fife Council publishes 15 spaces; Parkopedia currently lists 16, so the council count is used as authoritative.';
replaceSources(nethergate, parkingAuditSources, [
  source(
    'Crail parking re-audit',
    'Fife Council',
    'https://www.fife.gov.uk/facilities/car-park/nethergate-car-park%2C-crail',
    'Current-place curation: amenity=parking; operator=Fife Council; parking=surface; capacity=15; fee=no; price_display=Free; payment_required=no; payment_methods=No payment required; maxstay=Not published; confidence=Official Fife Council count used.',
    'local_authority',
  ),
  source(
    'Parkopedia Crail scrape',
    'Parkopedia',
    'https://en.parkopedia.co.uk/parking/carpark/british_legion_club/ky10/crail/',
    'Current-place curation: parkopedia_capacity=16; opening_hours:description=Open all day, Monday-Sunday; height_restriction=None; parkopedia_price=Free; parkopedia_operator=Fife Council; parkopedia_checked=25 August 2026; review_note=Parkopedia differs from the current council capacity by one space.',
  ),
]);

const marketgateNorth = feature('osm-community:way-1367414235');
marketgateNorth.name = 'Marketgate North Car Park';
marketgateNorth.shortDescription =
  'Parkopedia’s second Crail car park: 50 spaces, free and open all day, with no height restriction and an EV charging point.';
replaceSources(marketgateNorth, parkingAuditSources, [
  source(
    'Parkopedia Crail scrape',
    'Parkopedia',
    'https://en.parkopedia.co.uk/parking/carpark/marketgate_n/ky10/crail/',
    'Current-place curation: amenity=parking; operator=Fife Council; parking=surface; capacity=50; parkopedia_capacity=50; capacity:charging=1; fee=no; price_display=Free; payment_required=no; payment_methods=No payment required for parking; opening_hours:description=Open all day, Monday-Sunday; height_restriction=None; maxstay=Not published; confidence=Parkopedia live Crail result checked 25 August 2026.',
  ),
  source(
    'Crail parking EV re-audit',
    'Zapmap / ChargePlace Scotland',
    'https://www.zapmap.com/charge-points/anstruther/EY34FGS',
    'Current-place curation: ev_charging_price=40p/kWh; ev_payment_methods=Zap-Pay or ChargePlace Scotland app; ev_connectors=2 Type 2 (7kW); ev_last_checked=5 July 2026.',
  ),
]);

const marketgateSouth = feature('osm-community:way-306292353');
marketgateSouth.name = 'Marketgate South mapped parking area';
marketgateSouth.shortDescription =
  'A mapped parking area, but Parkopedia does not list it as a separate Crail public car park. It is withheld from the visitor parking list to avoid duplicating Marketgate North.';
marketgateSouth.tags = marketgateSouth.tags.filter((tag) => tag !== 'service-context-parking');
marketgateSouth.tags = [...new Set([...marketgateSouth.tags, 'parking-not-separately-verified'])];
marketgateSouth.homeMapEligible = false;
replaceSources(marketgateSouth, parkingAuditSources, [
  source(
    'Parkopedia Crail scrape',
    'Parkopedia and OpenStreetMap comparison',
    'https://en.parkopedia.co.uk/parking/crail/',
    'Current-place curation: visitor_place_type=Parking review record; publication_status=withheld; review_note=Parkopedia lists only British Legion Club and Marketgate North for Crail; this OSM feature is not treated as a distinct public visitor car park.',
    'discovery_only',
  ),
]);

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as {
  schemaVersion: number;
  projects: Record<string, Record<string, string[]>>;
};
planner.projects['crail-scotland'].parking = [nethergate.id, marketgateNorth.id];

const dogLibrary = JSON.parse(await readFile(dogPath, 'utf8')) as {
  schemaVersion: number;
  reviewedAt: string;
  projects: Record<string, { attraction?: Record<string, unknown>; eat?: Record<string, unknown> }>;
};
const crailDog = dogLibrary.projects['crail-scotland'] ?? {};
crailDog.attraction = {
  'curated-attraction:crail-1': {
    rating: 3,
    status: 'welcoming',
    label: 'Excellent outdoor dog access',
    summary:
      'The harbour, foreshore and connected coastal walking are open-air and repeatedly described as dog-friendly. Keep dogs close around working boats, roads, wildlife and any local signs.',
    sourceName: 'Crail harbour and beach dog-access cross-check',
    sourceUrl: 'https://seaglasshunting.com/crail-sea-glass-guide/',
    reviewedAt,
  },
  'curated-attraction:crail-2': {
    rating: 0,
    status: 'unconfirmed',
    label: 'Pet-dog admission not confirmed',
    summary:
      'Pet-dog admission could not be confirmed. The museum’s own current visitor page does not publish a policy, while a museum directory lists assistance dogs but not ordinary pet dogs indoors; contact the museum before relying on admission.',
    sourceName: 'Crail Museum official page and museum directory cross-check',
    sourceUrl: 'https://www.crailmuseum.uk/visit-us',
    reviewedAt,
  },
  'curated-attraction:crail-3': {
    rating: 1,
    status: 'restricted',
    label: 'Dogs reported in certain areas',
    summary:
      'A current third-party travel guide reports dogs welcome in certain pottery and garden areas, but the operator does not publish a formal policy. The courtyard is the safest assumption; telephone before relying on indoor access.',
    sourceName: 'Crail Pottery operator and third-party dog-access cross-check',
    sourceUrl:
      'https://www.expedia.co.uk/Crail-Hotels-Pet-Friendly-Hotel.0-0-d553248634717687640-tPetFriendlyHotel.Travel-Guide-Filter-Hotels',
    reviewedAt,
  },
  'osm-community:node-7657404154': {
    rating: 3,
    status: 'welcoming',
    label: 'Dogs welcomed inside and outside',
    summary:
      'Several independent visitor reports from 2023-2026 describe dogs being welcomed at indoor tables and in the sea-view courtyard. The operator page confirms indoor and courtyard service but does not publish a formal dog policy.',
    sourceName: 'Harbour Gallery operator and multiple visitor reports',
    sourceUrl:
      'https://www.tripadvisor.com/Restaurant_Review-g551745-d32729939-Reviews-Crail_Harbour_Gallery_And_Tea_Room-Crail_Fife_Scotland.html',
    reviewedAt,
  },
};
dogLibrary.projects['crail-scotland'] = crailDog;

const dogSourceNames = ['Crail attraction dog-access audit'];
const attractionDogSources: Record<string, SourceRecord[]> = {
  'curated-attraction:crail-1': [
    source(
      'Crail attraction dog-access audit',
      'Sea Glass Hunting Guide',
      'https://seaglasshunting.com/crail-sea-glass-guide/',
      'Dog-access evidence: Crail beach is described as dog-friendly all year with no seasonal restriction.',
    ),
    source(
      'Crail attraction dog-access audit',
      'Short Stay St Andrews',
      'https://shortstaystandrews.co.uk/beaches-to-visit-in-crail/',
      'Dog-access evidence: dogs are common on the coastal path and around Roome Bay; close control near wildlife and the play area is advised.',
    ),
  ],
  'curated-attraction:crail-2': [
    source(
      'Crail attraction dog-access audit',
      'Crail Museum and Heritage Centre',
      'https://www.crailmuseum.uk/visit-us',
      'Dog-access evidence: current official visitor information reviewed; no ordinary pet-dog policy is published.',
      'official_non_statutory',
    ),
    source(
      'Crail attraction dog-access audit',
      'MuseumsUK',
      'https://museumsuk.com/museums/crail/crail-museum-and-heritage-centre.html',
      'Dog-access evidence: the directory lists assistance dogs as welcome but does not confirm pet dogs.',
    ),
  ],
  'curated-attraction:crail-3': [
    source(
      'Crail attraction dog-access audit',
      'Crail Pottery',
      'https://crailpottery.com/',
      'Dog-access evidence: current operator visitor page reviewed; no formal dog policy is published.',
      'official_non_statutory',
    ),
    source(
      'Crail attraction dog-access audit',
      'Expedia Crail pet-friendly guide',
      'https://www.expedia.co.uk/Crail-Hotels-Pet-Friendly-Hotel.0-0-d553248634717687640-tPetFriendlyHotel.Travel-Guide-Filter-Hotels',
      'Dog-access evidence: dogs are reported welcome in certain pottery and garden areas; scope is not detailed.',
    ),
  ],
  'osm-community:node-7657404154': [
    source(
      'Crail attraction dog-access audit',
      'Crail Harbour Gallery',
      'https://www.crailharbourgallery.co.uk/',
      'Dog-access evidence: operator confirms indoor and courtyard service but publishes no formal dog policy.',
      'official_non_statutory',
    ),
    source(
      'Crail attraction dog-access audit',
      'Tripadvisor visitor reports',
      'https://www.tripadvisor.com/Restaurant_Review-g551745-d32729939-Reviews-Crail_Harbour_Gallery_And_Tea_Room-Crail_Fife_Scotland.html',
      'Dog-access evidence: multiple recent reports describe dogs welcomed indoors and outdoors.',
    ),
    source(
      'Crail attraction dog-access audit',
      'Dog Friendly Cottages confirmed guest review',
      'https://www.dogfriendlycottages.co.uk/properties/united-kingdom/scotland/fife/anstruther/crail-house-bc02bcd4-d19a-42b0-89ad-74364dbed294',
      'Dog-access evidence: an independent confirmed guest describes the harbour cafe and gallery as dog-friendly.',
    ),
  ],
};

for (const [id, replacements] of Object.entries(attractionDogSources)) {
  replaceSources(feature(id), dogSourceNames, replacements);
}

const museumHighlight = pkg.project.visitorHighlights?.find(
  (item) => item.featureId === 'curated-attraction:crail-2',
);
if (museumHighlight) {
  museumHighlight.admission = 'Free; donations welcome.';
  museumHighlight.freeAdmission = true;
  museumHighlight.openingTimes =
    'Summer 2026: Thursday-Sunday 11:00-16:00 until 18 October, plus the published holiday Monday.';
  museumHighlight.sourceName = 'Crail Museum and Heritage Centre';
  museumHighlight.sourceUrl = 'https://www.crailmuseum.uk/visit-us';
  museumHighlight.visitorWebsiteUrl = 'https://www.crailmuseum.uk/visit-us';
}

const appeal = pkg.project.touristAppeal;
if (!appeal?.score) throw new Error('Crail town score is missing.');
appeal.dogOwnerScore = 80;
appeal.dogAccessScoreAdjustment = -2;
appeal.dogAccessRating = 2;
appeal.dogAccessSummary =
  'Very good for harbour, shore, coastal walking and the dog-welcoming gallery, but not fully dog-equivalent: pet-dog admission is unconfirmed at the museum, pottery access is only partly evidenced, and several eating places restrict dogs to particular areas.';
appeal.sourceUrls = [
  ...new Set([
    ...(appeal.sourceUrls ?? []),
    'https://seaglasshunting.com/crail-sea-glass-guide/',
    'https://www.crailmuseum.uk/visit-us',
    'https://crailpottery.com/',
    'https://www.crailharbourgallery.co.uk/',
    'https://www.tripadvisor.com/Restaurant_Review-g551745-d32729939-Reviews-Crail_Harbour_Gallery_And_Tea_Room-Crail_Fife_Scotland.html',
  ]),
];

pkg.sources = [
  ...pkg.sources.filter((item) => item.id !== 'crail-parkopedia-dog-audit-2026'),
  {
    id: 'crail-parkopedia-dog-audit-2026',
    name: 'Crail Parkopedia parking scrape and attraction dog-access audit',
    organisation: 'Parkopedia, attraction operators and independent visitor sources',
    coverage:
      'Every Parkopedia car park returned for Crail and multiple-source dog-access checks for all four published attractions',
    accessMethod: 'Live Parkopedia browser scrape plus targeted current web research',
    sourceUrl: 'https://en.parkopedia.co.uk/parking/crail/',
    reliability: 'secondary',
    limitations:
      'Parkopedia lists 16 Nethergate spaces while Fife Council lists 15; the official count is retained. Museum and pottery pet access remain incompletely documented by their operators.',
  },
];

pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.some((item) => item.severity === 'error')) {
  throw new Error('Crail Parkopedia and dog-access audit introduced validation errors.');
}

await Promise.all([
  writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8'),
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dogLibrary, null, 2)}\n`, 'utf8'),
]);

console.log('Applied Crail Parkopedia scrape and four-attraction dog-access audit.');
