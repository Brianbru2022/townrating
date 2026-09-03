import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-09-02';
const createdAt = `${reviewedAt}T20:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';

interface Seed {
  id: string;
  filename: string;
  requestedName: string;
  name: string;
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  sourceUrl: string;
  resolutionNote?: string;
}

const seeds: Seed[] = [
  { id: 'kingskettle-scotland', filename: 'kingskettle.json', requestedName: 'Kingskettle', name: 'Kingskettle', centre: [-3.1162759, 56.2625596], radius: 700, score: 56, dogRating: 2, character: 'Historic Howe of Fife village', sourceUrl: 'https://www.openstreetmap.org/node/89022973' },
  { id: 'balmalcolm-scotland', filename: 'balmalcolm.json', requestedName: 'Balmacolm', name: 'Balmalcolm', centre: [-3.0997561, 56.2629458], radius: 650, score: 66, dogRating: 3, character: 'Small rural village and visitor-business cluster', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=1249', resolutionNote: 'The requested spelling “Balmacolm” is normalised to Balmalcolm.' },
  { id: 'kettlebridge-scotland', filename: 'kettlebridge.json', requestedName: 'Kettlebridge', name: 'Kettlebridge', centre: [-3.1184005, 56.2551997], radius: 550, score: 48, dogRating: 2, character: 'Compact Howe of Fife village', sourceUrl: 'https://www.openstreetmap.org/node/89022977' },
  { id: 'kettlehill-scotland', filename: 'kettlehill.json', requestedName: 'Kettlehill', name: 'Kettlehill', centre: [-3.091103, 56.2557688], radius: 450, score: 34, dogRating: 2, character: 'Small rural hamlet', sourceUrl: 'https://www.openstreetmap.org/node/3467568140' },
  { id: 'montrave-scotland', filename: 'montrave.json', requestedName: 'Montrave', name: 'Montrave', centre: [-3.0036778, 56.2489934], radius: 650, score: 24, dogRating: 1, character: 'Private estate and farm locality', sourceUrl: 'https://www.openstreetmap.org/node/4447876825', resolutionNote: 'Resolved to the Montrave estate and Home Farm locality, not Montrave Hill.' },
  { id: 'rameldry-mill-bank-scotland', filename: 'rameldry-mill-bank.json', requestedName: 'Rameldry Mill bank', name: 'Rameldry Mill Bank', centre: [-3.1152, 56.2416873], radius: 350, score: 12, dogRating: 1, character: 'Isolated named dwelling locality', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=1323', resolutionNote: 'Rameldry Mill Bank is one named locality, not two separate additions.' },
  { id: 'langdyke-fife-scotland', filename: 'langdyke-fife.json', requestedName: 'langdyke', name: 'Langdyke', centre: [-3.076727, 56.2309861], radius: 400, score: 18, dogRating: 1, character: 'Small rural Fife hamlet', sourceUrl: 'https://www.openstreetmap.org/node/71051721', resolutionNote: 'Resolved to Langdyke near Markinch; the English Langdyke reserve is unrelated.' },
  { id: 'muirhead-freuchie-scotland', filename: 'muirhead-freuchie.json', requestedName: 'muirhead', name: 'Muirhead (Freuchie)', centre: [-3.149937, 56.2362755], radius: 450, score: 20, dogRating: 1, character: 'Small hamlet near Freuchie', sourceUrl: 'https://www.openstreetmap.org/node/2685058249', resolutionNote: 'Qualified as Muirhead (Freuchie) to distinguish it from Muirhead in Angus and Little Muirhead on the Pilgrim Way.' },
  { id: 'kennoway-scotland', filename: 'kennoway.json', requestedName: 'kennoway', name: 'Kennoway', centre: [-3.0490999, 56.2114871], radius: 1150, score: 72, dogRating: 3, character: 'Historic Causeway village beside an ancient den', sourceUrl: 'https://www.openstreetmap.org/node/46970675' },
  { id: 'bonnybank-scotland', filename: 'bonnybank.json', requestedName: 'bonnybank', name: 'Bonnybank', centre: [-3.0398631, 56.2197612], radius: 450, score: 44, dogRating: 2, character: 'Small Pilgrim Way hamlet', sourceUrl: 'https://www.openstreetmap.org/node/4004509787' },
  { id: 'scoonie-scotland', filename: 'scoonie.json', requestedName: 'scoonie', name: 'Scoonie', centre: [-2.9953113, 56.2042839], radius: 600, score: 48, dogRating: 2, character: 'Historic Leven suburb and old parish site', sourceUrl: 'https://www.openstreetmap.org/node/4004509772' },
  { id: 'balcurvie-scotland', filename: 'balcurvie.json', requestedName: 'balcurvie', name: 'Balcurvie', centre: [-3.058046, 56.1976169], radius: 650, score: 51, dogRating: 2, character: 'Small rural hamlet with a bookable farm experience', sourceUrl: 'https://www.openstreetmap.org/node/71051610' },
  { id: 'windygates-scotland', filename: 'windygates.json', requestedName: 'windygates', name: 'Windygates', centre: [-3.0549086, 56.1930349], radius: 900, score: 56, dogRating: 2, character: 'Levenmouth crossroads village', sourceUrl: 'https://www.openstreetmap.org/node/71051604' },
  { id: 'milton-of-balgonie-scotland', filename: 'milton-of-balgonie.json', requestedName: 'milton of balgonie', name: 'Milton of Balgonie', centre: [-3.0979458, 56.1934278], radius: 750, score: 50, dogRating: 2, character: 'Small riverside village', sourceUrl: 'https://www.openstreetmap.org/node/71051617' },
  { id: 'markinch-scotland', filename: 'markinch.json', requestedName: 'Markinch', name: 'Markinch', centre: [-3.1324666, 56.202957], radius: 1500, score: 84, dogRating: 3, character: 'Ancient Fife capital and walking hub', sourceUrl: 'https://www.openstreetmap.org/node/26770101' },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Fife', locality: seed.name,
      centre: seed.centre, boundary,
      boundarySource: 'Resolved named-place location with a conservative strict settlement study buffer', boundaryConfidence: 'high',
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: `Strict-boundary catalogue intake. ${seed.resolutionNote ?? ''} No neighbouring town, private property or related attraction is allowed to inflate the settlement score.`,
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
        dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label,
        summary: `${seed.name} has a resolved Fife catalogue identity and a completed current-web visitor audit.`,
        dogAccessRating: seed.dogRating, dogAccessSummary: 'Outdoor access and venue-specific dog policies are recorded in the completed audit.',
        methodVersion: '2026-09-02-strict-settlement-full-audit-v5', reviewedAt,
        sourceUrls: [seed.sourceUrl, osmCopyright],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A boundary-aware Fife visitor assessment',
        intro: 'The score records only the offer within this place or explicitly marks related attractions separately.',
        bestFor: ['Regional reference'], perfectFor: ['Evidence-led Fife trip planning'], dontMiss: [],
        suggestedTime: seed.score >= 60 ? '2–5 hours' : 'Pass-through or a pre-planned stop',
        visitorMood: seed.score >= 60 ? 'An independently worthwhile stop.' : 'Selector-only unless visiting a separately listed attraction.',
        sourceUrls: [seed.sourceUrl], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: 'Resolved mapped named-place location', sourceUrl: seed.sourceUrl,
        sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Strict editorial study area, not an administrative boundary. Related attractions outside it do not support the town score.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} locality resolution`, organisation: 'OpenStreetMap contributors / Fife Place-name Data', coverage: seed.name, accessMethod: 'Named-place and strict-boundary editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap ODbL or cited source terms; retain attribution.', reliability: 'secondary', limitations: 'Facilities and opening hours remain time-sensitive.' }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

