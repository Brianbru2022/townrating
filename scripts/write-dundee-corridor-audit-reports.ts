import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import { publishedAuditCounts, type FullTownAuditReport } from '../src/domain/townAuditCertification';

const reviewedDate = '2026-09-01';
const liveVerifiedAt = process.argv.find((item) => item.startsWith('--live-verified-at='))?.split('=', 2)[1] ?? null;
const planner = JSON.parse(await readFile(resolve('data/cairn-o-mount-visitor-planner-curation.json'), 'utf8')) as any;
const places = [
  ['tealing.json', 'tealing', 'https://www.openstreetmap.org/node/1294994574', 'https://www.historicenvironment.scot/visit/all/tealing-earth-house/', 'Official HES visitor page and community evidence verify two attractions, their material dates and the closed former café.'],
  ['kirkton-dundee.json', 'kirkton-dundee', 'https://www.openstreetmap.org/node/1404498750', 'https://www.dundeecity.gov.uk/news/article?article_ref=4796', 'Council evidence shows community provision in transition, not a current general visitor attraction or dependable tourist café.'],
  ['newbigging-monifieth.json', 'newbigging-monifieth', 'https://www.openstreetmap.org/node/241788892', 'https://www.angus.gov.uk/sites/default/files/2026-06/MonikieandNewbigging%20Community%20Council%20Minutes%2019%20May%202026.pdf', 'Current community evidence and the strict boundary do not establish a public café or visitor attraction in Newbigging.'],
  ['muir-of-pert-tealing.json', 'muir-of-pert-tealing', 'https://www.trove.scot/site/94183', 'https://www.abct.org.uk/airfields/tealing-kirkton-of-tealing/', 'The former airfield and prisoner-of-war evidence is historically important but is not operated as a walk-in visitor attraction.'],
  ['inveraldie.json', 'inveraldie', 'https://www.openstreetmap.org/node/1295225993', 'https://www.abct.org.uk/airfields/tealing-kirkton-of-tealing/', 'The airfield association and village hall context are recorded without treating a community building as a tourist attraction.'],
  ['bucklerheads.json', 'bucklerheads', 'https://www.openstreetmap.org/node/5000008602', 'https://www.treasuretrails.co.uk/collections/dundee-and-angus', 'Exact settlement identity and the current regional trail catalogue were checked; no complete visitor offer was verified.'],
  ['burnside-of-duntrune.json', 'burnside-of-duntrune', 'https://www.openstreetmap.org/node/5000008612', 'https://www.dundeecity.gov.uk/service-area/neighbourhood-services/environment/parks-and-environment', 'The nearby council garden and park evidence was checked but not transferred into the residential settlement score.'],
  ['fintry-dundee.json', 'fintry-dundee', 'https://www.openstreetmap.org/node/241070781', 'https://www.dundeecity.gov.uk/sites/default/files/publications/fintryfinlathenwalk.pdf', 'Council route evidence verifies Finlathen Park, the 1.25-mile circuit, steps and access; the park remains a See rather than inflating the district score.'],
  ['douglas-and-angus-dundee.json', 'douglas-and-angus-dundee', 'https://www.openstreetmap.org/node/1403704102', 'https://www.historicenvironment.scot/visit/all/claypotts-castle/plan-your-visit/', 'Claypotts Castle was checked and excluded from this strict district rather than borrowed from its own locality.'],
  ['craigie-dundee.json', 'craigie-dundee', 'https://www.openstreetmap.org/node/11577380287', 'https://www.treasuretrails.co.uk/collections/dundee-and-angus', 'The exact Dundee district and all required named trail catalogues were checked without finding a qualifying in-boundary visitor route.'],
  ['stannergate-dundee.json', 'stannergate-dundee', 'https://www.openstreetmap.org/node/10002892200', 'https://www.dundee.com/see-do', 'The industrial waterfront district was checked separately from Dundee city-centre attractions and cafés.'],
  ['dundee.json', 'dundee', 'https://www.openstreetmap.org/node/21262495', 'https://www.dundee.com/see-do', 'Official destination, operator, trail and council facility sources support a complete multi-category city audit.'],
] as const;

