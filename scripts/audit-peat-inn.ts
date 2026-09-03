import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-08-31';
const reviewedAt = '2026-08-31T23:50:00.000Z';
const projectPath = resolve('data/projects/peat-inn.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const trailUrl = 'https://www.thewayofstandrews.com/route/routes-and-photos/st-margarets-way/earlsferry-to-st-andrews/';
const restaurantUrl = 'https://www.thepeatinn.co.uk/about/';
const trailId = 'curated-trail:st-margarets-way-peat-inn';

pkg.features = pkg.features.filter((feature) => feature.id !== trailId);
const trail: HeritageFeature = {
  id: trailId,
  projectId: pkg.project.id,
  name: "St Margaret's Way through Peat Inn",
  alternativeNames: [],
  countryCode: 'GB-SCT',
  region: 'Fife',
  locality: 'Peat Inn',
  featureType: 'walking_route',
  significance: 'regional',
  geometry: { type: 'Point', coordinates: [-2.88388, 56.27742] },
  locationType: 'representative',
  locationConfidence: 'high',
  dateBasis: 'unknown',
  dateConfidence: 'unknown',
  survival: 'substantially_intact',
  shortDescription: "The official 26 km Earlsferry-to-St Andrews section of St Margaret's Way passes through Peat Inn; it is a demanding cross-boundary pilgrimage stage rather than a village circuit.",
  visitorWebsiteUrl: trailUrl,
  sourceRecords: [{
    sourceName: "St Margaret's Way: Earlsferry to St Andrews",
    sourceOrganisation: 'The Way of St Andrews',
    sourceUrl: trailUrl,
    accessedAt: reviewedAt,
    licence: 'Source-linked visitor evidence; verify live route notices before walking.',
    reliability: 'official_non_statutory',
    notes: 'Current-context curation: visitor_place_type=Walking trail; trail_score=72; time_to_spend=Allow about 10 hours for the full stage; opening_hours:description=Open route, subject to path and weather conditions; entrance_fee=Free; description=Pilgrimage stage: 26 km cross-boundary route via Peat Inn; website=https://www.thewayofstandrews.com/route/routes-and-photos/st-margarets-way/earlsferry-to-st-andrews/.',
  }],
  tags: ['current-context', 'service-context-trail', 'visitor-context-trail', 'cross-boundary-trail'],
  createdAt: reviewedAt,
  updatedAt: reviewedAt,
  reviewed: true,
  evidenceScope: 'parish_evidence',
  editorialReview: {
    status: 'editorially_researched',
    category: 'trail',
    methodVersion: '2026-08-13-researched-visitor-value-v1',
    reviewedAt: reviewedDate,
    scoreRationale: 'A source-backed pilgrimage stage with a meaningful route through Peat Inn, but far too long to function as a compact settlement trail.',
    evidenceUrls: [trailUrl],
    attractionAssessment: { experienceDepth: 23, distinctiveness: 13, presentation: 11, journeyWorth: 10, accessAndReliability: 9, evidenceConfidence: 6, visitability: 'full_visitor_experience' },
  },
};
pkg.features.push(trail);
pkg.project.visitorHighlights = [];
pkg.project.touristAppeal = {
  score: 45,
  dogOwnerScore: 43,
  dogAccessScoreAdjustment: -2,
  rating: 0,
  label: 'Limited Visitor Interest',
  summary: "A small rural settlement crossed by St Margaret's Way and dominated by a destination fine-dining restaurant. The restaurant is not recast as a café/light-lunch Eat and neither asset supplies enough settlement interest for Home-map publication.",
  dogAccessRating: 1,
  dogAccessSummary: 'The long pilgrimage route provides lawful outdoor access, with close control required around roads, farms and livestock; no dog-welcoming public venue was verified.',
  methodVersion: '2026-08-31-full-settlement-visitor-audit-v1',
  reviewedAt: reviewedDate,
  sourceUrls: [trailUrl, restaurantUrl, 'https://www.treasuretrails.co.uk/collections/fife', 'https://curiousabout.co.uk/', 'https://www.mysteryguides.co.uk/', 'https://goquestadventures.com/', 'https://www.fife.gov.uk/facilities/public-toilet'],
};
pkg.project.townGuide = {
  characterTag: 'Tiny rural settlement and pilgrimage pass-through',
  headline: 'A route waypoint, not a general visitor town',
  intro: "Peat Inn remains available in the Fife selector, but stays below 60. St Margaret's Way is published under Trails; the Michelin-starred restaurant is dinner-led fine dining and does not meet this guide's café, coffee-and-cake or light-lunch Eat brief.",
  bestFor: ['Pilgrimage route context'],
  perfectFor: ['Passing through on the signed long-distance route'],
  suggestedFirstVisit: { title: 'No dedicated town visit recommended', summary: 'Use the verified route link for the full-stage plan and do not rely on the settlement for public facilities.' },
  dontMiss: [],
  suggestedTime: 'Pass-through only',
  visitorMood: 'Quiet rural waypoint with no borrowed attraction value.',
  sourceUrls: [trailUrl, restaurantUrl],
  lastReviewedAt: reviewedDate,
};

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
planner.reviewedAt = reviewedDate;
planner.projects[pkg.project.id] = { eat: [], trails: [trailId], picnic: [], parking: [], toilets: [] };
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
dog.reviewedAt = reviewedDate;
dog.projects[pkg.project.id] = { attraction: { [trailId]: { rating: 2, status: 'restricted', label: 'Route access with close control', summary: 'Keep dogs under close control around livestock, farm operations and road sections on this long pilgrimage stage.', sourceName: 'Scottish Outdoor Access Code', sourceUrl: 'https://www.outdooraccess-scotland.scot/dog-owners', reviewedAt: reviewedDate } }, eat: {} };
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);

