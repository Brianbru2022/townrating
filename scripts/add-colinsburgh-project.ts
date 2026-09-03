import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-09-03';
const createdAt = `${reviewedAt}T12:00:00.000Z`;
const id = 'colinsburgh-scotland';
const name = 'Colinsburgh';
const centre: [number, number] = [-2.8464822, 56.2196779];
const localityUrl = 'https://www.openstreetmap.org/node/1070664299';
const boundary = buffer(point(centre), 950, { units: 'metres', steps: 48 }) as Feature<Polygon>;
const initialScore = 56;
const dogRating = 1 as const;
const band = townScoreBand(initialScore);

const pkg: ProjectPackage = {
  project: {
    id,
    name,
    countryCode: 'GB-SCT',
    country: 'Scotland',
    region: 'Fife',
    locality: name,
    centre,
    boundary,
    boundarySource: 'OpenStreetMap named-place point with a conservative strict settlement study buffer',
    boundaryConfidence: 'high',
    sourceLanguage: 'English',
    preferredBasemap: 'voyager',
    createdAt,
    methodology: defaultMethodology,
    researchNotes: 'Catalogue intake only. The full audit must keep Balcarres, Charleton, Kilconquhar and Elie visitor assets outside the settlement score.',
    touristAppeal: {
      score: initialScore,
      dogOwnerScore: townScoreAfterDogAccess(initialScore, dogRating),
      dogAccessScoreAdjustment: townDogAccessScoreAdjustment(dogRating),
      rating: band.rating,
      label: band.label,
      summary: 'Colinsburgh is retained in the Fife selector while its full strict-boundary audit is completed.',
      dogAccessRating: dogRating,
      dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are assumed at intake.',
      methodVersion: '2026-09-03-strict-settlement-intake-v1',
      reviewedAt,
      sourceUrls: [localityUrl, 'https://www.openstreetmap.org/copyright'],
    },
    visitorHighlights: [],
    townGuide: {
      characterTag: 'Historic linear conservation village',
      headline: 'A village awaiting its complete sequential audit',
      intro: 'Colinsburgh has a distinctive historic Main Street and community-authored village tour, to be assessed without borrowing neighbouring estates or villages.',
      bestFor: ['Regional reference'],
      perfectFor: ['Locating the village while planning East Neuk visits'],
      dontMiss: [],
      suggestedTime: 'Pass-through until the audit is complete',
      visitorMood: 'Selectable with a cautious intake score.',
      sourceUrls: [localityUrl],
      lastReviewedAt: reviewedAt,
    },
    townStudyArea: {
      localityName: name,
      sourceName: 'OpenStreetMap named-place location',
      sourceUrl: localityUrl,
      sourceVersion: reviewedAt,
      bufferMetres: 950,
      localityBoundary: boundary,
      bufferedBoundary: boundary,
      notes: 'Strict editorial study area, not an administrative boundary; used consistently for local HES and visitor-place assignment.',
    },
  },
  features: [],
  sources: [{
    id: 'colinsburgh-scotland-locality',
    name: 'Colinsburgh locality resolution',
    organisation: 'OpenStreetMap contributors',
    coverage: 'Colinsburgh',
    accessMethod: 'Named-place identification and boundary-aware editorial review',
    sourceUrl: localityUrl,
    licence: 'OpenStreetMap ODbL; retain attribution.',
    reliability: 'secondary',
    limitations: 'The intake score is provisional until the full audit gate passes.',
  }],
  historicMaps: [],
  settlementPolygons: [],
  validation: [],
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
await writeFile(resolve('data/projects/colinsburgh.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

for (const filename of ['data/east-neuk-visitor-planner-curation.json', 'data/east-neuk-dog-access-curation.json']) {
  const library = JSON.parse(await readFile(resolve(filename), 'utf8')) as { reviewedAt?: string; projects: Record<string, unknown> };
  library.projects[id] ??= {};
  library.reviewedAt = reviewedAt;
  await writeFile(resolve(filename), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

console.log('Added Colinsburgh as a distinct Fife selector project for full audit.');
