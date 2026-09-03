import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-09-01';
const reviewedAt = '2026-09-01T12:40:00.000Z';
const projectPath = resolve('data/projects/guardbridge.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const reportPath = resolve('data/review/guardbridge-full-visitor-audit-2026-09-01.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;

const urls = {
  centre: 'https://fifecoastandcountrysidetrust.co.uk/eden-estuary-newsletter-july-2026/',
  reserve: 'https://fifecoastandcountrysidetrust.co.uk/walks/local-nature-reserves-others/eden-estuary-nature-reserve/',
  network: 'https://www.fife.gov.uk/__data/assets/pdf_file/0025/52909/Leuch-Guard-Bal-Strathk-Green-and-Blue-network-report-May-2023.pdf',
  edenMill: 'https://www.welcometofife.com/view-business/eden-mill-distillery--visitor-centre',
  edenMillTour: 'https://www.edenmill.com/pages/eden-mill-classic-whisky-tour',
  edenMillVisit: 'https://www.edenmill.com/pages/distilleryfaqs',
  tindals: 'https://catering.wp.st-andrews.ac.uk/tindals-cafe/',
  toilets: 'https://www.fife.gov.uk/facilities/public-toilet/public-toilets',
  treasure: 'https://www.treasuretrails.co.uk/collections/fife',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  quest: 'https://goquestadventures.com/',
  dog: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const source = (
  name: string,
  organisation: string,
  url: string,
  notes: string,
  reliability: any = 'official_non_statutory',
) => ({
  sourceName: name,
  sourceOrganisation: organisation,
  sourceUrl: url,
  accessedAt: reviewedAt,
  licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
  reliability,
  notes,
});
const upsert = (item: HeritageFeature) => {
  pkg.features = pkg.features.filter((feature) => feature.id !== item.id).concat(item);
  return item;
};
const feature = (
  id: string,
  name: string,
  featureType: string,
  coordinates: [number, number],
  description: string,
  website: string,
  sourceRecords: any[],
  tags: string[],
): HeritageFeature => ({
  id,
  projectId: pkg.project.id,
  name,
  alternativeNames: [],
  countryCode: 'GB-SCT',
  region: 'Fife',
  locality: 'Guardbridge',
  featureType,
  significance: 'regional',
  geometry: { type: 'Point', coordinates },
  locationType: 'exact',
  locationConfidence: 'high',
  dateBasis: 'unknown',
  dateConfidence: 'unknown',
  survival: 'substantially_intact',
  shortDescription: description,
  visitorWebsiteUrl: website,
  sourceRecords,
  tags: ['current-context', ...tags],
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  reviewed: true,
  evidenceScope: 'parish_evidence',
});

const mill = upsert(feature(
  'curated-attraction:eden-mill-guardbridge',
  'Eden Mill Distillery and Visitor Centre',
  'distillery',
  [-2.892142, 56.363945],
  'A major working gin and whisky distillery opened to visitors in September 2025, with immersive tours, tastings, shop, rooftop bar and broad views over the Eden Estuary.',
  urls.edenMill,
  [
    source('Eden Mill Distillery & Visitor Centre', 'Welcome to Fife', urls.edenMill, 'Official destination listing confirms the September 2025 opening, bookable gin and whisky tours and rooftop bar.'),
    source('Classic Whisky Tour', 'Eden Mill', urls.edenMillTour, 'Current operator page confirms a £26 working-distillery tour, immersive whisky room, tastings and retail visit.'),
    source('Distillery FAQs', 'Eden Mill', urls.edenMillVisit, 'Current operator page confirms seven-day tours, visitor parking, disabled bays, public transport and full lift access.'),
  ],
  ['curated-visitor-attraction'],
));
mill.editorialReview = {
  status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
  scoreRationale: 'A substantial, bookable and highly presented working-distillery experience with tastings and estuary views. Adult drinks focus and paid tours temper its general visitor reach.',
  evidenceUrls: [urls.edenMill, urls.edenMillTour, urls.edenMillVisit],
  attractionAssessment: { experienceDepth: 27, distinctiveness: 18, presentation: 17, journeyWorth: 14, accessAndReliability: 8, evidenceConfidence: 5, visitability: 'full_visitor_experience' },
};
mill.attractionGuide = {
  headline: 'Tour a new working Fife distillery',
  parking: 'The operator identifies a Main Street visitor car park, disabled bays at the distillery and restricted weekend use of the university car park. These are customer facilities, not general village parking.',
  toilets: 'Visitor-centre facilities are available to customers; no separate council public toilet is listed for Guardbridge.',
  picnic: 'No public picnic provision is claimed at the distillery.',
  foodNote: 'The Lookout is bar-led; Tindal’s Café provides the qualifying daytime coffee and lunch stop.',
};

const centre = upsert(feature(
  'curated-attraction:eden-estuary-centre',
  'Eden Estuary Centre and Outdoor Viewing Area',
  'nature_reserve',
  [-2.8896316, 56.3615287],
  'The principal Guardbridge viewpoint over the internationally important Eden Estuary; the indoor centre is closed for repairs at the July 2026 official update, while the outdoor viewing area remains accessible.',
  urls.centre,
  [
    source('Eden Estuary Newsletter July 2026', 'Fife Coast and Countryside Trust', urls.centre, 'Current official status: centre closed for repairs; outdoor viewing area remains accessible.'),
    source('Eden Estuary Nature Reserve', 'Fife Coast and Countryside Trust', urls.reserve, 'Official nature-reserve importance, access, birdlife and visitor-centre context.'),
  ],
  ['curated-visitor-attraction'],
));
centre.editorialReview = {
  status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
  scoreRationale: 'A highly worthwhile birdwatching viewpoint and one of Guardbridge’s defining experiences; the live indoor closure and small scale reduce reliability.',
  evidenceUrls: [urls.centre, urls.reserve],
  attractionAssessment: { experienceDepth: 23, distinctiveness: 18, presentation: 12, journeyWorth: 12, accessAndReliability: 5, evidenceConfidence: 5, visitability: 'full_visitor_experience' },
};
centre.attractionGuide = { headline: 'Watch the Eden without disturbing it', parking: 'Only use signed centre parking and follow current ranger information; capacity is small.', toilets: 'Do not rely on centre toilets while the building is closed.', picnic: 'No verified formal picnic facility is published at the centre.', foodNote: 'Tindal’s Café is at nearby Walter Bower House on Eden Campus.' };

const tindals = upsert(feature(
  'curated-food:tindals-cafe-guardbridge',
  'Tindal’s Café',
  'cafe',
  [-2.8920266, 56.3643391],
  'A weekday café in Walter Bower House serving coffee, fresh locally sourced meals and light lunches to university users and visitors.',
  urls.tindals,
  [
    source('Tindal’s Café', 'University of St Andrews', urls.tindals, 'Official current page confirms visitor welcome, Monday-Friday 08:30-16:30 opening, coffee and lunch service.'),
    source('Tindal’s Café visitor details', 'University of St Andrews', urls.tindals, 'Current-place curation: visit_score=72; opening_hours:description=Monday–Friday 08:30–16:30; price_band=££; cuisine=coffee_light_lunch; description=Weekday campus café. Coffee and fresh locally sourced meals for staff, students and visitors.'),
  ],
  ['service-context-food', 'visitor-context-food'],
));
tindals.editorialReview = {
  status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
  scoreRationale: 'A useful, officially visitor-welcoming coffee and light-lunch stop with dependable weekday hours; campus setting and weekend closure limit destination appeal.',
  evidenceUrls: [urls.tindals],
  foodAssessment: { foodAndDrinkQuality: 20, daytimeRelevance: 18, distinctiveness: 7, consistency: 10, visitorFit: 8, evidenceConfidence: 9 },
};

const highlights: VisitorHighlight[] = [
  {
    rank: 1, featureId: mill.id, name: mill.name,
    reason: 'The new working distillery is a substantial bookable experience with tours, tastings and estuary views.', visitorScore: 89,
    tagline: 'Working distillery and tastings', timeToSpend: '1–2 hours', openingTimes: 'Tours daily from 11:00; advance booking recommended.',
    admission: 'Classic whisky tour £26; other experiences vary.', visitorWebsiteUrl: urls.edenMill,
    sourceName: 'Welcome to Fife and Eden Mill', sourceUrl: urls.edenMill, verifiedInBoundaryAt: reviewedDate, editorialReview: mill.editorialReview,
  },
  {
    rank: 2, featureId: centre.id, name: centre.name,
    reason: 'The Eden Estuary provides Guardbridge’s wildlife setting and a quiet outdoor viewing stop.', visitorScore: 75,
    tagline: 'Estuary birds and outdoor viewing', timeToSpend: '45–120 minutes',
    openingTimes: 'Outdoor viewing remains accessible; indoor centre closed for repairs at the July 2026 update.', admission: 'Free outdoor viewing.', freeAdmission: true,
    visitorWebsiteUrl: urls.centre, sourceName: 'Fife Coast and Countryside Trust', sourceUrl: urls.centre, verifiedInBoundaryAt: reviewedDate, editorialReview: centre.editorialReview,
  },
];
pkg.project.visitorHighlights = highlights;
pkg.project.touristAppeal = {
  score: 68, dogOwnerScore: 60, dogAccessScoreAdjustment: -8, rating: 1, label: 'Notable Stop',
  summary: 'Guardbridge now has two independently worthwhile experiences—the new Eden Mill visitor centre and the Eden Estuary viewpoint—plus a genuine daytime café and excellent bus access. Sparse public facilities and the reserve-centre closure keep it below a broader destination score.',
  dogAccessRating: 1, dogAccessSummary: 'The estuary is highly wildlife-sensitive, the distillery has no reliable general pet policy and Tindal’s indoor policy is unconfirmed.',
  methodVersion: '2026-09-01-full-settlement-visitor-audit-v2', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Eden crossing, modern distillery and wetland edge', headline: 'Distillery experiences beside an important estuary',
  intro: 'Guardbridge combines the new Eden Mill visitor centre with wildlife viewing across the Eden and a useful weekday café. The village is now a notable focused stop rather than merely a reserve access point.',
  bestFor: ['Gin and whisky tours', 'Birdwatching', 'Estuary views'], perfectFor: ['A booked distillery tour combined with a quiet wildlife stop'],
  suggestedFirstVisit: { title: 'Distillery and estuary', summary: 'Book the distillery, follow its parking or bus guidance, then check the latest reserve-centre notice before using the outdoor viewing area.' },
  dontMiss: ['Eden Mill Distillery and Visitor Centre', 'Eden Estuary outdoor viewing area'], suggestedTime: '3–5 hours',
  visitorMood: 'Modern Fife food-and-drink craft beside a sensitive historic river crossing.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
planner.reviewedAt = reviewedDate;
planner.projects[pkg.project.id] = { eat: [tindals.id], trails: [], parking: [], toilets: [], picnic: [] };
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
dog.reviewedAt = reviewedDate;
dog.projects[pkg.project.id] = {
  attraction: {
    [mill.id]: { rating: 1, status: 'unconfirmed', label: 'General pet policy unconfirmed', summary: 'A reliable current general pet-admission policy is not published; assistance requirements should be confirmed directly.', sourceName: 'Eden Mill', sourceUrl: urls.edenMillVisit, reviewedAt: reviewedDate },
    [centre.id]: { rating: 1, status: 'restricted', label: 'Highly wildlife-sensitive', summary: 'Keep dogs very close and avoid disturbing feeding or roosting birds; indoor-centre access is not currently available.', sourceName: 'Fife Coast and Countryside Trust and Scottish Outdoor Access Code', sourceUrl: urls.dog, reviewedAt: reviewedDate },
  },
  eat: {
    [tindals.id]: { rating: 1, status: 'unconfirmed', label: 'Indoor dog policy unconfirmed', summary: 'A reliable current indoor dog policy is not published by the university café; confirm before relying on access.', sourceName: 'University of St Andrews', sourceUrl: urls.tindals, reviewedAt: reviewedDate },
  },
};
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);

const integrity = JSON.parse(await readFile(resolve('data/review/guardbridge-hes-integrity-2026-08-31.json'), 'utf8')) as any;
if (integrity.missingStatutoryDesignations || integrity.undatedVisiblePins) throw new Error('Guardbridge HES integrity gate failed.');
pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((issue) => issue.severity === 'error');
if (errors.length) throw new Error(`Guardbridge validation failed with ${errors.length} errors.`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);

await writeFile(reportPath, `${JSON.stringify({
  reviewedAt, place: 'Guardbridge', townScore: 68, mapPublished: true,
  categories: {
    see: { audited: true, published: 2, liveStatus: 'Eden Mill open; Eden Estuary indoor centre closed for repairs while outdoor viewing remains accessible.' },
    eat: { audited: true, published: 1, rejected: ['Guardbridge Inn and the Eden Mill Lookout are bar/meal-led rather than café-led daytime entries.'] },
    trails: { audited: true, published: 0, providerChecks: { TreasureTrails: 'No live Guardbridge product', CuriousAbout: 'No Guardbridge route', MysteryGuides: 'No Guardbridge route', GoQuestAdventures: 'No Guardbridge route', officialRoutes: 'The council green-network review was checked; no maintained place-specific circular visitor route is published.' } },
    picnic: { audited: true, published: 0 },
    parking: { audited: true, published: 0, reason: 'Eden Mill parking is for customers and the small reserve parking is tied to that visit; neither is represented as general public village parking.' },
    toilets: { audited: true, published: 0, reason: 'No council public toilet is listed; venue toilets are not represented as public facilities.' },
    accessibility: { audited: true, note: 'Eden Mill states full lift access and disabled bays; the reserve-centre indoor closure is retained.' },
    transport: { audited: true, note: 'The operator confirms frequent bus access from St Andrews and Leuchars connections.' },
    dogs: { audited: true, adjustment: -8 },
  },
  exclusions: ['Customer-only university and distillery facilities are not presented as general public village services.', 'Guardbridge Inn and The Lookout are excluded from the café-led Eat category.', 'St Andrews and Leuchars services are not borrowed.'],
  hes: { assigned: integrity.statutoryDesignationsAssigned, visibleDated: integrity.visibleHesPins, hiddenUndated: integrity.statutoryDesignationsAssigned - integrity.visibleHesPins, visibleUndated: integrity.undatedVisiblePins, missing: integrity.missingStatutoryDesignations },
  boundaryRule: 'Eden Mill, Tindal’s and the estuary viewpoint are physically inside the Guardbridge visitor boundary; nearby St Andrews assets are excluded.',
  research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: [
    { url: urls.edenMill, checkedAt: reviewedDate, outcome: 'verified', note: 'Official destination page confirms the visitor centre opened in September 2025.' },
    { url: urls.edenMillTour, checkedAt: reviewedDate, outcome: 'verified', note: 'Operator page confirms the working-distillery tour and £26 price.' },
    { url: urls.edenMillVisit, checkedAt: reviewedDate, outcome: 'verified', note: 'Operator FAQ confirms hours, parking, public transport and accessibility.' },
    { url: urls.tindals, checkedAt: reviewedDate, outcome: 'verified', note: 'University page confirms visitor welcome, weekday hours, coffee and lunches.' },
    { url: urls.centre, checkedAt: reviewedDate, outcome: 'verified', note: 'July 2026 trust update confirms the indoor closure and outdoor access.' },
  ] },
  certification: { publicationCountsReconciled: false, liveBrowserVerifiedAt: null },
}, null, 2)}\n`);

console.log('Guardbridge re-audit complete: score 68; 2 See, 1 Eat, 0 Trails, 0 Picnic, 0 general Parking, 0 public Toilets; HES gate passed.');