const hes = JSON.parse(await readFile(resolve('data/review/peat-inn-hes-integrity-2026-08-31.json'), 'utf8')) as any;
if (hes.missingStatutoryDesignations || hes.undatedVisiblePins) throw new Error('Peat Inn HES gate failed.');
pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.some((issue) => issue.severity === 'error')) throw new Error('Peat Inn validation failed.');
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(resolve('data/review/peat-inn-full-visitor-audit-2026-08-31.json'), `${JSON.stringify({
  reviewedAt, place: 'Peat Inn', townScore: 45, mapPublished: false,
  categories: {
    see: { audited: true, published: 0, rejected: ['The Peat Inn restaurant is hospitality, not an independently scored See attraction.'] },
    eat: { audited: true, published: 0, rejected: ['The Peat Inn is Michelin-starred destination fine dining with Friday/Saturday lunch and Tuesday–Saturday dinner; it is outside the café/light-lunch publication brief.'] },
    trails: { audited: true, published: 1, retained: ["St Margaret's Way through Peat Inn"], providerChecks: { TreasureTrails: 'Fife catalogue checked; no Peat Inn product', CuriousAbout: 'No Peat Inn route verified', MysteryGuides: 'No Peat Inn route verified', GoQuestAdventures: 'No Peat Inn route verified', officialRoutes: "St Margaret's Way direct section page verified" } },
    picnic: { audited: true, published: 0 }, parking: { audited: true, published: 0, note: 'Restaurant customer parking is not public visitor parking.' }, toilets: { audited: true, published: 0, note: 'Restaurant customer toilets are not public toilets.' },
    accessibility: { audited: true, note: 'The full route is long and includes rural surfaces; no settlement-wide accessible circuit is claimed.' }, transport: { audited: true, note: 'No dependable visitor-oriented public transport facility is published.' }, dogs: { audited: true, adjustment: -2 },
  },
  hes: { assigned: hes.statutoryDesignationsAssigned, visibleDated: hes.visibleHesPins, hiddenUndated: hes.statutoryDesignationsAssigned - hes.visibleHesPins, visibleUndated: hes.undatedVisiblePins, missing: hes.missingStatutoryDesignations },
  boundaryRule: 'Nearby St Andrews and East Neuk attractions and services do not contribute to Peat Inn.',
}, null, 2)}\n`);
console.log("Peat Inn full audit complete: score 45; 0 See, 0 Eat, 1 verified Trail, 0 Picnic, 0 Parking, 0 Toilets; four dated HES records.");
