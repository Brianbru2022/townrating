import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'bolshan-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T18:20:00Z';
const projectPath = resolve('data/projects/bolshan.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/bolshan-full-visitor-audit-2026-08-30.json');

const urls = {
  place: 'https://www.openstreetmap.org/node/5923036043',
  map: 'https://www.openstreetmap.org/api/0.6/map?bbox=-2.631%2C56.654%2C-2.613%2C56.664',
  trove: 'https://www.trove.scot/place/35862',
  tourism: 'https://visitangus.com/',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=bolshan',
  councilPlanning: 'https://www.angus.gov.uk/sites/default/files/2017-07/Bolshan%20Appendix%201.pdf',
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
  summary: 'A dispersed agricultural hamlet with archaeological context but no independently visitable settlement experience or verified public visitor facility.',
  dogAccessRating: 1, dogAccessSummary: 'No published visitor walk, dog facility or destination-scale dog experience is verified within the strict Bolshan boundary.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = undefined;
pkg.project.researchNotes = 'Full strict-boundary visitor audit. Bolshan remains selector-only and does not qualify for the main map. Local HES reconciliation finds no statutory designation in the boundary; three undated NRHE archaeological records remain catalogued and map-hidden. Current OSM, council, tourism and named-trail checks found no independent attraction, cafe, visitor trail, picnic provision, public parking or public toilet. Braikie Castle, Farnell Castle, Kinnell and Friockheim are outside the strict boundary and excluded.';
planner.projects[projectId] = {};
dog.projects[projectId] = {};

const statutory = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visibleStatutory = statutory.filter((feature: any) => !feature.tags.includes('map-hidden'));
const nrhe = pkg.features.filter((feature: any) => feature.tags.includes('nrhe'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 24, dogOwnerScore: 22, independentlyWorthwhile: false,
  mapPublication: 'selector-only; no main-map town marker',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedStatutoryDesignations: 0, representedStatutoryDesignations: statutory.length, visibleDatedPins: 0, visibleUndatedPins: visibleStatutory.length, hiddenUndatedNrheContext: nrhe.filter((feature: any) => feature.tags.includes('map-hidden')).length },
  attractionAssessment: [
    { name: 'Bolshan castle site', score: 40, result: 'archaeological site with no verified public visitor presentation; not a 60+ See' },
    { name: 'St Malruib chapel site', score: 36, result: 'archaeological context only; no verified access or visitor infrastructure' },
    { name: 'Bolshan windmill site', score: 30, result: 'recorded site rather than a confirmed visitable structure' },
  ],
  namedTrailSearch: { TreasureTrails: 'No dedicated Bolshan product found', CuriousAbout: 'No dedicated Bolshan product found', MysteryGuides: 'No dedicated Bolshan product found', GoQuestAdventures: 'No dedicated Bolshan product found', councilAndTourism: 'No Bolshan visitor trail found', retained: [] },
  practicalAudit: {
    eat: 'No cafe, coffee-and-cake or light-lunch stop verified in the strict boundary',
    picnic: 'No bench, picnic table or dedicated picnic site verified',
    parking: 'No public visitor car park verified', toilets: 'No public toilet verified',
    transport: 'No visitor transport facility verified in the dispersed hamlet',
    accessibility: 'No complete public accessible visitor experience verified',
  },
  exclusions: ['Braikie Castle', 'Farnell Castle', 'Kinnell and Friockheim visitor merit', 'Private farm and archaeological-site access', 'Roadside stopping'],
  evidence: { localHesRepairReport: 'data/review/bolshan-hes-integrity-verified-2026-08-30.json', currentOsmMap: urls.map, sourceUrls: Object.values(urls) },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