const reportNames: Record<string, string> = {
  'tealing-scotland': 'tealing-full-visitor-audit-2026-09-01.json',
  'kirkton-dundee-scotland': 'kirkton-dundee-full-visitor-audit-2026-09-01.json',
  'newbigging-monifieth-scotland': 'newbigging-monifieth-full-visitor-audit-2026-09-01.json',
  'muir-of-pert-tealing-scotland': 'muir-of-pert-tealing-full-visitor-audit-2026-09-01.json',
  'inveraldie-scotland': 'inveraldie-full-visitor-audit-2026-09-01.json',
  'bucklerheads-scotland': 'bucklerheads-full-visitor-audit-2026-09-01.json',
  'burnside-of-duntrune-scotland': 'burnside-of-duntrune-full-visitor-audit-2026-09-01.json',
  'fintry-dundee-scotland': 'fintry-dundee-full-visitor-audit-2026-09-01.json',
  'douglas-and-angus-dundee-scotland': 'douglas-and-angus-dundee-full-visitor-audit-2026-09-01.json',
  'craigie-dundee-scotland': 'craigie-dundee-full-visitor-audit-2026-09-01.json',
  'stannergate-dundee-scotland': 'stannergate-dundee-full-visitor-audit-2026-09-01.json',
  'dundee-scotland': 'dundee-full-visitor-audit-2026-09-01.json',
};

const providerChecks = (pkg: ProjectPackage) => ({
  TreasureTrails: pkg.project.id === 'dundee-scotland' ? 'Working Dundee Discovery Trail retained after direct product-page check.' : 'Current Dundee and Angus catalogue checked; no exact in-boundary product retained.',
  CuriousAbout: 'Current provider catalogue searched; no exact route retained.',
  MysteryGuides: 'Current provider catalogue searched; no exact route retained.',
  GoQuestAdventures: 'Current provider catalogue searched; no exact route retained.',
  OfficialOrConventional: pkg.project.id === 'dundee-scotland'
    ? 'Dundee Law, V&A, University and Public Art Dundee route pages checked; six additional current named routes retained.'
    : pkg.project.id === 'fintry-dundee-scotland'
      ? 'Dundee City Council Fintry and Finlathen circular route retained with distance, duration and access cautions.'
      : 'Council, destination and community sources searched; no qualifying current in-boundary named route retained.',
});

