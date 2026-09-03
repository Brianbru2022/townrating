import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-09-01';
const reviewedAt = '2026-09-01T13:10:00.000Z';
const projectId = 'rhynd-fife-scotland';
const projectPath = resolve('data/projects/rhynd-fife.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const reportPath = resolve('data/review/rhynd-fife-full-visitor-audit-2026-09-01.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;

const urls = {
  cafe: 'https://www.therhynd.com/caf%C3%A9',
  latest: 'https://www.therhynd.com/post/july-at-the-rhynd-1',
  treasure: 'https://www.treasuretrails.co.uk/collections/fife',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  quest: 'https://goquestadventures.com/',
  toilets: 'https://www.fife.gov.uk/facilities/public-toilet',
};

const source = (sourceName: string, sourceOrganisation: string, sourceUrl: string, notes: string, reliability: any = 'official_non_statutory') => ({
  sourceName,
  sourceOrganisation,
  sourceUrl,
  accessedAt: reviewedAt,
  licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
  reliability,
  notes,
});
const upsert = (feature: HeritageFeature) => {
  pkg.features = pkg.features.filter((item) => item.id !== feature.id).concat(feature);
  return feature;
};

const cafe = upsert({
  id: 'curated-food:rhynd-cafe', projectId, name: 'The Rhynd Café', alternativeNames: [],
  countryCode: 'GB-SCT', region: 'Fife', locality: 'Rhynd', featureType: 'cafe', significance: 'regional',
  geometry: { type: 'Point', coordinates: [-2.8663718, 56.4038228] }, locationType: 'exact', locationConfidence: 'high',
  dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
  shortDescription: 'Current-place curation: visit_score=85; opening_hours:description=Friday–Sunday 09:00–17:00; price_band=££; cuisine=coffee_bakes_seasonal_light_lunch; description=Seasonal farm café. Locally sourced cooking, coffee and bakes in a motorsport-themed farm venue.',
  visitorWebsiteUrl: urls.cafe,
  sourceRecords: [
    source('The Rhynd Café', 'The Rhynd', urls.cafe, 'Official current hours, seasonal menu, local-supplier focus and venue address.'),
    source('July at The Rhynd', 'The Rhynd', urls.latest, 'Current update confirms Friday–Sunday operation and booking guidance.'),
    source('Rhynd current-place curation', 'Heat Map editorial audit', urls.cafe, 'Current-place curation: visit_score=85; opening_hours:description=Friday–Sunday 09:00–17:00; price_band=££; cuisine=coffee_bakes_seasonal_light_lunch; description=Seasonal farm café. Locally sourced cooking, coffee and bakes in a motorsport-themed farm venue.'),
  ],
  tags: ['current-context', 'service-context-food', 'visitor-context-food'], createdAt: reviewedAt, updatedAt: reviewedAt,
  reviewed: true, evidenceScope: 'parish_evidence',
  editorialReview: {
    status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: 'A strong, distinctive farm-café destination with seasonal local food and bakes; reduced for three-day opening and a more substantial lunch emphasis than a pure coffee stop.',
    evidenceUrls: [urls.cafe, urls.latest],
    foodAssessment: { foodAndDrinkQuality: 26, daytimeRelevance: 18, distinctiveness: 15, consistency: 11, visitorFit: 9, evidenceConfidence: 6 },
  },
} as any);

const parking = upsert({
  id: 'curated-parking:rhynd-cafe', projectId, name: 'The Rhynd Café Visitor Parking', alternativeNames: [],
  countryCode: 'GB-SCT', region: 'Fife', locality: 'Rhynd', featureType: 'parking', significance: 'local',
  geometry: { type: 'Point', coordinates: [-2.8660, 56.40395] }, locationType: 'exact', locationConfidence: 'medium',
  dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
  shortDescription: 'On-site customer parking for The Rhynd; public town parking, capacity, accessible bays and tariff are not claimed.', visitorWebsiteUrl: urls.cafe,
  sourceRecords: [
    source('The Rhynd visitor location', 'The Rhynd', urls.cafe, 'Venue address and visitor-booking evidence.'),
    source('Mapped venue parking', 'OpenStreetMap contributors', 'https://www.openstreetmap.org/way/1314181369', 'Exact venue-parking geometry; used only as venue parking, not public town parking.', 'discovery_only'),
  ],
  tags: ['current-context', 'service-context-parking', 'visitor-context-parking'], createdAt: reviewedAt, updatedAt: reviewedAt,
  reviewed: true, evidenceScope: 'parish_evidence',
} as any);

pkg.project.visitorHighlights = [];
pkg.project.touristAppeal = {
  score: 36, dogOwnerScore: 34, dogAccessScoreAdjustment: -2, rating: 0, label: 'Limited Visitor Interest',
  summary: 'Rhynd is a rural farm locality rather than a visitor settlement. Its excellent café is correctly available under Eat, but that business alone does not justify a town marker.',
  dogAccessRating: 1,
  dogAccessSummary: 'A reliable current indoor dog policy is not published; general rural access also requires livestock care.',
  methodVersion: '2026-09-01-full-settlement-visitor-audit-v2', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Rural farm locality', headline: 'A destination café, not a visitor village',
  intro: 'The Rhynd is worth knowing for its seasonal farm café, while the locality itself has no independently verified attractions, named trails or public facilities.',
  bestFor: ['A booked farm-café stop'], perfectFor: ['Visitors planning around Friday–Sunday opening'],
  suggestedFirstVisit: { title: 'Book the café', summary: 'Treat The Rhynd as a food stop and do not transfer Leuchars, Tayport or Tentsmuir attractions into the locality score.' },
  dontMiss: [], suggestedTime: '60–120 minutes for the café', visitorMood: 'Selector-only, with its one strong business correctly represented in Eat.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
planner.reviewedAt = reviewedDate;
planner.projects[projectId] = { eat: [cafe.id], trails: [], parking: [parking.id], toilets: [], picnic: [] };
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = { attraction: {}, eat: { [cafe.id]: {
  rating: 1, status: 'unconfirmed', label: 'Indoor dog policy unconfirmed',
  summary: 'A reliable current indoor dog policy is not published; confirm before relying on indoor access.',
  sourceName: 'The Rhynd', sourceUrl: urls.cafe, reviewedAt: reviewedDate,
} } };
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);

const hes = JSON.parse(await readFile(resolve('data/review/rhynd-fife-hes-integrity-2026-08-31.json'), 'utf8')) as any;
if (hes.missingStatutoryDesignations || hes.undatedVisiblePins) throw new Error('Rhynd HES gate failed');
pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.some((item) => item.severity === 'error')) throw new Error('Rhynd validation failed');
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  reviewedAt, place: 'Rhynd', townScore: 36, mapPublished: false,
  categories: {
    see: { audited: true, published: 0 }, eat: { audited: true, published: 1 },
    trails: { audited: true, published: 0, providerChecks: { TreasureTrails: 'No live Rhynd product', CuriousAbout: 'No Rhynd route', MysteryGuides: 'No Rhynd route', GoQuestAdventures: 'No Rhynd route', WalkFife: 'No maintained place-specific Rhynd visitor route verified' } },
    picnic: { audited: true, published: 0 }, parking: { audited: true, published: 1, scope: 'Venue customers only' }, toilets: { audited: true, published: 0 },
    accessibility: { audited: true, withheld: 'No current operator specification' }, transport: { audited: true }, dogs: { audited: true, adjustment: -2 },
  },
  hes: { assigned: hes.statutoryDesignationsAssigned, visibleDated: hes.visibleHesPins, visibleUndated: hes.undatedVisiblePins, missing: hes.missingStatutoryDesignations },
  boundaryRule: 'The café is represented in Eat but does not create a visitor-town score.',
  research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: [
    { url: urls.cafe, checkedAt: reviewedDate, outcome: 'verified', note: 'Operator page verifies the café, current weekend hours, local food, coffee and bakes.' },
    { url: urls.treasure, checkedAt: reviewedDate, outcome: 'no_result', note: 'No named Rhynd trail product was found.' },
    { url: urls.toilets, checkedAt: reviewedDate, outcome: 'no_result', note: 'No public Rhynd toilet is listed.' },
  ] },
  certification: { publicationCountsReconciled: false, liveBrowserVerifiedAt: null },
}, null, 2)}\n`);
console.log('Rhynd re-audit complete: score 36; 0 See, 1 Eat, 0 Trails, 0 Picnic, 1 venue Parking, 0 Toilets; HES gate passed.');
