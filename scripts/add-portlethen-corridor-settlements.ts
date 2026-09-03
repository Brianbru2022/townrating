import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-28';
const createdAt = `${reviewedAt}T12:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const portlethenCycleRoutes = 'https://www.aberdeenshire.gov.uk/media/25055/portlethen-cycling.pdf';
const corePaths = 'https://www.aberdeenshire.gov.uk/outdoor-access-and-countryside/paths/core-paths-plan';
const parks = 'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/parks-and-open-spaces/parks-and-open-spaces/';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

interface Seed {
  id: string;
  name: string;
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  summary: string;
  rationale: string;
  sources: string[];
}

const seeds: Seed[] = [
  {
    id: 'marywell-portlethen-scotland', name: 'Marywell', centre: [-2.11536, 57.08374], radius: 500,
    score: 29, dogRating: 1, character: 'Small edge-of-city village',
    summary: 'A small residential settlement on the Aberdeen–Portlethen corridor without a coherent visitor offer of its own.',
    rationale: 'Marywell remains useful in the regional catalogue, but nearby Cove, Portlethen and Hare Moss are not transferred into its settlement score.',
    sources: [osmCopyright],
  },
  {
    id: 'hillside-portlethen-scotland', name: 'Hillside', centre: [-2.1336982, 57.0717316], radius: 650,
    score: 35, dogRating: 2, character: 'Modern Portlethen neighbourhood',
    summary: 'A modern residential neighbourhood with local shared-use paths and services, but little destination-scale character.',
    rationale: 'The council Hillside loop supports everyday recreation; it does not turn this Portlethen neighbourhood into a separate tourist destination.',
    sources: [portlethenCycleRoutes, osmCopyright],
  },
  {
    id: 'findon-aberdeenshire-scotland', name: 'Findon', centre: [-2.1048863, 57.0686746], radius: 520,
    score: 61, dogRating: 2, character: 'Historic coastal fishing village',
    summary: 'A compact old fishing village with distinctive coastal character and direct links to the Portlethen coast.',
    rationale: 'Findon narrowly clears 60 on its own historic coastal-village fabric and seaward setting; modern Portlethen services and other fishing villages are not counted.',
    sources: [portlethenCycleRoutes, corePaths, osmCopyright],
  },
  {
    id: 'portlethen-scotland', name: 'Portlethen', centre: [-2.1347746, 57.0610557], radius: 1450,
    score: 57, dogRating: 2, character: 'Modern commuter and service town',
    summary: 'A practical service town with rail access, local paths and links to the coast, but limited destination character in the modern centre.',
    rationale: 'The town’s loops, station and services make it useful to visitors, while Findon, Old Portlethen, Downies and the coastal scenery retain their own scores.',
    sources: [portlethenCycleRoutes, corePaths, parks, osmCopyright],
  },
  {
    id: 'downies-scotland', name: 'Downies', centre: [-2.126153, 57.046574], radius: 480,
    score: 56, dogRating: 2, character: 'Small historic coastal village',
    summary: 'A small former fishing village with coastal views and a signed leisure-route connection, but very limited visitor depth.',
    rationale: 'Downies earns credit for its own coastal character and route access; Portlethen facilities and neighbouring villages are not borrowed.',
    sources: [portlethenCycleRoutes, corePaths, osmCopyright],
  },
  {
    id: 'newtonhill-scotland', name: 'Newtonhill', centre: [-2.1503377, 57.0321018], radius: 1050,
    score: 58, dogRating: 2, character: 'Coastal commuter town with an older village edge',
    summary: 'A substantial coastal settlement with local paths, community facilities and access towards the dramatic Kincardineshire coast.',
    rationale: 'Newtonhill is a useful local base, but Muchalls, Skateraw and nearby coastal landmarks are kept separate, leaving the town just below publication threshold.',
    sources: [corePaths, parks, osmCopyright],
  },
  {
    id: 'muchalls-scotland', name: 'Muchalls', centre: [-2.1619971, 57.0211625], radius: 600,
    score: 64, dogRating: 2, character: 'Conservation-area coastal village',
    summary: 'A distinctive historic coastal village with a conservation-area core and strong clifftop setting.',
    rationale: 'Muchalls clears 60 on its own conserved village character and coast-path setting; Newtonhill services and attractions beyond the village are excluded.',
    sources: [corePaths, parks, osmCopyright],
  },
  {
    id: 'auchlunies-scotland', name: 'Auchlunies', centre: [-2.1795621, 57.0895771], radius: 360,
    score: 18, dogRating: 1, character: 'Dispersed rural hamlet',
    summary: 'A small rural locality south of Aberdeen without a verified independent visitor experience.',
    rationale: 'Nearby Blairs, Hare Moss and Deeside attractions are recorded separately and do not inflate the hamlet score.',
    sources: [osmCopyright],
  },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const adjustment = townDogAccessScoreAdjustment(seed.dogRating);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: seed.name,
      centre: seed.centre, boundary,
      boundarySource: `OpenStreetMap locality position with a conservative ${seed.radius}m editorial study buffer`,
      boundaryConfidence: 'low', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt,
      methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition gate review. The score measures the settlement itself and does not transfer points from nearby attractions or neighbouring villages.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: adjustment,
        rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogRating,
        dogAccessSummary: seed.dogRating >= 2
          ? 'Public outdoor routes can form part of a dog visit, with ordinary close-control restrictions around roads, livestock, wildlife and shared spaces.'
          : 'No destination-scale dog visit or dedicated dog facilities are verified; use public routes responsibly.',
        methodVersion: '2026-08-28-strict-settlement-visitor-gate-v1', reviewedAt,
        sourceUrls: [...seed.sources, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character,
        headline: seed.score >= 60 ? 'A modest but coherent visitor stop' : 'A recorded locality rather than a tourist destination',
        intro: seed.rationale,
        bestFor: seed.score >= 60 ? ['Historic village character', 'Coastal walking'] : ['Regional reference'],
        perfectFor: seed.score >= 60 ? ['A short coastal-village stop'] : ['Identifying the locality while planning a wider route'],
        dontMiss: [], suggestedTime: seed.score >= 60 ? '1–2 hours' : 'Pass-through or local-purpose visit',
        visitorMood: seed.score >= 60
          ? 'Published at 60+ because the settlement itself supports a coherent short visit.'
          : 'Kept in the selector for completeness, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: seed.sources, lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: 'OpenStreetMap locality position with editorial buffer', sourceUrl: osmCopyright,
        sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary.',
      },
    },
    features: [],
    sources: [{
      id: `${seed.id}-locality`, name: `${seed.name} settlement gate review`,
      organisation: 'Aberdeenshire Council / OpenStreetMap contributors', coverage: seed.name,
      accessMethod: 'Mapped locality identification and source-backed editorial review', sourceUrl: seed.sources[0] ?? osmCopyright,
      licence: 'Source-linked editorial evidence; OpenStreetMap data under ODbL where used.',
      reliability: seed.sources[0]?.includes('aberdeenshire.gov.uk') ? 'local_authority' : 'secondary',
      limitations: 'Catalogue-addition review only; a later full audit may add practical places, dated heritage records and artwork without borrowing neighbouring attractions.',
    }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) {
  const fileName = `${pkg.project.id.replace(/-scotland$/, '')}.json`;
  await writeFile(resolve('data/projects', fileName), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

await writeFile('data/review/portlethen-corridor-settlement-gate-audit-2026-08-28.json', `${JSON.stringify({
  schemaVersion: 1, reviewedAt,
  rule: 'Every resolved place remains selectable with its canonical score; only settlements scoring 60 or more publish as town markers. Nearby attractions and neighbouring villages do not inflate settlement scores.',
  assessments: seeds.map((seed) => ({
    requestedName: seed.name, resolvedName: seed.name, projectId: seed.id, score: seed.score,
    dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60,
    rationale: seed.rationale, sourceUrls: seed.sources,
  })),
  notes: [
    'Marywell resolves to the AB12 settlement immediately north of Portlethen, not the separate places of the same name elsewhere in Scotland.',
    'Hillside is retained as the modern Portlethen neighbourhood rather than merged into the town record.',
    'Findon, Downies and Muchalls are assessed as individual historic coastal villages.',
    'Auchlunies resolves to the rural locality south of Aberdeen near Banchory-Devenick.',
    'This catalogue-addition pass does not claim a full practical, clue-trail or dated-HES audit; those remain required before a later full-audit completion claim.',
  ],
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} settlement packages; ${packages.filter((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60).length} qualify for the town map.`);
