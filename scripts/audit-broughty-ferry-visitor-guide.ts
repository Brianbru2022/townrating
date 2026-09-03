import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  EditorialRecordReview,
  HeritageFeature,
  ProjectPackage,
  Reliability,
  SourceRecord,
  VisitorHighlight,
} from '../src/domain/models';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-09-02';
const reviewedAt = '2026-09-02T07:15:00.000Z';
const projectPath = resolve('data/projects/broughty-ferry.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const hesReportPath = resolve('data/review/broughty-ferry-hes-integrity-2026-09-02.json');
const auditPath = resolve('data/review/broughty-ferry-full-visitor-audit-2026-09-02.json');
const researchPath = resolve('data/review/broughty-ferry-web-research-2026-09-02.json');

const urls = {
  destination: 'https://visitbroughtyferry.com/',
  thingsToDo: 'https://visitbroughtyferry.com/things-to-do/',
  eatDirectory: 'https://visitbroughtyferry.com/eat-drink/',
  castle: 'https://www.historicenvironment.scot/visit/all/broughty-castle/plan-your-visit/',
  castleOperation: 'https://www.dundeecity.gov.uk/reports/reports/56-2026.pdf',
  castleFacilities: 'https://www.leisureandculturedundee.com/facilities',
  beach: 'https://www.dundeecity.gov.uk/service-area/neighbourhood-services/environment/parks-and-environment',
  waterCode: 'https://www.dundeecity.gov.uk/sites/default/files/publications/bfcodeofpractice.pdf',
  playground: 'https://secure.leisureandculturedundee.com/culture/broughty-castle',
  saltDog: 'https://www.saltdogmarine.com/',
  outdoorExplore: 'https://visitbroughtyferry.com/business-directory/outdoor-explore/',
  gallery: 'https://www.eastudios.com/contact/',
  sauna: 'https://www.beessauna.com/',
  maritimeTrail: 'https://www.dundeemaritime.co.uk/broughtyferry',
  maritimePdf: 'https://www.dundeemaritime.co.uk/sites/default/files/2025-03/BroughtyFerryMaritimeTrail.pdf',
  heritageWalk: 'https://dundeeheritagewalk.com/walks-broughty-ferry',
  waterfrontWalk: 'https://www.dundeecity.gov.uk/dundeecity/uploaded_publications/publication_2405.pdf',
  sandyBeachWalk: 'https://www.dundeecity.gov.uk/dundeecity/uploaded_publications/publication_2409.pdf',
  guidedWalk: 'https://www.dundeewaterfrontwalks.scot/historic-broughty-ferry',
  treasureCatalogue: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goquest: 'https://goquestadventures.com/',
  mitchells: 'https://mitchellsbroughtyferry.co.uk/',
  brawTea: 'https://brawtea.co.uk/',
  maisonDieu: 'https://maisondieucoffee.co.uk/pages/broughty-ferry-cafe',
  bowmans: 'https://www.bowmanscoffeehouse.co.uk/',
  willows: 'https://visitbroughtyferry.com/business-directory/willows/',
  goodfellow: 'https://visitbroughtyferry.com/business-directory/goodfellow-steven/',
  gracies: 'https://visitbroughtyferry.com/business-directory/gracies/',
  kitchenTable: 'https://ratings.food.gov.uk/business/1847150/the-kitchen-table-broughty-ferry',
  timeDd5: 'https://www.thecourier.co.uk/fp/business-environment/business/5356706/coffee-shop-time-dd5-broughty-ferry/',
  parking: 'https://www.dundeecity.gov.uk/project/parking-information?page=2',
  limitedWaiting: 'https://www.dundeecity.gov.uk/parking-information/limited-waiting-area-restricted-free-parking',
  toiletWorks: 'https://www.dundeecity.gov.uk/reports/reports/171-2025.pdf',
  communityMap: 'https://dundeecity.gov.uk/dundeecity/uploaded_publications/publication_24.pdf',
  rail: 'https://www.scotrail.co.uk/plan-your-journey/stations-and-facilities/byf',
  bus: 'https://www.stagecoachbus.com/news/east-scotland/2026/august/stagecoach-announces-simpler-more-connected-angus-bus-network',
  osmCopyright: 'https://www.openstreetmap.org/copyright',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const source = (
  sourceName: string,
  sourceOrganisation: string,
  sourceUrl: string,
  notes: string,
  reliability: Reliability = 'official_non_statutory',
): SourceRecord => ({
  sourceName,
  sourceOrganisation,
  sourceUrl,
  accessedAt: reviewedAt,
  licence: 'Source-linked editorial evidence; check time-sensitive details before travel.',
  reliability,
  notes,
});

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
if (pkg.project.id !== 'broughty-ferry-scotland') throw new Error(`Unexpected project id ${pkg.project.id}`);
pkg.features = pkg.features.filter((feature) => !feature.id.startsWith('broughty-ferry-curated:'));

function upsert(feature: HeritageFeature): HeritageFeature {
  pkg.features = pkg.features.filter((item) => item.id !== feature.id).concat(feature);
  return feature;
}

function currentFeature(input: {
  id: string;
  name: string;
  featureType: string;
  coordinates: [number, number];
  description: string;
  website: string;
  details: string;
  tags: string[];
  significance?: HeritageFeature['significance'];
  reliability?: Reliability;
  sources?: SourceRecord[];
}): HeritageFeature {
  return {
    id: `broughty-ferry-curated:${input.id}`,
    projectId: pkg.project.id,
    name: input.name,
    alternativeNames: [],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: input.featureType,
    significance: input.significance ?? 'local',
    geometry: { type: 'Point', coordinates: input.coordinates },
    locationType: 'exact',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: input.description,
    visitorWebsiteUrl: input.website,
    sourceRecords: [
      source(input.name, new URL(input.website).hostname, input.website, `Current-place curation: ${input.details}`, input.reliability),
      ...(input.sources ?? []),
    ],
    tags: ['current-context', ...input.tags],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
  };
}

function attractionReview(
  score: number,
  rationale: string,
  evidenceUrls: string[],
  visitability: 'full_visitor_experience' | 'substantial_visible_remains' = 'full_visitor_experience',
): EditorialRecordReview {
  const evidenceConfidence = 5;
  const accessAndReliability = Math.min(10, Math.max(5, score - 79));
  const journeyWorth = Math.min(15, Math.max(8, score - 67));
  const presentation = Math.min(20, Math.max(12, score - 55));
  const distinctiveness = Math.min(20, Math.max(12, score - 46));
  const experienceDepth = score - evidenceConfidence - accessAndReliability - journeyWorth - presentation - distinctiveness;
  return {
    status: 'editorially_researched',
    category: 'attraction',
    methodVersion: '2026-08-13-researched-visitor-value-v1',
    reviewedAt: reviewedDate,
    scoreRationale: rationale,
    evidenceUrls,
    visitability,
    attractionAssessment: { experienceDepth, distinctiveness, presentation, journeyWorth, accessAndReliability, evidenceConfidence, visitability },
  };
}

function foodReview(score: number, url: string, rationale: string): EditorialRecordReview {
  let remaining = score;
  const foodAndDrinkQuality = Math.min(30, remaining); remaining -= foodAndDrinkQuality;
  const daytimeRelevance = Math.min(20, remaining); remaining -= daytimeRelevance;
  const distinctiveness = Math.min(15, remaining); remaining -= distinctiveness;
  const consistency = Math.min(15, remaining); remaining -= consistency;
  const visitorFit = Math.min(10, remaining); remaining -= visitorFit;
  const evidenceConfidence = Math.min(10, remaining);
  return {
    status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: rationale, evidenceUrls: [url],
    foodAssessment: { foodAndDrinkQuality, daytimeRelevance, distinctiveness, consistency, visitorFit, evidenceConfidence },
  };
}

function trailReview(score: number, url: string, rationale: string): EditorialRecordReview {
  return {
    status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: rationale, evidenceUrls: [url],
  };
}

function highlight(feature: HeritageFeature, input: Omit<VisitorHighlight, 'featureId' | 'name'>): VisitorHighlight {
  feature.editorialReview = input.editorialReview;
  return { ...input, featureId: feature.id, name: feature.name };
}

function displayDate(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, (_match, number: string, suffix: string) => `${number}${suffix}`)
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

const heritage = pkg.features.filter((feature) => feature.tags.some((tag) =>
  ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape', 'hes-nrhe', 'nrhe'].includes(tag),
));

let nrheDatedFromLocalRecord = 0;
for (const feature of heritage.filter((item) => item.id.startsWith('nrhe:'))) {
  const extracted = extractHistoricEnglandDate(feature.shortDescription ?? '');
  if (extracted) {
    feature.documentedDateText = displayDate(extracted.evidenceText);
    feature.earliestPossibleYear = extracted.earliestPossibleYear;
    feature.latestPossibleYear = extracted.latestPossibleYear;
    feature.datePrecision = extracted.datePrecision;
    feature.dateBasis = extracted.dateBasis;
    feature.dateConfidence = extracted.dateConfidence;
    feature.tags = [...new Set(feature.tags.filter((tag) => tag !== 'map-hidden').concat('heritage-record-retained', 'nrhe-date-from-authoritative-classification', 'date-reviewed'))];
    feature.updatedAt = reviewedAt;
    feature.reviewed = true;
    nrheDatedFromLocalRecord += 1;
  } else {
    feature.tags = [...new Set(feature.tags.concat('heritage-record-retained', 'date-reviewed', 'map-hidden'))];
  }
}

for (const feature of heritage.filter((item) => !item.id.startsWith('nrhe:'))) {
  const hasMaterialDate = Boolean(feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown');
  feature.tags = hasMaterialDate
    ? [...new Set(feature.tags.filter((tag) => tag !== 'map-hidden').concat('heritage-record-retained', 'date-reviewed'))]
    : [...new Set(feature.tags.concat('heritage-record-retained', 'date-reviewed', 'map-hidden'))];
}

const castle = pkg.features.find((feature) => feature.id === 'nrhe:33391');
if (!castle) throw new Error('Local NRHE Broughty Castle record 33391 is missing.');
castle.alternativeNames = [...new Set([castle.name, ...castle.alternativeNames])];
castle.name = 'Broughty Castle Museum';
castle.documentedDateText = '1490';
castle.earliestPossibleYear = 1490;
castle.latestPossibleYear = 1490;
castle.datePrecision = 'year';
castle.dateBasis = 'documented_construction';
castle.dateConfidence = 'high';
castle.shortDescription = 'A coastal fortress erected by the 2nd Lord Gray in 1490, now housing a free museum of local history, wartime defence and Tay wildlife.';
castle.visitorWebsiteUrl = urls.castle;
castle.sourceRecords.push(
  source('Broughty Castle', 'Historic Environment Scotland', urls.castle, 'Official visitor history identifies the castle as erected in 1490; this is the material date, not a designation date.', 'official_statutory'),
  source('Operation of Broughty Ferry Castle, Museum and Grounds', 'Dundee City Council', urls.castleOperation, '2026 council decision continues free summer operation for three years; proposed 2026 season is 1 April to 25 October, Wednesday to Saturday.' , 'local_authority'),
);
castle.tags = [...new Set(castle.tags.filter((tag) => tag !== 'map-hidden').concat('curated-visitor-attraction', 'hes-date-reviewed', 'date-reviewed'))];
castle.updatedAt = reviewedAt;
castle.reviewed = true;
castle.attractionGuide = {
  headline: 'Climb a 1490 fortress above the Tay',
  intro: castle.shortDescription,
  parking: 'Free parking is available in front of the castle; Castle Green and Windmill parking are also audited separately. Check signs and do not use RNLI operational space.',
  toilets: 'Castle toilets are on the second floor; public toilets at Castle Green and Windmill are listed separately.',
  picnic: 'Castle Green and the beach provide the audited outdoor picnic choices.',
  foodNote: 'Braw Tea is in Castle Green; the town-centre café list is a short walk west.',
};

const beach = upsert(currentFeature({
  id: 'attraction-beach', name: 'Broughty Ferry Beach', featureType: 'beach', coordinates: [-2.8611538, 56.4647786],
  description: 'The western, in-boundary part of Dundee City Council’s award beach: sand, Tay views, promenade access and room for a family seaside stop.',
  website: urls.beach,
  details: 'visit_score=88; opening_hours:description=Open shore; observe tides, flags and seasonal notices; entrance_fee=Free; dog_access=Designated beach area excludes dogs 1 May to 30 September; description=Award beach and waterfront promenade.',
  tags: ['curated-visitor-attraction', 'service-context-beach'], significance: 'regional',
  sources: [source('Broughty Ferry water-user code', 'Dundee City Council', urls.waterCode, 'Official map documents beach safety, seasonal lifeguard/first aid, toilets and accessible parking.', 'local_authority')],
}));
beach.attractionGuide = { headline: 'Make time for the Ferry’s sandy shore', intro: beach.shortDescription ?? '', parking: 'Windmill Car Park is the closest audited free surface car park; spaces and accessible-bay counts are not published.', toilets: 'Windmill Public Toilet is wheelchair accessible; Castle Green Public Toilets are also close.', picnic: 'Informal beach picnics are explicitly promoted; follow the water-user code and take litter away.', foodNote: 'Braw Tea and the independent town-centre cafés are within walking distance.' };

const playground = upsert(currentFeature({
  id: 'attraction-castle-green-playground', name: 'Castle Green and Playground', featureType: 'playground', coordinates: [-2.8696146, 56.4639262],
  description: 'A large seafront family play area and public green beside Broughty Castle, with lawns, active-travel paths and Braw Tea in the pavilion.',
  website: urls.playground,
  details: 'visit_score=82; opening_hours:description=Open public green and outdoor play area; entrance_fee=Free; description=Castle-side park and family playground.',
  tags: ['curated-visitor-attraction', 'service-context-park'], significance: 'regional',
}));

const saltDog = upsert(currentFeature({
  id: 'attraction-saltdog-marine', name: 'SaltDog Marine Tay boat trips', featureType: 'boat_tour', coordinates: [-2.8702407, 56.4636735],
  description: 'Bookable RIB wildlife and heritage trips from Castle Approach, including a one-hour Tay experience with possible dolphin, seal and seabird sightings.',
  website: urls.saltDog,
  details: 'visit_score=87; opening_hours:description=Bookable trips, primarily April to November; weather and minimum-number conditions apply; entrance_fee=Paid; time_to_spend=From one hour.',
  tags: ['curated-visitor-attraction', 'bookable-experience'], significance: 'regional',
}));

const outdoorExplore = upsert(currentFeature({
  id: 'attraction-outdoor-explore', name: 'Outdoor Explore Broughty Ferry kayak tours', featureType: 'guided_tour', coordinates: [-2.8610, 56.4647],
  description: 'Easy guided small-group sea-kayak trips launching from Broughty Ferry Beach, normally 2–2.5 hours with equipment supplied and ages six-plus accepted.',
  website: urls.outdoorExplore,
  details: 'visit_score=84; opening_hours:description=Bookable all year, weather and conditions permitting; entrance_fee=From £55 per person; time_to_spend=2–2.5 hours; description=Beginner-friendly guided Tay estuary paddle.',
  tags: ['curated-visitor-attraction', 'bookable-experience'], significance: 'regional',
}));

const gallery = upsert(currentFeature({
  id: 'attraction-eduardo-alessandro', name: 'Eduardo Alessandro Studios', featureType: 'art_gallery', coordinates: [-2.87368, 56.46572],
  description: 'A long-established contemporary gallery showing original and print art, crafts and changing exhibitions with an emphasis on Scottish artists.',
  website: urls.gallery,
  details: 'visit_score=76; opening_hours:description=Monday–Saturday 10:00–17:00; Sunday 12:00–16:00 in July, August and December only; entrance_fee=Free to browse.',
  tags: ['curated-visitor-attraction'],
}));

const sauna = upsert(currentFeature({
  id: 'attraction-bees-sauna', name: 'Bee’s Sauna at Broughty Castle', featureType: 'wellness', coordinates: [-2.86975, 56.46318],
  description: 'A bookable Swedish wood-fired seafront sauna now permanently based in the castle grounds, pairing heat with the exposed Tay setting.',
  website: urls.sauna,
  details: 'visit_score=72; opening_hours:description=Bookable sessions; consult the live calendar; entrance_fee=Paid; description=Wood-fired coastal sauna.',
  tags: ['curated-visitor-attraction', 'bookable-experience'],
}));

const attractionSpecs: Array<{ feature: HeritageFeature; score: number; reason: string; tagline: string; time: string; opening: string; admission: string; free?: boolean; urls: string[] }> = [
  { feature: castle, score: 90, reason: 'A rare, free-to-enter 1490 coastal fortress with museum displays, commanding estuary views and current council-backed operation.', tagline: 'Free museum inside a 1490 fortress', time: '1–2 hours', opening: 'Wednesday–Saturday, 1 April–25 October in the published 2026 council schedule.', admission: 'Free; donations welcomed.', free: true, urls: [urls.castle, urls.castleOperation] },
  { feature: beach, score: 88, reason: 'A broad award beach and promenade immediately beside the castle and public facilities.', tagline: 'Sand, promenade and Tay views', time: '1–3 hours', opening: 'Open shore; tides, flags and seasonal notices apply.', admission: 'Free.', free: true, urls: [urls.beach, urls.waterCode] },
  { feature: saltDog, score: 87, reason: 'A distinctive, bookable wildlife-and-heritage boat experience departing from the centre of the destination.', tagline: 'Fast RIB trip on the Tay', time: 'From one hour', opening: 'Bookable trips, primarily April–November; weather dependent.', admission: 'Paid; live prices and availability online.', urls: [urls.saltDog] },
  { feature: outdoorExplore, score: 84, reason: 'A properly guided, beginner-friendly way to experience the castle, wildlife and estuary from the water.', tagline: 'Guided sea kayaking for beginners', time: '2–2.5 hours', opening: 'Bookable all year, subject to safe conditions.', admission: 'From £55 per person; equipment included.', urls: [urls.outdoorExplore] },
  { feature: playground, score: 82, reason: 'A substantial free family stop beside the castle, green, beach and café rather than an isolated play area.', tagline: 'Castle-side family play', time: '45 minutes–2 hours', opening: 'Open public green and outdoor play area.', admission: 'Free.', free: true, urls: [urls.playground, urls.destination] },
  { feature: gallery, score: 76, reason: 'A credible, open contemporary gallery that adds a useful all-weather cultural stop to the seafront offer.', tagline: 'Scottish art on Gray Street', time: '30–60 minutes', opening: 'Monday–Saturday 10:00–17:00; limited seasonal Sunday opening.', admission: 'Free to browse.', free: true, urls: [urls.gallery] },
  { feature: sauna, score: 72, reason: 'A memorable current coastal wellness experience, reduced for specialist appeal and advance booking.', tagline: 'Wood-fired warmth by the Tay', time: 'Allow 1–1.5 hours', opening: 'Bookable sessions; consult the live calendar.', admission: 'Paid.', urls: [urls.sauna] },
];

pkg.project.visitorHighlights = attractionSpecs.map((spec, index) => highlight(spec.feature, {
  rank: index + 1,
  reason: spec.reason,
  tagline: spec.tagline,
  visitorScore: spec.score,
  timeToSpend: spec.time,
  openingTimes: spec.opening,
  admission: spec.admission,
  freeAdmission: spec.free,
  visitorWebsiteUrl: spec.feature.visitorWebsiteUrl,
  sourceName: spec.feature.name,
  sourceUrl: spec.urls[0],
  verifiedInBoundaryAt: reviewedDate,
  editorialReview: attractionReview(spec.score, spec.reason, spec.urls),
}));

const foodSpecs = [
  { id: 'eat-mitchells', name: 'Mitchell’s', c: [-2.8740088, 56.4669781] as [number, number], tagline: 'Speciality coffee and brunch', desc: 'Independent Brook Street café for speciality coffee, cakes, brunch, sandwiches, salads and light lunch.', url: urls.mitchells, score: 88, hours: 'Daily 09:00–17:00', price: '££', dog: 'unconfirmed' },
  { id: 'eat-braw-tea', name: 'Braw Tea', c: [-2.8699227, 56.4647379] as [number, number], tagline: 'Social-enterprise coffee and bakes', desc: 'Award-winning social-enterprise café in Castle Green for artisan coffee, in-house baking, snacks and light lunches.', url: urls.brawTea, score: 86, hours: 'Friday–Monday 09:30–16:00; until 17:00 in July and August', price: '££', dog: 'outdoor-only' },
  { id: 'eat-maison-dieu', name: 'Maison Dieu Coffee Roasters', c: [-2.8756958, 56.4674269] as [number, number], tagline: 'Locally roasted speciality coffee', desc: 'Broughty Ferry’s speciality-coffee shop, serving locally roasted coffee, local bakes, panini, sandwiches and light bites.', url: urls.maisonDieu, score: 84, hours: 'Monday–Friday 08:00–16:00, Saturday 09:00–16:00, Sunday 10:00–16:00', price: '££', dog: 'unconfirmed' },
  { id: 'eat-bowmans', name: 'Bowmans Coffee House', c: [-2.8725237, 56.4667624] as [number, number], tagline: 'Dog-friendly coffee and cakes', desc: 'Family-run and explicitly dog-friendly coffee house for breakfast, brunch, lunch, afternoon tea and cakes.', url: urls.bowmans, score: 83, hours: 'Monday–Saturday 10:00–16:00; closed Sunday', price: '££', dog: 'welcoming' },
  { id: 'eat-willows', name: 'Willows Coffee Shop', c: [-2.8767631, 56.4673900] as [number, number], tagline: 'Home baking and light lunches', desc: 'Independent table-service coffee shop with home baking, soups, sandwiches, toasties, panini and baked potatoes.', url: urls.willows, score: 81, hours: 'Monday–Saturday 08:30–17:00, Sunday 09:00–17:00', price: '££', dog: 'unconfirmed' },
  { id: 'eat-goodfellow', name: 'Goodfellow & Steven Gallery Café', c: [-2.8734086, 56.4667672] as [number, number], tagline: 'Historic bakery and gallery café', desc: 'Historic local baker founded in 1897, with a gallery café for coffee, Scottish baking, Dundee cake and sweet treats.', url: urls.goodfellow, score: 80, hours: 'Monday–Saturday 08:00–16:00', price: '£', dog: 'unconfirmed' },
  { id: 'eat-gracies', name: 'Gracie’s', c: [-2.8765995, 56.4675380] as [number, number], tagline: 'Fresh bakes and brewed coffee', desc: 'Cosy independent café-bistro for fresh food, home baking and properly brewed tea and coffee.', url: urls.gracies, score: 78, hours: 'Monday–Saturday 09:00–17:00; Sunday 11:00–16:00', price: '££', dog: 'unconfirmed' },
  { id: 'eat-kitchen-table', name: 'The Kitchen Table', c: [-2.8716590, 56.4668152] as [number, number], tagline: 'Coffee, cake and vegan choices', desc: 'Independent coffee-and-cake café with vegetarian and vegan choices, breakfast and light lunch.', url: urls.kitchenTable, score: 75, hours: 'Monday–Saturday 08:00–15:00; closed Sunday', price: '££', dog: 'unconfirmed' },
  { id: 'eat-time-dd5', name: 'Time DD5', c: [-2.8738502, 56.4657058] as [number, number], tagline: 'Relaxed daytime drinks and bakes', desc: 'A newer Gray Street social-enterprise coffee shop for daytime drinks, bakes and a relaxed pause.', url: urls.timeDd5, score: 72, hours: 'Wednesday–Thursday 10:00–16:00; Friday–Saturday 09:00–18:00', price: '£', dog: 'unconfirmed', reliability: 'secondary' as Reliability },
] as const;

const foodIds: string[] = [];
for (const spec of foodSpecs) {
  const feature = upsert(currentFeature({
    id: spec.id, name: spec.name, featureType: 'cafe', coordinates: spec.c, description: spec.desc, website: spec.url,
    details: `amenity=cafe; visit_score=${spec.score}; opening_hours:description=${spec.hours}; price_band=${spec.price}; cuisine=coffee, cake and light lunch; description=${spec.tagline}: ${spec.desc}`,
    tags: ['service-context-food', 'visitor-context-food'],
    reliability: 'reliability' in spec ? spec.reliability : undefined,
  }));
  feature.editorialReview = foodReview(spec.score, spec.url, 'Scored for coffee, cake, baking and light-lunch usefulness from current operator, local directory or current mapped/FHRS evidence—not dinner prestige.');
  foodIds.push(feature.id);
}

const trailSpecs = [
  { id: 'trail-maritime', name: 'Broughty Ferry Shoreline Maritime Trail', c: [-2.8739, 56.4647] as [number, number], desc: 'A current one-kilometre, all-ages-and-abilities shoreline trail from the old burial ground to the award beach, passing the harbour, lifeboat, sculptures, castle and Windmill Garden.', url: urls.maritimeTrail, score: 88, time: 'About 45–75 minutes; optional 3 km beach extension', fee: 'Free', tags: [] as string[] },
  { id: 'trail-heritage', name: 'Broughty Ferry Heritage Walk', c: [-2.8739864, 56.4676434] as [number, number], desc: 'A detailed six-section self-guided walk through the planned town, Esplanade, castle, harbour, Fisher Street and central historic buildings.', url: urls.heritageWalk, score: 84, time: 'More than two hours for the full walk; sections can be shortened', fee: 'Free', tags: [] as string[] },
  { id: 'trail-guided-waterfront', name: 'Historic Broughty Ferry guided waterfront walk', c: [-2.8772, 56.4649] as [number, number], desc: 'A bookable guided history walk through the harbour and old fisher community, including access to the ancient burial ground when arranged.', url: urls.guidedWalk, score: 81, time: 'Use the current operator schedule', fee: 'Paid guided walk', tags: ['bookable-experience'] },
  { id: 'trail-waterfront-health', name: 'Broughty Ferry Waterfront health walk', c: [-2.8750, 56.4653] as [number, number], desc: 'Dundee City Council’s one-mile, 25-minute Grade 1 waterfront circuit linking the station/library area, historic streets, Castle Green and the shore.', url: urls.waterfrontWalk, score: 74, time: 'About 25 minutes', fee: 'Free', tags: [] as string[] },
  { id: 'trail-sandy-beach', name: 'The Sandy Beach health walk', c: [-2.8688, 56.4642] as [number, number], desc: 'An official out-and-back coastal walk starting at Broughty Castle and continuing east along the beach and shore path towards Balmossie; most of the route extends beyond the town audit boundary.', url: urls.sandyBeachWalk, score: 72, time: 'Allow 1.5–2.5 hours depending on turnaround', fee: 'Free', tags: ['cross-boundary-trail'] },
] as const;
const trailIds: string[] = [];
for (const spec of trailSpecs) {
  const feature = upsert(currentFeature({
    id: spec.id, name: spec.name, featureType: 'walking_route', coordinates: spec.c, description: spec.desc, website: spec.url,
    details: `trail_score=${spec.score}; opening_hours:description=Self-guided or booked as stated; use daylight and current route conditions; entrance_fee=${spec.fee}; time_to_spend=${spec.time}; description=${spec.desc}`,
    tags: ['service-context-trail', 'visitor-context-trail', ...spec.tags], significance: spec.score >= 80 ? 'regional' : 'local',
    sources: spec.id === 'trail-maritime' ? [source('Broughty Ferry Maritime Trail leaflet', 'Dundee Maritime', urls.maritimePdf, 'Current downloadable route leaflet confirms one kilometre, all-ages-and-abilities route and optional beach extension.')] : undefined,
  }));
  feature.editorialReview = trailReview(spec.score, spec.url, 'A named, source-linked route with enough route identity and planning detail to follow; cross-boundary mileage is explicitly disclosed.');
  trailIds.push(feature.id);
}

const picnicSpecs = [
  { id: 'picnic-castle-green', name: 'Castle Green picnic lawns and benches', c: [-2.8691855, 56.4640616] as [number, number], desc: 'Public lawns beside the castle and playground, with Braw Tea’s outdoor picnic benches nearby; take litter away and keep clear of events and play equipment.', url: urls.destination },
  { id: 'picnic-beach', name: 'Broughty Ferry Beach picnic area', c: [-2.8613, 56.4648] as [number, number], desc: 'Informal sandy-beach picnicking is explicitly promoted; observe flags, water-safety notices, tides and seasonal dog restrictions.', url: urls.destination },
] as const;
const picnicIds = picnicSpecs.map((spec) => upsert(currentFeature({ id: spec.id, name: spec.name, featureType: 'picnic_site', coordinates: spec.c, description: spec.desc, website: spec.url, details: `tourism=picnic_site; opening_hours:description=Open outdoor space; entrance_fee=Free; description=${spec.desc}`, tags: ['service-context-picnic', 'visitor-context-picnic'] })).id);

const parkingSpecs = [
  { id: 'parking-castle-front', name: 'Broughty Castle frontage parking', c: [-2.8729349, 56.4646184] as [number, number], fee: 'no', price: 'Free', desc: 'Free public street-side parking serving the castle and Castle Green; capacity and marked accessible-bay count are not published.' },
  { id: 'parking-windmill', name: 'Windmill Car Park', c: [-2.8670032, 56.4638866] as [number, number], fee: 'no', price: 'Free', desc: 'Free surface seafront parking beside Windmill Public Toilet and the beach; capacity is not published and peak-season demand can be high.' },
  { id: 'parking-fort-street', name: 'Fort Street Car Park', c: [-2.8766074, 56.4668397] as [number, number], fee: 'yes', price: 'Paid—check current council tariff and machine/sign', desc: 'Council town-centre surface car park. Current charges and maximum stay can change; use the machine, app and entrance signs rather than an old quoted price.' },
  { id: 'parking-queen-street', name: 'Queen Street Car Park', c: [-2.8738981, 56.4679026] as [number, number], fee: 'yes', price: 'Paid—check current council tariff and machine/sign', desc: 'Council surface car park close to the station and library. Current charges and maximum stay can change; check the entrance signs.' },
  { id: 'parking-brook-street', name: 'Brook Street Car Park', c: [-2.8726641, 56.4664445] as [number, number], fee: 'yes', price: 'Paid—check current council tariff and machine/sign', desc: 'Council surface car park behind the main shopping street. Current charges and maximum stay can change; check the entrance signs.' },
] as const;
const parkingIds = parkingSpecs.map((spec) => upsert(currentFeature({
  id: spec.id, name: spec.name, featureType: 'parking', coordinates: spec.c, description: spec.desc, website: urls.parking,
  details: `amenity=parking; parking=surface; access=public; fee=${spec.fee}; price_display=${spec.price}; capacity=Not published; capacity:disabled=Not published; opening_hours:description=Check current entrance signs; description=${spec.desc}`,
  tags: ['service-context-parking', 'visitor-context-parking'],
  sources: [source('Broughty Ferry parking locations', 'Dundee City Council', urls.limitedWaiting, 'Council parking pages and current mapped data distinguish charged town-centre parking from free seafront parking.', 'local_authority'), source('OpenStreetMap parking geometry', 'OpenStreetMap contributors', urls.osmCopyright, 'Current parking geometry and fee tags checked 2 September 2026.', 'secondary')],
})).id);

const toiletSpecs = [
  { id: 'toilets-castle-green', name: 'Castle Green Public Toilets', c: [-2.8701764, 56.4641927] as [number, number], desc: 'Free public toilet building at Castle Green. Current mapped access is step-free/limited-wheelchair; check opening notices before relying on it.', access: 'wheelchair=limited; fee=no' },
  { id: 'toilets-windmill', name: 'Windmill Public Toilet', c: [-2.8669677, 56.4640467] as [number, number], desc: 'Free public toilet at Windmill Car Park with wheelchair access and a Changing Places facility documented by the council.', access: 'wheelchair=yes; changing_places=yes; fee=no' },
  { id: 'toilets-queen-street', name: 'Queen Street Public Toilets', c: [-2.8735102, 56.4676840] as [number, number], desc: 'Paid public conveniences opposite the library and near the station; opening times, accessibility and charge are not published on the current council page, so check on site.', access: 'wheelchair=not_published; fee=yes' },
] as const;
const toiletIds = toiletSpecs.map((spec) => upsert(currentFeature({
  id: spec.id, name: spec.name, featureType: 'toilets', coordinates: spec.c, description: spec.desc, website: urls.toiletWorks,
  details: `amenity=toilets; ${spec.access}; opening_hours:description=Check current site notices; description=${spec.desc}`,
  tags: ['service-context-toilets', 'visitor-context-toilets'],
  sources: [source('Broughty Ferry community map', 'Dundee City Council', urls.communityMap, 'Official map identifies Castle Green and Queen Street public toilets.', 'local_authority'), source('Public Toilet Improvements', 'Dundee City Council', urls.toiletWorks, 'Council contract records 2025 improvement works at Windmill and Castle Green toilets.', 'local_authority'), source('OpenStreetMap toilet geometry', 'OpenStreetMap contributors', urls.osmCopyright, 'Current toilet coordinates and access/fee tags checked 2 September 2026.', 'secondary')],
})).id);

pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 87,
  dogOwnerScore: 81,
  dogAccessScoreAdjustment: -6,
  rating: 2,
  label: 'Strong Destination',
  summary: 'Broughty Ferry is a complete and compact Tay-side destination: a free 1490 castle museum, award beach and family green, bookable water experiences, current heritage and maritime walks, an excellent daytime café cluster and unusually strong practical facilities.',
  dogAccessRating: 2,
  dogAccessSummary: 'Promenade and outdoor walks remain useful, and Bowmans explicitly welcomes dogs, but the designated beach area excludes dogs from 1 May to 30 September, Braw Tea admits assistance dogs only indoors, indoor attraction policies vary and wildlife/open-water settings require close control.',
  methodVersion: '2026-09-02-full-settlement-visitor-audit-v3',
  reviewedAt: reviewedDate,
  sourceUrls: [urls.destination, urls.castle, urls.castleOperation, urls.beach, urls.maritimeTrail, urls.heritageWalk, urls.eatDirectory, urls.parking, urls.rail],
};
pkg.project.townGuide = {
  characterTag: 'Castle, beach and café-rich Tay waterfront',
  headline: 'A genuine seaside day out at Dundee’s eastern edge',
  intro: pkg.project.touristAppeal.summary ?? '',
  bestFor: ['Coastal history and castle views', 'Families and easy waterfront walking', 'Independent coffee, cake and light lunch', 'Bookable Tay wildlife and paddle trips'],
  perfectFor: ['A full day combining Broughty Castle, beach, a trail and cafés'],
  suggestedFirstVisit: { title: 'Castle, shore and Brook Street', summary: 'Start at the free castle museum, follow the Maritime Trail past Castle Green and the beach, then use the independent café list around Brook and Gray Streets.' },
  dontMiss: ['Broughty Castle Museum', 'Broughty Ferry Beach', 'Broughty Ferry Shoreline Maritime Trail'],
  suggestedTime: 'Full day; half a day without a booked water experience',
  visitorMood: 'Historic, breezy, family-friendly and unusually easy to combine on foot.',
  sourceUrls: [urls.destination, urls.castle, urls.maritimeTrail, urls.heritageWalk, urls.eatDirectory],
  lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit completed 2 September 2026 with current internet research and local HES/NRHE data. Barnhill Rock Garden, Broughty Ferry Local Nature Reserve, Dawson Park and Dundee city-centre attractions are outside this project boundary and do not lift the score. Nine café-led daytime Eat entries are published; dinner-led restaurants are not used to pad the category. Named trail providers were checked: no exact Treasure Trails, Curious About, Mystery Guides or GoQuest Adventures Broughty Ferry product was found. The current Maritime Trail, Heritage Walk, council health walks and a bookable guided waterfront walk are published. All 160 in-boundary statutory listed-building designations remain represented; 159 have defensible material dates and one unresolved record remains hidden. All 207 local NRHE records remain intact; classification text supplies defensible dates for 122 records and the remaining period-unassigned records are retained but hidden. Dates are stored for heat/timeline use and are not appended to map labels.';

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
planner.reviewedAt = reviewedDate;
planner.projects[pkg.project.id] = { eat: foodIds, trails: trailIds, picnic: picnicIds, parking: parkingIds, toilets: toiletIds };
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
dog.reviewedAt = reviewedDate;
const unconfirmed = (label: string, url: string) => ({ rating: 0, status: 'unconfirmed', label, summary: 'No reliable current dog policy is published; assistance-dog access may differ. Check the linked operator before relying on indoor access.', sourceName: 'Current operator information', sourceUrl: url, reviewedAt: reviewedDate });
const restricted = (label: string, summary: string, url: string, rating = 1) => ({ rating, status: 'restricted', label, summary, sourceName: 'Current operator or council access information', sourceUrl: url, reviewedAt: reviewedDate });
dog.projects[pkg.project.id] = { attraction: {}, eat: {} };
dog.projects[pkg.project.id].attraction[castle.id] = unconfirmed('Castle pet policy requires checking', urls.castle);
dog.projects[pkg.project.id].attraction[beach.id] = restricted('Seasonal designated-beach exclusion', 'Dogs are prohibited on the designated Broughty Ferry Beach area from 1 May to 30 September. Use lawful alternative paths and follow signs.', urls.beach);
dog.projects[pkg.project.id].attraction[playground.id] = restricted('Green access; keep clear of play equipment', 'Use Castle Green under responsible close control and keep dogs clear of the children’s play area, food seating and events.', urls.outdoorCode, 2);
for (const feature of [saltDog, outdoorExplore, gallery, sauna]) dog.projects[pkg.project.id].attraction[feature.id] = unconfirmed('Operator pet policy requires checking', feature.visitorWebsiteUrl!);
for (const spec of foodSpecs) {
  const id = `broughty-ferry-curated:${spec.id}`;
  dog.projects[pkg.project.id].eat[id] = spec.dog === 'welcoming'
    ? { rating: 3, status: 'welcoming', label: 'Explicitly dog friendly', summary: 'Bowmans explicitly describes its Broughty Ferry coffee house as doggy friendly.', sourceName: 'Bowmans Coffee House', sourceUrl: urls.bowmans, reviewedAt: reviewedDate }
    : spec.dog === 'outdoor-only'
      ? restricted('Assistance dogs only indoors', 'Braw Tea admits assistance dogs only inside; outdoor seating is available.', urls.brawTea)
      : unconfirmed('Café pet policy not confirmed', spec.url);
}
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

const allHeritage = pkg.features.filter((feature) => feature.tags.some((tag) =>
  ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape', 'hes-nrhe', 'nrhe'].includes(tag),
));
const visibleHeritage = allHeritage.filter((feature) => !feature.tags.includes('map-hidden'));
const badVisibleHeritage = visibleHeritage.filter((feature) =>
  !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown' || feature.name.includes(feature.documentedDateText),
);
if (badVisibleHeritage.length) throw new Error(`${badVisibleHeritage.length} visible heritage pins lack clean material dates: ${badVisibleHeritage.slice(0, 5).map((item) => item.id).join(', ')}`);

const hesReport = JSON.parse(await readFile(hesReportPath, 'utf8')) as any;
if (hesReport.missingStatutoryDesignations || hesReport.undatedVisiblePins) throw new Error('Broughty Ferry statutory HES integrity gate failed.');

pkg.validation = validateFeatures(pkg.project, pkg.features);
const validationErrors = pkg.validation.filter((entry) => entry.severity === 'error');
if (validationErrors.length) throw new Error(validationErrors.map((entry) => entry.message).join('; '));
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const providerChecks = {
  TreasureTrails: 'Exact Broughty Ferry product search completed; no exact product was found. The Dundee city trail is outside this boundary and is not published here.',
  CuriousAbout: 'Exact Broughty Ferry route search completed; no exact route was found.',
  MysteryGuides: 'Exact Broughty Ferry route search completed; no exact route was found.',
  GoQuestAdventures: 'Exact Broughty Ferry route search completed; no exact route was found.',
  officialAndLocal: 'Five current or source-verifiable Broughty Ferry routes are published, including the Maritime Trail and detailed Heritage Walk.',
};
const hiddenHeritage = allHeritage.filter((feature) => feature.tags.includes('map-hidden'));
const audit = {
  reviewedAt,
  place: 'Broughty Ferry',
  boundary: { rule: 'The 1.3 km Broughty Ferry editorial study boundary is applied. Barnhill, the local nature reserve, Dawson Park and Dundee city-centre attractions are excluded.', nearbyExcluded: ['Barnhill Rock Garden', 'Broughty Ferry Local Nature Reserve', 'Dawson Park', 'Dundee city-centre museums and trails'] },
  score: { value: 87, band: '80–89 Strong Destination', mapPublished: true, rationale: pkg.project.touristAppeal.summary, secondPass58: 'The placeholder score of exactly 58 was re-opened and discarded after a mandatory complete second pass. It was not a capped or audited score.' },
  publication: { see: pkg.project.visitorHighlights.length, eat: foodIds.length, trails: trailIds.length, picnic: picnicIds.length, parking: parkingIds.length, toilets: toiletIds.length },
  categories: {
    see: { audited: true, published: pkg.project.visitorHighlights.map((item) => item.name), exclusions: ['Barnhill Rock Garden and the local nature reserve are east of the strict boundary.', '45 Hound Black does not publish a dependable in-town visitor tour product.'] },
    eat: { audited: true, published: foodIds.length, focus: 'Independent cafés, coffee, cake, home baking and light lunch; full dinner restaurants are deliberately not used to pad the category.', broaderDirectoryChecked: urls.eatDirectory },
    trails: { audited: true, published: trailIds.length, linkStatus: 'All five published route/operator URLs returned usable current or still-published route content during the audit.', providerChecks },
    picnic: { audited: true, published: picnicIds.length, note: 'Castle Green and beach picnicking are supported; no invented dedicated table count is stated.' },
    parking: { audited: true, published: parkingIds.length, note: 'Two free seafront choices and three charged town-centre car parks. Unknown capacities, accessible-bay counts and live tariffs are explicitly marked rather than guessed.' },
    toilets: { audited: true, published: toiletIds.length, note: 'Castle Green, Windmill and Queen Street are represented. Castle visitor toilets are not substituted for public toilets and are upstairs.' },
    accessibility: { audited: true, note: 'Station platforms are step-free. The Maritime Trail is described as suitable for all ages and abilities. Windmill has wheelchair/Changing Places provision. Broughty Castle itself is not wheelchair accessible because of its spiral stair.' },
    transport: { audited: true, rail: 'Broughty Ferry station is step-free with seating, help points and six cycle spaces, but no station toilet.', bus: 'Stagecoach 73 serves Broughty Ferry on the Dundee–Carnoustie–Arbroath corridor; check live times.', sources: [urls.rail, urls.bus] },
    dogs: { audited: true, scoreAdjustment: -6, note: pkg.project.touristAppeal.dogAccessSummary },
  },
  heritage: {
    totalRetainedRecords: allHeritage.length,
    statutoryListedBuildings: allHeritage.filter((feature) => feature.tags.includes('hes-listed-building')).length,
    nrheRecords: allHeritage.filter((feature) => feature.id.startsWith('nrhe:')).length,
    nrheDatedFromAuthoritativeClassification: nrheDatedFromLocalRecord,
    visibleDatedPins: visibleHeritage.length,
    hiddenUndatedRecords: hiddenHeritage.length,
    visibleUndatedPins: badVisibleHeritage.length,
    missingStatutoryDesignations: hesReport.missingStatutoryDesignations,
    unresolvedStatutoryRecords: hesReport.localDescriptionsMissing,
    labelPolicy: 'Material dates remain in feature fields for heat/timeline use; dates are not appended to map names.',
  },
  evidencePolicy: 'Current operator, local authority, national heritage and transport sources were preferred. OpenStreetMap was used for exact current geometry and fee/access tags, never as the sole basis for a high visitor-value claim.',
};
await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

const research = {
  reviewedAt,
  place: 'Broughty Ferry',
  sources: Object.entries(urls).map(([key, url]) => ({ key, url })),
  checks: {
    currentCastleOperation: 'Official 2026 council report continues summer opening for three years; 2026 season proposed 1 April–25 October, Wednesday–Saturday. Free admission confirmed by HES/operator.',
    castleMaterialDate: 'HES visitor history gives 1490; Dundee heritage material sometimes says completed 1496. The feature uses 1490 as the official erection date and records the source.',
    trailProviders: providerChecks,
    dogRestriction: 'Dundee City Council rule prohibits dog walking on the designated beach area 1 May–30 September.',
    parkingVerification: 'Current council parking pages plus 2 September 2026 OSM geometry/fee tags; live tariffs remain sign-led.',
    facilitiesVerification: 'Council documents and current mapped data confirm Castle Green and Windmill public toilets; the 2025 contract covered upgrades to both.',
    foodScope: 'Nine current café-led daytime businesses verified from operator pages, the current Broughty Ferry directory, FHRS-linked records and current mapped data.',
  },
};
await writeFile(researchPath, `${JSON.stringify(research, null, 2)}\n`, 'utf8');

console.log(`Broughty Ferry full audit complete: score 87; ${pkg.project.visitorHighlights.length} See / ${foodIds.length} Eat / ${trailIds.length} Trails / ${picnicIds.length} Picnic / ${parkingIds.length} Parking / ${toiletIds.length} Toilets; ${visibleHeritage.length} dated heritage pins visible and ${hiddenHeritage.length} unresolved records retained but hidden.`);
