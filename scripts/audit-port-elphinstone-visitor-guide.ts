import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const id = 'port-elphinstone-scotland';
const day = '2026-09-02';
const at = '2026-09-02T10:25:00Z';
const projectPath = resolve('data/projects/port-elphinstone.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/port-elphinstone-full-visitor-audit-2026-09-02.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };
const urls = {
  walk: 'https://www.aberdeenshire.gov.uk/media/15820/inverurie-walking.pdf',
  openSpace: 'https://aberdeenshire.gov.uk/media/6174/portelphinstone.pdf',
  canalHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB18882',
  hes: 'https://portal.historicenvironment.scot/designation/LB35408',
  recycling: 'https://www.aberdeenshire.gov.uk/waste/recycling/recycling-point/',
  treasure: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curious: 'https://curiousabout.co.uk/', mystery: 'https://www.mysteryguides.co.uk/pages/scotland', goQuest: 'https://goquestadventures.com/',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: at, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });
const canalPoint = [-2.369649645526458, 57.27353965217982];
const attraction: F = {
  id: 'curated-attraction:port-elphinstone-canal-remains', projectId: id, name: 'Aberdeenshire Canal Remains and Sluice Bridges', alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Port Elphinstone', featureType: 'canal', significance: 'regional',
  geometry: { type: 'Point', coordinates: canalPoint }, locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
  shortDescription: 'The surviving terminus-side canal channel and listed 1796 sluice bridges, interpreted on the council’s mapped local walk.', visitorWebsiteUrl: urls.walk,
  attractionGuide: { headline: 'Follow the surviving end of the Aberdeen–Inverurie canal', intro: 'Port Elphinstone preserves canal fabric and a waterside path from the transport scheme that gave the settlement its name.', bestFor: ['Canal history', 'A short local walk'], parking: 'Davidson Park is evidenced as an open space and recycling location, but no dependable public visitor-car-park specification was found.', toilets: 'No public toilet was verified inside Port Elphinstone.', picnic: 'No formal picnic tables or dedicated picnic site were verified.' },
  editorialReview: { status: 'editorially_researched', category: 'attraction', methodVersion: '2026-09-02-researched-visitor-value-v1', reviewedAt: day, scoreRationale: 'A coherent local transport-history stop with surviving fabric and an official route, but modest interpretation and limited practical facilities.', evidenceUrls: [urls.walk, urls.canalHer, urls.hes], visitability: 'substantial_visible_remains', attractionAssessment: { experienceDepth: 14, distinctiveness: 15, presentation: 9, journeyWorth: 8, accessAndReliability: 11, evidenceConfidence: 6, visitability: 'substantial_visible_remains' } },
  sourceRecords: [source('Inverurie and Port Elphinstone walking map', 'Aberdeenshire Council', urls.walk, 'Official map verifies the 2.8 km route and canal history.', 'local_authority'), source('Canal, Port Elphinstone MAB18882', 'Aberdeenshire Council Historic Environment Record', urls.canalHer, 'Council HER identifies the 19th-century canal remains.', 'local_authority'), source('Sluice Bridges LB35408', 'Historic Environment Scotland', urls.hes, 'Official statutory record.', 'official_statutory')],
  tags: ['curated-visitor', 'home-standalone-place', 'current-context'], createdAt: at, updatedAt: at, reviewed: true, evidenceScope: 'parish_evidence',
};
const trail = pkg.features.find((feature) => feature.id === 'curated-trails:port-elphinstone-walking-loop');
if (!trail) throw new Error('Missing Port Elphinstone walking loop');
trail.name = 'Port Elphinstone Canal and Riverside Walk';
trail.shortDescription = 'An official 2.8 km circuit linking the settlement, surviving canal and riverside paths.';
trail.visitorWebsiteUrl = urls.walk;
trail.updatedAt = at;
trail.editorialReview = { status: 'editorially_researched', category: 'trail', methodVersion: '2026-09-02-researched-visitor-value-v1', reviewedAt: day, scoreRationale: 'An exact council-mapped 2.8 km Port Elphinstone route with useful heritage context; reduced because no duration, accessibility or current surface assessment is published.', evidenceUrls: [urls.walk], attractionAssessment: { experienceDepth: 16, distinctiveness: 12, presentation: 13, journeyWorth: 8, accessAndReliability: 10, evidenceConfidence: 6, visitability: 'full_visitor_experience' } };
pkg.features = [...pkg.features.filter((feature) => feature.id !== attraction.id), attraction];
const highlight: VisitorHighlight = { rank: 1, featureId: attraction.id, name: attraction.name, reason: attraction.editorialReview.scoreRationale, tagline: 'Canal terminus story and listed sluices', visitorScore: 60, timeToSpend: '45–90 minutes with the local circuit', openingTimes: 'Open-air route; check local path conditions', admission: 'Free', freeAdmission: true, visitorWebsiteUrl: urls.walk, editorialReview: attraction.editorialReview, sourceName: 'Aberdeenshire Council walking map', sourceUrl: urls.walk, verifiedInBoundaryAt: day };
pkg.project.preferredBasemap = 'voyager';
pkg.project.boundarySource = 'Strict Port Elphinstone settlement boundary; Inverurie centre, Garioch Heritage Centre and wider Inverurie services are excluded.';
pkg.project.boundaryConfidence = 'medium';
pkg.project.touristAppeal = { score: 54, dogOwnerScore: 53, dogAccessScoreAdjustment: -1, rating: 0, label: 'Limited Interest', summary: 'A pleasant 2.8 km canal-and-riverside circuit with surviving transport heritage and good open-space links, but no verified café, formal picnic site, dependable visitor car park or public toilet inside the settlement.', dogAccessRating: 2, dogAccessSummary: 'The outdoor circuit can suit responsible dog walking, with close control beside water, roads, wildlife and other users.', methodVersion: '2026-09-02-strict-settlement-full-audit-v3', reviewedAt: day, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = [highlight];
pkg.project.townGuide = { characterTag: 'Canal-side Inverurie neighbour', headline: 'A worthwhile short circuit, not a complete visitor town', intro: 'Port Elphinstone scores 54% after a full second pass. The canal remains, listed sluices and official 2.8 km loop justify a focused short stop, but Inverurie’s museum, cafés and practical facilities cannot be borrowed.', bestFor: ['Canal history', 'Short riverside walking'], perfectFor: ['A 45–90 minute local walk'], suggestedFirstVisit: { title: 'Use the official 2.8 km route', summary: 'Follow the mapped circuit through the settlement and canal-side green network.' }, dontMiss: ['Aberdeenshire Canal Remains and Sluice Bridges'], suggestedTime: '45–90 minutes', visitorMood: 'Green and locally interesting, with limited visitor infrastructure.', sourceUrls: Object.values(urls), lastReviewedAt: day };
pkg.project.researchNotes = 'Full current-web audit. All six visitor categories and four named clue-trail providers checked. Inverurie attractions and services were excluded. The single HES listed building is present, materially dated and named without appended date text.';
planner.projects[id] = { eat: [], trails: [trail.id], picnic: [], parking: [], toilets: [] };
dog.reviewedAt = day;
dog.projects[id] = { trail: { [trail.id]: { rating: 2, status: 'restricted', label: 'Outdoor waterside route', summary: 'Use a lead or reliable close control beside the canal, river, roads and wildlife.', sourceName: 'Scottish Outdoor Access Code', sourceUrl: urls.dogCode, reviewedAt: day } } };
pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const statutory = pkg.features.filter((feature) => feature.tags.includes('hes-listed-building'));
const visible = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
const undated = visible.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
if (undated.length) throw new Error(`Undated Port Elphinstone HES pins: ${undated.map((feature) => feature.id).join(', ')}`);
const report = {
  reviewedAt: at, projectId: id, place: 'Port Elphinstone', townScore: 54, mapPublished: false,
  categories: {
    see: { audited: true, published: 1 }, eat: { audited: true, published: 0, note: 'No café, coffee-and-cake, tearoom, bakery café or light-lunch stop verified inside the settlement.' },
    trails: { audited: true, published: 1, providerChecks: { TreasureTrails: 'Aberdeenshire catalogue checked; no Port Elphinstone product.', CuriousAbout: 'No exact route found.', MysteryGuides: 'Scotland catalogue checked; no exact product.', GoQuestAdventures: 'No exact quest found.', officialCouncilRoutes: 'Exact 2.8 km Port Elphinstone route verified in the council walking map.' } },
    picnic: { audited: true, published: 0, note: 'Open space does not prove formal picnic facilities.' }, parking: { audited: true, published: 0, note: 'Davidson Park is a council open space/recycling point, but no dependable visitor-parking specification was found.' }, toilets: { audited: true, published: 0, note: 'No public toilet verified.' },
  },
  hes: { assigned: statutory.length, visibleDated: visible.length - undated.length, hiddenUndated: statutory.length - visible.length, visibleUndated: undated.length, missing: 0 },
  boundaryRule: 'Inverurie centre, Garioch Heritage Centre and wider Inverurie café and parking provision are excluded.', research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: Object.values(urls).map((url) => ({ url, checkedAt: day, outcome: 'checked' })) },
  scoreReanalysis: { required: true, completed: true, previousScore: 58, resultScore: 54, rationale: 'The original 58 was an uncompleted gate score. The exact local route and canal fabric are real, but a full six-category audit found too little practical and independent visitor depth to retain 58.' },
  certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: null },
};
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Port Elphinstone audit complete: score 54; 1 See, 0 Eat, 1 Trail, 0 Picnic, 0 Parking, 0 Toilets; ${visible.length - undated.length}/${visible.length} visible HES pins dated.`);
