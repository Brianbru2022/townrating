import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T16:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string;
  requestedName: string;
  name: string;
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  rationale: string;
  sourceUrl: string;
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'dunnichen-scotland', requestedName: 'Dunnichen', name: 'Dunnichen', centre: [-2.802281, 56.6284614], radius: 750, score: 46, dogRating: 2, character: 'Small historic Angus village', rationale: 'Dunnichen has a distinct village identity, but the wider battle landscape is treated as an attraction rather than transferred into the settlement score.', sourceUrl: osm('node', 3524599621) },
  { id: 'letham-angus-scotland', requestedName: 'Letham', name: 'Letham', centre: [-2.7695401, 56.6288329], radius: 1100, score: 56, dogRating: 2, character: 'Established Angus village', rationale: 'Letham is a substantial service village, retained below the tourist-map threshold pending a full destination audit.', sourceUrl: osm('node', 1301944394) },
  { id: 'pitmuies-scotland', requestedName: 'Pitmules', name: 'Pitmuies', centre: [-2.7064728, 56.6381366], radius: 650, score: 30, dogRating: 1, character: 'Historic estate locality', rationale: 'The requested historic spelling resolves to Pitmuies. Estate and garden interest is recorded independently and does not make the locality a tourist town.', sourceUrl: osm('node', 5318933980) },
  { id: 'idvies-scotland', requestedName: 'Idvies', name: 'Idvies', centre: [-2.766409, 56.6195721], radius: 650, score: 28, dogRating: 1, character: 'Small rural Angus locality', rationale: 'Idvies is a named locality without a verified destination-scale visitor offer.', sourceUrl: osm('node', 4157785709) },
  { id: 'tulloes-scotland', requestedName: 'Tulloes', name: 'Tulloes', centre: [-2.800391, 56.601729], radius: 750, score: 22, dogRating: 1, character: 'Dispersed rural Angus locality', rationale: 'Tulloes represents the Upper and Nether Tulloes cluster and is retained as a regional reference, not a tourist settlement.', sourceUrl: osm('node', 4158228799), boundaryConfidence: 'medium' },
  { id: 'mosston-angus-scotland', requestedName: 'Mosston', name: 'Mosston', centre: [-2.7401953, 56.5902943], radius: 600, score: 20, dogRating: 1, character: 'Rural Angus locality', rationale: 'Mosston is a mapped rural locality without independently verified visitor depth.', sourceUrl: osm('node', 5321152959) },
  { id: 'redford-carmyllie-scotland', requestedName: 'Redford', name: 'Redford', centre: [-2.7132204, 56.5870947], radius: 650, score: 32, dogRating: 1, character: 'Small Carmyllie-area hamlet', rationale: 'This resolves to Redford near Carmyllie and is assessed independently from nearby attractions.', sourceUrl: osm('node', 3910707266) },
  { id: 'greystone-angus-scotland', requestedName: 'Greystone', name: 'Greystone', centre: [-2.7548668, 56.5793348], radius: 650, score: 30, dogRating: 1, character: 'Small rural Angus hamlet', rationale: 'Greystone has a distinct mapped identity but no verified visitor-town offer.', sourceUrl: osm('node', 3910707265) },
  { id: 'hayhillock-scotland', requestedName: 'Hayhillock', name: 'Hayhillock', centre: [-2.777585, 56.5684218], radius: 550, score: 20, dogRating: 1, character: 'Rural Angus locality', rationale: 'Hayhillock is retained for regional lookup without promotion as a destination.', sourceUrl: osm('node', 5755082434) },
  { id: 'carmyllie-scotland', requestedName: 'Carmyllie', name: 'Carmyllie', centre: [-2.7348882, 56.5731444], radius: 850, score: 42, dogRating: 2, character: 'Historic rural Angus village', rationale: 'Carmyllie has genuine village character but insufficient independently verified visitor infrastructure for a map marker.', sourceUrl: osm('node', 5321155161) },
  { id: 'denhead-of-arbirlot-scotland', requestedName: 'Denhead of Arbilot', name: 'Denhead of Arbirlot', centre: [-2.6874558, 56.5705639], radius: 600, score: 20, dogRating: 1, character: 'Rural Arbirlot locality', rationale: 'The requested spelling resolves to Denhead of Arbirlot, a small rural locality rather than a visitor destination.', sourceUrl: osm('node', 5846489555) },
  { id: 'balmirmer-scotland', requestedName: 'Balmirmer', name: 'Balmirmer', centre: [-2.6856073, 56.5398382], radius: 600, score: 20, dogRating: 1, character: 'Rural Angus locality', rationale: 'Balmirmer is retained as a named regional reference without a tourist-town marker.', sourceUrl: osm('node', 5878842856) },
  { id: 'monikie-scotland', requestedName: 'Monikie', name: 'Monikie', centre: [-2.8149155, 56.5379628], radius: 950, score: 54, dogRating: 2, character: 'Established rural Angus village', rationale: 'Monikie has genuine village identity, but the country park remains a separate attraction and does not by itself lift the settlement above 60.', sourceUrl: osm('node', 242787265) },
  { id: 'kirkton-of-monikie-scotland', requestedName: 'Kirkoton of Monikie', name: 'Kirkton of Monikie', centre: [-2.7860384, 56.5390435], radius: 750, score: 34, dogRating: 1, character: 'Small historic Angus village', rationale: 'The requested spelling resolves to Kirkton of Monikie, which is assessed separately from Monikie Country Park.', sourceUrl: osm('node', 5715751582) },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer',
      boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt,
      methodology: defaultMethodology, researchNotes: 'Catalogue-addition settlement gate. Nearby attractions and heritage properties do not inflate the settlement score.',
      touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label, summary: `${seed.name} is retained as an Angus regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating, dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-30-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode] },
      visitorHighlights: [],
      townGuide: { characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt },
      townStudyArea: { localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.' },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / cited mapping evidence', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }], historicMaps: [], settlementPolygons: [], validation: [],
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
await writeFile(resolve('data/review/dunnichen-monikie-locality-additions-2026-08-30.json'), `${JSON.stringify({ schemaVersion: 1, reviewedAt, threshold: 60, omitted: ['Friodell: omitted at user request after no reliable Angus match was found.'], rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.', namingDecisions: ['Pitmules resolves to Pitmuies.', 'Tulloes represents the Upper and Nether Tulloes cluster.', 'Redford resolves to the Carmyllie-area hamlet.', 'Denhead of Arbilot resolves to Denhead of Arbirlot.', 'Kirkoton of Monikie resolves to Kirkton of Monikie.'], additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })) }, null, 2)}\n`, 'utf8');
console.log(`Added ${packages.length} Dunnichen-Monikie catalogue places; none publish on the town map.`);
