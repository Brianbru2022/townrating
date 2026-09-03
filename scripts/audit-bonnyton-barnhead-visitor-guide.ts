import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'bonnyton-barnhead-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T18:35:00Z';
const projectPath = resolve('data/projects/bonnyton-barnhead.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/bonnyton-barnhead-full-visitor-audit-2026-08-30.json');

const urls = {
  hes: 'https://portal.historicenvironment.scot/apex/f?p=1505:300:::::VIEWTYPE,VIEWREF:designation,LB18241',
  place: 'https://www.openstreetmap.org/node/3995530673',
  map: 'https://www.openstreetmap.org/api/0.6/map?bbox=-2.565%2C56.686%2C-2.545%2C56.697',
  tourism: 'https://visitangus.com/',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=bonnyton+angus',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 22, dogOwnerScore: 20, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A small farm hamlet on the A934 with one listed agricultural building but no independently visitable settlement experience or verified public facility.',
  dogAccessRating: 1, dogAccessSummary: 'No published visitor walk, dog facility or destination-scale dog experience is verified within the strict Bonnyton boundary.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = undefined;
pkg.project.researchNotes = 'Full strict-boundary visitor audit for the Bonnyton on the A934 near Barnhead and Montrose, not other places of the same name. HES reconciliation confirms the sole statutory record, Bonnyton Farm Threshing Mill (LB18241), and restores its official mid-19th-century construction period. Eleven undated NRHE context records remain map-hidden. The private working farm is not promoted as a See. Current OSM, official tourism and named-trail checks found no cafe, visitor trail, picnic provision, public parking or public toilet. Montrose, House of Dun and neighbouring settlements are excluded.';
planner.projects[projectId] = {};
dog.projects[projectId] = {};

const statutory = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visibleStatutory = statutory.filter((feature: any) => !feature.tags.includes('map-hidden'));
const nrhe = pkg.features.filter((feature: any) => feature.tags.includes('nrhe') && !feature.tags.includes('hes-listed-building'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 22, dogOwnerScore: 20, independentlyWorthwhile: false,
  mapPublication: 'selector-only; no main-map town marker',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedStatutoryDesignations: 1, representedStatutoryDesignations: statutory.length, visibleDatedPins: visibleStatutory.filter((feature: any) => feature.documentedDateText?.trim()).length, visibleUndatedPins: visibleStatutory.filter((feature: any) => !feature.documentedDateText?.trim()).length, hiddenUndatedNrheContext: nrhe.filter((feature: any) => feature.tags.includes('map-hidden')).length },
  attractionAssessment: [{ name: 'Bonnyton Farm Threshing Mill', score: 38, result: 'mid-19th-century listed working-farm building with no verified public visitor access; heritage pin only, not a See' }],
  namedTrailSearch: { TreasureTrails: 'No dedicated Bonnyton product found', CuriousAbout: 'No dedicated Bonnyton product found', MysteryGuides: 'No dedicated Bonnyton product found', GoQuestAdventures: 'No dedicated Bonnyton product found', councilAndTourism: 'No Bonnyton visitor trail found', retained: [] },
  practicalAudit: {
    eat: 'No cafe, coffee-and-cake or light-lunch stop verified in the strict boundary',
    picnic: 'No bench, picnic table or dedicated picnic site verified', parking: 'No public visitor car park verified',
    toilets: 'No public toilet verified', transport: 'Roadside rural locality with no visitor transport facility verified',
    accessibility: 'No complete public accessible visitor experience verified',
  },
  exclusions: ['Montrose facilities and merit', 'House of Dun', 'Private farm access', 'Roadside stopping', 'Other Scottish places named Bonnyton'],
  evidence: { localHesRepairReport: 'data/review/bonnyton-barnhead-hes-integrity-verified-2026-08-30.json', currentOsmMap: urls.map, sourceUrls: Object.values(urls) },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
