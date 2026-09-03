import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T23:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'relation', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string; requestedName: string; name: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; rationale: string;
  sourceUrl: string; boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'montrose-scotland', requestedName: 'Montrose', name: 'Montrose', centre: [-2.4681544,56.7114295], radius: 1000, score: 58, dogRating: 2, character: 'Historic Angus port and royal burgh', rationale: 'Montrose clearly warrants a full town audit, but remains immediately below 60 until its complete attractions, daytime cafés, clue trails, parking, toilets and picnic provision are verified.', sourceUrl: osm('node',26669166) },
  { id: 'inchbraoch-scotland', requestedName: 'Inchbraoch', name: 'Inchbraoch', centre: [-2.47568,56.70348], radius: 350, score: 28, dogRating: 1, character: 'Rossie Island port-fringe locality', rationale: 'Inchbraoch is the former Rossie Island locality south of Montrose. Port activity and neighbouring Montrose or Ferryden attractions are not borrowed into its score.', sourceUrl: 'https://mapcarta.com/38883474', boundaryConfidence: 'medium' },
  { id: 'ferryden-scotland', requestedName: 'Ferryden', name: 'Ferryden', centre: [-2.4723176,56.6989251], radius: 500, score: 54, dogRating: 2, character: 'Historic fishing village on the South Esk', rationale: 'Ferryden has coherent fishing-village character but remains below the map gate until a full audit verifies its independent visitor depth and practical facilities.', sourceUrl: osm('node',4001592817) },
  { id: 'kirkton-of-craig-scotland', requestedName: 'Kirkton of Craig', name: 'Kirkton of Craig', centre: [-2.4846546,56.6928778], radius: 600, score: 36, dogRating: 2, character: 'Small historic Craig parish settlement', rationale: 'Kirkton of Craig has a distinct historic identity, but nearby Ferryden, Montrose and estate evidence do not create a complete visitor experience.', sourceUrl: osm('node',4159783315) },
  { id: 'dunninald-scotland', requestedName: 'Dunninald', name: 'Dunninald', centre: [-2.4844142,56.6787639], radius: 650, score: 30, dogRating: 1, character: 'Dunninald estate locality', rationale: 'The locality remains below the town threshold. Dunninald Castle and Gardens has seasonal public access and must be separately assessed and published under See rather than inflating a settlement score.', sourceUrl: osm('node',6052637913) },
  { id: 'fishtown-of-usan-scotland', requestedName: 'Fistown of Usan', name: 'Fishtown of Usan', centre: [-2.4518817,56.6822585], radius: 600, score: 46, dogRating: 2, character: 'Historic coastal fishing hamlet', rationale: 'The requested spelling is normalised to Fishtown of Usan. Its historic fisher settlement character is genuine, but the current visitor offer remains below the main-map gate pending a full audit.', sourceUrl: osm('node',4159783349) },
  { id: 'braehead-of-lunan-scotland', requestedName: 'Braehead of Lunan', name: 'Braehead of Lunan', centre: [-2.5077134,56.6649485], radius: 650, score: 36, dogRating: 2, character: 'Small Lunan coastal settlement', rationale: 'Braehead of Lunan is a recognised settlement, but Lunan Bay and neighbouring heritage must remain separately assessed rather than automatically creating a tourist-town score.', sourceUrl: osm('node',4115295760) },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, estates, ports and neighbouring settlements do not inflate the place score.',
      touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label, summary: `${seed.name} is retained as an Angus regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating, dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-30-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode] },
      visitorHighlights: [],
      townGuide: { characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Montrose and Angus coast route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt },
      townStudyArea: { localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.' },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / cited mapping evidence', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap ODbL or cited open-data terms; retain attribution.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }], historicMaps: [], settlementPolygons: [], validation: [],
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

await writeFile(resolve('data/review/montrose-lunan-locality-additions-2026-08-30.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
  namingDecisions: [
    'Fistown of Usan is normalised to Fishtown of Usan.',
    'Inchbraoch represents the Rossie Island fringe locality and remains separate from Ferryden and Montrose.',
    'Dunninald is an estate locality; Dunninald Castle and Gardens must be separately assessed under See.',
    'Braehead of Lunan does not inherit Lunan Bay visitor value.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, name: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Montrose-Lunan catalogue places; none publishes on the town map pending a full audit.`);
