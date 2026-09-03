import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T23:30:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (id: number) => `https://www.openstreetmap.org/node/${id}`;

interface Seed {
  id: string; name: string; centre: [number, number]; radius: number; score: number;
  dogRating: TouristAppealRating; character: string; rationale: string; sourceUrl: string;
}

const seeds: Seed[] = [
  { id: 'bridge-of-dun-scotland', name: 'Bridge of Dun', centre: [-2.5508894,56.7181264], radius: 650, score: 46, dogRating: 2, character: 'Small South Esk crossing and railway locality', rationale: 'Bridge of Dun is retained separately from Dun. House of Dun and the Caledonian Railway are independently assessed visitor attractions and do not automatically create a tourist-town score.', sourceUrl: osm(4159783157) },
  { id: 'barnhead-angus-scotland', name: 'Barnhead', centre: [-2.5478214,56.7081012], radius: 450, score: 24, dogRating: 1, character: 'Small Montrose Basin rural locality', rationale: 'Barnhead is a distinct mapped locality, but nearby basin, railway and estate attractions are not borrowed into its settlement score.', sourceUrl: osm(4134261872) },
  { id: 'bonnyton-barnhead-scotland', name: 'Bonnyton', centre: [-2.5548854,56.6920742], radius: 450, score: 22, dogRating: 1, character: 'Small Craig parish rural locality', rationale: 'This is the Bonnyton south of Barnhead, not another Scottish namesake. It has no verified independent destination-scale visitor offer.', sourceUrl: osm(3995530673) },
  { id: 'carcary-scotland', name: 'Carcary', centre: [-2.5772031,56.6897839], radius: 550, score: 24, dogRating: 1, character: 'Rural Angus estate locality', rationale: 'Carcary remains a regional reference. Private properties and nearby Montrose-area attractions do not inflate its settlement score.', sourceUrl: osm(4134261878) },
  { id: 'westerton-of-rossie-scotland', name: 'Westerton', centre: [-2.5439656,56.6772316], radius: 450, score: 22, dogRating: 1, character: 'Small Rossie rural locality', rationale: 'The requested Westerton is resolved contextually to Westerton of Rossie and added once despite being supplied twice.', sourceUrl: osm(3995512797) },
  { id: 'lunan-scotland', name: 'Lunan', centre: [-2.5100168,56.6553564], radius: 650, score: 50, dogRating: 2, character: 'Historic coastal Angus hamlet', rationale: 'Lunan has genuine coastal and historic character, but Lunan Bay and Red Castle are separate See destinations and cannot alone lift the hamlet onto the tourist-town map.', sourceUrl: osm(1449196563) },
  { id: 'redcastle-angus-scotland', name: 'Redcastle', centre: [-2.5129529,56.6435908], radius: 500, score: 28, dogRating: 1, character: 'Historic Lunan Bay estate locality', rationale: 'The locality is retained independently. Red Castle ruin is heritage and See evidence, not a substitute for a worthwhile visitor settlement.', sourceUrl: osm(4115297735) },
  { id: 'bolshan-scotland', name: 'Bolshan', centre: [-2.6218328,56.6587954], radius: 500, score: 24, dogRating: 1, character: 'Small rural Angus locality', rationale: 'Bolshan remains selectable as a named regional locality but has no verified independent destination-scale visitor offer.', sourceUrl: osm(5923036043) },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, estates and neighbouring settlements do not inflate the place score.',
      touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label, summary: `${seed.name} is retained as an Angus regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating, dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-30-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode] },
      visitorHighlights: [],
      townGuide: { characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt },
      townStudyArea: { localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.' },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap ODbL; retain attribution.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }], historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) await writeFile(resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const planner = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog = JSON.parse(await readFile(dogPath, 'utf8'));
for (const seed of seeds) { planner.projects[seed.id] = {}; dog.projects[seed.id] = {}; }
planner.reviewedAt = reviewedAt; dog.reviewedAt = reviewedAt;
await Promise.all([writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'), writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8')]);

await writeFile(resolve('data/review/bridge-of-dun-bolshan-locality-additions-2026-08-30.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
  namingDecisions: [
    'Bridge of Dun is distinct from the existing Dun entry.',
    'Braehead of Lunan reuses the existing project rather than creating a duplicate.',
    'Westerton was supplied twice and is stored once, resolved to Westerton of Rossie.',
    'Farmwell could not be resolved in the local or online place data and is withheld rather than assigned invented coordinates.',
    'House of Dun, Lunan Bay and Red Castle remain separate attraction or See evidence and do not inflate settlement scores.',
  ],
  existing: [{ requestedName: 'Braehead of Lunan', projectId: 'braehead-of-lunan-scotland', score: 36 }],
  unresolved: [{ requestedName: 'Farmwell', reason: 'No matching Angus locality found; corrected spelling or map pin required.' }],
  additions: seeds.map((seed) => ({ name: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Bridge of Dun-Bolshan catalogue places; reused Braehead of Lunan; Farmwell remains unresolved.`);
