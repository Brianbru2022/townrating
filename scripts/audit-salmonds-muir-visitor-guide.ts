import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const id = 'salmonds-muir-scotland';
const day = '2026-08-30';
const at = '2026-08-30T23:59:58.000Z';
const projectPath = resolve('data/projects/salmonds-muir.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/salmonds-muir-full-visitor-audit-2026-08-30.json');
const correctionPath = resolve('data/review/strict-settlement-score-correction-2026-08-30.json');
const urls = {
  place: 'https://www.openstreetmap.org/node/5286742364',
  heritage: 'https://www.bonnyknox-solarfarm.co.uk/media/euej3zwf/cultural-heritage-assessment.pdf',
  paths: 'https://www.angus.gov.uk/sites/default/files/2017-08/Carnoustie%20path%20network.pdf',
  pathDirectory: 'https://www.angus.gov.uk/directories/document_category/path_networks',
  treasure: 'https://www.treasuretrails.co.uk/collections/dundee-and-angus',
  curious: 'https://www.curiousabout.co.uk/',
  mystery: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  accessCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg: any = JSON.parse(await readFile(projectPath, 'utf8'));
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
const correction: any = JSON.parse(await readFile(correctionPath, 'utf8'));

function heritageFeature(input: {
  ref: string;
  name: string;
  coordinates: [number, number];
  featureType: HeritageFeature['featureType'];
  description: string;
  documentedDateText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  survival: HeritageFeature['survival'];
}): HeritageFeature {
  return {
    id: `angus-her:${input.ref}`,
    projectId: id,
    name: input.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Angus',
    locality: "Salmond's Muir",
    featureType: input.featureType,
    significance: 'local',
    designationType: 'Non-designated Angus HER asset',
    statutoryStatus: 'Non-designated',
    geometry: { type: 'Point', coordinates: input.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'documented_date_range',
    dateConfidence: 'medium',
    datePrecision: input.earliestPossibleYear === input.latestPossibleYear ? 'exact_year' : 'period_range',
    documentedDateText: input.documentedDateText,
    earliestPossibleYear: input.earliestPossibleYear,
    latestPossibleYear: input.latestPossibleYear,
    survival: input.survival,
    shortDescription: input.description,
    sourceRecords: [{
      sourceName: 'Bonnyknox Solar Farm cultural heritage assessment, Appendix 2',
      sourceOrganisation: 'SLR Consulting / Angus Historic Environment Record',
      sourceRecordId: input.ref,
      sourceUrl: urls.heritage,
      accessedAt: at,
      reliability: 'official_non_statutory',
      licence: 'Source-linked evidence; consult Angus HER for current record status.',
      quotedDateText: input.documentedDateText,
      notes: `Angus HER record ${input.ref}; construction or material-period evidence used for heat dating, never report or database publication dates.`,
    }],
    licence: 'Source-linked reference only; do not redistribute the underlying Angus HER data without confirming its terms.',
    tags: ['angus-her', 'heritage-record-retained', 'town-selection-inside-locality', 'date-reviewed'],
    createdAt: at,
    updatedAt: at,
    reviewed: true,
    reviewNotes: `Material date ${input.documentedDateText}; this is not a statutory HES designation and is not published as a visitor attraction.`,
    evidenceScope: 'parish_evidence',
  };
}

const heritage = [
  heritageFeature({
    ref: 'NO53NE0153',
    name: "Salmond's Muir Former Smithy",
    coordinates: [-2.6855445054, 56.5309925636],
    featureType: 'commercial_building',
    description: 'Former smithy shown on historic Ordnance Survey mapping; part of the building group was later removed.',
    documentedDateText: '19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1899,
    survival: 'partial',
  }),
  heritageFeature({
    ref: 'NO53NE0116',
    name: "Salmond's Muir Second World War Buildings",
    coordinates: [-2.6786278519, 56.5314977131],
    featureType: 'military_site',
    description: 'Foundation trenches and remains of Nissen-style and associated wartime buildings recorded during archaeological works; no visible trace survives on current aerial imagery.',
    documentedDateText: 'Second World War, 1939–1945',
    earliestPossibleYear: 1939,
    latestPossibleYear: 1945,
    survival: 'destroyed',
  }),
  heritageFeature({
    ref: 'NO53NE0160',
    name: "Salmond's Muir Bronze Age Axehead Findspot",
    coordinates: [-2.6783410918, 56.5300079105],
    featureType: 'archaeological_site',
    description: 'Findspot of a flanged Bronze Age axehead reported through the Treasure Trove process.',
    documentedDateText: 'Bronze Age, c. 2400–800 BC',
    earliestPossibleYear: -2400,
    latestPossibleYear: -800,
    survival: 'unknown',
  }),
  heritageFeature({
    ref: 'NO53NE0152',
    name: 'Salmondsmuir Smithy Cottages',
    coordinates: [-2.6808409389, 56.5316113829],
    featureType: 'house',
    description: 'A row of three cottages and a western outbuilding depicted on first- and second-edition Ordnance Survey maps; now two cottages.',
    documentedDateText: '19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1899,
    survival: 'partial',
  }),
];

pkg.features = heritage;
pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 28,
  dogOwnerScore: 27,
  dogAccessScoreAdjustment: -1,
  rating: 0,
  label: 'Minor Interest',
  summary: "A very small A92-edge hamlet with documentary and archaeological history but no independently visitable centre, attraction or visitor-service cluster. Nearby East Haven, Panbride and Carnoustie are not transferred into its score.",
  dogAccessRating: 1,
  dogAccessSummary: 'The road-edge setting and agricultural surroundings offer no verified destination-scale dog visit; use only mapped rights of way and keep dogs under close control.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3',
  reviewedAt: day,
  sourceUrls: Object.values(urls),
};
pkg.project.visitorHighlights = [];
pkg.project.townGuide = {
  characterTag: 'Small historic A92-edge hamlet',
  headline: 'A regional reference rather than a visitor stop',
  intro: "Salmond's Muir scores 28% and remains in the Angus selector but off the main town map. Its history is retained in the heat layer, while neighbouring coast and town facilities remain assigned to their own places.",
  bestFor: ['Historic-environment research', 'Route orientation'],
  perfectFor: ['Recognising the historic place-name while travelling between Carnoustie and Arbroath'],
  dontMiss: [],
  suggestedTime: 'No dedicated settlement visit',
  visitorMood: 'A small roadside hamlet whose interest is documentary rather than a public visitor experience.',
  sourceUrls: Object.values(urls),
  lastReviewedAt: day,
};
pkg.project.researchNotes = "Full strict-boundary audit completed. The local HES statutory and NRHE imports returned zero records. Four dated Angus HER records are retained from a current cultural-heritage gazetteer, without presenting them as attractions. Current OSM and named-provider searches found no qualifying See, Eat, dedicated trail, picnic site, public car park or public toilet. The Carnoustie path-network road link is context only and its own warning says it is not recommended for walkers or unaccompanied children.";
pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.length) throw new Error(`Validation errors: ${JSON.stringify(pkg.validation)}`);

