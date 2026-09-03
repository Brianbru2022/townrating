import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import type { PlannerCurationLibrary } from '../src/domain/plannerCuration';
import {
  currentPlaceInfo,
  visitorNeedPlaces,
  type VisitorNeed,
} from '../src/domain/visitorExperience';
import { isMappableVisitFeature } from '../src/domain/visiting';

const checkedAt = '2026-08-08T00:00:00.000Z';
const curationPath = resolve('data/visitor-planner-curation.json');
const dogAccessPath = resolve('data/dog-access-curation.json');

interface CurationFile {
  schemaVersion: number;
  description: string;
  projects: PlannerCurationLibrary;
}

interface DogAccessFile {
  schemaVersion: number;
  reviewedAt: string;
  projects: Record<
    string,
    {
      attraction?: Record<string, unknown>;
      eat?: Record<string, unknown>;
    }
  >;
}

interface TrailDefinition {
  projectId: string;
  file: string;
  id: string;
  name: string;
  alternativeName: string;
  coordinates: [number, number];
  score: number;
  type: string;
  distance: string;
  duration: string;
  accessibility: string;
  description: string;
  url: string;
}

const projectFiles: Record<string, string> = {
  'alloa-scotland': 'data/projects/alloa.json',
  'bathgate-scotland': 'data/projects/bathgate.json',
  'biggar-scotland': 'data/projects/biggar.json',
  'callander-scotland': 'data/projects/callander.json',
  'culross-scotland': 'data/projects/culross.json',
  'kincardine-on-forth-scotland': 'data/projects/kincardine.json',
  'killin-scotland': 'data/projects/killin.json',
  'kirriemuir-scotland': 'data/projects/kirriemuir.json',
  'linlithgow-scotland': 'data/projects/linlithgow.json',
  'livingston-scotland': 'data/projects/livingston.json',
  'peterborough-england': 'data/projects/peterborough.json',
  'quarriers-village-scotland': 'data/projects/quarriers-village.json',
  'south-queensferry-scotland': 'data/projects/south-queensferry.json',
  'tillicoultry-scotland': 'data/projects/tillicoultry.json',
  'whitburn-scotland': 'data/projects/whitburn.json',
};

