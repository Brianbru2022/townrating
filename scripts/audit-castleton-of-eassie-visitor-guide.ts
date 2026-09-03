import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'castleton-of-eassie-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/castleton-of-eassie.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/castleton-of-eassie-full-visitor-audit-2026-08-30.json');
const urls = {
  settlement: 'https://www.openstreetmap.org/node/5276089425',
  scheduledCastle: 'https://portal.historicenvironment.scot/designation/SM3554',
  castleNrhe: 'https://www.trove.scot/place/32134/',
  milestone: 'https://www.trove.scot/place/358455/',
  milepost: 'https://www.trove.scot/place/358456/',
  houseHistory: 'https://www.stravaiging.com/history/castle/castleton-of-eassie/',
  visitAngusTrails: 'https://visitangus.com/activity-type/walking-trail/',
  treasureTrailsAngus: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  treasureTrailSearch: 'https://www.treasuretrails.co.uk/pages/trail-search',
  curiousAbout: 'https://www.curiousabout.co.uk/',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));

const dateFixes: Record<string, { text: string; first: number; last: number; basis: string; confidence: string; source: string; note: string }> = {
  'hes-scheduled-monument:SM3554': {
    text: 'Likely 12th or 13th century AD', first: 1100, last: 1299,
    basis: 'documented_date_range', confidence: 'high', source: urls.scheduledCastle,
    note: 'The period is stated in the current HES scheduled-monument description; the 1975 scheduling date is not used as the monument date.',
  },
  'nrhe:194437': {
    text: 'Early 20th century; later extended', first: 1900, last: 1939,
    basis: 'estimated_from_authoritative_source', confidence: 'medium', source: urls.houseHistory,
    note: 'A site-specific architectural history describes the present house as early 20th century and later extended; this is not the date of the underlying medieval monument.',
  },
  'nrhe:358455': {
    text: '19th century', first: 1800, last: 1899,
    basis: 'estimated_from_authoritative_source', confidence: 'medium', source: urls.milestone,
    note: 'The official NRHE classification identifies this milestone as 19th century.',
  },
  'nrhe:358456': {
    text: '19th century', first: 1800, last: 1899,
    basis: 'estimated_from_authoritative_source', confidence: 'medium', source: urls.milepost,
    note: 'The official NRHE classification identifies this milepost as 19th century.',
  },
};

for (const feature of pkg.features) {
  const fix = dateFixes[feature.id];
  if (!fix) continue;
  feature.documentedDateText = fix.text;
  feature.earliestPossibleYear = fix.first;
  feature.latestPossibleYear = fix.last;
  feature.dateBasis = fix.basis;
  feature.dateConfidence = fix.confidence;
  feature.datePrecision = fix.first === fix.last ? 'exact_year' : 'century_range';
  feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
  feature.sourceRecords.push({
    sourceName: feature.id.startsWith('hes-') ? 'Historic Environment Scotland designation description' : 'Castleton of Eassie date review',
    sourceOrganisation: feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:358') ? 'Historic Environment Scotland' : 'Stravaiging around Scotland',
    sourceUrl: fix.source, accessedAt: reviewedAt,
    reliability: feature.id.startsWith('hes-') ? 'official_statutory' : feature.id.startsWith('nrhe:358') ? 'official_non_statutory' : 'secondary',
    licence: 'Source-linked date evidence; retain publisher attribution.', notes: fix.note,
  });
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `${feature.reviewNotes ?? ''} ${fix.note}`.trim();
}

const duplicateCastle = pkg.features.find((feature: any) => feature.id === 'nrhe:32134');
if (duplicateCastle) {
  duplicateCastle.documentedDateText = 'Possible 12th or 13th-century castle; medieval moated site';
  duplicateCastle.earliestPossibleYear = 1100;
  duplicateCastle.latestPossibleYear = 1299;
  duplicateCastle.dateBasis = 'estimated_from_authoritative_source';
  duplicateCastle.dateConfidence = 'medium';
  duplicateCastle.tags = [...new Set(duplicateCastle.tags.concat('map-hidden', 'date-reviewed', 'duplicate-of-statutory-designation'))];
  duplicateCastle.reviewed = true;
  duplicateCastle.updatedAt = reviewedAt;
  duplicateCastle.reviewNotes = 'Date retained from the NRHE classification, but the point stays map-hidden because it duplicates statutory scheduled monument SM3554 at the same castle earthwork.';
}

pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 28, dogOwnerScore: 25, dogAccessScoreAdjustment: -3, rating: 0, label: 'Minor Interest',
  summary: 'A small A94 locality with nationally important medieval archaeology, but no verified public attraction, visitor trail or practical service cluster.',
  dogAccessRating: 1, dogAccessSummary: 'No dedicated public visitor experience or verified dog facility was found; do not assume access to the privately occupied castle site.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Roadside hamlet over a medieval castle site',
  headline: 'Important archaeology, but not a developed visitor stop',
  intro: 'Castleton of Eassie scores 28%. Its scheduled 12th- or 13th-century castle earthwork is historically important, but the site includes a private house and no managed visitor access or settlement itinerary was verified.',
  bestFor: ['Understanding the place-name and medieval landscape'],
  perfectFor: ['Regional context while travelling between Glamis and Meigle'],
  suggestedFirstVisit: { title: 'Treat it as context, not an attraction visit', summary: 'Do not enter private property or rely on parking at the castle site. Visit managed nearby attractions under their own settlements.' },
  dontMiss: [], suggestedTime: 'Pass-through only',
  visitorMood: 'A historically intriguing but privately occupied rural hamlet without visitor infrastructure.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. Castleton of Eassie remains selector-only and rises modestly from 20 to 28 for its identifiable historic character, not for a public attraction. Scheduled monument SM3554 is complete in the local HES statutory data and now carries its HES-authored 12th/13th-century date. The overlapping NRHE castle record remains hidden as a duplicate, not omitted. Castleton House and two roadside markers receive source-backed periods; five genuinely undated NRHE records remain hidden rather than receiving invented dates. No qualifying See card, café/coffee-and-cake venue, named local trail, picnic facility, public visitor parking or public toilet was verified. Eassie Stone, Eassie Old Church and Glamis attractions are outside the strict boundary and are not transferred to this hamlet.';
planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const heritage = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('nrhe'));
const statutory = heritage.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const visibleDated = visible.filter((feature: any) => feature.documentedDateText?.trim() && feature.dateBasis !== 'unknown');
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 28, previousScore: 20,
  independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'The hamlet has identifiable medieval landscape interest, but the castle site is privately occupied and no independent public visitor experience or practical-service cluster exists.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedListedBuildings: 0, representedListedBuildings: 0,
    expectedScheduledMonuments: 1, representedScheduledMonuments: statutory.filter((feature: any) => feature.tags.includes('hes-scheduled-monument')).length,
    visibleDatedStatutoryPins: statutory.filter((feature: any) => !feature.tags.includes('map-hidden') && feature.documentedDateText?.trim()).length,
    visibleDatedHeritagePins: visibleDated.length, visibleUndatedHeritagePins: visible.length - visibleDated.length,
    hiddenHeritageRecords: heritage.length - visible.length, duplicateNrheCastleRecordRetainedAndHidden: true,
    undatedRecordsKeptHidden: heritage.filter((feature: any) => feature.tags.includes('map-hidden') && !feature.documentedDateText?.trim()).map((feature: any) => feature.id),
  },
  namedTrailSearch: {
    TreasureTrails: 'No Castleton of Eassie product appears in the current Dundee and Angus collection; provider links returned HTTP 200.',
    CuriousAbout: 'No exact Castleton of Eassie product found; provider link returned HTTP 200.',
    MysteryGuides: 'No exact Castleton of Eassie product found.', GoQuestAdventures: 'No exact Castleton of Eassie product found.',
    VisitAngus: 'No named Castleton of Eassie trail appears in the current walking-trail catalogue; catalogue link returned HTTP 200.', retained: [],
  },
  practicalAudit: {
    eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue inside the boundary. Agrico is an agricultural business, not a visitor eatery.',
    picnic: 'No managed or evidenced public picnic facility inside the boundary.',
    parking: 'No dedicated public visitor car park verified; private driveways and business parking are not presented as visitor parking.',
    toilets: 'No public toilet verified inside the boundary.', accessibility: 'No managed visitor facility with published accessibility information.',
    transport: 'A94 roadside locality; no attraction transport or safe visitor arrival facility was verified.',
  },
  exclusions: [
    'SM3554 castle earthwork: retained as a visible dated historic heat point, but not a See card because no managed public access is verified and a private house occupies part of the site.',
    'Eassie Stone and Eassie Old Church: roughly one mile south and assigned to Eassie, not Castleton of Eassie.',
    'Glamis Castle and other Glamis attractions: outside the strict boundary.',
    'Agrico UK: active agricultural business, not a visitor attraction, café or public facility.',
  ],
  verification: {
    statutoryDatasetComplete: statutory.length === 1, allVisibleHeritagePinsDated: visible.length === visibleDated.length,
    datesStoredWithoutChangingMapNames: visible.every((feature: any) => !feature.name.includes(feature.documentedDateText)),
    trailLinksChecked: [urls.visitAngusTrails, urls.treasureTrailsAngus, urls.treasureTrailSearch, urls.curiousAbout],
    curatedCategoryCoordinatesChecked: true,
  },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
