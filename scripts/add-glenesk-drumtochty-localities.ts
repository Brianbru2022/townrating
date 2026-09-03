import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T15:30:00.000Z`;
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

interface Seed {
  id: string; requestedName: string; name: string; region: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; summary: string; rationale: string;
  sourceUrl: string; boundarySource: string; boundaryConfidence: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'invermark-lodge-scotland', requestedName: 'Invermark lodge', name: 'Invermark Lodge', region: 'Angus', centre: [-2.9268856, 56.9128459], radius: 520, score: 24, dogRating: 1, character: 'Private historic shooting lodge', summary: 'A historic shooting lodge and estate property rather than a visitor settlement.', rationale: 'The 1852 lodge is retained as a named property. Invermark Castle, Loch Lee and Glen Esk walks are separate See or trail propositions and do not create a town score.', sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB35618/', boundarySource: 'Angus Historic Environment Record and OpenStreetMap property location with a tight editorial study buffer', boundaryConfidence: 'high' },
  { id: 'auchronie-glenesk-scotland', requestedName: 'Auchronie', name: 'Auchronie', region: 'Angus', centre: [-2.9067627, 56.9144159], radius: 500, score: 18, dogRating: 1, character: 'Isolated Glen Esk dwelling', summary: 'An isolated dwelling and historic place-name rather than an independent visitor settlement.', rationale: 'This is the Angus Auchronie beside Invermark, not East Auchronie near Skene. Nearby Invermark Castle and Loch Lee remain separately assessed.', sourceUrl: 'https://www.openstreetmap.org/node/4899830265', boundarySource: 'OpenStreetMap isolated-dwelling node with a tight editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'cairncross-glenesk-scotland', requestedName: 'Cairncross', name: 'Cairncross', region: 'Angus', centre: [-2.8258025, 56.9034554], radius: 650, score: 24, dogRating: 1, character: 'Dispersed Glen Esk farming locality', summary: 'A dispersed historic farming locality without a complete independent visitor offer.', rationale: 'Cairncross is retained as the Glen Esk locality. The glen’s long-distance walking and estate landscape are not transferred into the settlement score.', sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB35517/', boundarySource: 'Angus Historic Environment Record centre for Nether Cairncross with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'drumtochty-castle-scotland', requestedName: 'Drumtochty Castle', name: 'Drumtochty Castle', region: 'Aberdeenshire', centre: [-2.4946548, 56.9108138], radius: 600, score: 20, dogRating: 1, character: 'Private castle and estate property', summary: 'A castle and estate venue rather than a public visitor settlement.', rationale: 'The castle is retained as a named place, but architectural interest and event use do not imply general public access or justify a town marker.', sourceUrl: 'https://www.openstreetmap.org/way/306426048', boundarySource: 'OpenStreetMap castle footprint with a conservative estate-locality study buffer', boundaryConfidence: 'medium' },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: seed.region, locality: seed.name,
      centre: seed.centre, boundary, boundarySource: seed.boundarySource, boundaryConfidence: seed.boundaryConfidence,
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, neighbouring settlements and private properties do not inflate the place score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-29-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the property or locality while planning a wider route'], dontMiss: [],
        suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: seed.boundarySource, sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt,
        bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / official historic-environment evidence', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used; source-linked editorial evidence.', reliability: 'secondary', limitations: 'Preliminary catalogue gate. A later full visitor audit may add verified facilities, trails and artwork without borrowing neighbouring attractions.' }],
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

await writeFile(resolve('data/review/glenesk-drumtochty-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions and private properties never inflate locality scores.',
  existingEntries: [{ requestedName: 'Glendyne Lodge', resolvedName: 'Glendye Lodge', projectId: 'glendye-lodge-scotland' }, { requestedName: 'Bridge of Dye', resolvedName: 'Bridge of Dye', projectId: 'bridge-of-dye-scotland' }],
  namingDecisions: ['Glendyne Lodge resolves to the existing Glendye Lodge record.', 'Bridge of Dye already exists and is not duplicated.', 'Auchronie resolves to the Angus dwelling beside Invermark, distinct from East Auchronie in Aberdeenshire.', 'Cairncross resolves to the Glen Esk locality in Angus.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: seed.region, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Glen Esk–Drumtochty catalogue places; reused Glendye Lodge and Bridge of Dye; none of the new places publish on the town map.`);
