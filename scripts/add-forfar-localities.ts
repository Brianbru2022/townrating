import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T21:30:00.000Z`;
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

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
  osmId: number;
  osmType?: 'node' | 'relation';
  evidenceUrls?: string[];
}

const seeds: Seed[] = [
  { id: 'memus-scotland', requestedName: 'memus', name: 'Memus', centre: [-2.9385008, 56.7194667], radius: 750, score: 44, dogRating: 2, character: 'Small Angus glen village', rationale: 'Memus has a recognisable village identity but insufficient independent visitor depth for a town marker.', osmId: 4947003539 },
  { id: 'tannadice-scotland', requestedName: 'tannadice', name: 'Tannadice', centre: [-2.8591293, 56.7124480], radius: 850, score: 48, dogRating: 2, character: 'Historic South Esk village', rationale: 'Tannadice has genuine village character, while surrounding estates and countryside remain separate visitor propositions.', osmId: 4166648489 },
  { id: 'inverquharity-scotland', requestedName: 'inverquharrity', name: 'Inverquharity', centre: [-2.9731392, 56.7073044], radius: 700, score: 38, dogRating: 1, character: 'Rural castle and farm hamlet', rationale: 'The hamlet is retained independently; Inverquharity Castle and the Roman site do not inflate the settlement score.', osmId: 5649554444 },
  { id: 'murthill-scotland', requestedName: 'murthil', name: 'Murthill', centre: [-2.8795662, 56.7043036], radius: 550, score: 20, dogRating: 1, character: 'Small rural Angus hamlet', rationale: 'The requested spelling resolves to Murthill, a named hamlet rather than an independent visitor destination.', osmId: 5750380975 },
  { id: 'finavon-scotland', requestedName: 'finavon', name: 'Finavon', centre: [-2.8269938, 56.7062525], radius: 700, score: 42, dogRating: 2, character: 'Historic rural Angus hamlet', rationale: 'Finavon has local historic character, while Finavon Hill and nearby attractions remain separately assessed.', osmId: 5312046009 },
  { id: 'oathlaw-scotland', requestedName: 'oathlaw', name: 'Oathlaw', centre: [-2.8589047, 56.6959859], radius: 750, score: 44, dogRating: 2, character: 'Small historic Angus village', rationale: 'Oathlaw has a distinct village centre but limited visitor depth beyond its local character.', osmId: 5000008587 },
  { id: 'shielhill-memus-scotland', requestedName: 'shielhill', name: 'Shielhill', centre: [-2.9375809, 56.7044458], radius: 550, score: 20, dogRating: 1, character: 'Rural hamlet near Memus', rationale: 'This resolves to Shielhill by Memus, not the separate Shielhill near Newbigging.', osmId: 6258057004 },
  { id: 'carse-gray-scotland', requestedName: 'carse gray', name: 'Carse Gray', centre: [-2.8754203, 56.6729158], radius: 550, score: 18, dogRating: 1, character: 'Rural farm hamlet north of Forfar', rationale: 'Carse Gray is retained as a regional reference rather than a visitor destination.', osmId: 5248843256 },
  { id: 'mosside-ballinshoe-scotland', requestedName: 'mosside', name: 'Mosside', centre: [-2.9342257, 56.6604713], radius: 550, score: 20, dogRating: 1, character: 'Rural Ballinshoe locality', rationale: 'The requested Mosside resolves to Mosside of Ballinshoe in this Forfar-area batch.', osmId: 5726917923 },
  { id: 'lunanhead-scotland', requestedName: 'lunanhead', name: 'Lunanhead', centre: [-2.8570716, 56.6584322], radius: 850, score: 38, dogRating: 2, character: 'Small village adjoining Forfar', rationale: 'Lunanhead remains independently scored and does not inherit Forfar attractions.', osmId: 408608619 },
  { id: 'forfar-scotland', requestedName: 'forfar', name: 'Forfar', centre: [-2.8882120, 56.6443013], radius: 2400, score: 72, dogRating: 2, character: 'Historic Angus market town', rationale: 'Forfar has independent visitor depth through the Meffan Museum, town heritage, Forfar Loch and Balmashanner, supporting a preliminary 70–79 town score.', osmId: 8489414, osmType: 'relation', evidenceUrls: ['https://visitangus.com/plan-your-trip/explore-our-towns/forfar/', 'https://visitangus.com/get-inspired/heritage-trails/forfar-heritage-trail/', 'https://angusalive.scot/museums-galleries/visit-a-museum-gallery/meffan-museum-and-art-gallery/'] },
  { id: 'padanaram-scotland', requestedName: 'padanaram', name: 'Padanaram', centre: [-2.9348116, 56.6518538], radius: 750, score: 34, dogRating: 1, character: 'Small village west of Forfar', rationale: 'Padanaram is retained separately without inheriting Forfar or Glamis visitor interest.', osmId: 3922238274 },
  { id: 'drumgley-scotland', requestedName: 'drumgley', name: 'Drumgley', centre: [-2.9453639, 56.6389555], radius: 900, score: 22, dogRating: 2, character: 'Scattered rural locality southwest of Forfar', rationale: 'Drumgley represents the Nether, Upper and Easter Drumgley cluster; its core paths and dog park do not make the settlement a tourist town.', osmId: 5716366883 },
];

function sourceUrl(seed: Seed) {
  return `https://www.openstreetmap.org/${seed.osmType ?? 'node'}/${seed.osmId}`;
}

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const sourceUrls = [sourceUrl(seed), ...(seed.evidenceUrls ?? []), osmCopyright];
  const pkg: ProjectPackage = {
    project: {
      id: seed.id,
      name: seed.name,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: 'Angus',
      locality: seed.name,
      centre: seed.centre,
      boundary,
      boundarySource: 'OpenStreetMap named-place location with a conservative editorial study buffer',
      boundaryConfidence: 'high',
      sourceLanguage: 'English',
      preferredBasemap: 'voyager',
      createdAt,
      methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, neighbouring towns and landscape destinations do not inflate the place score.',
      touristAppeal: {
        score: seed.score,
        dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
        dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating,
        label: band.label,
        summary: `${seed.name} is retained as a regional reference pending any full destination audit.`,
        dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-29-strict-settlement-gate-v1',
        reviewedAt,
        sourceUrls: [...sourceUrls, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character,
        headline: seed.score >= 60 ? 'A worthwhile Angus town pending a full visitor audit' : 'A recorded place pending any full destination audit',
        intro: seed.rationale,
        bestFor: seed.score >= 60 ? ['Angus history', 'Town and loch walking'] : ['Regional reference'],
        perfectFor: [seed.score >= 60 ? 'A preliminary Angus day-out shortlist' : 'Identifying the locality while planning a wider Angus route'],
        dontMiss: [],
        suggestedTime: seed.score >= 60 ? 'Half day pending full audit' : 'Pass-through or pre-arranged visit only',
        visitorMood: seed.score >= 60 ? 'Published provisionally from independent town evidence; detailed facilities await the full audit.' : 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls,
        lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name,
        sourceName: 'OpenStreetMap named-place location',
        sourceUrl: sourceUrl(seed),
        sourceVersion: reviewedAt,
        bufferMetres: seed.radius,
        localityBoundary: boundary,
        bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: sourceUrl(seed), licence: 'OpenStreetMap data under ODbL.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }],
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
for (const seed of seeds) {
  planner.projects[seed.id] = {};
  dog.projects[seed.id] = {};
}
planner.reviewedAt = reviewedAt;
dog.reviewedAt = reviewedAt;
await Promise.all([
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8'),
]);

await writeFile(resolve('data/review/forfar-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1,
  reviewedAt,
  threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
  namingDecisions: [
    'inverquharrity resolves to Inverquharity.',
    'murthil resolves to Murthill.',
    'Shielhill resolves to the hamlet by Memus, not Shielhill near Newbigging.',
    'Mosside resolves to Mosside of Ballinshoe in this Forfar-area batch.',
    'Drumgley represents the Nether, Upper and Easter Drumgley cluster.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrls: [sourceUrl(seed), ...(seed.evidenceUrls ?? [])] })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Forfar-area catalogue places; ${packages.filter((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60).length} publishes on the town map.`);
