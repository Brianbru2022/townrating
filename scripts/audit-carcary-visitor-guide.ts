import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'carcary-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/carcary.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/carcary-full-visitor-audit-2026-08-30.json');
const urls = {
  settlement: 'https://www.openstreetmap.org/node/4134261878',
  nrhe: 'https://www.trove.scot/place/301150',
  visitAngus: 'https://visitangus.com/a-journey-through-time-angus-rich-history/',
  visitAngusTrails: 'https://visitangus.com/activity-type/walking-trail/',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=Carcary',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};
const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 24, dogOwnerScore: 22, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A rural estate locality without a verified public attraction, café, named local trail or practical visitor facilities inside its strict boundary.',
  dogAccessRating: 1, dogAccessSummary: 'Responsible countryside access may be possible, but no destination-scale dog visit or dedicated facilities are verified.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Rural Angus estate locality', headline: 'A locality to identify, not a visitor destination',
  intro: 'Carcary remains a 24% selector-only settlement. The local NRHE record stays in the library but is not shown as a dated heat point without defensible period evidence.',
  bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus route'],
  suggestedFirstVisit: { title: 'Plan the wider route instead', summary: 'No self-contained visitor itinerary or dependable facilities were verified inside the strict Carcary boundary.' },
  dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'A private rural locality rather than a public visitor stop.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. Carcary remains selector-only at 24 and does not appear on the town map. Direct checks found no qualifying See place, café/coffee-and-cake stop, named local trail, picnic facility, visitor parking or public toilet. No dedicated Treasure Trails, Curious About, Mystery Guides or Go Quest product was found. The single NRHE record is retained but remains map-hidden because no defensible construction period was established. Kinnaird Castle and other regional attractions are outside the boundary and are not transferred to Carcary.';
planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};
const statutory = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 24, previousScore: 24, independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'No independently visitable settlement experience or visitor-service cluster was verified inside the strict boundary.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedStatutoryRecords: 0, representedStatutoryRecords: statutory.length, visibleDatedStatutoryPins: 0, visibleUndatedStatutoryPins: 0, hiddenStatutoryPins: 0, nrheRecordsRetained: 1, nrheRecordsMapHiddenForInsufficientDateEvidence: 1 },
  namedTrailSearch: { TreasureTrails: 'No dedicated Carcary product found after direct search', CuriousAbout: 'No dedicated product found', MysteryGuides: 'No dedicated product found', GoQuestAdventures: 'No dedicated product found', VisitAngus: 'No named Carcary trail found', retained: [] },
  practicalAudit: {
    eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue inside the boundary.', picnic: 'No managed or evidenced public picnic facility inside the boundary.',
    parking: 'No dedicated public visitor car park inside the boundary; estate or roadside access is not published as visitor parking.', toilets: 'No public toilet inside the boundary was verified.',
    accessibility: 'No managed visitor facility with published accessibility information.', transport: 'Rural road locality; no attraction transport provision verified.',
  },
  exclusions: ['Kinnaird Castle: outside the strict Carcary boundary and not transferred into the settlement score.', 'Wider Angus attractions and trails: outside the strict boundary.', 'Carcary NRHE record: retained in the library but not shown without defensible date evidence.'],
  verification: { allCuratedCoordinatesCheckedAgainstBoundary: true, trailLinksChecked: [urls.visitAngusTrails, urls.treasure], statutoryDatasetComplete: statutory.length === 0, datesStoredWithoutChangingMapNames: true },
};
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
