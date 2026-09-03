import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T18:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string; name: string; centre: [number, number]; radius: number; score: number;
  dogRating: TouristAppealRating; character: string; rationale: string; sourceUrl: string;
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'auchenblae-scotland', name: 'Auchenblae', centre: [-2.4500865, 56.8985423], radius: 1100, score: 58, dogRating: 2, character: 'Historic Mearns village', rationale: 'Auchenblae has a coherent village identity and local services, but remains below the map gate until a full visitor audit verifies its complete offer.', sourceUrl: osm('node', 60481123) },
  { id: 'monboddo-house-scotland', name: 'Monboddo House', centre: [-2.42076, 56.89484], radius: 600, score: 28, dogRating: 1, character: 'Privately occupied historic estate', rationale: 'Monboddo House is retained as a heritage estate reference. Its historical importance is not treated as public access and does not inflate Auchenblae.', sourceUrl: 'https://www.trove.scot/place/36440', boundaryConfidence: 'high' },
  { id: 'mondynes-scotland', name: 'Mondynes', centre: [-2.36428, 56.90551], radius: 850, score: 30, dogRating: 1, character: 'Historic rural Mearns locality', rationale: 'Mondynes is the wider named locality around its farms, bridge and traditional King Duncan association, without a destination-scale visitor offer.', sourceUrl: 'https://mapcarta.com/38910862', boundaryConfidence: 'medium' },
  { id: 'brownmuir-fordoun-scotland', name: 'Brownmuir', centre: [-2.43243, 56.88794], radius: 700, score: 24, dogRating: 1, character: 'Small Fordoun-area rural locality', rationale: 'Brownmuir is retained separately from Fordoun and the former airfield records; neither nearby history nor housing development makes it a tourist settlement.', sourceUrl: 'https://www.trove.scot/place/276655', boundaryConfidence: 'medium' },
  { id: 'fordoun-scotland', name: 'Fordoun', centre: [-2.4123908, 56.8735394], radius: 1050, score: 54, dogRating: 2, character: 'Established historic Mearns village', rationale: 'Fordoun has genuine village character and services, but remains below 60 pending a full destination audit and does not inherit nearby estate value.', sourceUrl: osm('node', 785388763) },
  { id: 'parkneuk-arbuthnott-scotland', name: 'Parkneuk', centre: [-2.3425555, 56.8739428], radius: 650, score: 28, dogRating: 1, character: 'Small Arbuthnott-area hamlet', rationale: 'This resolves to Parkneuk beside Arbuthnott, distinct from the Glendavan place of the same name.', sourceUrl: osm('node', 8312876496) },
  { id: 'arbuthnott-scotland', name: 'Arbuthnott', centre: [-2.3305743, 56.8692091], radius: 950, score: 46, dogRating: 2, character: 'Historic Mearns village and parish centre', rationale: 'Arbuthnott has a distinct historic village identity, while private estate and church heritage remain independently assessed.', sourceUrl: osm('node', 5503607524) },
  { id: 'scotston-laurencekirk-scotland', name: 'Scotston', centre: [-2.4394, 56.8551], radius: 750, score: 28, dogRating: 1, character: 'Dispersed Laurencekirk-area settlement', rationale: 'This resolves to Scotston near Laurencekirk, not Scotston of Kirkside or the Aberdeen locality.', sourceUrl: 'https://britishlistedbuildings.co.uk/200397473-scotston-laurencekirk', boundaryConfidence: 'medium' },
  { id: 'garvock-laurencekirk-scotland', name: 'Garvock', centre: [-2.4199231, 56.8247011], radius: 850, score: 38, dogRating: 2, character: 'Small historic Mearns hamlet', rationale: 'Garvock has a distinct church-and-hamlet identity but insufficient verified visitor infrastructure for a town marker.', sourceUrl: osm('node', 11279257006) },
  { id: 'redford-garvock-scotland', name: 'Redford', centre: [-2.3974586, 56.8242792], radius: 650, score: 24, dogRating: 1, character: 'Rural Garvock farm hamlet', rationale: 'This is the Redford Farm locality near Garvock, retained separately from Redford near Carmyllie.', sourceUrl: osm('node', 11279256144) },
  { id: 'tulloch-garvock-scotland', name: 'Tulloch', centre: [-2.3733, 56.8331], radius: 900, score: 26, dogRating: 1, character: 'Nether and Easter Tulloch rural cluster', rationale: 'Tulloch represents the Garvock-area Nether and Easter Tulloch cluster rather than inventing separate tourist settlements for each farm.', sourceUrl: osm('node', 10751686579), boundaryConfidence: 'medium' },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions and heritage properties do not inflate the settlement score.',
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
await writeFile(resolve('data/review/auchenblae-garvock-locality-additions-2026-08-30.json'), `${JSON.stringify({ schemaVersion: 1, reviewedAt, threshold: 60, rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.', namingDecisions: ['Monboddo House is retained as an estate, not used to inflate Auchenblae.', 'Mondynes is the wider recognised locality.', 'Parkneuk resolves to the Arbuthnott-area hamlet.', 'Scotston resolves to the Laurencekirk locality.', 'Redford resolves to Redford Farm near Garvock and remains separate from Redford near Carmyllie.', 'Tulloch represents the Nether and Easter Tulloch cluster.'], additions: seeds.map((seed) => ({ name: seed.name, projectId: seed.id, region: 'Aberdeenshire', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })) }, null, 2)}\n`, 'utf8');
console.log(`Added ${packages.length} Auchenblae-Garvock catalogue places; none publish on the town map.`);