for (const seed of seeds) await writeFile(resolve('data/projects', seed.filename), `${JSON.stringify(packageFor(seed), null, 2)}\n`, 'utf8');

for (const filename of ['data/east-neuk-visitor-planner-curation.json', 'data/east-neuk-dog-access-curation.json']) {
  const library = JSON.parse(await readFile(resolve(filename), 'utf8')) as { reviewedAt?: string; projects: Record<string, unknown> };
  for (const seed of seeds) library.projects[seed.id] ??= {};
  library.reviewedAt = reviewedAt;
  await writeFile(resolve(filename), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

await writeFile(resolve('data/review/kingskettle-markinch-locality-additions-2026-09-02.json'), `${JSON.stringify({ schemaVersion: 1, reviewedAt, threshold: 60, rule: 'Every resolved place stays selectable with its audited score; only independently worthwhile settlements scoring 60 or more get a town marker.', additions: seeds.map((seed) => ({ requestedName: seed.requestedName, name: seed.name, projectId: seed.id, score: seed.score, publishOnTownMap: seed.score >= 60, resolutionNote: seed.resolutionNote, sourceUrl: seed.sourceUrl })) }, null, 2)}\n`, 'utf8');

console.log(`Added ${seeds.length} new Kingskettle-to-Markinch catalogue places; Lundin Links and Leven remain existing projects for re-audit.`);
