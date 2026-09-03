import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'caldhame-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/caldhame.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/caldhame-full-visitor-audit-2026-08-30.json');
const urls = {
  settlement: 'https://www.openstreetmap.org/node/3524633822',
  visitAngusTrails: 'https://visitangus.com/activity-type/walking-trail/',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=Caldhame',
  nrheBrugh: 'https://www.trove.scot/place/33566',
  nrheKingsmuir: 'https://www.trove.scot/place/33575',
  nrheBank: 'https://www.trove.scot/place/383426',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 26, dogOwnerScore: 24, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A small rural hamlet without a verified visitor attraction, café, named local trail or practical visitor facilities inside its strict boundary.',
  dogAccessRating: 1, dogAccessSummary: 'Responsible countryside access may be possible, but no destination-scale dog visit or dedicated facilities are verified.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Small rural Angus hamlet', headline: 'A route reference rather than a visitor destination',
  intro: 'Caldhame remains a 26% selector-only settlement. The local NRHE records remain in the library, but none has sufficient construction-period evidence to be shown as a dated historic heat point.',
  bestFor: ['Regional reference'], perfectFor: ['Identifying the hamlet while planning a wider Angus route'],
  suggestedFirstVisit: { title: 'Plan facilities elsewhere', summary: 'No self-contained visitor itinerary or dependable facilities were verified inside the strict Caldhame boundary.' },
  dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'A quiet rural hamlet with no verified public visitor offer.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. Caldhame remains selector-only at 26 and does not appear on the town map. Direct checks found no qualifying See place, café/coffee-and-cake stop, named local trail, picnic facility, visitor parking or public toilet. Visit Angus publishes no Caldhame trail, and no dedicated Treasure Trails, Curious About, Mystery Guides or Go Quest product was found. Three NRHE records are retained but remain map-hidden because the available local records do not establish defensible numeric construction periods; no HES listed building or scheduled monument is present in the package. Nearby regional attractions and facilities are not transferred to the hamlet.';
planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const statutory = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 26, previousScore: 26, independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'Limited rural identity, but no independently visitable settlement experience or visitor-service cluster inside the strict boundary.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedStatutoryRecords: 0, representedStatutoryRecords: statutory.length, visibleDatedStatutoryPins: 0, visibleUndatedStatutoryPins: 0, hiddenStatutoryPins: 0, nrheRecordsRetained: 3, nrheRecordsMapHiddenForInsufficientDateEvidence: 3 },
  namedTrailSearch: { TreasureTrails: 'No dedicated Caldhame product found after direct search', CuriousAbout: 'No dedicated product found', MysteryGuides: 'No dedicated product found', GoQuestAdventures: 'No dedicated product found', VisitAngus: 'No named Caldhame trail found', retained: [] },
  practicalAudit: {
    eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue inside the boundary.', picnic: 'No managed or evidenced public picnic facility inside the boundary.',
    parking: 'No dedicated public visitor car park inside the boundary; roadside or private access is not published as visitor parking.', toilets: 'No public toilet inside the boundary was verified.',
    accessibility: 'No managed visitor facility with published accessibility information.', transport: 'Rural road hamlet; no attraction transport provision verified.',
  },
  exclusions: ['Nearby Angus attractions: outside the strict settlement boundary.', 'General countryside roads and paths: not published as a named visitor trail.', 'Three NRHE records: retained in the library but not shown without defensible date evidence.'],
  verification: { allCuratedCoordinatesCheckedAgainstBoundary: true, trailLinksChecked: [urls.visitAngusTrails, urls.treasure], statutoryDatasetComplete: statutory.length === 0, datesStoredWithoutChangingMapNames: true },
};
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
