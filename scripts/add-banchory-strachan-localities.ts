import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T14:00:00.000Z`;
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

interface Seed {
  id: string; requestedName: string; name: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; summary: string; rationale: string;
  sourceUrl: string; boundarySource: string; boundaryConfidence: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'tillydrine-scotland', requestedName: 'Tillydrine', name: 'Tillydrine', centre: [-2.65741, 57.07820], radius: 520, score: 24, dogRating: 1, character: 'Small Deeside locality', summary: 'A small rural locality without a complete independent visitor offer.', rationale: "Kincardine O'Neil and surrounding Deeside attractions remain separately assessed and do not inflate Tillydrine.", sourceUrl: 'https://www.getthedata.com/tillydrine/where-is-tillydrine', boundarySource: 'Ordnance Survey Open Names centre with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'brathens-scotland', requestedName: 'Brathens', name: 'Brathens', centre: [-2.53336, 57.07322], radius: 650, score: 38, dogRating: 2, character: 'Small Deeside hamlet', summary: 'A small hamlet with rural character but limited independent visitor depth.', rationale: 'Banchory, Inchmarlo and nearby heritage remain separately bounded; their facilities are not transferred into Brathens.', sourceUrl: 'https://www.getthedata.com/brathens/where-is-brathens', boundarySource: 'Ordnance Survey Open Names centre with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'backhill-of-trustach-scotland', requestedName: 'Backhill of Trustach', name: 'Backhill of Trustach', centre: [-2.5993742, 57.0640644], radius: 500, score: 18, dogRating: 1, character: 'Dispersed rural locality', summary: 'A small recorded rural locality rather than a tourist settlement.', rationale: 'The Trustach hills and informal countryside routes are not assumed to be visitor facilities or public attractions for the locality.', sourceUrl: 'https://streetmap.co.uk/map?mapp=map&searchp=ids&st=4&sv=363750%2C797162&tl=Backhill+of+Trustach+in+Aberdeenshire&x=363750&y=797162&z=0', boundarySource: 'Ordnance Survey gazetteer grid location with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'bridge-of-canny-scotland', requestedName: 'Bridge of Canny', name: 'Bridge of Canny', centre: [-2.5722498, 57.0641650], radius: 560, score: 32, dogRating: 2, character: 'Small bridge hamlet', summary: 'A compact Deeside hamlet with limited independently verified visitor depth.', rationale: 'The bridge and countryside setting identify the hamlet, but Banchory and Inchmarlo services are not borrowed into its score.', sourceUrl: 'https://www.openstreetmap.org/node/6567890921', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'east-mains-banchory-scotland', requestedName: 'East Mains', name: 'East Mains', centre: [-2.5294963, 57.0642467], radius: 500, score: 26, dogRating: 1, character: 'Small Banchory-side hamlet', summary: 'A small hamlet within Banchory’s wider setting, without a separate visitor offer.', rationale: 'This resolves to East Mains near Banchory and Brathens, not the South Lanarkshire namesake. Banchory attractions and facilities remain with Banchory.', sourceUrl: 'https://www.openstreetmap.org/node/6567945110', boundarySource: 'OpenStreetMap hamlet node with a tight editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'arbeadie-scotland', requestedName: 'Arbeadie', name: 'Arbeadie', centre: [-2.495209, 57.053417], radius: 480, score: 16, dogRating: 1, character: 'Historic Banchory locality', summary: 'A former settlement now absorbed into Banchory rather than a separate visitor town.', rationale: 'Council evidence says Banchory amalgamated Arbeadie and Upper Arbeadie in the 1800s. This reference entry is distinct from Woodside of Arbeadie and cannot duplicate Banchory’s visitor offer.', sourceUrl: 'https://www.ouraberdeenshire.org.uk/wp-content/uploads/2025/06/2025-BANCHORY-LOCAL-PLACE-PLAN.pdf', boundarySource: 'Banchory Local Place Plan historic-settlement evidence and current road location with a tight editorial study buffer', boundaryConfidence: 'high' },
  { id: 'auchattie-scotland', requestedName: 'Auchattie', name: 'Auchattie', centre: [-2.5066, 57.0419], radius: 650, score: 28, dogRating: 2, character: 'Small rural Banchory locality', summary: 'A small rural locality south of Banchory with limited independent visitor depth.', rationale: 'Scolty Hill and Banchory remain separate visitor propositions. Their appeal does not promote Auchattie as a destination.', sourceUrl: 'https://publications.aberdeenshire.gov.uk/acblobstorage/0f690451-9c00-44ff-88fe-78fb9a3357b7/south-highways-list.pdf', boundarySource: 'Ordnance Survey Open Names centre and Aberdeenshire Council Auchattie Road evidence with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'belts-of-collonach-scotland', requestedName: 'Belts of Collanach', name: 'Belts of Collonach', centre: [-2.51816, 57.02700], radius: 600, score: 30, dogRating: 2, character: 'Small Strachan-area settlement', summary: 'A small rural settlement with local landscape context but limited independent visitor depth.', rationale: 'The requested spelling is corrected to Collonach. Strachan, Scolty and nearby archaeology remain separately assessed rather than transferred into this settlement score.', sourceUrl: 'https://aberdeenshire.moderngov.co.uk/Data/Infrastructure%20Services%20Committee/20090430/Agenda/g.%20Settlements%20Marr.pdf', boundarySource: 'Aberdeenshire Council settlement location with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'tillygarmond-scotland', requestedName: 'Tillygaemmond', name: 'Tillygarmond', centre: [-2.6100, 57.0280], radius: 650, score: 22, dogRating: 1, character: 'Historic Finzean farming locality', summary: 'A dispersed historic farming locality rather than a tourist settlement.', rationale: 'The requested spelling is normalised to Tillygarmond. Finzean Estate and wider Birse attractions are separate and do not create a town score here.', sourceUrl: 'https://britishplacenames.uk/scotland/aberdeenshire', boundarySource: 'Ordnance Survey gazetteer grid reference NO630933 with a conservative editorial study buffer', boundaryConfidence: 'medium' },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: seed.boundarySource, boundaryConfidence: seed.boundaryConfidence,
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, neighbouring settlements and private properties do not inflate the settlement score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogRating,
        dogAccessSummary: seed.dogRating >= 2 ? 'Local outdoor access may support a dog walk, with close control around roads, livestock and wildlife.' : 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-29-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded locality pending any full destination audit', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider route'], dontMiss: [],
        suggestedTime: 'Pass-through or local-purpose visit', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: seed.boundarySource, sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt,
        bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} settlement gate`, organisation: 'OpenStreetMap contributors / official gazetteer evidence', coverage: seed.name, accessMethod: 'Mapped locality identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used; source-linked editorial evidence.', reliability: 'secondary', limitations: 'Preliminary catalogue gate. A later full visitor audit may add verified facilities, trails and artwork without borrowing neighbouring attractions.' }],
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

await writeFile(resolve('data/review/banchory-strachan-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  existingEntries: [{ requestedName: 'Deebank', projectId: 'deebank-scotland' }, { requestedName: 'Strachan', projectId: 'strachan-scotland' }],
  namingDecisions: ['Deebank and Strachan already exist and are not duplicated.', 'Arbeadie is retained as a historical locality absorbed into Banchory and remains distinct from Woodside of Arbeadie.', 'Belts of Collanach is corrected to Belts of Collonach.', 'Tillygaemmond is corrected to Tillygarmond.', 'East Mains resolves to the Banchory-area hamlet, not the South Lanarkshire namesake.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Banchory–Strachan catalogue places; reused Deebank and Strachan; none of the new places publish on the town map.`);
