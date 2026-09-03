import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T16:45:00.000Z`;
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
  boundaryConfidence: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'clova-angus-scotland', requestedName: 'Clova', name: 'Clova', centre: [-3.1042052, 56.8441699], radius: 650, score: 38, dogRating: 2, character: 'Small Glen Clova settlement', summary: 'A tiny glen settlement and useful route reference rather than a complete visitor destination.', rationale: 'The hotel and wider Glen Clova walking landscape are useful nearby propositions, but the settlement itself has too little independent visitor fabric for a town marker.', osmType: 'node', osmId: 4898899226, boundaryConfidence: 'high' },
  { id: 'wheen-angus-scotland', requestedName: 'Wheen', name: 'Wheen', centre: [-3.0482005, 56.8257662], radius: 450, score: 18, dogRating: 1, character: 'Isolated Glen Clova farm', summary: 'A named farm locality rather than an independent visitor settlement.', rationale: 'Wheen is retained for regional reference without borrowing the appeal of the surrounding glen.', osmType: 'node', osmId: 6239866810, boundaryConfidence: 'high' },
  { id: 'inchgrundle-scotland', requestedName: 'Inchgrundle', name: 'Inchgrundle', centre: [-2.9686016, 56.8992549], radius: 550, score: 20, dogRating: 1, character: 'Remote Glen Esk estate locality', summary: 'A remote named locality with no verified independent visitor offer.', rationale: 'Nearby lochs, estate scenery and hill routes remain separate See or trail propositions.', osmType: 'node', osmId: 4006980036, boundaryConfidence: 'high' },
  { id: 'tarfside-scotland', requestedName: 'Tarfside', name: 'Tarfside', centre: [-2.8337235, 56.9054668], radius: 800, score: 48, dogRating: 2, character: 'Historic upper Glen Esk hamlet', summary: 'A characterful tiny hamlet and walking base, but not a complete destination town.', rationale: 'Tarfside has genuine historic fabric and access to the glen, while its limited scale and facilities keep the settlement below the publication threshold.', osmType: 'node', osmId: 3649234954, boundaryConfidence: 'high' },
  { id: 'huntlyhill-scotland', requestedName: 'Huntinghill Lodge', name: 'Huntlyhill', centre: [-2.6135341, 56.7615694], radius: 550, score: 18, dogRating: 1, character: 'Rural Brechin locality', summary: 'A rural place-name rather than an independent visitor destination.', rationale: 'No Angus place named Huntinghill Lodge was found in the local or mapped evidence; the request is transparently resolved to Huntlyhill rather than creating an unsupported duplicate.', osmType: 'node', osmId: 8604177552, boundaryConfidence: 'medium' },
  { id: 'millden-lodge-scotland', requestedName: 'Millden Lodge', name: 'Millden Lodge', centre: [-2.7545922, 56.8986749], radius: 500, score: 18, dogRating: 1, character: 'Private Glen Esk lodge', summary: 'An estate lodge and mapped property rather than a public visitor settlement.', rationale: 'The property is retained as a selector reference; estate character and surrounding scenery do not imply public access or a town score.', osmType: 'way', osmId: 428618447, boundaryConfidence: 'high' },
  { id: 'auchmull-scotland', requestedName: 'Auchmui', name: 'Auchmull', centre: [-2.6821684, 56.8606315], radius: 550, score: 20, dogRating: 1, character: 'Dispersed Angus rural locality', summary: 'A small rural locality without a verified independent visitor offer.', rationale: 'The requested spelling Auchmui resolves to mapped Auchmull; nearby countryside is not transferred into the locality score.', osmType: 'node', osmId: 5752073377, boundaryConfidence: 'high' },
  { id: 'dalbog-scotland', requestedName: 'Dalbog', name: 'Dalbog', centre: [-2.6791934, 56.8359832], radius: 500, score: 20, dogRating: 1, character: 'Dispersed Angus rural locality', summary: 'A small named locality rather than a visitor destination.', rationale: 'Dalbog remains available for regional reference without borrowing nearby estate or landscape attractions.', osmType: 'node', osmId: 4899621742, boundaryConfidence: 'high' },
  { id: 'gannochy-angus-scotland', requestedName: 'Gannochy', name: 'Gannochy', centre: [-2.6578976, 56.8271006], radius: 600, score: 24, dogRating: 1, character: 'Historic rural Angus locality', summary: 'A dispersed rural locality with limited independent visitor interest.', rationale: 'Any historic buildings are retained as heritage evidence, but do not by themselves create a worthwhile town visit.', osmType: 'node', osmId: 5326451947, boundaryConfidence: 'high' },
  { id: 'witton-angus-scotland', requestedName: 'Witton', name: 'Witton', centre: [-2.7180457, 56.8202725], radius: 550, score: 18, dogRating: 1, character: 'Rural Angus farm locality', summary: 'A mapped rural place-name rather than an independent visitor destination.', rationale: 'The Angus Witton is retained distinctly from numerous UK namesakes and remains below the town-map threshold.', osmType: 'node', osmId: 5750518413, boundaryConfidence: 'high' },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function sourceUrl(seed: Seed): string {
  return `https://www.openstreetmap.org/${seed.osmType}/${seed.osmId}`;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'OpenStreetMap named-place location with a conservative editorial study buffer', boundaryConfidence: seed.boundaryConfidence,
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
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus route'], dontMiss: [],
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

await writeFile(resolve('data/review/glen-clova-esk-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions and private properties never inflate locality scores.',
  namingDecisions: [
    'Auchmui resolves to the mapped Angus locality Auchmull.',
    'Huntinghill Lodge has no matching Angus record; the coherent local match is Huntlyhill near Brechin, retained with medium boundary confidence.',
    'Witton resolves specifically to the Angus locality near Dalbog and Gannochy.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: sourceUrl(seed), boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Glen Clova–Glen Esk catalogue places; none publish on the town map.`);