const trailDefinitions: TrailDefinition[] = [
  {
    projectId: 'alloa-scotland',
    file: projectFiles['alloa-scotland'],
    id: 'curated-trail:alloa-treasure-trail',
    name: 'Alloa Town and Landmarks Treasure Trail',
    alternativeName: 'Alloa - Town & Landmarks',
    coordinates: [-3.788305681222948, 56.112478271568996],
    score: 86,
    type: 'Treasure hunt trail',
    distance: '1.3 miles circular',
    duration: '90 minutes',
    accessibility: 'Wheelchair, pushchair and scooter friendly; dog friendly.',
    description:
      'Follow a family-friendly clue trail from Alloa Tower through the historic centre, Town Hall and Church of the Holy Rude.',
    url: 'https://www.treasuretrails.co.uk/products/things-to-do-alloa-stirling-falkirk',
  },
  {
    projectId: 'bathgate-scotland',
    file: projectFiles['bathgate-scotland'],
    id: 'curated-trail:bathgate-treasure-trail',
    name: 'Bathgate Town and Park of Peace Treasure Trail',
    alternativeName: 'Bathgate - Town & Park of Peace',
    coordinates: [-3.6420199533113133, 55.90184352043804],
    score: 85,
    type: 'Detective mystery trail',
    distance: 'Town-centre circular route',
    duration: '1-3 hours',
    accessibility: 'Wheelchair and scooter friendly; dog friendly.',
    description:
      'Solve a detective mystery while exploring Bathgate town centre, its historic streets and the Park of Peace.',
    url: 'https://www.treasuretrails.co.uk/products/things-to-do-bathgate-lothian',
  },
  {
    projectId: 'biggar-scotland',
    file: projectFiles['biggar-scotland'],
    id: 'curated-trail:biggar-treasure-trail',
    name: 'Biggar Puppet Theatre and Square Treasure Trail',
    alternativeName: 'Biggar - Puppet Theatre & Square',
    coordinates: [-3.527780909184815, 55.622684293250394],
    score: 85,
    type: 'Treasure hunt trail',
    distance: 'Town-centre circular route',
    duration: '1-3 hours',
    accessibility: 'Walking route; dog friendly.',
    description:
      'Hunt for clues around Biggar High Street, the Puppet Theatre, town square, golf-course edge and Gas Works Museum.',
    url: 'https://www.treasuretrails.co.uk/products/things-to-do-biggar-glasgow-lanarkshire',
  },
  {
    projectId: 'callander-scotland',
    file: projectFiles['callander-scotland'],
    id: 'curated-trail:callander-treasure-trail',
    name: 'Callander Riverfront and Square Treasure Trail',
    alternativeName: 'Callander - Riverfront & Square',
    coordinates: [-4.2153, 56.2447],
    score: 88,
    type: 'Detective mystery trail',
    distance: '2 miles circular',
    duration: '2 hours',
    accessibility: 'Pushchair and scooter friendly; dog friendly, but not wheelchair suitable.',
    description:
      'Solve a detective mystery on a loop from Ancaster Square through Main Street, the River Teith waterfront and quieter historic streets.',
    url: 'https://www.treasuretrails.co.uk/products/things-to-do-callander-stirling-falkirk',
  },
  {
    projectId: 'linlithgow-scotland',
    file: projectFiles['linlithgow-scotland'],
    id: 'curated-trail:linlithgow-treasure-trail',
    name: 'Linlithgow Canal, Centre and Palace Treasure Trail',
    alternativeName: 'Linlithgow - Canal, Centre & Palace',
    coordinates: [-3.6010087687504773, 55.9775252289187],
    score: 90,
    type: 'Secret spy mission trail',
    distance: '2 miles circular',
    duration: '2 hours',
    accessibility: 'Walking route; dog friendly, but not wheelchair or pushchair suitable.',
    description:
      'Crack a spy mission while exploring the canal, historic centre and streets around Linlithgow Palace.',
    url: 'https://www.treasuretrails.co.uk/products/things-to-do-linlithgow-lothian',
  },
  {
    projectId: 'peterborough-england',
    file: projectFiles['peterborough-england'],
    id: 'curated-trail:peterborough-treasure-trail',
    name: 'Peterborough City Centre and Rivers Treasure Trail',
    alternativeName: 'Peterborough - City Centre & Rivers',
    coordinates: [-0.240688, 52.570855],
    score: 88,
    type: 'Detective mystery trail',
    distance: '1.5 miles linear',
    duration: '2 hours',
    accessibility: 'Wheelchair, pushchair and scooter friendly; dog friendly.',
    description:
      'Follow a detective mystery from Car Haven through green spaces, riverside paths and historic streets to Peterborough Cathedral.',
    url: 'https://www.treasuretrails.co.uk/products/things-to-do-peterborough-cambs',
  },
  {
    projectId: 'quarriers-village-scotland',
    file: projectFiles['quarriers-village-scotland'],
    id: 'curated-trail:quarriers-village-treasure-trail',
    name: "Quarrier's Village Avenues and Church Treasure Trail",
    alternativeName: "Quarrier's Village - Avenues & Church",
    coordinates: [-4.617873187667503, 55.86857795840181],
    score: 84,
    type: 'Secret spy mission trail',
    distance: 'Village circular route',
    duration: '1-3 hours',
    accessibility: 'Walking route; dog friendly.',
    description:
      'Follow a spy mission through the village avenues, woodland and landmark buildings around Mount Zion Church.',
    url: 'https://www.treasuretrails.co.uk/products/things-to-do-quarriers-village-glasgow-lanarkshire',
  },
];

const practicalAdditions: Partial<Record<string, Partial<Record<VisitorNeed, string[]>>>> = {
  'culross-scotland': { toilets: ['osm-community:node-4995290458'] },
  'kirriemuir-scotland': { picnic: ['osm-community:node-13264886749'] },
  'linlithgow-scotland': { parking: ['osm-community:way-263513939'] },
  'livingston-scotland': {
    parking: [
      'osm-community:way-492631334',
      'osm-community:way-87166954',
      'osm-community:relation-20134428',
      'osm-community:way-86501918',
      'osm-community:way-43997152',
      'osm-community:way-176818869',
    ],
    picnic: ['osm-community:node-2805451357', 'osm-community:node-8132077903'],
    toilets: ['osm-community:node-3439498365'],
  },
  'tillicoultry-scotland': {
    picnic: ['osm-community:node-11828395926'],
    toilets: ['osm-community:node-9144962980'],
  },
  'whitburn-scotland': { picnic: ['osm-community:node-3761390476'] },
};

const supersededPracticalIds = new Set([
  // These OSM geometries duplicate the richer named Alloa council car-park records.
  'osm-community:way-237358761',
  'osm-community:way-92438298',
  'osm-community:way-48756052',
  // OSM does not establish that this theatre car park is unrestricted public parking.
  'osm-community:way-301150750',
]);

