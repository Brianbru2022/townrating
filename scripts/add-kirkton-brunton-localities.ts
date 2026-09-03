import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import {
  townDogAccessScoreAdjustment,
  townScoreAfterDogAccess,
  townScoreBand,
} from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-09-02';
const createdAt = `${reviewedAt}T16:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string;
  filename: string;
  requestedName: string;
  name: string;
  centre: [number, number];
  radius: number;
  initialScore: number;
  dogRating: TouristAppealRating;
  character: string;
  rationale: string;
  sourceUrl: string;
  resolutionNote?: string;
}

const seeds: Seed[] = [
  {
    id: 'kirkton-balmerino-scotland', filename: 'kirkton-balmerino.json', requestedName: 'Kirkton', name: 'Kirkton (Balmerino)',
    centre: [-3.0356292, 56.4137988], radius: 300, initialScore: 26, dogRating: 1,
    character: 'Small Balmerino-parish rural settlement',
    rationale: 'Kirkton is assessed separately from Balmerino Abbey, Gauldry and Bottomcraig, with no neighbouring attraction or service transferred into its score.',
    sourceUrl: 'https://fife-placenames.glasgow.ac.uk/parish/?id=14',
    resolutionNote: 'Resolved to Kirkton in Balmerino parish at NO362251 and labelled Kirkton (Balmerino) to avoid the other catalogue localities named Kirkton.',
  },
  {
    id: 'bottomcraig-scotland', filename: 'bottomcraig.json', requestedName: 'Bottomcraig', name: 'Bottomcraig',
    centre: [-3.0257615, 56.4084901], radius: 300, initialScore: 22, dogRating: 1,
    character: 'Small north Fife rural settlement',
    rationale: 'Bottomcraig remains a distinct selector entry and does not inherit Balmerino Abbey, Gauldry facilities or wider Tay routes.',
    sourceUrl: 'https://fife-placenames.glasgow.ac.uk/volume/?id=4',
  },
  {
    id: 'kilmany-scotland', filename: 'kilmany.json', requestedName: 'Kilmany', name: 'Kilmany',
    centre: [-2.9911061, 56.3845134], radius: 500, initialScore: 48, dogRating: 1,
    character: 'Historic parish village associated with Jim Clark',
    rationale: 'Kilmany is assessed on its own church, memorial, village environment and current facilities, without borrowing Cupar, Rathillet or private nearby properties.',
    sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=2904',
  },
  {
    id: 'rathillet-scotland', filename: 'rathillet.json', requestedName: 'Rathilllet', name: 'Rathillet',
    centre: [-3.0297488, 56.3761122], radius: 350, initialScore: 26, dogRating: 1,
    character: 'Historic rural hamlet and former estate settlement',
    rationale: 'Rathillet is scored as the present hamlet; documentary medieval history and nearby private estate land do not become visitor attractions without access evidence.',
    sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=2920',
    resolutionNote: 'The requested spelling is normalised to Rathillet.',
  },
  {
    id: 'hazelton-walls-scotland', filename: 'hazelton-walls.json', requestedName: 'Hazelton Walls', name: 'Hazelton Walls',
    centre: [-3.0737097, 56.3847240], radius: 350, initialScore: 20, dogRating: 1,
    character: 'Scattered rural hamlet above Creich',
    rationale: 'Hazelton Walls is retained as a named rural place and does not inherit Creich Castle, Brunton heritage or distant visitor businesses.',
    sourceUrl: 'https://fife-placenames.glasgow.ac.uk/volume/?id=4',
  },
  {
    id: 'creich-fife-scotland', filename: 'creich-fife.json', requestedName: 'Creich', name: 'Creich',
    centre: [-3.0818783, 56.3775101], radius: 700, initialScore: 40, dogRating: 1,
    character: 'Historic north Fife hamlet with castle remains',
    rationale: 'Creich is assessed on publicly appreciable in-boundary heritage; Brunton, Luthrie and wider parish attractions remain separate.',
    sourceUrl: 'https://www.getthedata.com/creich/where-is-creich',
  },
  {
    id: 'brunton-creich-scotland', filename: 'brunton-creich.json', requestedName: 'Brunton', name: 'Brunton (Creich)',
    centre: [-3.0981700, 56.3751500], radius: 400, initialScore: 42, dogRating: 1,
    character: 'Small north Fife conservation hamlet',
    rationale: 'Brunton is assessed as a conservation hamlet with its own built heritage; Creich Castle, Luthrie services and wider parish scenery are not transferred.',
    sourceUrl: osm('node', 4429679045),
    resolutionNote: 'Resolved to the conservation hamlet in Creich parish and labelled Brunton (Creich), not Brunton near Markinch.',
  },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.initialScore);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id,
      name: seed.name,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: 'Fife',
      locality: seed.name,
      centre: seed.centre,
      boundary,
      boundarySource: 'Resolved named-place location with a conservative strict settlement study buffer',
      boundaryConfidence: 'high',
      sourceLanguage: 'English',
      preferredBasemap: 'voyager',
      createdAt,
      methodology: defaultMethodology,
      researchNotes: `Catalogue-addition gate. ${seed.resolutionNote ?? ''} No neighbouring attraction, private property or parent-settlement service is transferred into this place score.`,
      touristAppeal: {
        score: seed.initialScore,
        dogOwnerScore: townScoreAfterDogAccess(seed.initialScore, seed.dogRating),
        dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating,
        label: band.label,
        summary: `${seed.name} is retained in the Fife selector while its complete sequential visitor audit is undertaken.`,
        dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are assumed at the catalogue-addition stage.',
        methodVersion: '2026-09-02-strict-settlement-intake-v1',
        reviewedAt,
        sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character,
        headline: 'A recorded place awaiting its complete sequential audit',
        intro: seed.rationale,
        bestFor: ['Regional reference'],
        perfectFor: ['Locating the place while planning a wider north Fife visit'],
        dontMiss: [],
        suggestedTime: 'Pass-through or pre-arranged visit only until the audit is complete',
        visitorMood: 'Selectable with a cautious intake score; absent from the main map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright],
        lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name,
        sourceName: 'Resolved mapped named-place location',
        sourceUrl: seed.sourceUrl,
        sourceVersion: reviewedAt,
        bufferMetres: seed.radius,
        localityBoundary: boundary,
        bufferedBoundary: boundary,
        notes: 'Strict editorial study area, not an administrative boundary. It is used consistently for local HES and visitor-place assignment.',
      },
    },
    features: [],
    sources: [{
      id: `${seed.id}-locality`,
      name: `${seed.name} locality resolution`,
      organisation: 'OpenStreetMap contributors / Fife Place-name Data / cited official source',
      coverage: seed.name,
      accessMethod: 'Named-place identification and boundary-aware editorial review',
      sourceUrl: seed.sourceUrl,
      licence: 'OpenStreetMap ODbL or cited source terms; retain attribution.',
      reliability: 'secondary',
      limitations: 'The intake score is deliberately provisional until the full audit gate passes.',
    }],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

for (const seed of seeds) {
  await writeFile(resolve('data/projects', seed.filename), `${JSON.stringify(packageFor(seed), null, 2)}\n`, 'utf8');
}

for (const filename of ['data/east-neuk-visitor-planner-curation.json', 'data/east-neuk-dog-access-curation.json']) {
  const library = JSON.parse(await readFile(resolve(filename), 'utf8')) as { reviewedAt?: string; projects: Record<string, unknown> };
  for (const seed of seeds) library.projects[seed.id] ??= {};
  library.reviewedAt = reviewedAt;
  await writeFile(resolve(filename), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

await writeFile(resolve('data/review/kirkton-brunton-locality-additions-2026-09-02.json'), `${JSON.stringify({
  schemaVersion: 1,
  reviewedAt,
  threshold: 60,
  rule: 'All resolved places remain selectable with a score; only independently audited settlements scoring 60 or more appear as town markers.',
  additions: seeds.map((seed) => ({
    requestedName: seed.requestedName,
    name: seed.name,
    projectId: seed.id,
    region: 'Fife',
    intakeScore: seed.initialScore,
    publishOnTownMap: false,
    rationale: seed.rationale,
    resolutionNote: seed.resolutionNote,
    sourceUrl: seed.sourceUrl,
  })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${seeds.length} new Kirkton-to-Brunton catalogue places; Logie will be re-audited in place.`);