planner.projects[id] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[id] = {};

const visibleHeritage = pkg.features.filter((feature: any) => !feature.tags.includes('map-hidden'));
const invalidDates = visibleHeritage.filter((feature: any) => !feature.documentedDateText?.trim() || feature.dateBasis === 'unknown' || feature.name.includes(feature.documentedDateText));
if (visibleHeritage.length !== 4 || invalidDates.length) throw new Error(`Invalid heritage audit: ${invalidDates.map((feature: any) => feature.id).join(', ')}`);

const report = {
  reviewedAt: at,
  projectId: id,
  status: 'verified',
  settlementScore: 28,
  previousScore: 28,
  independentlyWorthwhile: false,
  publishOnTownMap: false,
  scoreRationale: pkg.project.touristAppeal.summary,
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    localHesListedBuildings: 0,
    localNrheRecords: 0,
    angusHerRecordsRetained: 4,
    visibleDatedHeritagePins: 4,
    visibleUndatedHeritagePins: 0,
    mapHiddenRecords: 0,
    dateRule: 'Construction or material-period dates only; never designation, database, assessment or publication dates.',
  },
  namedTrailSearch: {
    TreasureTrails: 'No Salmond\'s Muir or Carnoustie product appears in the current Dundee and Angus collection; the live collection currently lists Dundee, Forfar and Montrose.',
    CuriousAbout: 'No exact Salmond\'s Muir product found.',
    MysteryGuides: 'No exact Salmond\'s Muir product found.',
    GoQuestAdventures: 'No exact Salmond\'s Muir product found.',
    AngusCouncil: 'Carnoustie Path Network includes Salmond\'s Muir as map context, but the relevant on-road link is not recommended for walkers or unaccompanied children and is not published as a settlement trail.',
    retained: [],
  },
  practicalAudit: {
    see: 'No public attraction clearing 60 was verified. The four HER records are archaeological or historic evidence, not public visitor experiences.',
    eat: 'No café, coffee-and-cake stop, tearoom, bakery café or light-lunch venue was found within the strict hamlet boundary.',
    picnic: 'No managed or expressly promoted public picnic facility was verified.',
    parking: 'No dedicated public visitor car park with a verified access, capacity or charging contract was found; A92 lay-bys and private access are not published as visitor parking.',
    toilets: 'No public toilet was verified.',
    accessibility: 'No independent visitor facility publishes an accessibility contract.',
    transport: 'The A92-edge setting is a road junction and route reference rather than a visitor hub.',
  },
  exclusions: ['East Haven beach and village facilities', 'Panbride heritage', 'Carnoustie attractions, cafés, paths, parking and toilets', 'Private farm access and informal roadside stopping'],
  verification: {
    localListedBuildingImport: { added: 0, refreshed: 0, bufferCandidates: 0 },
    localNrheImport: { added: 0, linked: 0, excludedCandidates: 0 },
    allHeritageRecordsIntact: true,
    allVisibleHeritagePinsDated: true,
    datesStoredWithoutChangingMapNames: true,
    trailLinksChecked: [urls.paths, urls.pathDirectory, urls.treasure, urls.curious, urls.mystery, urls.goQuest],
    practicalCoordinatesChecked: true,
  },
};

const existingRow = correction.results.find((row: any) => row.projectId === id);
const row = {
  projectId: id,
  name: "Salmond's Muir",
  region: 'Angus',
  previousScore: 28,
  correctedScore: 28,
  changed: false,
  publishOnTownMap: false,
  rationale: pkg.project.touristAppeal.summary,
  sourceUrls: [urls.place, urls.heritage, urls.paths, urls.treasure],
};
if (existingRow) Object.assign(existingRow, row);
else correction.results.push(row);
correction.affectedProjects = correction.results.length;
correction.changedScores = correction.results.filter((item: any) => item.changed).length;
correction.mappedAfterCorrection = correction.results
  .filter((item: any) => item.correctedScore >= 60)
  .map((item: any) => ({ projectId: item.projectId, name: item.name, score: item.correctedScore }));

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(correctionPath, `${JSON.stringify(correction, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, score: report.settlementScore, publication: report.publication, heritage: report.heritage }, null, 2));
