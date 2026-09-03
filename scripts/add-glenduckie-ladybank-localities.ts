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
const createdAt = `${reviewedAt}T18:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

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
    id: 'glenduckie-scotland',
    filename: 'glenduckie.json',
    requestedName: 'Glenduckie',
    name: 'Glenduckie',
    centre: [-3.1616183, 56.3558067],
    radius: 450,
    initialScore: 54,
    dogRating: 2,
    character: 'Small north Fife hill-foot hamlet',
    rationale:
      'Glenduckie is assessed on its own route access and settlement fabric without borrowing Newburgh or wider Tay facilities.',
    sourceUrl: 'https://www.openstreetmap.org/node/13004427062',
  },
  {
    id: 'luthrie-scotland',
    filename: 'luthrie.json',
    requestedName: 'Luthrie',
    name: 'Luthrie',
    centre: [-3.084673, 56.364087],
    radius: 500,
    initialScore: 57,
    dogRating: 2,
    character: 'Rural village below Norman’s Law',
    rationale:
      'Luthrie is assessed as the route village and community-hall starting point; intermittent events are not treated as a permanent café.',
    sourceUrl: 'https://www.openstreetmap.org/node/2583945591',
  },
  {
    id: 'moonzie-scotland',
    filename: 'moonzie.json',
    requestedName: 'Moozie',
    name: 'Moonzie',
    centre: [-3.0606835, 56.3444536],
    radius: 750,
    initialScore: 46,
    dogRating: 1,
    character: 'Scattered historic parish locality',
    rationale:
      'Moonzie is retained for its church and rare advertised garden opening, not scored as an everyday serviced destination.',
    sourceUrl: 'https://www.openstreetmap.org/node/5412606317',
    resolutionNote: 'The requested “Moozie” is normalised to Moonzie.',
  },
  {
    id: 'kilmaron-castle-scotland',
    filename: 'kilmaron-castle.json',
    requestedName: 'Kilmarton Castle',
    name: 'Kilmaron Castle',
    centre: [-3.03927, 56.33345],
    radius: 600,
    initialScore: 18,
    dogRating: 0,
    character: 'Former mansion estate locality',
    rationale:
      'The 1815 mansion is demolished and the surviving estate remains private; its national records stay available without creating a public attraction.',
    sourceUrl: 'https://www.trove.scot/place/100435',
    resolutionNote:
      'Resolved as Kilmaron Castle near Cupar, not Kilmartin in Argyll; the principal house was demolished.',
  },
  {
    id: 'lindifferon-scotland',
    filename: 'lindifferon.json',
    requestedName: 'Lindifferon',
    name: 'Lindifferon',
    centre: [-3.1080267, 56.3348892],
    radius: 500,
    initialScore: 22,
    dogRating: 0,
    character: 'Small historic farm locality',
    rationale:
      'Lindifferon remains a selector record and does not inherit Luthrie, Moonzie or Fernie visitor content.',
    sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=3083',
  },
  {
    id: 'fernie-castle-scotland',
    filename: 'fernie-castle.json',
    requestedName: 'Fernie',
    name: 'Fernie Castle',
    centre: [-3.10695, 56.3204239],
    radius: 350,
    initialScore: 36,
    dogRating: 0,
    character: 'Private castle-hotel estate locality',
    rationale:
      'Fernie Castle is a trading hotel and event venue rather than an unrestricted public attraction; accommodation and full-meal trade do not inflate the locality score.',
    sourceUrl:
      'https://www-eur.cvent.com/venues/en-US/cupar/special-event-venue/fernie-castle/venue-f9ff8113-c0fa-4701-a5f9-ffecdfddfabd',
    resolutionNote:
      'Resolved to the Fernie Castle estate locality rather than inventing a separate village.',
  },
  {
    id: 'letham-fife-scotland',
    filename: 'letham-fife.json',
    requestedName: 'Letham',
    name: 'Letham (Fife)',
    centre: [-3.1203005, 56.3171635],
    radius: 450,
    initialScore: 34,
    dogRating: 1,
    character: 'Small rural Fife village',
    rationale:
      'This is the Fife village, kept distinct from Letham in Angus and audited only on its own current public offer.',
    sourceUrl: 'https://www.openstreetmap.org/node/29621843',
    resolutionNote: 'Labelled Letham (Fife) to distinguish it from the existing Angus entry.',
  },
  {
    id: 'bow-of-fife-scotland',
    filename: 'bow-of-fife.json',
    requestedName: 'Bow of Fife',
    name: 'Bow of Fife',
    centre: [-3.0999757, 56.3034556],
    radius: 450,
    initialScore: 26,
    dogRating: 1,
    character: 'Small Howe of Fife settlement',
    rationale:
      'Bow of Fife remains a named selector locality with no neighbouring estate, café or attraction transferred into it.',
    sourceUrl: 'https://www.openstreetmap.org/node/2231237288',
  },
  {
    id: 'cupar-muir-scotland',
    filename: 'cupar-muir.json',
    requestedName: 'Cupar Muir',
    name: 'Cupar Muir',
    centre: [-3.0357329, 56.3073997],
    radius: 500,
    initialScore: 28,
    dogRating: 1,
    character: 'Small settlement south-west of Cupar',
    rationale:
      'Cupar Muir is audited separately and does not inherit Cupar town-centre services, trails or heritage.',
    sourceUrl: 'https://www.openstreetmap.org/node/1450724513',
  },
  {
    id: 'cupar-scotland',
    filename: 'cupar.json',
    requestedName: 'Cupar',
    name: 'Cupar',
    centre: [-3.0116545, 56.3193913],
    radius: 1500,
    initialScore: 82,
    dogRating: 2,
    character: 'Historic market town and former county town',
    rationale:
      'Cupar has a substantial independently visitable heritage, café, park, trail and practical-facility offer.',
    sourceUrl: 'https://www.openstreetmap.org/node/29755168',
  },
  {
    id: 'craigrothie-scotland',
    filename: 'craigrothie.json',
    requestedName: 'Craigrothie',
    name: 'Craigrothie',
    centre: [-3.0043429, 56.2854714],
    radius: 450,
    initialScore: 59,
    dogRating: 2,
    character: 'Compact village on an historic route corridor',
    rationale:
      'Craigrothie has a documented weekly café and route context, but limited always-available facilities keep it below the map threshold.',
    sourceUrl: 'https://www.openstreetmap.org/node/60684782',
  },
  {
    id: 'pitlessie-scotland',
    filename: 'pitlessie.json',
    requestedName: 'Pitlessie',
    name: 'Pitlessie',
    centre: [-3.0773494, 56.2754275],
    radius: 500,
    initialScore: 59,
    dogRating: 2,
    character: 'Howe of Fife village beside the River Eden',
    rationale:
      'Pitlessie has a genuine daytime inn stop and walking context, but not enough independently verified practical breadth for a 60+ destination score.',
    sourceUrl: 'https://www.openstreetmap.org/node/4241330189',
  },
  {
    id: 'springfield-fife-scotland',
    filename: 'springfield-fife.json',
    requestedName: 'Springfield',
    name: 'Springfield (Fife)',
    centre: [-3.0645656, 56.2952787],
    radius: 550,
    initialScore: 59,
    dogRating: 2,
    character: 'Railway village and walking-route start',
    rationale:
      'Springfield is a useful documented trail start but a route alone does not make the settlement a rounded destination.',
    sourceUrl: 'https://www.openstreetmap.org/node/21517339',
    resolutionNote:
      'Labelled Springfield (Fife) to avoid ambiguity with other Scottish Springfields.',
  },
  {
    id: 'ladybank-scotland',
    filename: 'ladybank.json',
    requestedName: 'Ladybank',
    name: 'Ladybank',
    centre: [-3.1255066, 56.2781959],
    radius: 750,
    initialScore: 66,
    dogRating: 3,
    character: 'Railway village at a large woodland edge',
    rationale:
      'Ladybank supports a genuine short visit through its woodland circuit, cafés, picnic opportunity and rail-based access.',
    sourceUrl: 'https://www.openstreetmap.org/node/21517379',
  },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, {
    units: 'metres',
    steps: 48,
  }) as Feature<Polygon>;
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
      boundarySource:
        'Resolved named-place location with a conservative strict settlement study buffer',
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
        dogAccessSummary:
          'No destination-scale dog visit or dedicated dog facilities are assumed at the catalogue-addition stage.',
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
        notes:
          'Strict editorial study area, not an administrative boundary. It is used consistently for local HES and visitor-place assignment.',
      },
    },
    features: [],
    sources: [
      {
        id: `${seed.id}-locality`,
        name: `${seed.name} locality resolution`,
        organisation: 'OpenStreetMap contributors / Fife Place-name Data / cited official source',
        coverage: seed.name,
        accessMethod: 'Named-place identification and boundary-aware editorial review',
        sourceUrl: seed.sourceUrl,
        licence: 'OpenStreetMap ODbL or cited source terms; retain attribution.',
        reliability: 'secondary',
        limitations: 'The intake score is provisional until the full audit gate passes.',
      },
    ],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

for (const seed of seeds)
  await writeFile(
    resolve('data/projects', seed.filename),
    `${JSON.stringify(packageFor(seed), null, 2)}\n`,
    'utf8',
  );

for (const filename of [
  'data/east-neuk-visitor-planner-curation.json',
  'data/east-neuk-dog-access-curation.json',
]) {
  const library = JSON.parse(await readFile(resolve(filename), 'utf8')) as {
    reviewedAt?: string;
    projects: Record<string, unknown>;
  };
  for (const seed of seeds) library.projects[seed.id] ??= {};
  library.reviewedAt = reviewedAt;
  await writeFile(resolve(filename), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

await writeFile(
  resolve('data/review/glenduckie-ladybank-locality-additions-2026-09-02.json'),
  `${JSON.stringify({ schemaVersion: 1, reviewedAt, threshold: 60, rule: 'All resolved places remain selectable with a score; only independently audited settlements scoring 60 or more appear as town markers.', additions: seeds.map((seed) => ({ requestedName: seed.requestedName, name: seed.name, projectId: seed.id, region: 'Fife', intakeScore: seed.initialScore, publishOnTownMap: seed.initialScore >= 60, rationale: seed.rationale, resolutionNote: seed.resolutionNote, sourceUrl: seed.sourceUrl })) }, null, 2)}\n`,
  'utf8',
);

console.log(`Added ${seeds.length} Glenduckie-to-Ladybank catalogue places.`);
