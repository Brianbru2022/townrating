import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'braehead-of-lunan-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T19:15:00Z';
const projectPath = resolve('data/projects/braehead-of-lunan.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/braehead-of-lunan-full-visitor-audit-2026-08-30.json');

const urls = {
  place: 'https://www.openstreetmap.org/node/4115295760',
  map: 'https://www.openstreetmap.org/api/0.6/map?bbox=-2.517%2C56.660%2C-2.498%2C56.670',
  settlementBoundary: 'https://www.angus.gov.uk/sites/default/files/Angus%20local%20development%20plan%20adopted%20September%202016.pdf',
  landscapeViewpoint: 'https://marine.gov.scot/datafiles/lot/nng_revised_design/individual/Appendix%2014.1%20SLVIA%20Technical%20Report.pdf',
  tourism: 'https://visitangus.com/',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=braehead+of+lunan',
  upperDysart: 'https://www.upperdysart.co.uk/',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 36, dogOwnerScore: 35, dogAccessScoreAdjustment: -1, rating: 0, label: 'Minor Interest',
  summary: 'A small elevated coastal hamlet with broad Lunan Bay views and National Cycle Route 1 passing through, but too little public visitor depth for a town-map stop.',
  dogAccessRating: 2, dogAccessSummary: 'The rural setting may suit careful walking, but no dedicated public visitor trail or dog facility is verified within the strict settlement boundary.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = undefined;
pkg.project.researchNotes = 'Full strict-boundary visitor audit. Braehead of Lunan remains selector-only. HES reconciliation confirms all three listed structures and restores official construction evidence: Lunan Lodge 1783, Nether Dysart Doocot 17th century and the Lunan Lodge sundial dated 1830. Seven undated NRHE context records remain map-hidden. The recognised elevated Lunan Bay outlook and NCN Route 1 give the hamlet some landscape character, but there is no dedicated viewpoint parking, visitor trail or coherent settlement visit. Upper Dysart Larder, Lunan Bay beach, Red Castle and their facilities lie outside the boundary and are excluded.';
planner.projects[projectId] = {};
dog.projects[projectId] = {};

const statutory = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visibleStatutory = statutory.filter((feature: any) => !feature.tags.includes('map-hidden'));
const nrheOnly = pkg.features.filter((feature: any) => feature.tags.includes('nrhe') && !feature.tags.includes('hes-listed-building'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 36, dogOwnerScore: 35, independentlyWorthwhile: false,
  mapPublication: 'selector-only; no main-map town marker', publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedListedBuildings: 3, representedListedBuildings: statutory.length, visibleDatedPins: visibleStatutory.filter((feature: any) => feature.documentedDateText?.trim()).length, visibleUndatedPins: visibleStatutory.filter((feature: any) => !feature.documentedDateText?.trim()).length, hiddenUndatedNrheContext: nrheOnly.filter((feature: any) => feature.tags.includes('map-hidden')).length },
  attractionAssessment: [
    { name: 'Braehead of Lunan coastal outlook', score: 52, result: 'genuine landscape character but no dedicated viewpoint, formal access or visitor infrastructure' },
    { name: 'Lunan Lodge listed group', score: 42, result: 'private historic property group; heritage pins only, not a public See' },
  ],
  namedTrailSearch: { TreasureTrails: 'No dedicated Braehead of Lunan product found', CuriousAbout: 'No dedicated Braehead of Lunan product found', MysteryGuides: 'No dedicated Braehead of Lunan product found', GoQuestAdventures: 'No dedicated Braehead of Lunan product found', nationalCycleNetwork: 'NCN Route 1 passes through, but it is a through-route rather than a settlement visitor trail', retained: [] },
  practicalAudit: { eat: 'No cafe, coffee-and-cake or light-lunch stop verified in the strict boundary', picnic: 'No bench, picnic table or dedicated picnic site verified', parking: 'No public visitor car park or formal viewpoint parking verified', toilets: 'No public toilet verified', transport: 'Rural road and cycle-route access; no visitor transport facility verified in the hamlet', accessibility: 'No complete public accessible visitor experience verified' },
  exclusions: ['Upper Dysart Larder and its cafe, play, picnic and parking facilities', 'Lunan Bay beach and Red Castle', 'Private Lunan Lodge access', 'Roadside stopping'],
  evidence: { localHesRepairReport: 'data/review/braehead-of-lunan-hes-integrity-verified-2026-08-30.json', currentOsmMap: urls.map, sourceUrls: Object.values(urls) },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
