import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'dykelands-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/dykelands.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/dykelands-full-visitor-audit-2026-08-30.json');
const correctionPath = resolve('data/review/strict-settlement-score-correction-2026-08-30.json');

const urls = {
  settlement: 'https://www.openstreetmap.org/node/12152154252',
  nrheRingDitch: 'https://www.trove.scot/place/152700',
  nrheRig: 'https://www.trove.scot/place/350828',
  nrheEvent: 'https://www.trove.scot/place/347823',
  hesLibrary: 'data/reference/SCOTLAND_HES_LIBRARY.md',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  treasure: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curious: 'https://www.curiousabout.co.uk/aberdeen.html',
  mystery: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
const correction: any = JSON.parse(await readFile(correctionPath, 'utf8'));

// Remove records injected by the generic polygon importer, which currently
// defaults to Alloa rather than honouring this project's path argument.
const rejectedOutOfAreaIds = [
  'hes-conservation-area:CA506',
  'hes-conservation-area:CA507',
  'hes-scheduled-monument:SM3746',
  'hes-scheduled-monument:SM625',
];
pkg.features = pkg.features.filter((feature: any) => !rejectedOutOfAreaIds.includes(feature.id));

for (const feature of pkg.features) {
  if (!feature.tags.includes('nrhe')) continue;
  feature.tags = [...new Set(feature.tags.concat('heritage-record-retained'))];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  if (feature.id === 'nrhe:350828') {
    feature.documentedDateText = 'Medieval to post-medieval';
    feature.earliestPossibleYear = 1100;
    feature.latestPossibleYear = 1900;
    feature.dateBasis = 'estimated_from_authoritative_source';
    feature.dateConfidence = 'medium';
    feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
    feature.reviewNotes = 'The local HES NRHE classification explicitly identifies medieval to post-medieval rig and furrow. The broad material period is shown without claiming an exact year; the map name remains unchanged.';
  } else {
    feature.tags = [...new Set(feature.tags.concat('map-hidden'))];
    feature.reviewNotes = 'Retained from the local HES NRHE source but map-hidden because its official classification is period unassigned and no defensible material date was verified.';
  }
}

pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 20,
  dogOwnerScore: 18,
  dogAccessScoreAdjustment: -2,
  rating: 0,
  label: 'Minor Interest',
  summary: 'A dispersed rural locality without a verified independent visitor experience or public facility cluster.',
  dogAccessRating: 1,
  dogAccessSummary: 'Responsible countryside access may be possible, but no dedicated dog walk, destination or dog facility is verified here.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3',
  reviewedAt: reviewedDate,
  sourceUrls: Object.values(urls).filter((value) => value.startsWith('http')),
};
pkg.project.townGuide = {
  characterTag: 'Dispersed rural locality',
  headline: 'A map reference rather than a visitor destination',
  intro: 'Dykelands scores 20% and remains available in the selector, but it does not qualify for the town map. Nearby Marykirk and Mearns Coast places are not transferred into this locality.',
  bestFor: ['Regional orientation', 'Historic landscape research'],
  perfectFor: ['Locating Dykelands while planning a wider Mearns journey'],
  suggestedFirstVisit: { title: 'Treat it as a route reference', summary: 'No verified visitor itinerary or public facility cluster exists inside the strict Dykelands study area.' },
  dontMiss: [],
  suggestedTime: 'Pass-through only',
  visitorMood: 'Scattered rural properties and archaeological landscape evidence rather than a visitable village centre.',
  sourceUrls: Object.values(urls).filter((value) => value.startsWith('http')),
  lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full sequential audit. Local HES checks found no listed buildings or scheduled monuments and retained three NRHE records. One rig-and-furrow record has an explicit medieval-to-post-medieval classification and is shown as a broadly dated heat pin; two period-unassigned records remain map-hidden. Current OSM amenity, tourism, shop and leisure checks within 900 m returned no publishable visitor places. No qualifying See, café-led Eat, named trail, picnic place, public parking or public toilet was verified. Nearby Marykirk and Mearns Coast offers are outside the locality and are not borrowed.';

planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const heritage = pkg.features.filter((feature: any) => feature.tags.includes('nrhe') || feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const statutory = heritage.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const report = {
  reviewedAt,
  projectId,
  status: 'verified',
  settlementScore: 20,
  previousScore: 24,
  independentlyWorthwhile: false,
  publishOnTownMap: false,
  scoreRationale: 'A dispersed locality with no independently visitable centre, attraction or visitor-service cluster inside its strict boundary.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedStatutoryRecords: 0,
    representedStatutoryRecords: statutory.length,
    nrheRecordsRetained: heritage.filter((feature: any) => feature.tags.includes('nrhe')).length,
    visibleDatedHeritagePins: visible.length,
    visibleUndatedHeritagePins: visible.filter((feature: any) => !feature.documentedDateText).length,
    hiddenUndatedRecords: heritage.filter((feature: any) => feature.tags.includes('map-hidden')).map((feature: any) => feature.id),
    rejectedOutOfAreaIds,
  },
  namedTrailSearch: {
    TreasureTrails: 'The live Aberdeenshire catalogue has no Dykelands or Marykirk product; the Mearns Coast trail is elsewhere and is not transferred.',
    CuriousAbout: 'The nearest published product found is Aberdeen, not Dykelands.',
    MysteryGuides: 'No Dykelands product found.',
    GoQuestAdventures: 'No Dykelands product found.',
    retained: [],
  },
  practicalAudit: {
    see: 'No managed or interpreted visitor sight was verified inside the strict study area; the NRHE cropmark and rig-and-furrow records remain heat-map evidence, not See cards.',
    eat: 'No café, coffee-and-cake outlet, tearoom, bakery or light-lunch venue was found within 900 m of the locality centre.',
    picnic: 'No managed public picnic place was found within the checked area.',
    parking: 'No dedicated public visitor parking was found; private farm and residential access is not visitor parking.',
    toilets: 'No local public toilet was found and Dykelands is not listed in the council public-toilet directory.',
    accessibility: 'No managed visitor facility publishes accessibility information.',
    transport: 'A dispersed rural locality; no attraction-specific public transport or arrival facility was verified.',
  },
  exclusions: [
    'Marykirk visitor services and heritage are outside the strict Dykelands study area.',
    'Mearns Coast Treasure Trail does not pass through Dykelands and is not a Dykelands trail.',
    'Private farm and residential access is not presented as parking or a visitor attraction.',
  ],
  verification: {
    localListedBuildingImport: { added: 0, refreshed: 0, bufferCandidates: 0 },
    localNrheImport: { added: 0, linked: 0, excludedCandidates: 0 },
    statutoryDatasetComplete: statutory.length === 0,
    allVisibleHeritagePinsDated: visible.every((feature: any) => feature.documentedDateText && feature.dateBasis !== 'unknown'),
    datesStoredWithoutChangingMapNames: visible.every((feature: any) => !feature.name.includes(feature.documentedDateText)),
    currentOsmVisitorFeatureCountWithin900m: 0,
    trailLinksChecked: [urls.treasure, urls.curious, urls.mystery, urls.goQuest],
    outOfAreaImporterContaminationRemoved: rejectedOutOfAreaIds.every((id) => !pkg.features.some((feature: any) => feature.id === id)),
  },
};

const row = correction.results.find((value: any) => value.projectId === projectId);
if (row) {
  row.previousScore = 24;
  row.correctedScore = 20;
  row.changed = true;
  row.publishOnTownMap = false;
  row.rationale = report.scoreRationale;
  row.sourceUrls = [urls.settlement, urls.nrheRig, urls.treasure];
}
correction.changedScores = correction.results.filter((value: any) => value.changed).length;
correction.mappedAfterCorrection = correction.results.filter((value: any) => value.correctedScore >= 60).map((value: any) => ({ projectId: value.projectId, name: value.name, score: value.correctedScore }));

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(correctionPath, `${JSON.stringify(correction, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
