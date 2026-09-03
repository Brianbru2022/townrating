import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T17:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way' | 'relation', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string; requestedName: string; name: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; rationale: string;
  sourceUrl: string; boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'east-cairnbeg-scotland', requestedName: 'East Cairnbeg', name: 'East Cairnbeg', centre: [-2.4815884, 56.8827877], radius: 650, score: 24, dogRating: 1, character: 'Dispersed rural Mearns locality', rationale: 'East Cairnbeg is retained as a named farm-and-cottage locality without borrowing wider Fordoun or Auchenblae interest.', sourceUrl: 'https://catalogue.nrscotland.gov.uk/nrsonlinecatalogue/details.aspx?reference=RHP9285', boundaryConfidence: 'medium' },
  { id: 'thainston-scotland', requestedName: 'Thainston / Thinston', name: 'Thainston', centre: [-2.607398, 56.866334], radius: 750, score: 20, dogRating: 1, character: 'Upper and Nether Thainston farm cluster', rationale: 'Thinston resolves as a spelling duplicate of the Upper and Nether Thainston cluster; it is stored once as Thainston.', sourceUrl: osm('way', 932382525), boundaryConfidence: 'medium' },
  { id: 'mains-of-balnakettle-scotland', requestedName: 'Mains of Balnakettle', name: 'Mains of Balnakettle', centre: [-2.616055, 56.8613728], radius: 600, score: 18, dogRating: 1, character: 'Rural estate farm locality', rationale: 'Mains of Balnakettle is a working rural locality rather than an independently visitable settlement.', sourceUrl: osm('way', 932382536) },
  { id: 'bent-laurencekirk-scotland', requestedName: 'Bent', name: 'Bent', centre: [-2.5064353, 56.8439903], radius: 600, score: 20, dogRating: 1, character: 'Rural Thornton-area farm locality', rationale: 'This resolves to Bent near Thornton and Laurencekirk, not another Scottish Bent locality.', sourceUrl: osm('way', 932382611) },
  { id: 'laurencekirk-scotland', requestedName: 'Laurencekirk', name: 'Laurencekirk', centre: [-2.4679922, 56.8323266], radius: 1450, score: 58, dogRating: 2, character: 'Established Mearns town and rail stop', rationale: 'Laurencekirk has genuine town identity and services, but remains below the tourist-map gate until a complete destination audit verifies the visitor offer.', sourceUrl: osm('node', 408773481) },
  { id: 'mains-of-thornton-laurencekirk-scotland', requestedName: 'Mains of Thornton', name: 'Mains of Thornton', centre: [-2.5227255, 56.8364006], radius: 700, score: 28, dogRating: 1, character: 'Small Thornton-area hamlet', rationale: 'This resolves to Mains of Thornton west of Laurencekirk, distinct from the previously catalogued Glamis-area Thornton.', sourceUrl: osm('node', 14029905319) },
  { id: 'meikle-strath-scotland', requestedName: 'Meilke Strath', name: 'Meikle Strath', centre: [-2.5864816, 56.8321848], radius: 600, score: 18, dogRating: 1, character: 'Rural Mearns farm locality', rationale: 'The requested spelling resolves to Meikle Strath, a farm locality without an independent visitor-town offer.', sourceUrl: osm('way', 494506902) },
  { id: 'inch-of-arnhall-scotland', requestedName: 'Inch of Arnhall', name: 'Inch of Arnhall', centre: [-2.61682, 56.82941], radius: 750, score: 24, dogRating: 1, character: 'Small rural Arnhall hamlet', rationale: 'Inch of Arnhall is retained as an OS-recorded hamlet; historical or nearby estate interest does not inflate its settlement score.', sourceUrl: 'https://britishplacenames.uk/inch-of-arnhall-aberdeenshire-no624710', boundaryConfidence: 'medium' },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer',
      boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt,
      methodology: defaultMethodology, researchNotes: 'Catalogue-addition settlement gate. Nearby attractions and heritage properties do not inflate the settlement score.',
      touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label, summary: `${seed.name} is retained as an Aberdeenshire regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating, dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-30-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode] },
      visitorHighlights: [],
      townGuide: { characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Mearns route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt },
      townStudyArea: { localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.' },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / cited mapping evidence', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'Open Government Licence or OpenStreetMap ODbL according to the cited source.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }], historicMaps: [], settlementPolygons: [], validation: [],
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
await writeFile(resolve('data/review/laurencekirk-fettercairn-locality-additions-2026-08-30.json'), `${JSON.stringify({ schemaVersion: 1, reviewedAt, threshold: 60, reused: [{ requestedName: 'Clatterin bridge', projectId: 'clatterin-brig-scotland' }, { requestedName: 'glensaugh', projectId: 'glensaugh-scotland' }, { requestedName: 'Fettercvairn', projectId: 'fettercairn-scotland' }], rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.', namingDecisions: ['Clatterin bridge reuses Clatterin Brig.', 'Fettercvairn reuses Fettercairn.', 'Thinston is treated as a spelling duplicate of Thainston.', 'Meilke Strath resolves to Meikle Strath.', 'Mains of Thornton resolves to the Laurencekirk-area hamlet.'], additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: 'Aberdeenshire', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })) }, null, 2)}\n`, 'utf8');
console.log(`Added ${packages.length} Laurencekirk-Fettercairn catalogue places; reused three existing places and de-duplicated Thinston.`);
