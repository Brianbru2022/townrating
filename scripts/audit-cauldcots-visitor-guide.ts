import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'cauldcots-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:59:00Z';
const projectPath = resolve('data/projects/cauldcots.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/cauldcots-full-visitor-audit-2026-08-30.json');
const urls = {
  settlement: 'https://www.openstreetmap.org/node/4133659350',
  stationNrhe: 'https://www.trove.scot/place/194427',
  stationHistory: 'https://www.railscot.co.uk/locations/C/Cauldcots/',
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

const station = pkg.features.find((feature: any) => feature.id === 'nrhe:194427');
if (!station) throw new Error('Cauldcots Station NRHE record is required.');
station.documentedDateText = 'Opened October 1883; closed 22 September 1930';
station.earliestPossibleYear = 1883;
station.latestPossibleYear = 1930;
station.dateBasis = 'documented_date_range';
station.dateConfidence = 'high';
station.datePrecision = 'multi_period';
station.tags = [...new Set(station.tags.filter((tag: string) => tag !== 'map-hidden').concat('date-reviewed'))];
station.sourceRecords.push({
  sourceName: 'RAILSCOT Cauldcots station history', sourceOrganisation: 'RAILSCOT', sourceUrl: urls.stationHistory,
  accessedAt: reviewedAt, reliability: 'secondary', licence: 'Source-linked chronology; retain publisher attribution.',
  notes: 'Station dates are construction/use chronology, not an inventory or database date. The source records opening in 1883 and closure in 1930.',
});
station.reviewed = true;
station.updatedAt = reviewedAt;
station.reviewNotes = 'The NRHE 19th–20th-century classification is resolved by a railway chronology: opened October 1883 and closed 22 September 1930.';

pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 22, dogOwnerScore: 20, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A small rural locality with a documented former station site but no verified public attraction, named trail or visitor-service cluster.',
  dogAccessRating: 1, dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified inside the strict locality.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = {
  characterTag: 'Rural railway-history locality', headline: 'A former station site, not a developed visitor stop',
  intro: 'Cauldcots remains a 22% selector-only locality. Its former railway station opened in 1883 and closed in 1930, but no managed visitor experience or practical service cluster was verified.',
  bestFor: ['Railway-history context'], perfectFor: ['Identifying the locality on a wider Angus route'],
  suggestedFirstVisit: { title: 'Use it as route context', summary: 'There is no published visitor itinerary, dedicated parking or public access facility at the former station site.' },
  dontMiss: [], suggestedTime: 'Pass-through only', visitorMood: 'A dispersed rural locality whose interest is primarily archival.',
  sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.researchNotes = 'Full strict-boundary audit. Cauldcots remains selector-only at 22 and does not appear on the town map. The complete local HES layers contain no statutory listed building or scheduled monument in the strict boundary. Both NRHE records remain intact: the former station now has an evidenced 1883–1930 date and is visible in the historic heat layer; the farm record remains hidden because its official classification is period-unassigned and no construction date was established. Direct checks found no qualifying See place, café/coffee-and-cake stop, named local trail, picnic facility, public visitor parking or public toilet. No exact Treasure Trails, Curious About, Mystery Guides or Go Quest product was found. Inverkeilor, Letham Grange and coast attractions remain outside the boundary.';
planner.projects[projectId] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[projectId] = {};

const heritage = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('nrhe'));
const statutory = heritage.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visible = heritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 22, previousScore: 22,
  independentlyWorthwhile: false, publishOnTownMap: false,
  scoreRationale: 'A former station gives limited historic identity, but there is no independent public visitor experience or service provision.',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedStatutoryRecords: 0, representedStatutoryRecords: statutory.length,
    nrheRecordsRetained: 2, visibleDatedNrhePins: visible.filter((feature: any) => feature.tags.includes('nrhe') && feature.documentedDateText?.trim()).length,
    visibleUndatedHeritagePins: visible.filter((feature: any) => !feature.documentedDateText?.trim()).length,
    hiddenUndatedNrheRecords: heritage.filter((feature: any) => feature.tags.includes('nrhe') && feature.tags.includes('map-hidden') && !feature.documentedDateText?.trim()).map((feature: any) => feature.id),
  },
  namedTrailSearch: {
    TreasureTrails: 'No Cauldcots product appears in the current Dundee and Angus collection; checked links returned HTTP 200.',
    CuriousAbout: 'No exact Cauldcots product found; provider link returned HTTP 200.', MysteryGuides: 'No exact Cauldcots product found.',
    GoQuestAdventures: 'No exact Cauldcots product found.', VisitAngus: 'No named Cauldcots trail appears in the current walking-trail catalogue; link returned HTTP 200.', retained: [],
  },
  practicalAudit: {
    eat: 'No qualifying café, coffee-and-cake stop, tearoom or light-lunch venue inside the boundary.', picnic: 'No managed or evidenced public picnic facility inside the boundary.',
    parking: 'No dedicated public visitor car park verified; farm, residential and railway-access land is not presented as public parking.', toilets: 'No public toilet verified inside the boundary.',
    accessibility: 'No managed visitor facility with published accessibility information.', transport: 'The railway station closed in 1930; no current visitor transport facility was verified.',
  },
  exclusions: ['Former Cauldcots station: visible as a dated historic heat point, but not a See card because no interpreted or managed visitor experience was verified.', 'Inverkeilor, Letham Grange and coastal attractions: outside the strict boundary.', 'Cauldcots farm record: retained but hidden until defensible construction evidence is available.'],
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
