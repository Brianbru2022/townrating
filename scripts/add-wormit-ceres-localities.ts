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
const createdAt = `${reviewedAt}T10:00:00.000Z`;
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
  { id: 'wormit-scotland', filename: 'wormit.json', requestedName: 'Wormit', name: 'Wormit', centre: [-2.9768521, 56.4256079], radius: 1600, initialScore: 56, dogRating: 2, character: 'Tay-side village and bridge viewpoint', rationale: 'Wormit is assessed as a village with its own bay, bridge views and routes, without borrowing Newport-on-Tay or Dundee services.', sourceUrl: osm('node', 21511505) },
  { id: 'pickletillum-scotland', filename: 'pickletillum.json', requestedName: 'Pickletilem', name: 'Pickletillum', centre: [-2.9147719, 56.4108366], radius: 500, initialScore: 20, dogRating: 1, character: 'Small rural hamlet', rationale: 'The roughly twelve-household hamlet is retained without inheriting Drumoig or Tayport visitor businesses.', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=3003', resolutionNote: 'The requested spelling is normalised to Pickletillum.' },
  { id: 'lucklawhill-scotland', filename: 'lucklawhill.json', requestedName: 'lucklawhill', name: 'Lucklawhill', centre: [-2.9303857, 56.3871654], radius: 650, initialScore: 34, dogRating: 2, character: 'Hill-foot hamlet', rationale: 'The settlement and the promoted Lucklaw Hill circuit are distinguished so the route does not manufacture a rounded town offer.', sourceUrl: osm('node', 4346667928) },
  { id: 'balmullo-scotland', filename: 'balmullo.json', requestedName: 'bumullo', name: 'Balmullo', centre: [-2.9269390, 56.3772778], radius: 900, initialScore: 48, dogRating: 2, character: 'North-east Fife village below Lucklaw Hill', rationale: 'Balmullo is assessed on its own village fabric, current daytime provision and genuine local walks.', sourceUrl: osm('node', 726213921), resolutionNote: 'The requested spelling is normalised to Balmullo.' },
  { id: 'logie-fife-scotland', filename: 'logie-fife.json', requestedName: 'logie', name: 'Logie', centre: [-2.9670405, 56.3720742], radius: 700, initialScore: 38, dogRating: 1, character: 'Small historic parish village', rationale: 'Logie is assessed independently from Balmullo, Dairsie and nearby estates.', sourceUrl: osm('node', 4346667927), resolutionNote: 'Resolved to Logie in north-east Fife.' },
  { id: 'dairsie-scotland', filename: 'dairsie.json', requestedName: 'dairsie of osnaburgh', name: 'Dairsie', centre: [-2.9492916, 56.3451958], radius: 1400, initialScore: 52, dogRating: 1, character: 'Historic village also known as Osnaburgh', rationale: 'The village is assessed separately from private Dairsie Castle; publicly visitable heritage may contribute only where access is evidenced.', sourceUrl: osm('node', 97889808), resolutionNote: 'Dairsie of Osnaburgh is catalogued under the current mapped name Dairsie.' },
  { id: 'kemback-scotland', filename: 'kemback.json', requestedName: 'kemback', name: 'Kemback', centre: [-2.94552, 56.32610], radius: 750, initialScore: 40, dogRating: 2, character: 'Rural village beside Dura Den', rationale: 'Kemback is assessed as a small locality; the privately converted former church and cross-boundary routes are not treated as a complete destination.', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=1172', boundaryConfidence: 'medium' },
  { id: 'blebo-craigs-scotland', filename: 'blebo-craigs.json', requestedName: 'Blebocraig', name: 'Blebo Craigs', centre: [-2.9236281, 56.3258601], radius: 700, initialScore: 38, dogRating: 2, character: 'Small woodland-edge village', rationale: 'Community facilities and informal local woodland access are recorded without treating them as staffed visitor attractions.', sourceUrl: osm('node', 1455278267), resolutionNote: 'The requested spelling is normalised to Blebo Craigs.' },
  { id: 'pitscottie-scotland', filename: 'pitscottie.json', requestedName: 'pitscottie', name: 'Pitscottie', centre: [-2.9439551, 56.3078171], radius: 850, initialScore: 52, dogRating: 2, character: 'Dura Den hamlet', rationale: 'The hamlet is assessed on its own café and route access; wider Dura Den scenery is included only where the public route genuinely enters the boundary.', sourceUrl: osm('node', 1455278265) },
  { id: 'baldinnie-scotland', filename: 'baldinnie.json', requestedName: 'baldinnie', name: 'Baldinnie', centre: [-2.9246217, 56.2913514], radius: 500, initialScore: 22, dogRating: 1, character: 'Small rural hamlet', rationale: 'Baldinnie remains selectable but does not inherit Ceres or Peat Inn services and attractions.', sourceUrl: osm('node', 1455278271) },
  { id: 'bridgend-ceres-scotland', filename: 'bridgend-ceres.json', requestedName: 'bridgend', name: 'Bridgend (Ceres)', centre: [-2.9781530, 56.2960325], radius: 400, initialScore: 18, dogRating: 1, character: 'Historic west-end neighbourhood of Ceres', rationale: 'Bridgend is retained as a separately selectable historic locality and does not inherit the museum, cafés or facilities in central Ceres.', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/parish/?id=17', resolutionNote: 'Resolved to the Bridgend recorded at the west end of Ceres, not another Fife Bridgend.', boundaryConfidence: 'medium' },
  { id: 'ceres-scotland', filename: 'ceres.json', requestedName: 'ceres', name: 'Ceres', centre: [-2.9704927, 56.2924394], radius: 1100, initialScore: 58, dogRating: 2, character: 'Historic village, green and folk museum', rationale: 'Ceres receives a full independent audit of the museum, daytime food, routes and public facilities before its final score is published.', sourceUrl: osm('node', 60684781) },
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
      researchNotes: `Catalogue-addition gate. ${seed.resolutionNote ?? ''} No neighbouring attraction, estate, beach, golf course or parent-town service is transferred into this place score.`,
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
  const pkg = packageFor(seed);
  await writeFile(resolve('data/projects', seed.filename), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

for (const filename of ['data/east-neuk-visitor-planner-curation.json', 'data/east-neuk-dog-access-curation.json']) {
  const library = JSON.parse(await readFile(resolve(filename), 'utf8')) as { reviewedAt?: string; projects: Record<string, unknown> };
  for (const seed of seeds) library.projects[seed.id] ??= {};
  library.reviewedAt = reviewedAt;
  await writeFile(resolve(filename), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

await writeFile(resolve('data/review/wormit-ceres-locality-additions-2026-09-02.json'), `${JSON.stringify({
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

console.log(`Added ${seeds.length} Wormit-Ceres catalogue places for sequential full audit.`);
