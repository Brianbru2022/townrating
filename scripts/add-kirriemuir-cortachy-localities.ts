import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T20:30:00.000Z`;
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

interface Seed {
  id: string; requestedName: string; name: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; rationale: string;
  osmId: number;
}

const seeds: Seed[] = [
  { id: 'pearsie-scotland', requestedName: 'Pearsire', name: 'Pearsie', centre: [-3.0385035, 56.7212550], radius: 600, score: 20, dogRating: 1, character: 'Rural Glen Prosen locality', rationale: 'The requested spelling resolves to Pearsie. Estate and glen scenery remain separate visitor propositions.', osmId: 4899982235 },
  { id: 'cortachy-scotland', requestedName: 'cortacvhy', name: 'Cortachy', centre: [-2.9889300, 56.7232471], radius: 850, score: 48, dogRating: 2, character: 'Historic small Angus village', rationale: 'Cortachy has genuine village and heritage character, while the castle and wider estate must be assessed separately and do not lift the settlement above 60.', osmId: 5000008584 },
  { id: 'balloch-rottal-scotland', requestedName: 'balloch', name: 'Balloch', centre: [-3.0370829, 56.8182547], radius: 500, score: 18, dogRating: 1, character: 'Remote Rottal farm locality', rationale: 'This is the mapped Balloch beside Rottal, not Ballochan or the East and West Balloch farms near Kirriemuir.', osmId: 4898875874 },
  { id: 'kirkton-of-kingoldrum-scotland', requestedName: 'kirton of kingoldrum', name: 'Kirkton of Kingoldrum', centre: [-3.0865585, 56.6825201], radius: 850, score: 42, dogRating: 2, character: 'Small historic Angus village', rationale: 'The kirkton has recognisable settlement character but too little independent visitor depth for a 60+ town marker.', osmId: 5000008580 },
  { id: 'kinnordy-scotland', requestedName: 'kinnordy', name: 'Kinnordy', centre: [-3.0328612, 56.6843330], radius: 650, score: 28, dogRating: 1, character: 'Rural Kirriemuir estate locality', rationale: 'Kinnordy is retained as a locality; Loch of Kinnordy and estate heritage remain separate See propositions.', osmId: 3922437885 },
  { id: 'northmuir-scotland', requestedName: 'northmuir', name: 'Northmuir', centre: [-3.0049192, 56.6826961], radius: 850, score: 30, dogRating: 1, character: 'Residential neighbour of Kirriemuir', rationale: 'Northmuir is retained independently without inheriting Kirriemuir attractions or score.', osmId: 3922238334 },
  { id: 'mains-of-ballindarg-scotland', requestedName: 'mains of ballindarg', name: 'Mains of Ballindarg', centre: [-2.9719928, 56.6478697], radius: 500, score: 18, dogRating: 1, character: 'Rural Angus farm locality', rationale: 'A named farm locality rather than an independent visitor destination.', osmId: 562695220 },
  { id: 'westmuir-kirriemuir-scotland', requestedName: 'westmuir', name: 'Westmuir', centre: [-3.0373390, 56.6616444], radius: 850, score: 40, dogRating: 2, character: 'Small village near Kirriemuir', rationale: 'Westmuir has modest village identity but must not inherit Kirriemuir attractions or the score of the larger town.', osmId: 3922238336 },
  { id: 'kirkton-of-airlie-scotland', requestedName: 'kiirkton of airlie', name: 'Kirkton of Airlie', centre: [-3.1219472, 56.6503851], radius: 850, score: 40, dogRating: 2, character: 'Small historic Angus kirkton', rationale: 'Historic character supports a modest score, while Airlie Castle and wider estate interest remain separate visitor propositions.', osmId: 5286188121 },
];

const sourceUrl = (seed: Seed) => `https://www.openstreetmap.org/node/${seed.osmId}`;
function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'OpenStreetMap named-place location with a conservative editorial study buffer', boundaryConfidence: 'high',
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, neighbouring towns and landscape destinations do not inflate the place score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: `${seed.name} is retained as a regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-29-strict-settlement-gate-v1', reviewedAt,
        sourceUrls: [sourceUrl(seed), osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only',
        visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [sourceUrl(seed), osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: { localityName: seed.name, sourceName: 'OpenStreetMap named-place location', sourceUrl: sourceUrl(seed), sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.' },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: sourceUrl(seed), licence: 'OpenStreetMap data under ODbL.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }],
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

await writeFile(resolve('data/review/kirriemuir-cortachy-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
  existingEntries: [{ requestedName: 'kirriemuir', resolvedName: 'Kirriemuir', projectId: 'kirriemuir-scotland', score: 73 }],
  namingDecisions: ['Pearsire resolves to Pearsie.', 'cortacvhy resolves to Cortachy.', 'kirton of kingoldrum resolves to Kirkton of Kingoldrum.', 'kiirkton of airlie resolves to Kirkton of Airlie.', 'Balloch resolves to the locality beside Rottal.', 'Westmuir is distinct from West Muir near Little Brechin.', 'Kirriemuir already exists and is not duplicated.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: sourceUrl(seed) })),
}, null, 2)}\n`, 'utf8');
console.log(`Added ${packages.length} Kirriemuir–Cortachy catalogue places; reused Kirriemuir; none of the new places publish on the town map.`);
