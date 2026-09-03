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

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T20:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string;
  name: string;
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  rationale: string;
  sourceUrl: string;
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  {
    id: 'pitforthie-fordoun-scotland',
    name: 'Pitforthie',
    centre: [-2.3070274, 56.9025496],
    radius: 900,
    score: 24,
    dogRating: 1,
    character: 'Dispersed Fordoun-area farm cluster',
    rationale: 'Pitforthie represents the Nether, Upper and Hillhead farm cluster near Fordoun. Agricultural and private equestrian uses do not establish a public tourist destination.',
    sourceUrl: osm('way', 946127329),
    boundaryConfidence: 'medium',
  },
  {
    id: 'roadside-of-catterline-scotland',
    name: 'Roadside of Catterline',
    centre: [-2.2315433, 56.902588],
    radius: 450,
    score: 26,
    dogRating: 1,
    character: 'Small A92 roadside hamlet',
    rationale: 'Roadside of Catterline is retained separately from the coastal village. Catterline Bay, harbour and Joan Eardley associations remain with Catterline and do not inflate this roadside locality.',
    sourceUrl: osm('node', 6842020811),
  },
  {
    id: 'kinneff-scotland',
    name: 'Kinneff',
    centre: [-2.2379517, 56.8648744],
    radius: 800,
    score: 48,
    dogRating: 2,
    character: 'Historic coastal-parish hamlet',
    rationale: 'Kinneff has a genuine historic identity and Old Kirk association, but remains below the map gate until a full visitor audit establishes access, facilities and a complete visit independent of nearby Inverbervie.',
    sourceUrl: osm('node', 3075532052),
  },
  {
    id: 'mains-of-allardice-scotland',
    name: 'Mains of Allardice',
    centre: [-2.2971057, 56.8616535],
    radius: 600,
    score: 24,
    dogRating: 1,
    character: 'Allardice estate farm locality',
    rationale: 'Mains of Allardice is a rural farm locality. Nearby private estate heritage is recorded but is not treated as public access or borrowed tourist value.',
    sourceUrl: osm('node', 10172532519),
  },
  {
    id: 'inverbervie-scotland',
    name: 'Inverbervie',
    centre: [-2.2806005, 56.844524],
    radius: 850,
    score: 58,
    dogRating: 2,
    character: 'Historic Mearns coastal burgh',
    rationale: 'Inverbervie has clear town identity, coastal setting and local services, but remains just below 60 until a full audit verifies its complete See, Eat, trails, picnic, parking and toilet offer.',
    sourceUrl: osm('node', 370784626),
  },
  {
    id: 'gourdon-aberdeenshire-scotland',
    name: 'Gourdon',
    centre: [-2.2866153, 56.8296151],
    radius: 750,
    score: 58,
    dogRating: 2,
    character: 'Working Mearns fishing village',
    rationale: 'Gourdon has an attractive working-harbour identity, but remains below the map gate until a full audit verifies the village offer and keeps nearby Inverbervie evidence separate.',
    sourceUrl: osm('node', 413734161),
  },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, {
    units: 'metres',
    steps: 48,
  }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id,
      name: seed.name,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: 'Aberdeenshire',
      locality: seed.name,
      centre: seed.centre,
      boundary,
      boundarySource: 'Mapped named-place location with a conservative editorial study buffer',
      boundaryConfidence: seed.boundaryConfidence ?? 'high',
      sourceLanguage: 'English',
      preferredBasemap: 'voyager',
      createdAt,
      methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, estates and neighbouring settlements do not inflate the settlement score.',
      touristAppeal: {
        score: seed.score,
        dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
        dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating,
        label: band.label,
        summary: `${seed.name} is retained as an Aberdeenshire regional reference pending any full destination audit.`,
        dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-30-strict-settlement-gate-v1',
        reviewedAt,
        sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character,
        headline: 'A recorded place pending any full destination audit',
        intro: seed.rationale,
        bestFor: ['Regional reference'],
        perfectFor: ['Identifying the locality while planning a wider Mearns route'],
        dontMiss: [],
        suggestedTime: 'Pass-through or pre-arranged visit only',
        visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright],
        lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name,
        sourceName: 'Mapped named-place location',
        sourceUrl: seed.sourceUrl,
        sourceVersion: reviewedAt,
        bufferMetres: seed.radius,
        localityBoundary: boundary,
        bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.',
      },
    },
    features: [],
    sources: [{
      id: `${seed.id}-locality`,
      name: `${seed.name} place gate`,
      organisation: 'OpenStreetMap contributors',
      coverage: seed.name,
      accessMethod: 'Mapped place identification and boundary-aware editorial review',
      sourceUrl: seed.sourceUrl,
      licence: 'OpenStreetMap ODbL; retain contributor attribution.',
      reliability: 'secondary',
      limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.',
    }],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) {
  await writeFile(
    resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`),
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf8',
  );
}

const plannerPath = resolve('data/stonehaven-coast-visitor-planner-curation.json');
const dogPath = resolve('data/stonehaven-coast-dog-access-curation.json');
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

await writeFile(
  resolve('data/review/pitforthie-gourdon-locality-additions-2026-08-30.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    reviewedAt,
    threshold: 60,
    rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
    namingDecisions: [
      'Caterline is interpreted as the already-published Catterline and is not duplicated.',
      'Arbuthnott and Roadside of Kinneff are already published catalogue entries and are not duplicated.',
      'Pitforthie represents the Nether, Upper and Hillhead cluster near Fordoun.',
      'Roadside of Catterline remains separate from Catterline village.',
      'Mains of Allardice remains separate from the private Allardice estate.',
      'Gourdon is qualified by Aberdeenshire in its project identifier to avoid namesake collisions.',
    ],
    existing: [
      { name: 'Catterline', projectId: 'catterline-scotland' },
      { name: 'Roadside of Kinneff', projectId: 'roadside-of-kinneff-scotland' },
      { name: 'Arbuthnott', projectId: 'arbuthnott-scotland' },
    ],
    additions: seeds.map((seed) => ({
      name: seed.name,
      projectId: seed.id,
      region: 'Aberdeenshire',
      score: seed.score,
      dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
      publishOnTownMap: seed.score >= 60,
      rationale: seed.rationale,
      sourceUrl: seed.sourceUrl,
    })),
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Added ${packages.length} new Pitforthie-Gourdon catalogue places; reused 3 existing entries; none of the new entries publishes on the town map.`);