const excludedCurationIds = new Set([
  ...supersededPracticalIds,
  'osm-community:node-11104464562',
  'osm-community:node-13094934349',
]);

const excludedAttractionIds = new Set([
  'curated-attraction:kincardine-on-forth-tulliallan-old-parish-church-and-kirkyard',
  'osm-community:node-3791535268',
]);

const locationNames: Array<{
  projectId: string;
  featureId: string;
  name: string;
  description: string;
}> = [
  {
    projectId: 'culross-scotland',
    featureId: 'osm-community:node-4995290458',
    name: "Bessie's Bar Steps public toilets",
    description: "Public toilets beside Bessie's Bar Steps in the eastern part of Culross.",
  },
  {
    projectId: 'kincardine-on-forth-scotland',
    featureId: 'osm-community:node-13094934349',
    name: 'Wood Lea picnic table',
    description: 'Public picnic table by Wood Lea in Kincardine.',
  },
  {
    projectId: 'livingston-scotland',
    featureId: 'osm-community:node-2805451357',
    name: 'Almond Path North picnic area',
    description: 'Picnic area beside Almond Path North in Livingston Village.',
  },
  {
    projectId: 'livingston-scotland',
    featureId: 'osm-community:node-8132077903',
    name: 'Thirlfield Wynd picnic table',
    description: 'Public picnic table by Thirlfield Wynd in Kirkton, Livingston.',
  },
  {
    projectId: 'livingston-scotland',
    featureId: 'osm-community:node-3439498365',
    name: 'Almondvale Avenue public toilets',
    description: 'Public toilets by Almondvale Avenue in central Livingston.',
  },
  {
    projectId: 'tillicoultry-scotland',
    featureId: 'osm-community:node-11828395926',
    name: 'Drummie Road picnic table',
    description: 'Public picnic table by Drummie Road in Devonside, Tillicoultry.',
  },
  {
    projectId: 'tillicoultry-scotland',
    featureId: 'osm-community:node-9144962980',
    name: 'Devon Way public toilets',
    description: 'Public toilets beside the Devon Way in Tillicoultry.',
  },
  {
    projectId: 'whitburn-scotland',
    featureId: 'osm-community:node-3761390476',
    name: 'Mansewood Crescent picnic table',
    description: 'Public picnic table by Mansewood Crescent in Whitburn.',
  },
];

function detail(feature: HeritageFeature, key: string): string | undefined {
  return currentPlaceInfo(feature).currentDetails.find((item) => item.key === key)?.value;
}

function appendUnique(target: string[], values: readonly string[]): string[] {
  return [...new Set([...target, ...values])];
}

