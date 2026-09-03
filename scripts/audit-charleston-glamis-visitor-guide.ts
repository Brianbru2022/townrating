import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'charleston-glamis-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/charleston-glamis.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/charleston-glamis-full-visitor-audit-2026-08-30.json');
const urls = {
  settlement: 'https://www.openstreetmap.org/node/1300032505',
  villageNrhe: 'https://www.trove.scot/place/194522',
  buttonNrhe: 'https://www.trove.scot/place/357589',
  villageHistory: 'https://electricscotland.com/history/gazetteer/Glamis.pdf',
  hallRegister: 'https://www.oscr.org.uk/about-charities/search-the-register/charity-details?number=SC037211',
  glamisToilets: 'https://www.angus.gov.uk/directories/public_toilets_and_radar_keys/glamis_main_street',
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

function reviewDatedFeature(id: string, values: Record<string, unknown>, sourceRecord: Record<string, unknown>, note: string) {
  const feature = pkg.features.find((candidate: any) => candidate.id === id);
  if (!feature) throw new Error(`${id} is required.`);
  Object.assign(feature, values);
  feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
  feature.sourceRecords.push(sourceRecord);
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = note;
}

reviewDatedFeature('nrhe:194522', {
  documentedDateText: 'Village founded in 1833', earliestPossibleYear: 1833, latestPossibleYear: 1833,
  dateBasis: 'documented_year', dateConfidence: 'high', datePrecision: 'year',
}, {
  sourceName: 'Glamis: A Parish History', sourceOrganisation: 'Electric Scotland digital edition', sourceUrl: urls.villageHistory,
  accessedAt: reviewedAt, reliability: 'secondary', licence: 'Source-linked historic chronology; retain publisher attribution.',
  notes: 'The parish history states that Charleston was built in 1833. This is a settlement foundation date, not an inventory date.',
}, 'The official NRHE village record is dated from the published parish history, which records Charleston as built in 1833.');

reviewDatedFeature('nrhe:357589', {
  documentedDateText: '18th century', earliestPossibleYear: 1700, latestPossibleYear: 1799,
  dateBasis: 'documented_century', dateConfidence: 'high', datePrecision: 'century',
}, {
  sourceName: 'Trove NRHE 357589', sourceOrganisation: 'Historic Environment Scotland', sourceUrl: urls.buttonNrhe,
  accessedAt: reviewedAt, reliability: 'official_non_statutory', licence: 'Open Government Licence',
  notes: 'The official classification is lead button, 18th century. The point is accurate only to the nearest 1km.',
}, 'The official NRHE classification supplies an 18th-century material date; the mapped location retains the source record’s 1km precision caveat.');

pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 30, dogOwnerScore: 28, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A small planned weaving village founded in 1833, with modest historic character but no independent public visitor attraction or service cluster.',
  dogAccessRating: 1, dogAccessSummary: 'No reliable current dog policy is published for a destination-scale visit or dedicated visitor facility inside the strict locality.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Planned 1830s weaving village', headline: 'A compact historic settlement, not a developed visitor stop',
  intro: 'Charleston remains a 30% selector-only village. Its documented origin in 1833 gives it local historic identity, but its community hall and play area are not presented as a visitor attraction and no visitor-service cluster was verified.',
  bestFor: ['Local settlement history'], perfectFor: ['Recognising the village on a wider Angus journey'],
  suggestedFirstVisit: { title: 'Treat Charleston as route context', summary: 'The village is residential; use Glamis for public visitor services rather than transferring them into this guide.' },
  dontMiss: [], suggestedTime: 'Pass-through only', visitorMood: 'A quiet planned village with a clear 19th-century origin but little public visitor infrastructure.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. Charleston remains selector-only at 30 and does not appear on the town map. Local HES reconciliation found no statutory listed buildings or scheduled monuments and retained all six NRHE records. The settlement record is now visibly dated to its documented 1833 foundation, and the lead-button record to the official 18th-century classification. The cup findspot, battleaxe findspot, Woodbank House and 19 Charleston Village records remain intact but map-hidden because their official records are period-unassigned and no defensible material date was established. Direct current searches found no qualifying See place, café/coffee-and-cake stop, named local visitor trail, picnic tables, dedicated public visitor car park or public toilet inside the boundary. Charleston Village Hall and its play area are community assets, not an advertised visitor attraction. Glamis Castle, Glamis cafés, Glamis public toilets and Glamis parking are outside the boundary and remain with Glamis.';
planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const heritage = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('nrhe'));
const statutory = heritage.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 30, previousScore: 30,
  independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'Charleston has a coherent 1833 planned-village history, but no independently visitable attraction, named trail or practical visitor-service cluster.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedStatutoryRecords: 0, representedStatutoryRecords: statutory.length, nrheRecordsRetained: 6,
    visibleDatedNrhePins: visible.filter((feature: any) => feature.tags.includes('nrhe') && feature.documentedDateText?.trim()).length,
    visibleUndatedHeritagePins: visible.filter((feature: any) => !feature.documentedDateText?.trim()).length,
    hiddenUndatedNrheRecords: heritage.filter((feature: any) => feature.tags.includes('nrhe') && feature.tags.includes('map-hidden') && !feature.documentedDateText?.trim()).map((feature: any) => feature.id),
  },
  namedTrailSearch: {
    TreasureTrails: 'No Charleston or Glamis product appears in the current Dundee and Angus collection; checked links returned HTTP 200.',
    CuriousAbout: 'No exact Charleston product found; provider link returned HTTP 200.', MysteryGuides: 'No exact Charleston product found.',
    GoQuestAdventures: 'No exact Charleston product found.', VisitAngus: 'No named Charleston trail appears in the current walking-trail catalogue; link returned HTTP 200.', retained: [],
  },
  practicalAudit: {
    eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue inside the boundary; Glamis venues are outside it.',
    picnic: 'The community play area is verified, but no managed picnic tables or advertised visitor picnic facility were found.',
    parking: 'No dedicated public visitor car park was verified; village-hall or residential access is not presented as general visitor parking.',
    toilets: 'No public toilet was verified inside Charleston; the Angus Council facility is in Glamis at 56.608107, -3.004955, outside the strict boundary.',
    accessibility: 'No managed visitor attraction with published accessibility information.',
    transport: 'No dedicated visitor arrival facility was verified; the locality is treated as pass-through context.',
  },
  exclusions: [
    'Charleston Village Hall and play area: community assets rather than an advertised visitor attraction or unrestricted visitor facility.',
    'Glamis Castle, cafés, parking and Angus Council public toilets: outside Charleston’s strict boundary and retained with Glamis.',
    'Four period-unassigned NRHE records: retained in the catalogue but hidden until a defensible material date is established.',
  ],
  verification: {
    statutoryDatasetComplete: statutory.length === 0, allVisibleHeritagePinsDated: visible.every((feature: any) => feature.documentedDateText?.trim() && feature.dateBasis !== 'unknown'),
    datesStoredWithoutChangingMapNames: visible.every((feature: any) => !feature.name.includes(feature.documentedDateText)),
    trailLinksChecked: [urls.visitAngusTrails, urls.treasureTrailsAngus, urls.treasureTrailSearch, urls.curiousAbout], curatedCategoryCoordinatesChecked: true,
  },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
