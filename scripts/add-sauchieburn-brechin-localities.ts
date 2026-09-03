import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T21:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string; requestedName: string; name: string; region: 'Aberdeenshire' | 'Angus';
  centre: [number, number]; radius: number; score: number; dogRating: TouristAppealRating;
  character: string; rationale: string; sourceUrl: string;
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'sauchieburn-scotland', requestedName: 'sauchieburn', name: 'Sauchieburn', region: 'Aberdeenshire', centre: [-2.5513292,56.8174421], radius: 500, score: 20, dogRating: 1, character: 'Small Luthermuir-area rural locality', rationale: 'A small rural locality retained separately from Luthermuir; neighbouring village services are not borrowed.', sourceUrl: osm('node',14029905314) },
  { id: 'luthermuir-scotland', requestedName: 'luthermuir', name: 'Luthermuir', region: 'Aberdeenshire', centre: [-2.5602584,56.8065359], radius: 800, score: 48, dogRating: 2, character: 'Established Mearns village', rationale: 'Luthermuir has a coherent village identity but remains below the tourist-town gate until a full audit verifies its independent visitor offer.', sourceUrl: osm('node',4224197191) },
  { id: 'north-water-bridge-scotland', requestedName: 'north water bridge', name: 'North Water Bridge', region: 'Angus', centre: [-2.5702311,56.7849019], radius: 600, score: 34, dogRating: 2, character: 'River-crossing hamlet on the Angus boundary', rationale: 'The bridge and roadside cluster form a recognised locality, but transport geography alone does not establish a destination-scale visit.', sourceUrl: osm('node',5329907969) },
  { id: 'edzell-scotland', requestedName: 'edzell', name: 'Edzell', region: 'Angus', centre: [-2.6558539,56.8099863], radius: 1100, score: 58, dogRating: 2, character: 'Planned historic Angus village', rationale: 'Edzell has strong village character and services but remains just below 60 pending a complete visitor audit; Edzell Castle must be assessed as a separate See place rather than automatically inflating the settlement.', sourceUrl: osm('node',408767284) },
  { id: 'pert-angus-scotland', requestedName: 'pert', name: 'Pert', region: 'Angus', centre: [-2.5644604,56.7821228], radius: 450, score: 22, dogRating: 1, character: 'Small North Esk roadside locality', rationale: 'Pert is retained as a distinct rural locality near North Water Bridge without borrowing the bridge or neighbouring attractions.', sourceUrl: osm('node',8604177563) },
  { id: 'marykirk-scotland', requestedName: 'marky kirk', name: 'Marykirk', region: 'Aberdeenshire', centre: [-2.5152053,56.7813709], radius: 800, score: 44, dogRating: 2, character: 'Historic Mearns village', rationale: 'The requested spelling resolves to Marykirk. The village has a distinct identity but insufficient verified visitor depth for the main map pending a full audit.', sourceUrl: osm('node',370779196) },
  { id: 'craigo-angus-scotland', requestedName: 'craigo', name: 'Craigo', region: 'Angus', centre: [-2.5097846,56.7706385], radius: 650, score: 30, dogRating: 1, character: 'Small Angus village and former mill locality', rationale: 'Craigo is a recognised settlement, but industrial history and nearby rural heritage do not alone create a complete visitor destination.', sourceUrl: osm('node',5000008571) },
  { id: 'logie-craigo-scotland', requestedName: 'logie', name: 'Logie', region: 'Angus', centre: [-2.4947397,56.7621599], radius: 500, score: 22, dogRating: 1, character: 'Craigo-area rural locality', rationale: 'This resolves to Logie near Craigo, not the existing Logie Coldstone or the separately requested Logie Pert.', sourceUrl: osm('node',5357384741) },
  { id: 'hillside-montrose-scotland', requestedName: 'hillside', name: 'Hillside', region: 'Angus', centre: [-2.4767609,56.7404910], radius: 850, score: 42, dogRating: 2, character: 'Established village north of Montrose', rationale: 'This is Hillside beside Montrose, distinct from Hillside near Portlethen. It has village services but no verified destination-scale offer yet.', sourceUrl: osm('node',408888140) },
  { id: 'kirkhill-montrose-scotland', requestedName: 'kirkhill', name: 'Kirkhill', region: 'Angus', centre: [-2.5108979,56.7339391], radius: 500, score: 22, dogRating: 1, character: 'Small Montrose-area rural locality', rationale: 'Kirkhill is retained as a named rural locality and does not inherit Montrose or House of Dun attractions.', sourceUrl: osm('node',4422991739) },
  { id: 'dun-angus-scotland', requestedName: 'dun', name: 'Dun', region: 'Angus', centre: [-2.5482042,56.7300564], radius: 700, score: 38, dogRating: 2, character: 'Historic Bridge of Dun parish settlement', rationale: 'Dun has a recognisable parish identity, but House of Dun is a separately assessed attraction and cannot create a tourist-town score for the settlement.', sourceUrl: osm('node',5326445161) },
  { id: 'brechin-scotland', requestedName: 'brechin', name: 'Brechin', region: 'Angus', centre: [-2.6600193,56.7315193], radius: 1500, score: 58, dogRating: 2, character: 'Historic cathedral city and Angus market town', rationale: 'Brechin clearly warrants a full audit, but remains immediately below the map threshold until its See, Eat, trail and practical visitor evidence is fully checked.', sourceUrl: osm('node',5312776000) },
  { id: 'keithock-scotland', requestedName: 'keithock', name: 'Keithock', region: 'Angus', centre: [-2.6506774,56.7612636], radius: 600, score: 24, dogRating: 1, character: 'Rural locality north of Brechin', rationale: 'Keithock is a dispersed rural locality and does not inherit Brechin attractions or private estate value.', sourceUrl: osm('node',8604143226) },
  { id: 'logie-pert-scotland', requestedName: 'logie pert', name: 'Logie Pert', region: 'Angus', centre: [-2.5470368,56.7694488], radius: 650, score: 28, dogRating: 1, character: 'Historic North Esk parish locality', rationale: 'Logie Pert is retained separately from Logie near Craigo; parish history does not imply a complete current visitor experience.', sourceUrl: osm('node',8604177547) },
  { id: 'muirton-of-ballochy-scotland', requestedName: 'muirton of ballochy', name: 'Muirton of Ballochy', region: 'Angus', centre: [-2.5761055,56.7542476], radius: 500, score: 20, dogRating: 1, character: 'Small rural property cluster', rationale: 'A mapped rural locality rather than an independently visitable settlement; nearby river and estate features remain separate.', sourceUrl: osm('node',3998615885) },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: seed.region, locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, estates and neighbouring settlements do not inflate the place score.',
      touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label, summary: `${seed.name} is retained as a ${seed.region} regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating, dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-30-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode] },
      visitorHighlights: [],
      townGuide: { characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus and Mearns route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt },
      townStudyArea: { localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.' },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap ODbL; retain contributor attribution.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }], historicMaps: [], settlementPolygons: [], validation: [],
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

await writeFile(resolve('data/review/sauchieburn-brechin-locality-additions-2026-08-30.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
  namingDecisions: [
    'Marky Kirk is normalised to Marykirk.',
    'Logie resolves to the Craigo-area locality and remains distinct from Logie Coldstone and Logie Pert.',
    'Hillside resolves to the village north of Montrose and remains distinct from Hillside near Portlethen.',
    'Dun resolves to the settlement at Bridge of Dun; House of Dun remains a separate attraction.',
    'Keithock resolves to the locality north of Brechin.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, name: seed.name, projectId: seed.id, region: seed.region, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Sauchieburn-Brechin catalogue places; none publishes on the town map pending a full audit.`);
