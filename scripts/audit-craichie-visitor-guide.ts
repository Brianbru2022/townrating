import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'craichie-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/craichie.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/craichie-full-visitor-audit-2026-08-30.json');
const urls = {
  settlement: 'https://www.openstreetmap.org/node/3524582668',
  mill: 'https://portal.historicenvironment.scot/designation/LB4601',
  farmhouse: 'https://portal.historicenvironment.scot/designation/LB4620',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  treasureTrailSearch: 'https://www.treasuretrails.co.uk/pages/trail-search',
  curiousAbout: 'https://www.curiousabout.co.uk/',
  visitAngusTrails: 'https://visitangus.com/activity-type/walking-trail/',
  busStop: 'https://bustimes.org/stops/6490IM225',
  busTimetables: 'https://www.angus.gov.uk/roads_parking_and_travel/public_transport/bus_timetables',
  outdoorAccess: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));

function dateListed(id: string, values: Record<string, unknown>, sourceUrl: string, notes: string) {
  const feature = pkg.features.find((candidate: any) => candidate.id === id);
  if (!feature) throw new Error(`${id} is required.`);
  Object.assign(feature, values, { reviewed: true, updatedAt: reviewedAt });
  feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat('hes-date-reviewed', 'date-reviewed', 'heritage-record-retained'))];
  feature.sourceRecords.push({
    sourceName: `Historic Environment Scotland ${id.replace('hes-listed-building:', '')}`,
    sourceOrganisation: 'Historic Environment Scotland', sourceUrl, accessedAt: reviewedAt,
    reliability: 'official_statutory', licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.', notes,
  });
  feature.reviewNotes = `${notes} The administrative listing date is not used as the building date, and the map label remains unchanged.`;
}

dateListed('hes-listed-building:LB4601', {
  documentedDateText: 'Dated 1708; rebuilt 1817', earliestPossibleYear: 1708, latestPossibleYear: 1817,
  dateBasis: 'documented_year', dateConfidence: 'high', datePrecision: 'year_range',
}, urls.mill, 'The official description records inset dates of 1708 and a rebuild in 1817.');

dateListed('hes-listed-building:LB4620', {
  documentedDateText: 'Rebuilt early 19th century; adjoining lintel dated 1745', earliestPossibleYear: 1800, latestPossibleYear: 1832,
  dateBasis: 'documented_period', dateConfidence: 'high', datePrecision: 'period',
}, urls.farmhouse, 'The official description dates the farmhouse rebuild to the early 19th century and separately records an adjoining lintel dated 1745.');

for (const feature of pkg.features.filter((item: any) => item.tags.includes('nrhe'))) {
  feature.tags = [...new Set(feature.tags.concat('heritage-record-retained', 'map-hidden'))];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = 'The local HES NRHE record is retained, but its classification remains period-unassigned and no defensible material date was established; it therefore stays out of the heat layer.';
}

pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 32, dogOwnerScore: 30, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A small rural hamlet with two dated listed mill buildings, but no independently visitable attraction or practical visitor-service cluster.',
  dogAccessRating: 1, dogAccessSummary: 'Rural-road walking is possible, but no dedicated visitor site or source-backed place-specific dog policy was found.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Rural Angus mill hamlet', headline: 'Historic mill fabric without a developed visitor stop',
  intro: 'Craichie remains a 32% selector-only hamlet. Its old cornmill and farmhouse have genuine 18th- and early-19th-century fabric, but they are not promoted as public attractions and the settlement has no verified visitor-service cluster.',
  bestFor: ['Recognising historic rural fabric'], perfectFor: ['Route context between Forfar and Letham'],
  suggestedFirstVisit: { title: 'Treat Craichie as route context', summary: 'The mill buildings are private historic fabric rather than advertised visitor attractions; use nearby towns for facilities.' },
  dontMiss: [], suggestedTime: 'Pass-through only', visitorMood: 'A quiet roadside hamlet whose interest lies in private rural heritage rather than a public visitor experience.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. Craichie remains selector-only at 32 and does not appear on the town map. Local HES reconciliation confirms two listed buildings, no scheduled monuments and three NRHE records. The old cornmill is now dated to its 1708 fabric and documented 1817 rebuild; the farmhouse is dated to its early-19th-century rebuild, with the separate 1745 lintel noted. Both listed-building dots are visible, while all three period-unassigned NRHE records remain intact but map-hidden. The mill buildings are private rural fabric and do not qualify as 60+ public See attractions. Current searches found no qualifying café/coffee-and-cake stop, named local visitor trail, picnic facility, dedicated public visitor car park or public toilet. Treasure Trails, Curious About, Mystery Guides, GoQuest and Visit Angus trail catalogues produced no exact Craichie product. Service 27 is recorded at the High Rigg stops; current times should be checked before travel.';
planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const heritage = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('nrhe'));
const statutory = heritage.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 32, previousScore: 32,
  independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'Two private listed mill buildings give modest historic character, but there is no public attraction, named trail or visitor-service cluster.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedStatutoryRecords: 2, representedStatutoryRecords: statutory.length, nrheRecordsRetained: heritage.filter((feature: any) => feature.tags.includes('nrhe')).length,
    visibleDatedListedBuildingPins: visible.filter((feature: any) => feature.tags.includes('hes-listed-building') && feature.documentedDateText?.trim()).length,
    visibleUndatedHeritagePins: visible.filter((feature: any) => !feature.documentedDateText?.trim()).length,
    hiddenUndatedNrheRecords: heritage.filter((feature: any) => feature.tags.includes('nrhe') && feature.tags.includes('map-hidden') && !feature.documentedDateText?.trim()).map((feature: any) => feature.id),
  },
  namedTrailSearch: {
    TreasureTrails: 'No Craichie product appears in the current Dundee and Angus collection; the collection page lists Dundee, Forfar and Montrose products.',
    CuriousAbout: 'No exact Craichie product found; provider page checked.', MysteryGuides: 'No exact Craichie product found.',
    GoQuestAdventures: 'No exact Craichie product found.', VisitAngus: 'No named Craichie trail found in the current trail catalogue.', retained: [],
  },
  practicalAudit: {
    see: 'The two listed mill buildings are private rural heritage and do not meet the 60-point public-attraction publication threshold.',
    eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue was verified inside the boundary.',
    picnic: 'No advertised visitor picnic site or managed picnic tables were verified.',
    parking: 'No dedicated public visitor car park was verified; roadside or private farm access is not published as visitor parking.',
    toilets: 'No public toilet was verified inside Craichie.', accessibility: 'No managed public visitor attraction with published accessibility information.',
    transport: 'Service 27 calls at the Craichie High Rigg stops; the current timetable should be checked before travel.',
  },
  exclusions: [
    'Craichie Mill watermill and farmhouse: visible as accurately dated heritage dots, but not promoted as public See attractions.',
    'Three period-unassigned NRHE records: retained in the catalogue but hidden until a defensible material date is established.',
    'Roadside and private farm access: not represented as public parking or visitor access.',
  ],
  verification: {
    statutoryDatasetComplete: statutory.length === 2, allVisibleHeritagePinsDated: visible.every((feature: any) => feature.documentedDateText?.trim() && feature.dateBasis !== 'unknown'),
    datesStoredWithoutChangingMapNames: visible.every((feature: any) => !feature.name.includes(feature.documentedDateText)),
    trailLinksChecked: [urls.treasureTrails, urls.treasureTrailSearch, urls.curiousAbout, urls.visitAngusTrails],
    curatedCategoryCoordinatesChecked: true, busEvidenceChecked: [urls.busStop, urls.busTimetables],
  },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
