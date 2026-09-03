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
const createdAt = `${reviewedAt}T20:30:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const placeNames = 'https://fife-placenames.glasgow.ac.uk/volume/?id=3';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string;
  requestedName: string;
  name: string;
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  rationale: string;
  sourceUrl: string;
  resolutionNote?: string;
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  {
    id: 'pitcorthie-kilrenny-scotland', requestedName: 'Pitcorthie', name: 'Pitcorthie',
    centre: [-2.6952585, 56.2532848], radius: 500, score: 28, dogRating: 1,
    character: 'Small historic Kilrenny-parish farm locality',
    rationale: 'West Pitcorthie is a mapped rural locality. Historic fabric is retained, but no neighbouring Crail, Kilrenny or golf visitor value is transferred.',
    sourceUrl: osm('way', 362579135),
    resolutionNote: 'Resolved to West Pitcorthie in Kilrenny parish, the Pitcorthie encountered in this east-to-west East Neuk sequence.',
    boundaryConfidence: 'medium',
  },
  {
    id: 'pitkierie-scotland', requestedName: 'Pitkierie', name: 'Pitkierie',
    centre: [-2.7136456, 56.2440294], radius: 500, score: 26, dogRating: 1,
    character: 'Small rural steading locality',
    rationale: 'East Pitkierie is retained as the current mapped focus of the historic Pitkierie place-name without borrowing Kilrenny or Anstruther attractions.',
    sourceUrl: osm('way', 443032414),
    resolutionNote: 'Resolved to East Pitkierie, supported by the historic Pitkierie record.',
    boundaryConfidence: 'medium',
  },
  {
    id: 'ardross-fife-scotland', requestedName: 'Ardross', name: 'Ardross',
    centre: [-2.7937587, 56.1970153], radius: 650, score: 48, dogRating: 2,
    character: 'Coastal farm and historic barony locality',
    rationale: 'Ardross Farm is a genuine public-facing visitor stop, but the attraction is recorded separately and does not manufacture a 60-point settlement.',
    sourceUrl: osm('way', 363191722),
    resolutionNote: 'Resolved to Ardross Farm and the historic Ardross barony in Fife, not Ardross in Highland.',
  },
  {
    id: 'balchrystie-scotland', requestedName: 'Balchrystie', name: 'Balchrystie',
    centre: [-2.87257, 56.2167551], radius: 500, score: 22, dogRating: 1,
    character: 'Dispersed historic house and farm locality',
    rationale: 'Balchrystie is retained as a named rural place; private house and farm fabric is not treated as a public attraction.',
    sourceUrl: osm('way', 434871001), boundaryConfidence: 'medium',
  },
  {
    id: 'abercrombie-fife-scotland', requestedName: 'Abercrombie', name: 'Abercrombie',
    centre: [-2.7795668, 56.2156488], radius: 900, score: 56, dogRating: 2,
    character: 'Historic church hamlet and walking waypoint',
    rationale: 'The ruined medieval church and a documented circular route give a worthwhile specialist stop, but food and public-facility depth remain insufficient for 60.',
    sourceUrl: osm('node', 4347192278),
  },
  {
    id: 'arncroach-scotland', requestedName: 'Arncroach', name: 'Arncroach',
    centre: [-2.7874577, 56.2367887], radius: 650, score: 49, dogRating: 1,
    character: 'Small inland East Neuk village',
    rationale: 'Arncroach has a coherent village identity, but Kellie Castle is a separate attraction outside the settlement boundary and cannot supply its town score or facilities.',
    sourceUrl: osm('node', 4347235941),
  },
  {
    id: 'carnbee-scotland', requestedName: 'Carnbee', name: 'Carnbee',
    centre: [-2.7580584, 56.2489214], radius: 650, score: 50, dogRating: 1,
    character: 'Rural parish-church hamlet',
    rationale: 'Carnbee church, war memorial and historic fabric merit a short heritage pause, not a rounded visitor-town score. Kellie Castle remains separate.',
    sourceUrl: osm('node', 4112372789),
  },
  {
    id: 'kingsmuir-fife-scotland', requestedName: 'Kingsmuir', name: 'Kingsmuir',
    centre: [-2.74035, 56.2651], radius: 500, score: 20, dogRating: 1,
    character: 'Historic Crail-parish rural locality',
    rationale: 'The historic Kingsmuir place-name is retained independently from the Angus village and from nearby Dunino, Crail and Carnbee attractions.',
    sourceUrl: placeNames,
    resolutionNote: 'Resolved to the Fife Place-name Data record at NO542083, not Kingsmuir near Forfar.',
    boundaryConfidence: 'medium',
  },
  {
    id: 'lochty-fife-scotland', requestedName: 'Lochty', name: 'Lochty',
    centre: [-2.7647384, 56.2631131], radius: 500, score: 24, dogRating: 1,
    character: 'Small Carnbee-parish rural locality',
    rationale: 'The Fife Lochty place-name and its historic railway context are retained without transferring Carnbee, Dunino or Crail visitor value.',
    sourceUrl: osm('node', 8115416571),
    resolutionNote: 'Resolved to Lochty in Fife at NO525081, not the existing Angus Lochty record.',
    boundaryConfidence: 'medium',
  },
  {
    id: 'radernie-scotland', requestedName: 'Radernie', name: 'Radernie',
    centre: [-2.865737, 56.2764434], radius: 550, score: 28, dogRating: 1,
    character: 'Dispersed rural hamlet',
    rationale: 'Radernie remains selector-visible as a mapped hamlet but does not inherit nearby Peat Inn, Lathones or St Andrews services.',
    sourceUrl: osm('node', 2616303928),
  },
  {
    id: 'lathones-scotland', requestedName: 'Lahtones', name: 'Lathones',
    centre: [-2.8500113, 56.2683594], radius: 650, score: 42, dogRating: 1,
    character: 'Roadside village with destination inn',
    rationale: 'The inn is a meal-and-accommodation business rather than the agreed café-led Eat offer; customer facilities do not make Lathones a visitor destination.',
    sourceUrl: osm('node', 1376547764),
    resolutionNote: 'The requested spelling is normalised to the current mapped name Lathones.',
  },
  {
    id: 'largoward-scotland', requestedName: 'Largoward', name: 'Largoward',
    centre: [-2.8625713, 56.2573988], radius: 800, score: 46, dogRating: 1,
    character: 'Working inland village',
    rationale: 'Largoward is a real service village, but its place plan identifies several visitor and active-travel facilities as future proposals rather than current provision.',
    sourceUrl: osm('node', 1376547762),
  },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id,
      name: seed.name,
      countryCode: 'GB-SCT', country: 'Scotland', region: 'Fife', locality: seed.name,
      centre: seed.centre, boundary,
      boundarySource: 'Resolved named-place location with a conservative strict settlement study buffer',
      boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager',
      createdAt, methodology: defaultMethodology,
      researchNotes: `East Neuk sequential full audit intake. ${seed.resolutionNote ?? ''} No neighbouring attraction, estate, coast, golf course or parent-town service is transferred into this settlement score.`,
      touristAppeal: {
        score: seed.score,
        dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
        dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: seed.rationale,
        dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are assumed without current evidence.',
        methodVersion: '2026-09-02-sequential-full-town-audit-v4', reviewedAt,
        sourceUrls: [seed.sourceUrl, placeNames, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: seed.score >= 50 ? 'A modest specialist heritage stop' : 'A recorded place rather than a visitor destination',
        intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['A route waypoint or specifically researched local-history stop'],
        dontMiss: [], suggestedTime: seed.score >= 50 ? 'Up to 1 hour' : 'Pass-through or pre-arranged visit only',
        visitorMood: 'Selectable with an evidence-based score; absent from the main town map below 60.',
        sourceUrls: [seed.sourceUrl, placeNames, osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: 'OpenStreetMap named place and Fife Place-name Data',
        sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius,
        localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Strict editorial study area, not an administrative boundary. Used consistently for local HES and visitor-place assignment.',
      },
    },
    features: [],
    sources: [{
      id: `${seed.id}-locality`, name: `${seed.name} locality resolution`,
      organisation: 'OpenStreetMap contributors and Fife Place-name Data', coverage: seed.name,
      accessMethod: 'Named-place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl,
      licence: 'OpenStreetMap ODbL or cited source terms; retain attribution.', reliability: 'secondary',
      limitations: 'Circular editorial boundary is conservative and does not imply an administrative settlement boundary.',
    }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) {
  const stem = pkg.project.id.replace(/-scotland$/, '');
  await writeFile(resolve('data/projects', `${stem}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

for (const filename of ['data/east-neuk-visitor-planner-curation.json', 'data/east-neuk-dog-access-curation.json']) {
  const library = JSON.parse(await readFile(resolve(filename), 'utf8')) as { reviewedAt?: string; projects: Record<string, unknown> };
  for (const seed of seeds) library.projects[seed.id] ??= {};
  library.reviewedAt = reviewedAt;
  await writeFile(resolve(filename), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

await writeFile(resolve('data/review/east-neuk-inland-additions-2026-09-02.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'All resolved places remain selector-visible with their audited score; only independently worthwhile settlements scoring at least 60 appear as town markers.',
  additions: seeds.map((seed) => ({
    requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id,
    score: seed.score, publishOnTownMap: seed.score >= 60, rationale: seed.rationale,
    resolutionNote: seed.resolutionNote, sourceUrl: seed.sourceUrl,
  })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} distinct East Neuk localities without overwriting same-name Angus projects.`);