function trailFeature(definition: TrailDefinition, pkg: ProjectPackage): HeritageFeature {
  return {
    id: definition.id,
    projectId: definition.projectId,
    name: definition.name,
    alternativeNames: [definition.alternativeName],
    countryCode: pkg.project.countryCode,
    region: pkg.project.region,
    locality: pkg.project.locality,
    featureType: 'walking_route',
    significance: 'recognised',
    geometry: { type: 'Point', coordinates: definition.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: definition.description,
    sourceRecords: [
      {
        sourceName: definition.alternativeName,
        sourceOrganisation: 'Treasure Trails',
        sourceRecordId: new URL(definition.url).pathname.split('/').at(-1),
        sourceUrl: definition.url,
        accessedAt: checkedAt,
        licence: 'Link and original editorial summary only; commercial trail content remains with Treasure Trails.',
        notes: `Current-place curation: route=foot; name=${definition.name}; trail_type=${definition.type}; visit_score=${definition.score}; distance=${definition.distance}; time_to_spend=${definition.duration}; entrance_fee=Trail booklet £10.99; dog_friendly=yes; accessibility=${definition.accessibility}; description=${definition.description}; website=${definition.url}.`,
        reliability: 'official_non_statutory',
      },
    ],
    licence: 'Link and original editorial summary only; commercial trail content remains with Treasure Trails.',
    tags: [
      'current-context',
      'curated-trail-place',
      'service-context-walk',
      'service-context-visitor',
      'visitor-context-trail',
    ],
    createdAt: checkedAt,
    updatedAt: checkedAt,
    reviewed: true,
    reviewNotes:
      'Checked against the current Treasure Trails product catalogue and retained as an in-boundary town trail on 2026-08-08.',
    evidenceScope: 'related_context',
  };
}

const curationFile = JSON.parse(await readFile(curationPath, 'utf8')) as CurationFile;
const dogAccessFile = JSON.parse(await readFile(dogAccessPath, 'utf8')) as DogAccessFile;
const packagesById = new Map(publishedProjectPackages.map((pkg) => [pkg.project.id, pkg]));
const touchedProjects = new Set<string>();

for (const rename of locationNames) {
  const pkg = packagesById.get(rename.projectId);
  const feature = pkg?.features.find((item) => item.id === rename.featureId);
  if (!feature) throw new Error(`Missing practical feature ${rename.projectId} ${rename.featureId}`);
  feature.name = rename.name;
  feature.shortDescription = rename.description;
  feature.updatedAt = checkedAt;
  feature.reviewNotes = [
    feature.reviewNotes,
    'Location label checked against the mapped point and nearest named street during the cross-town visitor audit on 2026-08-08.',
  ]
    .filter(Boolean)
    .join(' ');
  touchedProjects.add(rename.projectId);
}

for (const pkg of publishedProjectPackages) {
  const state = (curationFile.projects[pkg.project.id] ??= {});
  for (const need of Object.keys(state) as VisitorNeed[]) {
    state[need] = (state[need] ?? []).filter((featureId) => !excludedCurationIds.has(featureId));
  }
  const existingEat = state.eat ?? [];
  const genericFoodName = /^(cafe|café|restaurant|takeaway|fast food|ice-cream shop)$/i;
  const reviewedFoodIds = visitorNeedPlaces(pkg, 'eat', 100)
    .filter((place) => !excludedCurationIds.has(place.id))
    .filter((place) => !genericFoodName.test(place.name.trim()))
    .map((place) => place.id);
  state.eat = appendUnique(existingEat, reviewedFoodIds).slice(0, 20);

  const additions = practicalAdditions[pkg.project.id];
  if (additions) {
    for (const [need, featureIds] of Object.entries(additions) as Array<[
      VisitorNeed,
      string[],
    ]>) {
      state[need] = appendUnique(state[need] ?? [], featureIds);
    }
  }

  const rawExistingHighlights = (pkg.project.visitorHighlights ?? []).filter(
    (highlight) => !excludedAttractionIds.has(highlight.featureId),
  );
  const existingHighlights = rawExistingHighlights.map((highlight) => {
    const feature = pkg.features.find((item) => item.id === highlight.featureId);
    return {
      ...highlight,
      sourceName:
        highlight.sourceName ??
        feature?.sourceRecords[0]?.sourceOrganisation ??
        feature?.sourceRecords[0]?.sourceName ??
        'Reviewed visitor source',
      sourceUrl:
        highlight.sourceUrl ?? feature?.sourceRecords[0]?.sourceUrl ?? 'https://www.openstreetmap.org/',
      verifiedInBoundaryAt: highlight.verifiedInBoundaryAt ?? checkedAt,
    };
  });
  const highlightedIds = new Set(existingHighlights.map((highlight) => highlight.featureId));
  const additionalAttractions = pkg.features
    .filter((feature) => !highlightedIds.has(feature.id))
    .filter((feature) => !excludedAttractionIds.has(feature.id))
    .filter((feature) => isMappableVisitFeature(pkg, feature))
    .map((feature) => ({ feature, score: Number(detail(feature, 'visit_score')) }))
    .filter(({ feature, score }) =>
      Boolean(
        Number.isFinite(score) &&
          score >= 35 &&
          detail(feature, 'tourism') === 'attraction' &&
          !/(trail|walk|route|golf|parking|toilet|picnic)/i.test(feature.name),
      ),
    )
    .sort((left, right) => right.score - left.score || left.feature.name.localeCompare(right.feature.name));

  const highlightsNeedRepair =
    rawExistingHighlights.length !== (pkg.project.visitorHighlights?.length ?? 0) ||
    rawExistingHighlights.some(
    (highlight) => !highlight.sourceName || !highlight.sourceUrl || !highlight.verifiedInBoundaryAt,
    );
  if (additionalAttractions.length || highlightsNeedRepair) {
    const merged = [
      ...existingHighlights,
      ...additionalAttractions.map(({ feature, score }) => ({
        featureId: feature.id,
        rank: 0,
        name: feature.name,
        reason: detail(feature, 'description') ?? feature.shortDescription ?? 'A reviewed visitor stop.',
        tagline: detail(feature, 'visitor_place_type'),
        visitorScore: score,
        openingTimes: detail(feature, 'opening_hours:description'),
        admission: detail(feature, 'entrance_fee'),
        freeAdmission: /^free\b/i.test(detail(feature, 'entrance_fee') ?? ''),
        sourceName: feature.sourceRecords[0]?.sourceOrganisation ?? feature.sourceRecords[0]?.sourceName ?? 'Reviewed visitor source',
        sourceUrl: feature.sourceRecords[0]?.sourceUrl ?? 'https://www.openstreetmap.org/',
        verifiedInBoundaryAt: checkedAt,
      })),
    ]
      .sort(
        (left, right) =>
          (right.visitorScore ?? 0) - (left.visitorScore ?? 0) || left.name.localeCompare(right.name),
      )
      .slice(0, 20)
      .map((highlight, index) => ({ ...highlight, rank: index + 1 }));
    pkg.project.visitorHighlights = merged;
    touchedProjects.add(pkg.project.id);
  }
}

for (const definition of trailDefinitions) {
  const pkg = packagesById.get(definition.projectId);
  if (!pkg) throw new Error(`Missing project ${definition.projectId}`);
  if (!pkg.features.some((feature) => feature.id === definition.id)) {
    pkg.features.push(trailFeature(definition, pkg));
    touchedProjects.add(definition.projectId);
  }
  const state = (curationFile.projects[definition.projectId] ??= {});
  state.trails = appendUnique(state.trails ?? [], [definition.id]);
}

for (const pkg of publishedProjectPackages) {
  const projectDogAccess = (dogAccessFile.projects[pkg.project.id] ??= {});
  const featureById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  for (const [kind, featureIds] of [
    [
      'attraction',
      (pkg.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
    ],
    ['eat', curationFile.projects[pkg.project.id]?.eat ?? []],
  ] as const) {
    const entries = (projectDogAccess[kind] ??= {});
    for (const featureId of featureIds) {
      if (entries[featureId]) continue;
      const feature = featureById.get(featureId);
      entries[featureId] = {
        rating: 0,
        status: 'unconfirmed',
        label: 'Dog policy not confirmed',
        summary:
          'No reliable current policy confirming pet-dog access was found in the reviewed visitor sources. Check directly before making a dog-dependent journey; assistance-dog access is separate.',
        sourceName: 'Reviewed visitor information',
        sourceUrl: feature?.sourceRecords[0]?.sourceUrl ?? 'https://www.openstreetmap.org/',
        reviewedAt: checkedAt.slice(0, 10),
      };
    }
  }
}
dogAccessFile.reviewedAt = checkedAt.slice(0, 10);

for (const projectId of touchedProjects) {
  const file = projectFiles[projectId];
  const pkg = packagesById.get(projectId);
  if (!file || !pkg) throw new Error(`No writable project file registered for ${projectId}`);
  await writeFile(resolve(file), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

await writeFile(curationPath, `${JSON.stringify(curationFile, null, 2)}\n`, 'utf8');
await writeFile(dogAccessPath, `${JSON.stringify(dogAccessFile, null, 2)}\n`, 'utf8');

// The former two-collection Treasure Trails snapshot did not constitute a full online
// town audit. Keep online discovery separate from this curation migration so a rerun cannot
// overwrite the evidence-backed full-catalogue report. Run `npm run audit-online-trails`.

const coverageReview = {
  schemaVersion: 1,
  reviewedAt: checkedAt,
  policy: {
    see: 'Up to 20 reviewed in-boundary attractions.',
    eat: 'Up to 20 named in-boundary food and drink places.',
    practical:
      'No display cap. Include every reviewed in-boundary trail, picnic place, public car park and public toilet, using location-specific names.',
  },
  towns: publishedProjectPackages.map((pkg) => {
    const state = curationFile.projects[pkg.project.id] ?? {};
    return {
      projectId: pkg.project.id,
      locality: pkg.project.locality,
      see: Math.min(pkg.project.visitorHighlights?.length ?? 0, 20),
      eat: state.eat?.length ?? 0,
      trails: state.trails?.length ?? 0,
      picnic: state.picnic?.length ?? 0,
      parking: state.parking?.length ?? 0,
      toilets: state.toilets?.length ?? 0,
    };
  }),
};

await writeFile(
  resolve('data/review/cross-town-visitor-coverage-2026-08-08.json'),
  `${JSON.stringify(coverageReview, null, 2)}\n`,
  'utf8',
);

console.log(
  `Updated ${publishedProjectPackages.length} published towns; added ${trailDefinitions.length} Treasure Trails and widened reviewed planner coverage.`,
);
