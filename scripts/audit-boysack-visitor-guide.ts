import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'boysack-scotland';
const reviewedDate = '2026-08-30';
const reviewedAt = '2026-08-30T18:55:00Z';
const projectPath = resolve('data/projects/boysack.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/boysack-full-visitor-audit-2026-08-30.json');

const urls = {
  place: 'https://www.openstreetmap.org/node/4133659357',
  map: 'https://www.openstreetmap.org/api/0.6/map?bbox=-2.625%2C56.626%2C-2.606%2C56.636',
  sm5985: 'https://portal.historicenvironment.scot/designation/SM5985',
  sm5986: 'https://portal.historicenvironment.scot/designation/SM5986',
  sm5987: 'https://portal.historicenvironment.scot/designation/SM5987',
  tourism: 'https://visitangus.com/',
  treasure: 'https://www.treasuretrails.co.uk/pages/search-results-page?q=boysack',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));

const scheduledDates: Record<string, { text: string; from: number; to: number; source: string }> = {
  SM5985: { text: 'Prehistoric to 1st millennium AD', from: -4000, to: 999, source: urls.sm5985 },
  SM5986: { text: 'c. 4500 BC to AD 800', from: -4500, to: 800, source: urls.sm5986 },
  SM5987: { text: 'Later prehistoric', from: -800, to: 400, source: urls.sm5987 },
};
for (const feature of pkg.features) {
  const reference = Object.keys(scheduledDates).find((value) => feature.id.toUpperCase().includes(value));
  if (!reference) continue;
  const date = scheduledDates[reference];
  feature.documentedDateText = date.text;
  feature.earliestPossibleYear = date.from;
  feature.latestPossibleYear = date.to;
  feature.dateBasis = 'documented_date_range';
  feature.datePrecision = 'period_range';
  feature.dateConfidence = 'high';
  feature.tags = [...new Set(feature.tags.filter((tag: string) => tag !== 'map-hidden').concat(['hes-date-reviewed', 'date-reviewed']))];
  const source = feature.sourceRecords.find((record: any) => record.sourceRecordId === reference);
  if (source) source.notes = `Construction or material-period evidence used for the heat date: ${date.text}. Administrative designation dates were not used.`;
}

pkg.features = pkg.features.filter((feature: any) => !feature.id.startsWith('curated-'));
pkg.project.visitorHighlights = [];
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 26, dogOwnerScore: 24, dogAccessScoreAdjustment: -2, rating: 0, label: 'Minor Interest',
  summary: 'A dispersed rural hamlet with significant buried prehistoric archaeology and an historic mill group, but no independently visitable settlement experience or visitor facility.',
  dogAccessRating: 1, dogAccessSummary: 'No published visitor walk, dog facility or destination-scale dog experience is verified within the strict Boysack boundary.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3', reviewedAt: reviewedDate, sourceUrls: Object.values(urls),
};
pkg.project.townGuide = undefined;
pkg.project.researchNotes = 'Full strict-boundary visitor audit. Boysack remains selector-only. HES reconciliation confirms all three listed mill structures with official 18th-century dates. The three scheduled cropmark sites are also retained and now carry their official prehistoric or multi-period date evidence; they are archaeological records beneath farmland, not promoted visitor attractions. Ten separate undated NRHE context records remain map-hidden. No cafe, visitor trail, picnic provision, public parking or public toilet was verified. Braikie Castle, Letham Grange, Friockheim and other nearby merit are excluded.';
planner.projects[projectId] = {};
dog.projects[projectId] = {};

const statutory = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
const visibleStatutory = statutory.filter((feature: any) => !feature.tags.includes('map-hidden'));
const nrheOnly = pkg.features.filter((feature: any) => feature.tags.includes('nrhe') && !feature.tags.includes('hes-listed-building') && !feature.tags.includes('hes-scheduled-monument'));
const report = {
  reviewedAt, projectId, status: 'verified', settlementScore: 26, dogOwnerScore: 24, independentlyWorthwhile: false,
  mapPublication: 'selector-only; no main-map town marker',
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: { expectedListedBuildings: 3, representedListedBuildings: statutory.filter((feature: any) => feature.tags.includes('hes-listed-building')).length, expectedScheduledMonuments: 3, representedScheduledMonuments: statutory.filter((feature: any) => feature.tags.includes('hes-scheduled-monument')).length, visibleDatedPins: visibleStatutory.filter((feature: any) => feature.documentedDateText?.trim()).length, visibleUndatedPins: visibleStatutory.filter((feature: any) => !feature.documentedDateText?.trim()).length, hiddenUndatedNrheContext: nrheOnly.filter((feature: any) => feature.tags.includes('map-hidden')).length },
  attractionAssessment: [
    { name: 'Boysack Mills group', score: 42, result: 'listed private mill structures without verified public visitor access; heritage pins only' },
    { name: 'Boysack scheduled cropmark complex', score: 46, result: 'nationally important buried archaeology under farmland, not a presented or independently visitable attraction' },
  ],
  namedTrailSearch: { TreasureTrails: 'No dedicated Boysack product found', CuriousAbout: 'No dedicated Boysack product found', MysteryGuides: 'No dedicated Boysack product found', GoQuestAdventures: 'No dedicated Boysack product found', councilAndTourism: 'No Boysack visitor trail found', retained: [] },
  practicalAudit: { eat: 'No cafe, coffee-and-cake or light-lunch stop verified in the strict boundary', picnic: 'No bench, picnic table or dedicated picnic site verified', parking: 'No public visitor car park verified', toilets: 'No public toilet verified', transport: 'No visitor transport facility verified', accessibility: 'No complete public accessible visitor experience verified' },
  exclusions: ['Braikie Castle', 'Letham Grange', 'Friockheim facilities and visitor merit', 'Private mill and farmland access', 'Roadside stopping'],
  evidence: { localHesRepairReport: 'data/review/boysack-hes-integrity-verified-2026-08-30.json', scheduledDateSources: [urls.sm5985, urls.sm5986, urls.sm5987], currentOsmMap: urls.map, sourceUrls: Object.values(urls) },
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
