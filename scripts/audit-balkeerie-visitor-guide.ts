import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'balkeerie-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T23:00:00Z';
const projectPath = resolve('data/projects/balkeerie.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/balkeerie-full-visitor-audit-2026-08-30.json');

const urls = {
  place: 'https://www.openstreetmap.org/node/5000008574',
  map: 'https://www.openstreetmap.org/api/0.6/map?bbox=-3.105%2C56.58%2C-3.07%2C56.603',
  hall: 'https://www.angus.gov.uk/sites/default/files/2023-05/Report%20LB32_23%20Delegated%20Occasionals.pdf',
  corePathEvidence: 'https://www.angus.gov.uk/sites/default/files/2017-07/437_App2_Applicants%20Submissions_0.pdf',
  speedMap: 'https://engage.angus.gov.uk/angus-20mph-strategy/widgets/132966/documents',
  hesChurch: 'https://portal.historicenvironment.scot/designation/LB4636',
  hesManse: 'https://portal.historicenvironment.scot/designation/LB4637',
  hesSchoolhouse: 'https://portal.historicenvironment.scot/designation/LB4638',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=balkeerie',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 28,
  dogOwnerScore: 26,
  dogAccessScoreAdjustment: -2,
  rating: 0,
  label: 'Minor Interest',
  summary: 'A small rural Angus cluster with a dated church, manse and former schoolhouse, but no complete public visitor experience or verified practical facilities.',
  dogAccessRating: 1,
  dogAccessSummary: 'No destination-scale dog visit, dedicated dog facility or verified local public trail is present within the strict settlement boundary.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3',
  reviewedAt: reviewedDate,
  sourceUrls: Object.values(urls),
};
pkg.project.townGuide = undefined;
pkg.project.researchNotes = 'Full strict-boundary visitor audit. Balkeerie remains selectable but does not qualify for the main map. The 1833 Eassie and Nevay Parish Church, 1841 manse and 18th-century former schoolhouse are preserved as dated HES heat evidence; none independently clears the 60-point See threshold as a reliably open visitor experience. Eassie Stone, Glamis Castle and other neighbouring merit are not transferred. The community hall is not treated as a visitor attraction, public car park or public toilet. Current local OSM and council/tourism searches found no café, public parking, public toilet, picnic facility or in-boundary visitor trail.';

planner.projects[projectId] = {};
dog.projects[projectId] = {};

const listed = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building'));
const visible = listed.filter((feature: any) => !feature.tags.includes('map-hidden'));
const dated = visible.filter((feature: any) => feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown');
const hiddenNrhe = pkg.features.filter((feature: any) => feature.tags.includes('nrhe') && feature.tags.includes('map-hidden'));

const report = {
  reviewedAt,
  projectId,
  status: 'verified',
  settlementScore: 28,
  dogOwnerScore: 26,
  independentlyWorthwhile: false,
  mapPublication: 'selector-only; no main-map town marker',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    expectedListedBuildings: 3,
    representedListedBuildings: listed.length,
    visibleDatedPins: dated.length,
    visibleUndatedPins: visible.length - dated.length,
    hiddenUndatedNrheContext: hiddenNrhe.length,
    constructionDates: listed.map((feature: any) => ({ id: feature.id, name: feature.name, date: feature.documentedDateText })),
  },
  attractionAssessment: [
    { name: 'Eassie and Nevay Parish Church', score: 48, result: 'retained as HES evidence; below the 60-point See threshold because reliable visitor opening and an interpreted experience are not established' },
    { name: 'Manse and former schoolhouse', score: 34, result: 'historic streetscape evidence, not public visitor attractions' },
    { name: 'Eassie and Nevay Community Hall', score: 24, result: 'community/event use only; not a standing visitor attraction' },
  ],
  namedTrailSearch: {
    TreasureTrails: 'No dedicated Balkeerie product found',
    CuriousAbout: 'No dedicated Balkeerie product found',
    MysteryGuides: 'No dedicated Balkeerie product found',
    GoQuestAdventures: 'No dedicated Balkeerie product found',
    councilAndTourism: 'No Balkeerie visitor trail found; council planning evidence places the nearest core-path network about 1.4 km away',
    retained: [],
  },
  practicalAudit: {
    eat: 'No current café, coffee-and-cake or light-lunch venue verified in the strict boundary',
    picnic: 'No bench, picnic table or public picnic site in the local August 2026 OSM extract',
    parking: 'No public visitor car park verified; hall or church curtilage is not assumed public parking',
    toilets: 'No public toilet verified; hall facilities are not assumed publicly available',
    transport: 'No visitor-useful service detail verified; check current journey planners before travel',
    accessibility: 'No complete public accessible visitor experience verified',
  },
  exclusions: ['Eassie Stone outside the strict Balkeerie visitor boundary', 'Glamis Castle and neighbouring settlements', 'Community-hall event facilities as permanent public amenities', 'Nearest core paths outside the place boundary'],
  evidence: { localHesRepairReport: 'data/review/balkeerie-hes-integrity-verified-2026-08-30.json', localPicnicRestExtract: 'data/review/gb-picnic-rest-osm-2026-08-11.json', currentOsmMap: urls.map, sourceUrls: Object.values(urls) },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
