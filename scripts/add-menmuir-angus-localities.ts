import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T19:15:00.000Z`;
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

interface Seed {
  id: string; requestedName: string; name: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; rationale: string;
  sourceUrl: string; confidence?: ProjectPackage['project']['boundaryConfidence'];
}

const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;
const seeds: Seed[] = [
  { id: 'glenmoy-angus-scotland', requestedName: 'Glenmoy', name: 'Glenmoy', centre: [-2.9775549, 56.7705486], radius: 600, score: 22, dogRating: 1, character: 'Rural Angus glen locality', rationale: 'Glenmoy is retained as the mapped rural locality; the wider glen landscape remains a separate outdoor proposition.', sourceUrl: osm('node', 5750363826) },
  { id: 'glenquiech-scotland', requestedName: 'Glenqueich', name: 'Glenquiech', centre: [-2.9419503, 56.7437697], radius: 550, score: 20, dogRating: 1, character: 'Dispersed Angus locality', rationale: 'The requested spelling resolves to mapped Glenquiech, a small rural locality rather than a visitor destination.', sourceUrl: osm('node', 4898813772) },
  { id: 'glenogil-scotland', requestedName: 'Glenogil', name: 'Glenogil', centre: [-2.9066824, 56.7595173], radius: 600, score: 24, dogRating: 1, character: 'Historic rural estate locality', rationale: 'Estate character and nearby landscape interest do not by themselves create an independent tourist-town score.', sourceUrl: osm('node', 3998661025) },
  { id: 'auchnacree-scotland', requestedName: 'Auchnacree', name: 'Auchnacree', centre: [-2.8773970, 56.7626304], radius: 550, score: 20, dogRating: 1, character: 'Rural Angus locality', rationale: 'Auchnacree is retained for regional reference without borrowing neighbouring attractions.', sourceUrl: osm('node', 5750474062) },
  { id: 'ogil-angus-scotland', requestedName: 'Ogil', name: 'Ogil', centre: [-2.9025731, 56.7426534], radius: 750, score: 20, dogRating: 1, character: 'Historic Ogil farming locality', rationale: 'Ogil is represented as the historic rural locality around Easter and Mains of Ogil; Hill of Ogil and Den of Ogil are not treated as town assets.', sourceUrl: osm('node', 5312619152), confidence: 'medium' },
  { id: 'fern-angus-scotland', requestedName: 'Fern', name: 'Fern', centre: [-2.8457875, 56.7438996], radius: 800, score: 42, dogRating: 2, character: 'Small historic Angus village', rationale: 'Fern has recognisable village and heritage character, but its limited scale and practical offer keep it below the 60+ town-map threshold.', sourceUrl: osm('node', 471989811) },
  { id: 'newmill-of-inshewan-scotland', requestedName: 'Newmill of Inshewan', name: 'Newmill of Inshewan', centre: [-2.9456688, 56.7360328], radius: 500, score: 18, dogRating: 1, character: 'Rural mill locality', rationale: 'A named rural property cluster rather than an independent visitor settlement.', sourceUrl: osm('node', 5750351332) },
  { id: 'bridgend-menmuir-scotland', requestedName: 'Bridgend', name: 'Bridgend', centre: [-2.7600534, 56.8046674], radius: 550, score: 20, dogRating: 1, character: 'Rural Angus bridge locality', rationale: 'This is the Bridgend north-west of Balfield, kept distinct from the existing Muir of Fowlis namesake.', sourceUrl: osm('node', 5000008590) },
  { id: 'balfield-angus-scotland', requestedName: 'Balfield', name: 'Balfield', centre: [-2.7454358, 56.8057093], radius: 550, score: 20, dogRating: 1, character: 'Rural Angus locality', rationale: 'Balfield remains selectable as a named locality without an independent visitor offer.', sourceUrl: osm('node', 5286352662) },
  { id: 'dunlappie-scotland', requestedName: 'Dunlapple', name: 'Dunlappie', centre: [-2.6777456, 56.7998974], radius: 550, score: 20, dogRating: 1, character: 'Rural Edzell locality', rationale: 'The requested spelling resolves to mapped Dunlappie; it is a rural locality rather than a tourist destination.', sourceUrl: osm('node', 5752194582) },
  { id: 'tillyarblet-scotland', requestedName: 'Tillyarblet', name: 'Tillyarblet', centre: [-2.7868157, 56.7933162], radius: 500, score: 18, dogRating: 1, character: 'Rural Angus farm locality', rationale: 'Tillyarblet is retained for regional reference without transferring nearby landscape appeal.', sourceUrl: osm('node', 4894765876) },
  { id: 'kirkton-of-menmuir-scotland', requestedName: 'Kirkton of Menmuir', name: 'Kirkton of Menmuir', centre: [-2.7645082, 56.7686055], radius: 850, score: 44, dogRating: 2, character: 'Historic small Angus village', rationale: 'Kirkton of Menmuir has genuine village and heritage character, but not enough independently verified visitor depth for a 60+ marker.', sourceUrl: osm('node', 5000008588) },
  { id: 'tigerton-scotland', requestedName: 'Tigerton', name: 'Tigerton', centre: [-2.7550793, 56.7689321], radius: 500, score: 24, dogRating: 1, character: 'Small Menmuir locality', rationale: 'The duplicated request is represented once; Tigerton remains distinct from adjacent Kirkton of Menmuir.', sourceUrl: osm('node', 1335006811) },
  { id: 'mains-of-balhall-scotland', requestedName: 'Mains of Balhall', name: 'Mains of Balhall', centre: [-2.7923280, 56.7601869], radius: 550, score: 20, dogRating: 1, character: 'Historic farm locality', rationale: 'Historic fabric may appear as dated evidence, but the farm locality is not an independent visitor destination.', sourceUrl: osm('node', 5750474067) },
  { id: 'lochty-menmuir-scotland', requestedName: 'Lochty', name: 'Lochty', centre: [-2.7564937, 56.7510703], radius: 500, score: 18, dogRating: 1, character: 'Rural Menmuir locality', rationale: 'Lochty is retained as a mapped rural place-name rather than a destination town.', sourceUrl: osm('node', 5750495869) },
  { id: 'belliehill-scotland', requestedName: 'Belliehill', name: 'Belliehill', centre: [-2.7131229, 56.7610616], radius: 650, score: 20, dogRating: 1, character: 'Rural Menmuir locality', rationale: 'Belliehill is retained as the rural locality; the nearby scheduled prehistoric settlement is heritage evidence and does not inflate the place score.', sourceUrl: 'https://www.openstreetmap.org/?mlat=56.7610616&mlon=-2.7131229#map=16/56.7611/-2.7131', confidence: 'medium' },
  { id: 'little-brechin-scotland', requestedName: 'Little Brechin', name: 'Little Brechin', centre: [-2.6867295, 56.7534588], radius: 800, score: 38, dogRating: 2, character: 'Small historic Angus village', rationale: 'Little Brechin has modest village character but too little independent visitor depth for the main map.', sourceUrl: osm('node', 5286716231) },
  { id: 'west-muir-little-brechin-scotland', requestedName: 'West Muir', name: 'West Muir', centre: [-2.7093604, 56.7453294], radius: 500, score: 18, dogRating: 1, character: 'Rural Little Brechin locality', rationale: 'This is the West Muir beside Little Brechin, kept distinct from Westmuir near Kirriemuir.', sourceUrl: osm('node', 5750495896) },
  { id: 'newtonmill-inchbare-scotland', requestedName: 'Newtonmill', name: 'Newtonmill', centre: [-2.6469935, 56.7679034], radius: 550, score: 20, dogRating: 1, character: 'Rural Inchbare locality', rationale: 'Newtonmill is retained as a named rural locality without borrowing nearby Brechin attractions.', sourceUrl: osm('node', 3643240882) },
  { id: 'inchbare-scotland', requestedName: 'Inchbuare', name: 'Inchbare', centre: [-2.6454074, 56.7804626], radius: 850, score: 40, dogRating: 2, character: 'Small Angus village', rationale: 'The requested spelling resolves to Inchbare. Its village services and character remain below the 60+ visitor threshold.', sourceUrl: osm('node', 408767223) },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: seed.confidence ?? 'high',
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, heritage sites and landscape destinations do not inflate the place score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: `${seed.name} is retained as a regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-29-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus route'], dontMiss: [],
        suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt,
        bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / cited mapping evidence', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) await writeFile(resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
const planner = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog = JSON.parse(await readFile(dogPath, 'utf8'));
for (const seed of seeds) { planner.projects[seed.id] = {}; dog.projects[seed.id] = {}; }
planner.reviewedAt = reviewedAt; dog.reviewedAt = reviewedAt;
await Promise.all([writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'), writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8')]);

await writeFile(resolve('data/review/menmuir-angus-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60, duplicateRequests: ['Tigerton'],
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
  namingDecisions: ['Glenqueich resolves to Glenquiech.', 'Dunlapple resolves to Dunlappie.', 'Inchbuare resolves to Inchbare.', 'Bridgend resolves to the Angus locality north-west of Balfield.', 'Ogil is the wider historic rural locality centred on Mains/Easter Ogil, not Hill of Ogil.', 'Belliehill is the rural locality and is not scored from its scheduled monument.', 'West Muir is the Little Brechin locality, distinct from Westmuir near Kirriemuir.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.confidence ?? 'high' })),
}, null, 2)}\n`, 'utf8');
console.log(`Added ${packages.length} unique Menmuir–Angus catalogue places; de-duplicated Tigerton; none publish on the town map.`);
