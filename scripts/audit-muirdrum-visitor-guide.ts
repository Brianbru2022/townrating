import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateFeatures } from '../src/domain/validation';

const id = 'muirdrum-scotland';
const day = '2026-08-30';
const at = '2026-08-30T23:59:59.000Z';
const projectPath = resolve('data/projects/muirdrum.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const reportPath = resolve('data/review/muirdrum-full-visitor-audit-2026-08-30.json');
const correctionPath = resolve('data/review/strict-settlement-score-correction-2026-08-30.json');
const urls = {
  place: 'https://www.openstreetmap.org/node/5000008610',
  hes: 'https://www.trove.scot/explore/places',
  fairySteps: 'https://explorecarnoustie.co.uk/circular-3-fairy-steps.html',
  restoration: 'https://www.angus.gov.uk/communities_and_people/community_benefit_gateway_list_of_requests',
  paths: 'https://www.angus.gov.uk/directories/document_category/path_networks',
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

for (const feature of pkg.features) {
  feature.reviewed = true;
  feature.updatedAt = at;
  feature.tags = [...new Set([...feature.tags, 'heritage-record-retained', 'date-reviewed'])];
  if (feature.id === 'nrhe:142686') {
    feature.name = 'Auchrennie Possible Prehistoric Roundhouse';
    feature.dateBasis = 'documented_date_range';
    feature.dateConfidence = 'low';
    feature.datePrecision = 'period_range';
    feature.documentedDateText = 'Prehistoric, broadly c. 4000 BC–AD 400';
    feature.earliestPossibleYear = -4000;
    feature.latestPossibleYear = 400;
    feature.reviewNotes = 'The official NRHE classification identifies a possible prehistoric roundhouse. The broad material period is shown with low confidence; no narrower construction date is claimed.';
  } else {
    feature.tags = [...new Set([...feature.tags, 'map-hidden'])];
    feature.reviewNotes = feature.id === 'nrhe:34523'
      ? 'The official record identifies a socketed stone but assigns no period and locates it only to the nearest 1 km. It is retained intact but hidden from the heat map rather than given an invented date.'
      : 'The official record identifies a road bridge but assigns no period. It is retained intact but hidden from the heat map rather than given an invented construction date.';
  }
}

pkg.project.preferredBasemap = 'voyager';
pkg.project.touristAppeal = {
  score: 34,
  dogOwnerScore: 32,
  dogAccessScoreAdjustment: -2,
  rating: 0,
  label: 'Minor Interest',
  summary: 'A small A92-edge village with limited archaeological context but no verified visitor attraction, service cluster or currently complete destination trail. Nearby Panbride and Carnoustie value is not transferred into Muirdrum.',
  dogAccessRating: 1,
  dogAccessSummary: 'There is no verified destination-scale dog visit. The Fairy Steps restoration remains ongoing, so it is not promoted as a dependable route.',
  methodVersion: '2026-08-30-strict-settlement-full-audit-v3',
  reviewedAt: day,
  sourceUrls: Object.values(urls),
};
pkg.project.visitorHighlights = [];
pkg.project.townGuide = {
  characterTag: 'Small A92-edge Angus village',
  headline: 'A regional reference rather than a visitor stop',
  intro: 'Muirdrum scores 34% and remains in the Angus selector but off the main town map. Its local archaeological records remain available in the heritage data without borrowing Panbride or Carnoustie attractions and facilities.',
  bestFor: ['Regional orientation', 'Historic-environment research'],
  perfectFor: ['Recognising the village while travelling between Dundee, Carnoustie and Arbroath'],
  dontMiss: [],
  suggestedTime: 'No dedicated settlement visit',
  visitorMood: 'A compact roadside village whose interest is primarily local and documentary.',
  sourceUrls: Object.values(urls),
  lastReviewedAt: day,
};
pkg.project.researchNotes = 'Full strict-boundary audit completed. The local HES listed-building import returned zero records and the local NRHE import retained three records. One possible prehistoric roundhouse has a defensible broad material-period date; the period-unassigned socketed stone and road bridge remain intact but map-hidden. Current OSM and named-provider checks found no qualifying See, Eat, completed trail, picnic site, dedicated public visitor car park or public toilet. Angus Council records confirm that restoration of the Fairy Steps right of way remains ongoing, so it is not published as a ready visitor trail.';
pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.length) throw new Error(`Validation errors: ${JSON.stringify(pkg.validation)}`);

planner.projects[id] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
dog.projects[id] = {};

const visible = pkg.features.filter((feature: any) => !feature.tags.includes('map-hidden'));
const hidden = pkg.features.filter((feature: any) => feature.tags.includes('map-hidden'));
if (pkg.features.length !== 3 || visible.length !== 1 || hidden.length !== 2 || visible.some((feature: any) => !feature.documentedDateText || feature.name.includes(feature.documentedDateText))) {
  throw new Error('Muirdrum heritage visibility or dating contract failed.');
}

const report = {
  reviewedAt: at,
  projectId: id,
  status: 'verified',
  settlementScore: 34,
  previousScore: 42,
  independentlyWorthwhile: false,
  publishOnTownMap: false,
  scoreRationale: pkg.project.touristAppeal.summary,
  publication: { see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 },
  heritage: {
    localHesListedBuildings: 0,
    localNrheRecords: 3,
    retainedHeritageRecords: 3,
    visibleDatedHeritagePins: 1,
    visibleUndatedHeritagePins: 0,
    mapHiddenRecords: 2,
    dateRule: 'Construction or material-period dates only; never designation, database, assessment or publication dates.',
  },
  namedTrailSearch: {
    TreasureTrails: 'No exact Muirdrum product was found in the current Dundee and Angus collection.',
    CuriousAbout: 'No exact Muirdrum product found.',
    MysteryGuides: 'No exact Muirdrum product found.',
    GoQuestAdventures: 'No exact Muirdrum product found.',
    AngusCouncil: 'The Fairy Steps right of way links Panbride and Muirdrum, but the council states that restoration remains ongoing. It is retained as research context, not published as a ready trail.',
    retained: [],
  },
  practicalAudit: {
    see: 'No public attraction clearing 60 was verified. Archaeological records are heritage evidence, not visitor attractions.',
    eat: 'No café, coffee-and-cake stop, tearoom, bakery café or light-lunch venue was verified within the strict village boundary.',
    picnic: 'No managed or expressly promoted public picnic facility was verified.',
    parking: 'An unnamed OSM parking point southwest of the village has no verified visitor purpose and is not published.',
    toilets: 'No public toilet was verified.',
    accessibility: 'No independent visitor facility publishes an accessibility contract.',
    transport: 'The A92-edge village is a route reference rather than a visitor hub.',
  },
  exclusions: ['Panbride Church and village heritage', 'Carnoustie attractions and practical facilities', 'Incomplete Fairy Steps restoration', 'Unnamed parking without a verified visitor purpose'],
  verification: {
    localListedBuildingImport: { added: 0, refreshed: 0, bufferCandidates: 0 },
    localNrheImport: { added: 3, linked: 0, excludedCandidates: 0 },
    allHeritageRecordsIntact: true,
    allVisibleHeritagePinsDated: true,
    datesStoredWithoutChangingMapNames: true,
    trailLinksChecked: [urls.fairySteps, urls.restoration, urls.paths, urls.treasure, urls.curious, urls.mystery, urls.goQuest],
    practicalCoordinatesChecked: true,
  },
};

const row = {
  projectId: id,
  name: 'Muirdrum',
  region: 'Angus',
  previousScore: 42,
  correctedScore: 34,
  changed: true,
  publishOnTownMap: false,
  rationale: pkg.project.touristAppeal.summary,
  sourceUrls: [urls.place, urls.hes, urls.restoration, urls.treasure],
};
const existingRow = correction.results.find((item: any) => item.projectId === id);
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
