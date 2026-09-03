import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'bent-laurencekirk-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T18:05:00Z';
const projectPath = resolve('data/projects/bent-laurencekirk.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/bent-laurencekirk-full-visitor-audit-2026-08-30.json');

const urls = {
  place: 'https://www.openstreetmap.org/way/932382611',
  map: 'https://www.openstreetmap.org/api/0.6/map?bbox=-2.517%2C56.838%2C-2.496%2C56.850',
  councilParking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  tourism: 'https://visitabdn.com/places/laurencekirk',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=bent+laurencekirk',
  localityEvidence: 'https://www.aberdeenshire.gov.uk/business/trading-standards/business/public-weighbridges/',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 20, dogOwnerScore: 18, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A working farm locality near Laurencekirk with no independently visitable settlement experience or verified public visitor facility.',
  dogAccessRating: 1, dogAccessSummary: 'No published visitor walk, dog facility or destination-scale dog experience is verified within the strict Bent boundary.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = undefined;
pkg.project.researchNotes = 'Full strict-boundary visitor audit. Bent remains selector-only and does not qualify for the main map. Local HES reconciliation finds no statutory designation in the boundary; three undated NRHE farm-context records remain catalogued and map-hidden. Current OSM, council, tourism and named-trail checks found no independent attraction, cafe, visitor trail, picnic provision, public parking or public toilet. Laurencekirk services and wider Mearns merit are outside the settlement and excluded.';
planner.projects[projectId] = {};
dog.projects[projectId] = {};

const statutory = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visibleStatutory = statutory.filter((feature: any) => !feature.tags.includes('map-hidden'));
const nrhe = pkg.features.filter((feature: any) => feature.tags.includes('nrhe'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 20, dogOwnerScore: 18, independentlyWorthwhile: false,
  mapPublication: 'selector-only; no main-map town marker',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedStatutoryDesignations: 0, representedStatutoryDesignations: statutory.length, visibleDatedPins: 0, visibleUndatedPins: visibleStatutory.length, hiddenUndatedNrheContext: nrhe.filter((feature: any) => feature.tags.includes('map-hidden')).length },
  attractionAssessment: [{ name: 'Bent farm locality', score: 20, result: 'working rural locality only; no public visitor experience independently clears 60' }],
  namedTrailSearch: { TreasureTrails: 'No dedicated Bent or Bent of Halkerton product found', CuriousAbout: 'No dedicated Bent product found', MysteryGuides: 'No dedicated Bent product found', GoQuestAdventures: 'No dedicated Bent product found', councilAndTourism: 'No Bent visitor trail found', retained: [] },
  practicalAudit: {
    eat: 'No cafe, coffee-and-cake or light-lunch stop verified in the strict boundary',
    picnic: 'No bench, picnic table or dedicated picnic site verified',
    parking: 'No public visitor car park verified; Laurencekirk council car parks are outside the boundary',
    toilets: 'No public toilet verified',
    transport: 'No visitor transport facility in the locality; Laurencekirk station and bus services are outside the boundary',
    accessibility: 'No complete public accessible visitor experience verified',
  },
  exclusions: ['Laurencekirk attractions, cafes, station and car parks', 'Wider Mearns scenery and routes', 'Private farm access or roadside stopping'],
  evidence: { localHesRepairReport: 'data/review/bent-laurencekirk-hes-integrity-verified-2026-08-30.json', currentOsmMap: urls.map, sourceUrls: Object.values(urls) },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
