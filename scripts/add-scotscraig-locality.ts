import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-09-02';
const timestamp = `${reviewedAt}T23:20:00.000Z`;
const projectId = 'scotscraig-scotland';
const centre: [number, number] = [-2.9016622, 56.4427612];
const boundary = buffer(point(centre), 600, { units: 'metres', steps: 48 }) as Feature<Polygon>;
const score = 42;
const dogRating = 2 as const;
const band = townScoreBand(score);

const pkg: ProjectPackage = {
  project: {
    id: projectId,
    name: 'Scotscraig',
    countryCode: 'GB-SCT',
    country: 'Scotland',
    region: 'Fife',
    locality: 'Scotscraig',
    centre,
    boundary,
    boundarySource: 'OpenStreetMap named hamlet and Fife Place-name Data, with a conservative 600 m strict settlement study buffer',
    boundaryConfidence: 'high',
    sourceLanguage: 'English',
    preferredBasemap: 'voyager',
    createdAt: timestamp,
    methodology: defaultMethodology,
    researchNotes: 'Scotscraig is resolved as the historic estate hamlet at NO444282, not Scotscraig Golfing Club in Tayport. Private estate fabric and an intersecting walking route do not by themselves make the hamlet a destination.',
    touristAppeal: {
      score,
      dogOwnerScore: townScoreAfterDogAccess(score, dogRating),
      dogAccessScoreAdjustment: townDogAccessScoreAdjustment(dogRating),
      rating: band.rating,
      label: band.label,
      summary: 'A historic estate hamlet with nationally important fabric and a published walking route, but no verified public attraction, café-led stop or independent visitor facilities. It remains selector-only.',
      dogAccessRating: dogRating,
      dogAccessSummary: 'The published estate route can work for controlled dogs; private land, livestock and route-specific restrictions must be respected.',
      methodVersion: '2026-09-02-full-settlement-visitor-audit-v2',
      reviewedAt,
      sourceUrls: [
        'https://www.openstreetmap.org/node/13795964523',
        'https://fife-placenames.glasgow.ac.uk/volume/?id=4',
        'https://portal.historicenvironment.scot/designation/SM5180',
      ],
    },
    visitorHighlights: [],
    townGuide: {
      characterTag: 'Historic estate hamlet',
      headline: 'A catalogue locality, not a visitor destination',
      intro: 'Scotscraig retains important estate archaeology, but the fabric is not presented as an independently visitable attraction and nearby Tayport businesses are not borrowed.',
      bestFor: ['Regional and heritage reference'],
      perfectFor: ['A planned walk through the wider estate'],
      dontMiss: [],
      suggestedTime: 'Pass-through or as part of the published estate walk',
      visitorMood: 'Selector-only settlement; statutory heritage remains available on the historic layer.',
      sourceUrls: [
        'https://fife-placenames.glasgow.ac.uk/volume/?id=4',
        'https://fifewalking.com/north-fife/scotscraig-and-morton-lochs/',
      ],
      lastReviewedAt: reviewedAt,
    },
    townStudyArea: {
      localityName: 'Scotscraig',
      sourceName: 'OpenStreetMap and Fife Place-name Data',
      sourceUrl: 'https://www.openstreetmap.org/node/13795964523',
      sourceVersion: reviewedAt,
      bufferMetres: 600,
      localityBoundary: boundary,
      bufferedBoundary: boundary,
      notes: 'Strict editorial study area around the mapped Scotscraig hamlet and estate core. Scotscraig Golfing Club is outside this boundary and belongs to Tayport.',
    },
  },
  features: [],
  sources: [
    {
      id: 'scotscraig-locality-resolution',
      name: 'Scotscraig locality resolution',
      organisation: 'OpenStreetMap contributors / Fife Place-name Data',
      coverage: 'Scotscraig, Fife',
      accessMethod: 'Named-place and strict-boundary editorial review',
      sourceUrl: 'https://www.openstreetmap.org/node/13795964523',
      licence: 'OpenStreetMap ODbL and linked source terms; retain attribution.',
      reliability: 'secondary',
      limitations: 'The buffer is an editorial visitor-audit area, not an administrative boundary.',
    },
  ],
  historicMaps: [],
  settlementPolygons: [],
  validation: [],
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
await writeFile(resolve('data/projects/scotscraig.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

for (const file of ['data/east-neuk-visitor-planner-curation.json', 'data/east-neuk-dog-access-curation.json']) {
  const library = JSON.parse(await readFile(resolve(file), 'utf8')) as { reviewedAt?: string; projects: Record<string, unknown> };
  library.projects[projectId] ??= {};
  library.reviewedAt = reviewedAt;
  await writeFile(resolve(file), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

console.log('Added Scotscraig as a selector-only, boundary-resolved Fife locality.');
