import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'barnhead-angus-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:40:00Z';
const projectPath = resolve('data/projects/barnhead-angus.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/barnhead-full-visitor-audit-2026-08-30.json');

const urls = {
  place: 'https://www.openstreetmap.org/node/4134261872',
  map: 'https://www.openstreetmap.org/api/0.6/map?bbox=-2.565%2C56.697%2C-2.53%2C56.718',
  lurgies: 'https://www.wildsouthesk.org/places-to-explore/the-lurgies/',
  reserve: 'https://www.montrosebasin.org.uk/reserve.php',
  accessGuide: 'https://scottishwildlifetrust.org.uk/wp-content/uploads/2017/06/002_433__montrosebasinaccessguide_1438245590.pdf',
  paths: 'https://www.angus.gov.uk/leisure_tourism_and_the_outdoors/paths_and_outdoor_access/paths_and_path_networks',
  hesFarmhouse: 'https://portal.historicenvironment.scot/designation/LB18239',
  hesBridge: 'https://portal.historicenvironment.scot/designation/LB18240',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=barnhead%20montrose',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 24, dogOwnerScore: 22, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A small rural Montrose Basin locality with two late-18th-century listed structures, but no independent public visitor experience or verified visitor facilities.',
  dogAccessRating: 1, dogAccessSummary: 'No in-boundary published visitor walk, dog facility or destination-scale dog experience is verified.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = undefined;
pkg.project.researchNotes = 'Full strict-boundary visitor audit. Barnhead remains selector-only. Barnhead Farmhouse and Barnhead Bridge are retained as dated HES heat evidence but are not reliably open, interpreted 60+ visitor attractions. The Lurgies and Old Montrose Pier are genuine Montrose Basin visitor assets outside the strict settlement boundary; official directions use Barnhead only as a road reference, so their trail, parking and wildlife merit are not transferred. Montrose, House of Dun and the Basin Visitor Centre are also excluded.';
planner.projects[projectId] = {};
dog.projects[projectId] = {};

const listed = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building'));
const visible = listed.filter((feature: any) => !feature.tags.includes('map-hidden'));
const dated = visible.filter((feature: any) => feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown');
const scheduled = pkg.features.filter((feature: any) => feature.tags.includes('hes-scheduled-monument'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 24, dogOwnerScore: 22, independentlyWorthwhile: false,
  mapPublication: 'selector-only; no main-map town marker',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedListedBuildings: 2, representedListedBuildings: listed.length, visibleDatedPins: dated.length, visibleUndatedPins: visible.length - dated.length,
    hiddenScheduledContext: scheduled.filter((feature: any) => feature.tags.includes('map-hidden')).length,
    constructionDates: listed.map((feature: any) => ({ id: feature.id, name: feature.name, date: feature.documentedDateText })),
  },
  attractionAssessment: [
    { name: 'Barnhead Bridge', score: 42, result: 'dated listed structure but not a destination visitor experience' },
    { name: 'Barnhead Farmhouse', score: 32, result: 'private historic property, not a public attraction' },
    { name: 'The Lurgies', score: 72, result: 'valid standalone Montrose Basin attraction rejected from Barnhead because its start, car park and experience lie outside the strict boundary' },
  ],
  namedTrailSearch: { TreasureTrails: 'No dedicated Barnhead product found', CuriousAbout: 'No dedicated Barnhead product found', MysteryGuides: 'No dedicated Barnhead product found', GoQuestAdventures: 'No dedicated Barnhead product found', councilAndTourism: 'Montrose Path Network and The Lurgies were checked; no trail begins inside Barnhead’s strict boundary', retained: [] },
  practicalAudit: {
    eat: 'No café, coffee-and-cake or light-lunch stop verified in the strict boundary', picnic: 'No bench, picnic table or picnic site in the local August 2026 OSM extract',
    parking: 'No public visitor car park verified in Barnhead; The Lurgies car park is outside the boundary', toilets: 'No public toilet verified',
    transport: 'No visitor-useful current public-transport detail verified for the hamlet', accessibility: 'No complete public accessible visitor experience verified; The Lurgies access guide is not transferred to Barnhead',
  },
  exclusions: ['The Lurgies and Old Montrose Pier outside the strict boundary', 'Montrose Basin Visitor Centre', 'House of Dun', 'Montrose town facilities', 'Private farm or roadside access'],
  evidence: { localHesRepairReport: 'data/review/barnhead-angus-hes-integrity-verified-2026-08-30.json', localPicnicRestExtract: 'data/review/gb-picnic-rest-osm-2026-08-11.json', currentOsmMap: urls.map, sourceUrls: Object.values(urls) },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
