import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T22:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string; name: string; centre: [number, number]; radius: number; score: number;
  dogRating: TouristAppealRating; character: string; rationale: string; sourceUrl: string;
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
  boundarySource?: string;
}

const seeds: Seed[] = [
  { id: 'dykelands-scotland', name: 'Dykelands', centre: [-2.4885753,56.8094411], radius: 500, score: 24, dogRating: 1, character: 'Small Marykirk-area rural locality', rationale: 'Dykelands is retained as a distinct rural locality and does not inherit Marykirk, Laurencekirk or nearby estate attractions.', sourceUrl: osm('node',12152154252) },
  { id: 'benholm-scotland', name: 'Benholm', centre: [-2.3224283,56.8147881], radius: 750, score: 46, dogRating: 2, character: 'Historic coastal-parish village', rationale: 'Benholm has a coherent historic identity, but remains below the map gate until a full audit verifies current public access, trails and visitor facilities without borrowing neighbouring Johnshaven.', sourceUrl: osm('node',2383642143) },
  { id: 'johnshaven-scotland', name: 'Johnshaven', centre: [-2.3357887,56.7948936], radius: 800, score: 58, dogRating: 2, character: 'Historic Mearns fishing village', rationale: 'Johnshaven has strong harbour and village character but remains just below 60 pending a complete See, Eat, trails and practical visitor audit.', sourceUrl: osm('node',495236262) },
  { id: 'st-cyrus-scotland', name: 'St Cyrus', centre: [-2.4159051,56.7742789], radius: 600, score: 58, dogRating: 2, character: 'Coastal Mearns village', rationale: 'St Cyrus warrants a full audit but remains below the town-map threshold until the settlement itself is separated from the independently scored National Nature Reserve and its practical visitor offer is checked.', sourceUrl: osm('node',408887964) },
  { id: 'ecclesgreig-scotland', name: 'Ecclesgreig', centre: [-2.431722,56.7829684], radius: 450, score: 22, dogRating: 1, character: 'Rural St Cyrus estate locality', rationale: 'Although Ecclesgreig is also the historic name associated with St Cyrus, this entry represents the present mapped rural locality and does not duplicate the village or imply access to private estate property.', sourceUrl: osm('node',14029842142) },
  { id: 'lochside-st-cyrus-scotland', name: 'Lochside', centre: [-2.4276,56.7709], radius: 400, score: 36, dogRating: 2, character: 'Residential settlement adjoining St Cyrus', rationale: 'Lochside is retained as the separately named adjoining settlement. St Cyrus services and the National Nature Reserve are not automatically transferred into its score.', sourceUrl: osm('node',6855158423), boundaryConfidence: 'medium' },
  { id: 'morphie-scotland', name: 'Morphie', centre: [-2.4708772,56.7689807], radius: 650, score: 28, dogRating: 1, character: 'Historic rural Mearns locality', rationale: 'Morphie has genuine historic and archaeological context, but the Stone of Morphie and private properties remain separate See or heritage records rather than creating a tourist settlement.', sourceUrl: osm('node',8138039473) },
  { id: 'pathhead-st-cyrus-scotland', name: 'Pathhead', centre: [-2.447475,56.759197], radius: 500, score: 20, dogRating: 1, character: 'Small St Cyrus-area rural locality', rationale: 'This resolves to the Pathhead locality near St Cyrus and Morphie, not the better-known Midlothian or Fife settlements. A postcode centroid requires a cautious boundary and no neighbouring attractions are borrowed.', sourceUrl: 'https://api.postcodes.io/postcodes/DD100AG', boundaryConfidence: 'low', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with a conservative editorial study buffer' },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: seed.boundarySource ?? 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, estates, nature reserves and neighbouring settlements do not inflate the place score.',
      touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label, summary: `${seed.name} is retained as an Aberdeenshire regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating, dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-30-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode] },
      visitorHighlights: [],
      townGuide: { characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider coastal Mearns route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt },
      townStudyArea: { localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.' },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / Office for National Statistics where cited', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap ODbL or source open-data terms; retain attribution.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }], historicMaps: [], settlementPolygons: [], validation: [],
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

await writeFile(resolve('data/review/dykelands-pathhead-locality-additions-2026-08-30.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
  namingDecisions: [
    'Redford resolves to the already-published Redford Farm near Garvock and is not duplicated.',
    'Ecclesgreig represents the current mapped rural locality; its historical use as a name for St Cyrus does not create a duplicate village.',
    'Lochside is retained separately from the adjoining St Cyrus settlement.',
    'Pathhead resolves to the DD10 0AG Aberdeenshire locality near St Cyrus and Morphie, not Midlothian or Fife.',
  ],
  existing: [{ name: 'Redford', projectId: 'redford-garvock-scotland', score: 24 }],
  additions: seeds.map((seed) => ({ name: seed.name, projectId: seed.id, region: 'Aberdeenshire', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} new Dykelands-Pathhead catalogue places; reused Redford; none of the new entries publishes on the town map.`);
