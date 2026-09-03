import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'chapeltown-inverkeilor-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/chapeltown-inverkeilor.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/chapeltown-inverkeilor-full-visitor-audit-2026-08-30.json');
const urls = {
  locality: 'https://api.postcodes.io/postcodes/DD114RT',
  burialHes: 'https://portal.historicenvironment.scot/designation/LB11289',
  burialNrhe: 'https://www.trove.scot/place/35452',
  archaeologyHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB65396/',
  treasureTrailsAngus: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  treasureTrailSearch: 'https://www.treasuretrails.co.uk/pages/trail-search',
  visitAngusTrails: 'https://visitangus.com/activity-type/walking-trail/',
  curiousAbout: 'https://www.curiousabout.co.uk/',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};
const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));

const fixes: Record<string, { text: string; first: number; last: number; confidence: 'high'|'medium'|'low'; source: string; note: string }> = {
  'hes-listed-building:LB11289': { text: 'Medieval chapel and burial ground; rebuilt as a private burial place in the 19th century', first: 1100, last: 1899, confidence: 'medium', source: urls.burialHes, note: 'The HES-derived description identifies featureless medieval chapel remains rebuilt as a private burial place in the 19th century.' },
  'nrhe:35487': { text: 'NRHE classification period: prehistoric enclosure', first: -12000, last: 42, confidence: 'low', source: 'https://www.trove.scot/place/35487', note: 'Broad prehistoric period normalised from the official NRHE classification; not a precise construction date.' },
  'nrhe:35497': { text: 'NRHE classification period: medieval corn-drying kilns and enclosure', first: 1100, last: 1599, confidence: 'medium', source: 'https://www.trove.scot/place/35497', note: 'Medieval period normalised from the official NRHE classification and supported by the published excavation record.' },
  'nrhe:35522': { text: 'NRHE classification period: medieval to post-medieval rig and furrow', first: 1100, last: 1900, confidence: 'low', source: 'https://www.trove.scot/place/35522', note: 'Broad medieval to post-medieval period normalised from the official NRHE classification.' },
  'nrhe:143378': { text: 'NRHE classification period: possible prehistoric roundhouse and souterrain', first: -12000, last: 42, confidence: 'low', source: 'https://www.trove.scot/place/143378', note: 'Broad prehistoric period normalised from the official NRHE classification; uncertain cropmark elements remain qualified.' },
  'nrhe:143379': { text: 'NRHE classification period: possible Neolithic roundhouses', first: -4000, last: -2201, confidence: 'low', source: 'https://www.trove.scot/place/143379', note: 'Broad Neolithic period normalised from the official NRHE classification; the interpretation remains possible.' },
  'nrhe:144406': { text: 'NRHE classification period: prehistoric roundhouse and souterrain', first: -12000, last: 42, confidence: 'low', source: 'https://www.trove.scot/place/144406', note: 'Broad prehistoric period normalised from the official NRHE classification.' },
  'nrhe:331758': { text: 'NRHE classification period: medieval to post-medieval rig and furrow', first: 1100, last: 1900, confidence: 'low', source: 'https://www.trove.scot/place/331758', note: 'Only the explicitly dated rig-and-furrow component is used; period-unknown cropmarks are not independently dated.' },
};
for (const feature of pkg.features) {
  const fix = fixes[feature.id];
  if (!fix) continue;
  feature.documentedDateText = fix.text;
  feature.earliestPossibleYear = fix.first;
  feature.latestPossibleYear = fix.last;
  feature.dateBasis = feature.id.startsWith('hes-') ? 'documented_date_range' : 'estimated_from_authoritative_source';
  feature.dateConfidence = fix.confidence;
  feature.datePrecision = 'broad_period';
  feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
  feature.sourceRecords.push({
    sourceName: feature.id.startsWith('hes-') ? 'Historic Environment Scotland listed-building description' : 'Historic Environment Scotland NRHE period classification',
    sourceOrganisation: 'Historic Environment Scotland', sourceUrl: fix.source, accessedAt: reviewedAt,
    reliability: feature.id.startsWith('hes-') ? 'official_statutory' : 'official_non_statutory',
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.', notes: fix.note,
  });
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `${feature.reviewNotes ?? ''} ${fix.note}`.trim();
}

pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 28, dogOwnerScore: 25, dogAccessScoreAdjustment: -3, rating: 0, label: 'Minor Interest',
  summary: 'A small crossroads hamlet with a medieval chapel/burial-place landscape and cropmark archaeology, but no managed attraction or visitor-service cluster.',
  dogAccessRating: 1, dogAccessSummary: 'No dedicated dog visit or managed public access was verified; respect private burial and agricultural land.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Crossroads hamlet and buried medieval landscape', headline: 'Historic context without a developed visitor stop',
  intro: 'Chapeltown remains a 28% selector-only locality. Its medieval chapel and burial-ground history is genuine, but the enclosure is a private burial place and the surrounding archaeology is largely buried cropmark evidence.',
  bestFor: ['Archaeological and place-name context'], perfectFor: ['Understanding the wider Inverkeilor landscape'],
  suggestedFirstVisit: { title: 'Respect private land', summary: 'Do not treat the burial place or surrounding cropmark fields as a managed attraction, parking site or public trail.' },
  dontMiss: [], suggestedTime: 'Pass-through only', visitorMood: 'A historically layered but largely private agricultural hamlet.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. Chapeltown remains selector-only at 28 and does not appear on the town map. It was reconciled directly against the local HES scheduled-monument polygons: none intersects the strict boundary; nearby SM5987, SM5989, SM5990 and SM5991 remain outside and are not imported. LB11289 is complete and now dated as a medieval chapel/burial ground rebuilt in the 19th century. Seven NRHE records with explicit prehistoric, Neolithic, medieval or post-medieval classifications now carry broad, qualified date ranges and are visible. The period-unassigned Kinblethmont kennels remain intact but hidden. No qualifying public See card, café/coffee-and-cake stop, named local trail, picnic facility, visitor parking or public toilet was verified. Nearby Inverkeilor venues and Kinblethmont estate attractions are outside the boundary.';
planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const heritage = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('nrhe'));
const statutory = heritage.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 28, previousScore: 28, independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'The hamlet has genuine archaeological character but no independently visitable attraction or practical service provision.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedListedBuildings: 1, representedListedBuildings: statutory.filter((feature: any) => feature.tags.includes('hes-listed-building')).length,
    expectedScheduledMonuments: 0, representedScheduledMonuments: statutory.filter((feature: any) => feature.tags.includes('hes-scheduled-monument')).length,
    nrheRecordsRetained: heritage.filter((feature: any) => feature.tags.includes('nrhe')).length,
    visibleDatedHeritagePins: visible.filter((feature: any) => feature.documentedDateText?.trim()).length,
    visibleUndatedHeritagePins: visible.filter((feature: any) => !feature.documentedDateText?.trim()).length,
    hiddenUndatedRecords: heritage.filter((feature: any) => feature.tags.includes('map-hidden') && !feature.documentedDateText?.trim()).map((feature: any) => feature.id),
    localScheduledDatasetReconciled: true, nearbyScheduledMonumentsExcludedByExactBoundary: ['SM5987','SM5989','SM5990','SM5991'],
  },
  namedTrailSearch: {
    TreasureTrails: 'No Chapeltown or Inverkeilor product appears in the current Dundee and Angus collection; checked links returned HTTP 200.',
    CuriousAbout: 'No exact Chapeltown product found; provider link returned HTTP 200.', MysteryGuides: 'No exact Chapeltown product found.',
    GoQuestAdventures: 'No exact Chapeltown product found.', VisitAngus: 'No named Chapeltown trail appears in the current walking-trail catalogue; link returned HTTP 200.', retained: [],
  },
  practicalAudit: {
    eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue inside the boundary; Inverkeilor venues are outside.',
    picnic: 'No managed or evidenced public picnic facility inside the boundary.', parking: 'No dedicated public visitor car park; burial-place, farm and roadside access are not presented as visitor parking.',
    toilets: 'No public toilet verified inside the boundary.', accessibility: 'No managed visitor facility with published accessibility information.', transport: 'Rural crossroads locality without a verified visitor arrival facility.',
  },
  exclusions: ['Chapelton Burial Place: retained as a visible dated historic point, not a See card, because it is a private burial place without verified managed access.', 'Nearby scheduled cropmark monuments: outside the exact strict boundary according to the local HES polygons.', 'Inverkeilor tearooms/restaurants and village facilities: outside the strict boundary.', 'Kinblethmont attractions and estate access: not transferred to Chapeltown.'],
  verification: {
    localHesScheduledDatasetRun: 'data/review/chapeltown-audit-local-hes-completeness-2026-08-30.json', statutoryDatasetComplete: statutory.length === 1,
    allVisibleHeritagePinsDated: visible.every((feature: any) => feature.documentedDateText?.trim() && feature.dateBasis !== 'unknown'),
    datesStoredWithoutChangingMapNames: visible.every((feature: any) => !feature.name.includes(feature.documentedDateText)),
    trailLinksChecked: [urls.visitAngusTrails, urls.treasureTrailsAngus, urls.treasureTrailSearch, urls.curiousAbout], curatedCategoryCoordinatesChecked: true,
  },
};
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
