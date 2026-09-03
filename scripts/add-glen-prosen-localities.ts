import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T18:00:00.000Z`;
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

interface Seed {
  id: string;
  requestedName: string;
  name: string;
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  summary: string;
  rationale: string;
  osmType: 'node' | 'way';
  osmId: number;
}

const seeds: Seed[] = [
  { id: 'glenprosen-lodge-scotland', requestedName: 'Glenprossan lodge', name: 'Glenprosen Lodge', centre: [-3.1630761, 56.7980829], radius: 650, score: 22, dogRating: 1, character: 'Historic private shooting lodge', summary: 'A historic lodge and tiny estate locality rather than a public visitor settlement.', rationale: 'The lodge is retained by its established Glenprosen spelling. Its historic interest and nearby hill access remain separate heritage and trail propositions and do not create a town score.', osmType: 'node', osmId: 6240245541 },
  { id: 'kilburn-angus-scotland', requestedName: 'Kilburn', name: 'Kilburn', centre: [-3.0519692, 56.8041391], radius: 500, score: 18, dogRating: 1, character: 'Glen Clova farm locality', summary: 'A named rural locality rather than an independent visitor destination.', rationale: 'The duplicated request is represented once, without borrowing Glen Clova scenery or facilities.', osmType: 'node', osmId: 4898875849 },
  { id: 'balnaboth-scotland', requestedName: 'Balnaboth', name: 'Balnaboth', centre: [-3.1223771, 56.7883944], radius: 650, score: 30, dogRating: 2, character: 'Small Glen Prosen estate hamlet', summary: 'A small historic locality and accommodation base with limited independent visitor fabric.', rationale: 'The hostel and cottages support a wider glen visit, but do not make Balnaboth a 60+ destination town.', osmType: 'node', osmId: 5326399666 },
  { id: 'prosen-village-scotland', requestedName: 'Glenprossan village', name: 'Prosen Village', centre: [-3.1013603, 56.7789767], radius: 850, score: 42, dogRating: 2, character: 'Scattered Glen Prosen village', summary: 'A scenic small village and outdoor base whose appeal is primarily the surrounding glen.', rationale: 'Prosen Village is the mapped settlement name. Glen walks and the Scott-Wilson story remain separately assessed visitor reasons rather than being transferred wholesale into the village score.', osmType: 'node', osmId: 5407394431 },
  { id: 'easter-lednathie-scotland', requestedName: 'Easter Lednathie', name: 'Easter Lednathie', centre: [-3.0811740, 56.7543916], radius: 500, score: 18, dogRating: 1, character: 'Rural Angus farm locality', summary: 'A named rural locality without a verified independent visitor offer.', rationale: 'The locality remains selectable for regional reference but has no basis for a tourist-town marker.', osmType: 'node', osmId: 5750367537 },
  { id: 'rottal-scotland', requestedName: 'Rottal', name: 'Rottal', centre: [-3.0311499, 56.8143615], radius: 650, score: 24, dogRating: 2, character: 'Historic glen estate locality', summary: 'A small estate locality with heritage interest but little independent visitor infrastructure.', rationale: 'Historic fabric can appear as dated heritage evidence, while wider Angus Glens recreation remains separate from the locality score.', osmType: 'node', osmId: 4898875873 },
  { id: 'clachnabrain-scotland', requestedName: 'Clachnabrain', name: 'Clachnabrain', centre: [-3.0262200, 56.7823927], radius: 500, score: 18, dogRating: 1, character: 'Glen Clova farm locality', summary: 'A mapped rural place-name rather than an independent visitor destination.', rationale: 'Clachnabrain is retained without attributing nearby glen scenery or trails to the farm locality.', osmType: 'node', osmId: 4898842883 },
  { id: 'horniehaugh-scotland', requestedName: 'Horniehaugh', name: 'Horniehaugh', centre: [-2.9586015, 56.7436256], radius: 500, score: 18, dogRating: 1, character: 'Rural Angus locality', summary: 'A small named rural locality without a complete visitor offer.', rationale: 'Horniehaugh remains a selector reference and does not qualify as a tourist-town marker.', osmType: 'node', osmId: 4898821368 },
  { id: 'dykehead-glen-prosen-scotland', requestedName: 'Dykehead', name: 'Dykehead', centre: [-3.0047679, 56.7297680], radius: 650, score: 30, dogRating: 1, character: 'Small Glen Prosen rural locality', summary: 'A small rural locality with a notable exploration association but limited independent visitor fabric.', rationale: 'This record is the Glen Prosen Dykehead. Captain Scott and Dr Wilson associations belong in See when fully audited and do not alone justify a 60+ town score.', osmType: 'node', osmId: 4543222807 },
];

function sourceUrl(seed: Seed): string {
  return `https://www.openstreetmap.org/${seed.osmType}/${seed.osmId}`;
}

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'OpenStreetMap named-place location with a conservative editorial study buffer', boundaryConfidence: 'high',
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, estates and landscape destinations do not inflate the place score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-29-strict-settlement-gate-v1', reviewedAt, sourceUrls: [sourceUrl(seed), osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus Glens route'], dontMiss: [],
        suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [sourceUrl(seed), osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: 'OpenStreetMap named-place location', sourceUrl: sourceUrl(seed), sourceVersion: reviewedAt,
        bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: sourceUrl(seed), licence: 'OpenStreetMap data under ODbL.', reliability: 'secondary', limitations: 'Preliminary catalogue gate. A later full visitor audit may add verified facilities, trails and artwork without borrowing neighbouring attractions.' }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) {
  await writeFile(resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

const planner = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog = JSON.parse(await readFile(dogPath, 'utf8'));
for (const seed of seeds) { planner.projects[seed.id] = {}; dog.projects[seed.id] = {}; }
planner.reviewedAt = reviewedAt; dog.reviewedAt = reviewedAt;
await Promise.all([
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8'),
]);

await writeFile(resolve('data/review/glen-prosen-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions and private properties never inflate locality scores.',
  duplicateRequests: ['Kilburn'],
  namingDecisions: [
    'Glenprossan Lodge resolves to the established Glenprosen Lodge spelling.',
    'Glenprossan village resolves to the mapped settlement Prosen Village.',
    'Dykehead resolves to the Glen Prosen locality at OSM node 4543222807, not the other Angus namesakes.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: sourceUrl(seed) })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} unique Glen Prosen catalogue places; de-duplicated Kilburn; none publish on the town map.`);
