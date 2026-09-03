import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T09:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;
interface Seed { id: string; requestedName: string; name: string; centre: [number, number]; radius: number; score: number; dogRating: TouristAppealRating; character: string; rationale: string; sourceUrl: string; boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'] }
const seeds: Seed[] = [
  { id: 'ruthven-house-angus-scotland', requestedName: 'Rutgven House', name: 'Ruthven House', centre: [-3.1369050,56.6173467], radius: 500, score: 18, dogRating: 0, character: 'Private rural property', rationale: 'The requested spelling resolves to Ruthven House. It is retained as a named property rather than promoted as a settlement or assumed public attraction.', sourceUrl: osm('way',373252363) },
  { id: 'leys-of-cossans-scotland', requestedName: 'Leys of Cossans', name: 'Leys of Cossans', centre: [-2.9992763,56.6360378], radius: 550, score: 20, dogRating: 1, character: 'Rural Angus farm locality', rationale: 'A named rural locality without a verified independent visitor offer.', sourceUrl: osm('node',5716366892), boundaryConfidence: 'medium' },
  { id: 'glamis-scotland', requestedName: 'Glamis', name: 'Glamis', centre: [-3.0034297,56.6083190], radius: 950, score: 56, dogRating: 2, character: 'Historic conservation village', rationale: 'Glamis has clear village character and destination potential, but Glamis Castle is a separate attraction and does not by itself justify a 60+ settlement marker. A full audit is required before promotion.', sourceUrl: osm('node',1300032580) },
  { id: 'charleston-glamis-scotland', requestedName: 'Charleston', name: 'Charleston', centre: [-3.0081641,56.5986801], radius: 650, score: 30, dogRating: 1, character: 'Small planned Angus village', rationale: 'Charleston is retained independently and does not inherit visitor value from Glamis village or castle.', sourceUrl: osm('node',1300032505) },
  { id: 'castleton-of-eassie-scotland', requestedName: 'Castleton', name: 'Castleton of Eassie', centre: [-3.0856013,56.6069896], radius: 550, score: 20, dogRating: 1, character: 'Rural Eassie locality', rationale: 'The contextual request resolves to Castleton of Eassie, not Castleton near Marywell. It has no verified destination-scale visitor offer.', sourceUrl: osm('node',5276089425) },
  { id: 'balkeerie-scotland', requestedName: 'Balkeerie', name: 'Balkeerie', centre: [-3.0884632,56.5917653], radius: 650, score: 28, dogRating: 1, character: 'Rural Angus hamlet', rationale: 'A recognisable hamlet retained without borrowing interest from nearby Eassie heritage.', sourceUrl: osm('node',5000008574) },
  { id: 'kirkinch-scotland', requestedName: 'Kirkinch', name: 'Kirkinch', centre: [-3.1208978,56.5836470], radius: 650, score: 28, dogRating: 1, character: 'Small rural Angus village', rationale: 'Kirkinch remains selectable but lacks a verified independent visitor-town experience.', sourceUrl: osm('node',2775034303) },
  { id: 'eassie-scotland', requestedName: 'Eassie', name: 'Eassie', centre: [-3.0577404,56.6136318], radius: 800, score: 42, dogRating: 2, character: 'Historic rural parish locality', rationale: 'Eassie has genuine historic character, while the Pictish stone is separate attraction evidence and does not alone make the settlement a 60+ destination.', sourceUrl: osm('node',5000008573) },
  { id: 'wester-denoon-scotland', requestedName: 'Wester Denppn', name: 'Wester Denoon', centre: [-3.0633575,56.5772058], radius: 550, score: 20, dogRating: 1, character: 'Rural Angus farm locality', rationale: 'The requested spelling resolves to Wester Denoon, a named rural locality rather than a tourist settlement.', sourceUrl: osm('node',5716178764) },
  { id: 'nether-handwick-scotland', requestedName: 'Nether Handwick', name: 'Nether Handwick', centre: [-3.0269867,56.5644832], radius: 500, score: 18, dogRating: 1, character: 'Rural Angus property locality', rationale: 'A mapped property locality with no verified independent visitor offer.', sourceUrl: osm('node',5716178769) },
  { id: 'newtyle-scotland', requestedName: 'Newtyle', name: 'Newtyle', centre: [-3.1436686,56.5585738], radius: 1100, score: 54, dogRating: 2, character: 'Planned historic Angus village', rationale: 'Newtyle has substantial village character and visitor potential, but remains below the map gate until a full attractions, trails, daytime café and practical-facilities audit is completed.', sourceUrl: osm('node',1042695863) },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = { project: {
    id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
    centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
    researchNotes: 'Catalogue-addition settlement gate. Nearby castles, Pictish stones and other attractions do not inflate the settlement score.',
    touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label, summary: `${seed.name} is retained as an Angus regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating, dogAccessSummary: seed.dogRating === 0 ? 'No dependable public visitor or dog access has been verified.' : 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-30-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl,osmCopyright,outdoorCode] },
    visitorHighlights: [], townGuide: { characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [seed.sourceUrl,osmCopyright], lastReviewedAt: reviewedAt },
    townStudyArea: { localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.' },
  }, features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / cited mapping evidence', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }], historicMaps: [], settlementPolygons: [], validation: [] };
  pkg.validation = validateFeatures(pkg.project,pkg.features); return pkg;
}
const packages=seeds.map(packageFor);
for(const pkg of packages) await writeFile(resolve('data/projects',`${pkg.project.id.replace(/-scotland$/,'')}.json`),`${JSON.stringify(pkg,null,2)}\n`,'utf8');
const plannerPath=resolve('data/cairn-o-mount-visitor-planner-curation.json'); const dogPath=resolve('data/cairn-o-mount-dog-access-curation.json');
const planner=JSON.parse(await readFile(plannerPath,'utf8')); const dog=JSON.parse(await readFile(dogPath,'utf8'));
for(const seed of seeds){planner.projects[seed.id]={};dog.projects[seed.id]={};} planner.reviewedAt=reviewedAt; dog.reviewedAt=reviewedAt;
await Promise.all([writeFile(plannerPath,`${JSON.stringify(planner,null,2)}\n`,'utf8'),writeFile(dogPath,`${JSON.stringify(dog,null,2)}\n`,'utf8')]);
await writeFile(resolve('data/review/glamis-newtyle-locality-additions-2026-08-30.json'),`${JSON.stringify({schemaVersion:1,reviewedAt,threshold:60,rule:'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Nearby attractions are not transferred into settlement scores.',namingDecisions:['Rutgven House resolves to Ruthven House.','Wester Denppn resolves to Wester Denoon.','The contextual Castleton resolves to Castleton of Eassie, not Castleton near Marywell.'],additions:seeds.map(seed=>({requestedName:seed.requestedName,resolvedName:seed.name,projectId:seed.id,region:'Angus',score:seed.score,dogOwnerScore:townScoreAfterDogAccess(seed.score,seed.dogRating),publishOnTownMap:seed.score>=60,rationale:seed.rationale,sourceUrl:seed.sourceUrl,boundaryConfidence:seed.boundaryConfidence??'high'}))},null,2)}\n`,'utf8');
console.log(`Added ${packages.length} Glamis–Newtyle catalogue places; none publish on the town map.`);
