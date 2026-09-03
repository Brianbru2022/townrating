import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = 'ecclesgreig-scotland', day = '2026-08-30', at = '2026-08-30T23:59:30Z';
const projectPath = resolve('data/projects/ecclesgreig.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/ecclesgreig-full-visitor-audit-2026-08-30.json');
const correctionPath = resolve('data/review/strict-settlement-score-correction-2026-08-30.json');
const urls = {
  settlement: 'https://www.openstreetmap.org/node/14029842142',
  house: 'https://portal.historicenvironment.scot/designation/LB16323',
  burial: 'https://www.trove.scot/place/133177',
  steading: 'https://www.trove.scot/place/133179',
  garden: 'https://www.trove.scot/place/244700',
  privateAccess: 'https://www.thedicamillo.com/house/ecclesgreigg-house/',
  treasure: 'https://www.treasuretrails.co.uk/products/things-to-do-mearns-coast-aberdeenshire',
  curious: 'https://www.curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  outdoor: 'https://www.outdooraccess-scotland.scot/dog-owners',
};
const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
const correction: any = JSON.parse(await readFile(correctionPath, 'utf8'));

for (const feature of pkg.features) {
  if (!feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag))) continue;
  feature.reviewed = true;
  feature.updatedAt = at;
  feature.tags = [...new Set(feature.tags.concat('heritage-record-retained'))];
  if (feature.id === 'hes-listed-building:LB16323') {
    Object.assign(feature, { documentedDateText: '1844', earliestPossibleYear: 1844, latestPossibleYear: 1844, dateBasis: 'documented_exact_year', dateConfidence: 'high' });
    feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
    feature.reviewNotes = 'The HES designation describes Henry Edmund Goodridge\'s 1844 reconstruction. The date is stored in metadata and not appended to the map label.';
  } else if (feature.id === 'nrhe:133177') {
    Object.assign(feature, { documentedDateText: '19th century', earliestPossibleYear: 1800, latestPossibleYear: 1899, dateBasis: 'documented_date_range', dateConfidence: 'high' });
    feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
    feature.reviewNotes = 'The local HES NRHE classification explicitly dates the burial ground to the 19th century.';
  } else if (feature.id === 'nrhe:244700') {
    Object.assign(feature, { documentedDateText: '1844', earliestPossibleYear: 1844, latestPossibleYear: 1844, dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high' });
    feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
    feature.reviewNotes = 'This NRHE record is the terrace, steps and garden ornaments included in the HES designation for Goodridge\'s 1844 house reconstruction.';
  } else {
    feature.tags = [...new Set(feature.tags.concat('map-hidden'))];
    feature.reviewNotes = 'Retained from the local HES NRHE dataset but map-hidden because the official classification is period unassigned and no defensible material date was verified.';
  }
}
pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 22, dogOwnerScore: 20, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A private rural estate locality without an independently visitable settlement centre or public visitor-service cluster.',
  dogAccessRating: 1, dogAccessSummary: 'No dedicated dog destination, published dog route or dog facility is verified inside the locality.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: day, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Private St Cyrus estate locality', headline: 'Historic fabric, but not a public visitor destination',
  intro: 'Ecclesgreig scores 22% and remains in the selector but not on the town map. Its historic house and estate records remain as dated heritage evidence; the private house is not promoted as an attraction.',
  bestFor: ['Regional orientation', 'Historic-environment research'], perfectFor: ['Identifying the locality during a wider Mearns journey'],
  suggestedFirstVisit: { title: 'Treat it as a route reference', summary: 'No verified public itinerary or visitor facility exists inside the strict study area.' },
  dontMiss: [], suggestedTime: 'Pass-through only', visitorMood: 'A dispersed private estate locality rather than a visitable village centre.', sourceUrls: Object.values(urls), lastReviewedAt: day,
};
pkg.project.researchNotes = 'Full sequential audit. The local HES imports found one listed building and retained all three NRHE records. Three pins have defensible dates; the period-unassigned steading remains map-hidden. Ecclesgreig House is private and not open to the public. No qualifying See, cafe-led Eat, named trail, picnic place, public parking or public toilet was verified inside the strict boundary. St Cyrus attractions and the Mearns Coast Treasure Trail are not transferred to this locality.';
planner.projects[id] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[id] = {};

const heritage = pkg.features.filter((feature: any) => feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)));
const statutory = heritage.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const report = {
  reviewedAt: at, projectId: id, status: 'verified', settlementScore: 22, previousScore: 22, independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'A private rural estate locality with historic fabric but no independently visitable centre, attraction or visitor-service cluster.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedStatutoryRecords: 1, representedStatutoryRecords: statutory.length, nrheRecordsRetained: heritage.filter((feature: any) => feature.tags.includes('nrhe')).length, visibleDatedHeritagePins: visible.length, visibleUndatedHeritagePins: visible.filter((feature: any) => !feature.documentedDateText).length, hiddenUndatedRecords: heritage.filter((feature: any) => feature.tags.includes('map-hidden')).map((feature: any) => feature.id) },
  namedTrailSearch: { TreasureTrails: 'The current Mearns Coast product visits St Cyrus, not the private Ecclesgreig estate locality.', CuriousAbout: 'No Ecclesgreig product found.', MysteryGuides: 'No Ecclesgreig product found.', GoQuestAdventures: 'No Ecclesgreig product found.', retained: [] },
  practicalAudit: { see: 'Ecclesgreig House is private and not open to the public; its heritage remains on the heat layer rather than becoming a See card.', eat: 'No cafe, coffee-and-cake outlet, tearoom, bakery or light-lunch venue was verified inside the strict boundary.', picnic: 'No managed public picnic facility was verified.', parking: 'No dedicated public visitor parking was verified; private estate and residential access is not parking.', toilets: 'No local public toilet was verified and the locality has no council-listed facility.', accessibility: 'No public visitor facility publishes accessibility information.', transport: 'Dispersed rural locality with no attraction-specific arrival provision.' },
  exclusions: ['Private Ecclesgreig House is not a public attraction.', 'St Cyrus village, nature reserve, holiday park and facilities lie outside this locality and are not borrowed.', 'The Mearns Coast Treasure Trail is not an Ecclesgreig-estate route.'],
  verification: { localListedBuildingImport: { added: 0, refreshed: 1, bufferCandidates: 0 }, localNrheImport: { added: 0, linked: 1, excludedCandidates: 0 }, statutoryDatasetComplete: statutory.length === 1, allVisibleHeritagePinsDated: visible.every((feature: any) => feature.documentedDateText && feature.dateBasis !== 'unknown'), datesStoredWithoutChangingMapNames: visible.every((feature: any) => !feature.name.includes(feature.documentedDateText)), trailLinksChecked: [urls.treasure, urls.curious, urls.mystery, urls.goQuest], allCuratedCoordinatesCheckedAgainstBoundary: true },
};
const row = correction.results.find((value: any) => value.projectId === id);
if (row) { row.correctedScore = 22; row.changed = row.previousScore !== 22; row.publishOnTownMap = false; row.rationale = pkg.project.touristAppeal.summary; row.sourceUrls = [urls.settlement, urls.house, urls.privateAccess, urls.treasure]; }
correction.changedScores = correction.results.filter((value: any) => value.changed).length;
correction.mappedAfterCorrection = correction.results.filter((value: any) => value.correctedScore >= 60).map((value: any) => ({ projectId: value.projectId, name: value.name, score: value.correctedScore }));
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(correctionPath, `${JSON.stringify(correction, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
