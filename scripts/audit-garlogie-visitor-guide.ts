import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'garlogie-scotland';
const reviewedDate = '2026-09-02';
const reviewedAt = '2026-09-02T10:10:00Z';
const projectPath = resolve('data/projects/garlogie.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/garlogie-full-visitor-audit-2026-09-02.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };

const urls = {
  engine: 'https://www.garlogie-engine.org.uk/',
  visit: 'https://www.garlogie-engine.org.uk/visit--location.html',
  hes: 'https://portal.historicenvironment.scot/designation/LB16506',
  inn: 'https://www.garlogieinn.com/',
  highTea: 'https://garlogieinn.com/assets/garlogie-high-tea-menu.pdf',
  councilAssets: 'https://www.aberdeenshire.gov.uk/media/4i5fcwuk/council-asset-list.pdf',
  councilTrails: 'https://www.aberdeenshire.gov.uk/roads-and-travel/transportation/cycling/walking-and-cycling-routes/',
  treasure: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curious: 'https://curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/pages/scotland',
  goQuest: 'https://goquestadventures.com/',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({
  sourceName: name,
  sourceOrganisation: organisation,
  sourceUrl: url,
  accessedAt: reviewedAt,
  reliability,
  licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
  notes,
});

const listedBuilding: F = {
  id: 'hes-listed-building:LB16506', projectId, name: 'Garlogie Village Hall, Turbine and Engine House', alternativeNames: [],
  countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Garlogie', featureType: 'mill', designationType: 'Listed Building',
  designationCategory: 'Category A', statutoryStatus: 'Listed Building', significance: 'national',
  geometry: { type: 'Point', coordinates: [-2.3614246363239415, 57.139824728438434] }, locationType: 'building_centroid', locationConfidence: 'high',
  documentedDateText: 'Woollen-mill site established 1799; beam engine installed in the 1830s; turbine 1923; village hall remodelled 1931',
  earliestPossibleYear: 1799, latestPossibleYear: 1931, datePrecision: 'multi_phase', dateBasis: 'documented_date_range', dateConfidence: 'high',
  survival: 'substantially_intact', shortDescription: 'Category A industrial complex containing an in-situ 1830s beam engine and a 1923 hydro-electric turbine.',
  sourceRecords: [source('Garlogie Village Hall, Turbine and Engine House, LB16506', 'Historic Environment Scotland', urls.hes, 'Material dates come from the official listing description; the administrative listing date is not used.', 'official_statutory')],
  tags: ['hes-designation', 'hes-listed-building', 'date-reviewed', 'hes-date-reviewed', 'heritage-record-retained'], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
};

const attraction: F = {
  id: 'curated-attraction:garlogie-beam-engine', projectId, name: 'Garlogie Beam Engine and Turbine House', alternativeNames: [],
  countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Garlogie', featureType: 'mill', significance: 'national',
  geometry: listedBuilding.geometry, locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
  shortDescription: 'A rare surviving 1830s beam engine in its original engine house, opened on published monthly summer dates and Doors Open Day.',
  visitorWebsiteUrl: urls.visit,
  attractionGuide: {
    headline: 'See Scotland’s oldest steam engine still in its original location',
    intro: 'The trust presents an 1830s beam engine, an 1805 cast-iron beam and a 1920s hydro-electric turbine in the surviving Garlogie mill complex.',
    bestFor: ['Industrial archaeology', 'Steam and water power', 'A pre-planned short visit'],
    parking: 'No dependable dedicated visitor-parking details are published by the operator; confirm before travelling.',
    toilets: 'No public or visitor-toilet provision is published by the operator.',
    picnic: 'No formal picnic provision is published.',
    foodNote: 'Refreshments are advertised for Doors Open Day only; Garlogie Inn is a separate settlement Eat stop.',
  },
  editorialReview: {
    status: 'editorially_researched', category: 'attraction', methodVersion: '2026-09-02-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: 'Nationally unusual surviving machinery in its historic setting, reduced for a narrow programme of public opening days and incomplete practical information.', evidenceUrls: [urls.engine, urls.visit, urls.hes],
    visitability: 'full_visitor_experience', attractionAssessment: { experienceDepth: 20, distinctiveness: 20, presentation: 13, journeyWorth: 12, accessAndReliability: 7, evidenceConfidence: 5, visitability: 'full_visitor_experience' },
  },
  sourceRecords: [source('Garlogie Beam Engine Trust', 'Garlogie Beam Engine Trust', urls.engine, 'Official history and visitor significance.'), source('Visit and location', 'Garlogie Beam Engine Trust', urls.visit, 'Public opening days are 11:00–16:00 on the last Sunday from April to August, plus the September Doors Open event.'), source('LB16506', 'Historic Environment Scotland', urls.hes, 'Official statutory description.', 'official_statutory')],
  tags: ['curated-visitor', 'home-standalone-place', 'current-context'], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
};

const eat: F = {
  id: 'curated-eat:garlogie-inn', projectId, name: 'Garlogie Inn', alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Garlogie',
  featureType: 'commercial_building', significance: 'local', geometry: { type: 'Point', coordinates: [-2.348985, 57.139289] }, locationType: 'representative_point', locationConfidence: 'medium',
  dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: 'Family-run inn serving breakfast, a dedicated light-lunch menu, tea, coffee and home bakes alongside its full restaurant offer.',
  visitorWebsiteUrl: urls.inn,
  editorialReview: {
    status: 'editorially_researched', category: 'food', methodVersion: '2026-09-02-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: 'Included for the operator-verified breakfast and light-lunch offer rather than full-meal dining; the venue is useful but not a café-led destination.', evidenceUrls: [urls.inn, urls.highTea],
    foodAssessment: { foodAndDrinkQuality: 18, daytimeRelevance: 15, distinctiveness: 8, consistency: 11, visitorFit: 8, evidenceConfidence: 5 },
  },
  sourceRecords: [source('Garlogie Inn', 'Garlogie Inn', urls.inn, 'Operator page verifies breakfast 10:00–11:30, a light-lunch menu 11:30–16:00 and current food-service hours.'), source('Garlogie Inn High Tea menu', 'Garlogie Inn', urls.highTea, 'Tea or coffee and a home bake are bundled with weekday high tea; this is supporting evidence, not a café classification.')],
  tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
};

pkg.features = [...pkg.features.filter((feature) => !['hes-listed-building:LB16506', attraction.id, eat.id].includes(feature.id)), listedBuilding, attraction, eat];
const highlight: VisitorHighlight = {
  rank: 1, featureId: attraction.id, name: attraction.name, reason: attraction.editorialReview!.scoreRationale, tagline: 'Rare beam engine in its original mill', visitorScore: 77,
  timeToSpend: '45–75 minutes', openingTimes: 'Last Sunday monthly, April–August, 11:00–16:00; September Doors Open date 10:00–16:00', admission: 'Check operator event listing',
  visitorWebsiteUrl: urls.visit, editorialReview: attraction.editorialReview, sourceName: 'Garlogie Beam Engine Trust', sourceUrl: urls.visit, verifiedInBoundaryAt: reviewedDate,
};

pkg.project.preferredBasemap = 'voyager';
pkg.project.boundarySource = 'OpenStreetMap Garlogie settlement extent reviewed against the strict settlement-only scoring rule. The beam-engine complex remains a standalone See attraction and contributes no town-score points.';
pkg.project.boundaryConfidence = 'medium';
pkg.project.touristAppeal = {
  score: 46, dogOwnerScore: 44, dogAccessScoreAdjustment: -2, rating: 0, label: 'Limited Interest',
  summary: 'A small rural settlement with one useful daytime food stop. Its nationally unusual beam engine is correctly retained as a separately scored See attraction rather than used to make the settlement appear map-worthy.',
  dogAccessRating: 1, dogAccessSummary: 'No general dog policy was established for the indoor attraction or inn; public-road and rural access requires ordinary close control.',
  methodVersion: '2026-09-02-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.visitorHighlights = [highlight];
pkg.project.townGuide = {
  characterTag: 'Small mill village with one exceptional industrial survivor', headline: 'Plan for the beam engine, not for a rounded village day out',
  intro: 'Garlogie scores 46% as a settlement and remains selector-only. The beam engine is a worthwhile separately scored attraction, but its limited opening calendar, one daytime food stop and absence of verified trails, picnic facilities, visitor parking or public toilets do not create an independent town visit.',
  bestFor: ['Industrial-history specialists'], perfectFor: ['A pre-planned beam-engine open day'], suggestedFirstVisit: { title: 'Check the opening calendar first', summary: 'Public openings are limited to published summer Sundays and Doors Open Day.' },
  dontMiss: ['Garlogie Beam Engine and Turbine House'], suggestedTime: 'No general settlement visit; 45–75 minutes on an engine open day', visitorMood: 'Rural, dispersed and dependent on pre-planning.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full current-web audit completed. See attraction separated from town merit. Six visitor categories checked; no promoted Garlogie route, formal picnic provision, dependable visitor car park or public toilet was verified. The one Category A HES record is retained with a material multi-phase date and the date is not appended to its map name.';

planner.projects[projectId] = { eat: [eat.id], trails: [], picnic: [], parking: [], toilets: [] };
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: { [attraction.id]: { rating: 1, status: 'unconfirmed', label: 'Indoor policy unconfirmed', summary: 'No general pet policy is published; contact the trust before relying on indoor access.', sourceName: 'Garlogie Beam Engine visitor page', sourceUrl: urls.visit, reviewedAt: reviewedDate } },
  eat: { [eat.id]: { rating: 1, status: 'unconfirmed', label: 'Operator policy unconfirmed', summary: 'No dependable current indoor dog policy was found.', sourceName: 'Garlogie Inn', sourceUrl: urls.inn, reviewedAt: reviewedDate } },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const visibleHeritage = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building') && !feature.tags.includes('map-hidden'));
const undated = visibleHeritage.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
if (undated.length) throw new Error(`Undated Garlogie heritage pins: ${undated.map((feature) => feature.id).join(', ')}`);

const report = {
  reviewedAt, projectId, place: 'Garlogie', townScore: 46, mapPublished: false,
  categories: {
    see: { audited: true, published: 1, note: 'Standalone attraction; excluded from the settlement score.' },
    eat: { audited: true, published: 1, note: 'Included for operator-verified breakfast and light lunch, not full-meal dining.' },
    trails: { audited: true, published: 0, providerChecks: { TreasureTrails: 'Aberdeenshire catalogue checked; no Garlogie product.', CuriousAbout: 'No Garlogie route found.', MysteryGuides: 'Scotland catalogue checked; no Garlogie product.', GoQuestAdventures: 'No Garlogie quest found.', officialCouncilRoutes: 'Aberdeenshire walking/cycling and clue-trail material checked; no promoted Garlogie visitor route verified.' } },
    picnic: { audited: true, published: 0, note: 'No formal public picnic facility verified.' },
    parking: { audited: true, published: 0, note: 'Council ownership of the hall/museum does not prove dependable visitor parking; the operator publishes no parking details.' },
    toilets: { audited: true, published: 0, note: 'No public or attraction visitor toilet provision verified.' },
  },
  hes: { assigned: 1, visibleDated: 1, hiddenUndated: 0, visibleUndated: 0, missing: 0, dateRule: 'Material dates only; no designation date and no dates in map names.' },
  boundaryRule: 'The beam engine is retained as a separately scored See attraction and does not contribute to the settlement score. Westhill, Dunecht and wider Skene facilities are not borrowed.',
  research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: Object.values(urls).map((url) => ({ url, checkedAt: reviewedDate, outcome: 'checked' })) },
  scoreReanalysis: { required: true, completed: true, previousScore: 58, resultScore: 46, rationale: 'The exact 58 was an unfinished gate score. A complete second pass found one separately scored seasonal attraction and one daytime food stop but no rounded settlement offer, so the town falls to 46 and remains off the map.' },
  certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: null },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log('Garlogie full audit complete: score 46; 1 See, 1 Eat, 0 Trails, 0 Picnic, 0 Parking, 0 Toilets; 1/1 HES pin dated.');