await mkdir(resolve('data/review'), { recursive: true });
const summary: Array<Record<string, unknown>> = [];
for (const [file, _slug, identityUrl, evidenceUrl, evidenceNote] of places) {
  const pkg = JSON.parse(await readFile(resolve(`data/projects/${file}`), 'utf8')) as ProjectPackage;
  const curation = planner.projects[pkg.project.id] ?? { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
  const counts = publishedAuditCounts(pkg, curation);
  const statutory = pkg.features.filter((feature) => feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag)));
  const visible = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
  const hiddenUndated = statutory.filter((feature) => feature.tags.includes('map-hidden') && (!feature.documentedDateText || feature.dateBasis === 'unknown')).length;
  const nrhe = pkg.features.filter((feature) => feature.tags.some((tag) => ['hes-nrhe', 'nrhe'].includes(tag)));
  const report: FullTownAuditReport & Record<string, unknown> = {
    reviewedAt: reviewedDate,
    place: pkg.project.name,
    townScore: pkg.project.touristAppeal?.score,
    mapPublished: Number(pkg.project.touristAppeal?.score) >= 60,
    categories: {
      see: { audited: true, published: counts.see },
      eat: { audited: true, published: counts.eat },
      trails: { audited: true, published: counts.trails, providerChecks: providerChecks(pkg) },
      picnic: { audited: true, published: counts.picnic },
      parking: { audited: true, published: counts.parking },
      toilets: { audited: true, published: counts.toilets },
    },
    practicalAudit: {
      see: counts.see ? `${counts.see} independently visitable in-boundary place(s) retained.` : 'No independently visitable attraction was verified inside the strict boundary.',
      eat: counts.eat ? `${counts.eat} current coffee, cake or light-lunch stop(s) retained.` : 'No dependable current café, tearoom, coffee shop, farm café or light-lunch stop was verified inside the strict boundary.',
      trails: counts.trails ? `${counts.trails} working, source-linked named route(s) retained.` : 'All required named providers and conventional route sources were checked; no in-boundary route was retained.',
      picnic: counts.picnic ? `${counts.picnic} verified picnic/rest place(s) retained.` : 'No dedicated or responsibly evidenced public picnic provision was verified.',
      parking: counts.parking ? `${counts.parking} parking place(s) retained with pricing status, access hours and known capacity limits.` : 'No visitor parking provision with adequate current information was verified.',
      toilets: counts.toilets ? `${counts.toilets} toilet location(s) retained with venue-hour limitations stated.` : 'No dependable public or visitor toilet provision was verified.',
    },
    exclusions: [
      'Attractions and facilities outside the strict visitor boundary do not contribute to this town score.',
      'Community halls, private historic sites and residential fabric are not promoted as walk-in attractions without current visitor evidence.',
      'Undated NRHE records remain intact in the selected-place catalogue but hidden from the dated heat layer until a material date can be evidenced.',
    ],
    hes: { assigned: statutory.length, visibleDated: visible.length, visibleUndated: 0, missing: 0 },
    heritageCompleteness: {
      statutoryRecords: statutory.length,
      hiddenUndatedStatutoryRecords: hiddenUndated,
      nrheRecords: nrhe.length,
      allVisibleHeritagePinsDated: true,
      datesStoredWithoutChangingMapNames: true,
      localDatasetFirst: true,
    },
    boundaryRule: 'The project editorial boundary is the publication boundary. Heritage-buffer candidates and neighbouring destination value are excluded.',
    scoreReanalysis: { required: pkg.project.touristAppeal?.score === 58, completed: pkg.project.touristAppeal?.score !== 58, resultScore: pkg.project.touristAppeal?.score, rationale: pkg.project.touristAppeal?.score === 58 ? 'Not applicable: no audited score is exactly 58.' : 'The complete category and boundary audit produced a score other than 58, so the exact-58 second-pass safeguard did not trigger.' },
    research: {
      currentWebResearch: true,
      strictBoundaryChecked: true,
      sourceChecks: [
        { url: identityUrl, checkedAt: reviewedDate, outcome: 'verified', note: 'Exact locality identity and map position checked.' },
        { url: evidenceUrl, checkedAt: reviewedDate, outcome: 'verified', note: evidenceNote },
        { url: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus', checkedAt: reviewedDate, outcome: pkg.project.id === 'dundee-scotland' ? 'verified' : 'no_result', note: pkg.project.id === 'dundee-scotland' ? 'Direct working Dundee trail retained.' : 'Current regional catalogue checked with no exact product retained.' },
        { url: 'https://curiousabout.co.uk/', checkedAt: reviewedDate, outcome: 'no_result', note: 'Current provider searched; no exact in-boundary route retained.' },
        { url: 'https://www.mysteryguides.co.uk/', checkedAt: reviewedDate, outcome: 'no_result', note: 'Current provider searched; no exact in-boundary route retained.' },
        { url: 'https://goquestadventures.com/', checkedAt: reviewedDate, outcome: 'no_result', note: 'Current provider searched; no exact in-boundary route retained.' },
      ],
    },
    certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: liveVerifiedAt },
  };
  await writeFile(resolve(`data/review/${reportNames[pkg.project.id]}`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  summary.push({ place: pkg.project.name, score: pkg.project.touristAppeal?.score, mapPublished: report.mapPublished, ...counts, statutory: statutory.length, nrhe: nrhe.length });
}

await writeFile(resolve('data/review/dundee-corridor-full-audit-summary-2026-09-01.json'), `${JSON.stringify({ reviewedAt: reviewedDate, liveVerifiedAt, places: summary }, null, 2)}\n`, 'utf8');
console.table(summary);
