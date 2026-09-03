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
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  {
    id: 'woodside-largo-scotland', filename: 'woodside-largo.json', requestedName: 'Woodside', name: 'Woodside (Largo)',
    centre: [-2.93367, 56.26042], radius: 520, initialScore: 18, dogRating: 1,
    character: 'Small Largo-parish rural hamlet',
    rationale: 'Woodside is retained as the hamlet west of New Gilston and is not confused with Woodside in Aberdeen or allowed to inherit Ceres, Peat Inn or Largo attractions.',
    sourceUrl: osm('node', 3920983223), resolutionNote: 'Resolved to Woodside beside New Gilston in Fife; displayed with Largo qualifier to prevent ambiguity.',
  },
  {
    id: 'new-gilston-scotland', filename: 'new-gilston.json', requestedName: 'New Gilston', name: 'New Gilston',
    centre: [-2.9191816, 56.2626422], radius: 720, initialScore: 30, dogRating: 1,
    character: 'Linear former mining hamlet',
    rationale: 'New Gilston is assessed on its own historic settlement fabric and community hall without borrowing neighbouring estates, scheduled cairns or destination restaurants.',
    sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=1342',
  },
  {
    id: 'wester-newburn-scotland', filename: 'wester-newburn.json', requestedName: 'Wester Newburn', name: 'Wester Newburn',
    centre: [-2.9020555, 56.2360451], radius: 480, initialScore: 14, dogRating: 1,
    character: 'Historic named farm locality',
    rationale: 'Wester Newburn is a farm locality rather than a visitor village; Newburn churches, Largo Law and nearby accommodation remain outside its settlement score.',
    sourceUrl: osm('way', 516494991), boundaryConfidence: 'medium',
  },
  {
    id: 'lundin-links-scotland', filename: 'lundin-links.json', requestedName: 'Lundin Links', name: 'Lundin Links',
    centre: [-2.9544147, 56.2126211], radius: 1100, initialScore: 58, dogRating: 2,
    character: 'Victorian coastal and golf village',
    rationale: 'Lundin Links is assessed independently through its beach-edge setting, scheduled standing stones, golf visitor offer, daytime coffee and routes that genuinely enter the village.',
    sourceUrl: osm('node', 533603387),
  },
  {
    id: 'lower-largo-scotland', filename: 'lower-largo.json', requestedName: 'Lower LArge', name: 'Lower Largo',
    centre: [-2.9371002, 56.2129474], radius: 1050, initialScore: 58, dogRating: 2,
    character: 'Historic Largo Bay fishing village',
    rationale: 'Lower Largo is assessed on its harbour, beach, Alexander Selkirk associations, independent trails, café and practical facilities without inheriting Upper Largo or Leven.',
    sourceUrl: osm('node', 533603388), resolutionNote: 'The requested spelling is normalised to Lower Largo.',
  },
  {
    id: 'drumeldrie-scotland', filename: 'drumeldrie.json', requestedName: 'Drumildrie', name: 'Drumeldrie',
    centre: [-2.9014701, 56.2182582], radius: 1350, initialScore: 44, dogRating: 1,
    character: 'Small historic parish hamlet',
    rationale: 'Drumeldrie keeps its strong Newburn church history in See, but that heritage alone does not make the hamlet a rounded visitor destination.',
    sourceUrl: osm('node', 2275768784), resolutionNote: 'The requested spelling is normalised to the established Drumeldrie.',
  },
  {
    id: 'leven-fife-scotland', filename: 'leven-fife.json', requestedName: 'Leven', name: 'Leven',
    centre: [-2.99692, 56.1954351], radius: 2300, initialScore: 58, dogRating: 2,
    character: 'Forth-coast town, beach and green spaces',
    rationale: 'Leven receives a complete town-scale audit of its beach, parks, heritage railway, family activity, coffee-and-cake stops, trails and public facilities.',
    sourceUrl: osm('node', 46971338),
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
      boundaryConfidence: seed.boundaryConfidence ?? 'high',
      sourceLanguage: 'English',
      preferredBasemap: 'voyager',
      createdAt,
      methodology: defaultMethodology,
      researchNotes: `Catalogue-addition gate. ${seed.resolutionNote ?? ''} Nearby attractions and services are excluded unless the full audit proves that they form part of this place's own visit.`,
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
        perfectFor: ['Locating the place while planning a wider Fife visit'],
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
      organisation: 'OpenStreetMap contributors / Fife Place-name Data / cited local source',
      coverage: seed.name,
      accessMethod: 'Named-place identification and boundary-aware editorial review',
      sourceUrl: seed.sourceUrl,
      licence: 'OpenStreetMap ODbL or cited source terms; retain attribution.',
      reliability: 'secondary',
      limitations: 'The intake score is provisional until the full audit gate passes.',
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

await writeFile(resolve('data/review/woodside-leven-locality-additions-2026-09-02.json'), `${JSON.stringify({
  schemaVersion: 1,
  reviewedAt,
  threshold: 60,
  rule: 'All resolved places remain selectable with a score; only independently audited settlements scoring 60 or more appear as town markers.',
  additions: seeds.map((seed) => ({
    requestedName: seed.requestedName,
    name: seed.name,
    projectId: seed.id,
    intakeScore: seed.initialScore,
    publishOnTownMap: false,
    rationale: seed.rationale,
    resolutionNote: seed.resolutionNote,
    sourceUrl: seed.sourceUrl,
  })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${seeds.length} Woodside-to-Leven catalogue places for sequential full audit.`);
