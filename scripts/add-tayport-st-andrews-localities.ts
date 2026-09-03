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

const reviewedAt = '2026-08-31';
const createdAt = `${reviewedAt}T12:00:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string;
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
  { id: 'tayport-scotland', requestedName: 'Tayport', name: 'Tayport', centre: [-2.8807193, 56.4490878], radius: 1200, initialScore: 58, dogRating: 2, character: 'Tay estuary harbour town', rationale: 'A substantial harbour and coastal town requiring a complete independent audit before its map score is published.', sourceUrl: osm('node', 243596728) },
  { id: 'leuchars-scotland', requestedName: 'Leuchars', name: 'Leuchars', centre: [-2.8838885, 56.3814110], radius: 900, initialScore: 58, dogRating: 2, character: 'Historic Fife village and rail gateway', rationale: 'The village, rather than the railway station alone, is the assessment subject; heritage and visitor depth must be checked independently.', sourceUrl: osm('node', 21511528) },
  { id: 'guardbridge-scotland', requestedName: 'Guardbridge', name: 'Guardbridge', centre: [-2.8906486, 56.3605947], radius: 800, initialScore: 52, dogRating: 2, character: 'Eden estuary industrial village', rationale: 'Industrial heritage and estuary access are relevant, but nearby St Andrews and Eden attractions are not transferred automatically.', sourceUrl: osm('node', 29755167) },
  { id: 'rhynd-fife-scotland', requestedName: 'Rhynd', name: 'Rhynd', centre: [-2.8668608, 56.4037114], radius: 500, initialScore: 28, dogRating: 1, character: 'Rural Leuchars-area locality', rationale: 'The mapped farm and any destination business are kept distinct from settlement-level visitor merit.', sourceUrl: osm('way', 428916319), boundaryConfidence: 'medium' },
  { id: 'carrick-leuchars-scotland', requestedName: 'Carrick', name: 'Carrick', centre: [-2.9055953, 56.3924507], radius: 500, initialScore: 24, dogRating: 1, character: 'Small Leuchars parish locality', rationale: 'The historic Fife place-name at NO441226 is retained without inheriting Leuchars or Tayport attractions.', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/parish/?id=53', resolutionNote: 'Resolved from the Fife Place-name Data grid reference NO441226.', boundaryConfidence: 'medium' },
  { id: 'kincaple-scotland', requestedName: 'Kincaple', name: 'Kincaple', centre: [-2.8696783, 56.3545842], radius: 550, initialScore: 34, dogRating: 1, character: 'Small historic roadside hamlet', rationale: 'Kincaple is assessed on its own compact fabric and services, not on nearby St Andrews.', sourceUrl: osm('node', 443043478) },
  { id: 'strathkinness-scotland', requestedName: 'Strathkinness', name: 'Strathkinness', centre: [-2.8763984, 56.3355368], radius: 800, initialScore: 56, dogRating: 2, character: 'Elevated Fife village', rationale: 'A coherent village that needs its own See, daytime food, trail and practical-facility evidence checked before crossing 60.', sourceUrl: osm('node', 29641849) },
  { id: 'newpark-st-andrews-scotland', requestedName: 'Newpark', name: 'Newpark', centre: [-2.8156147, 56.3336648], radius: 450, initialScore: 22, dogRating: 1, character: 'Historic St Andrews edge locality', rationale: 'Newpark is treated as a named St Andrews locality around New Park Place and the former New Park estate, not as an independent town.', sourceUrl: 'https://www.ladebraes.net/new-mill/', resolutionNote: 'Resolved to the Newpark locality recorded beside New Mill and modern New Park Place.', boundaryConfidence: 'medium' },
  { id: 'balone-scotland', requestedName: 'Balone', name: 'Balone', centre: [-2.8362204, 56.3263640], radius: 500, initialScore: 24, dogRating: 1, character: 'Small Mount Melville-area hamlet', rationale: 'Balone remains a regional reference and does not inherit St Andrews or Craigtoun visitor value.', sourceUrl: osm('node', 8115194361) },
  { id: 'denhead-st-andrews-scotland', requestedName: 'Denhead', name: 'Denhead', centre: [-2.8618854, 56.3129540], radius: 550, initialScore: 30, dogRating: 1, character: 'Small St Andrews parish hamlet', rationale: 'The hamlet is assessed independently from Mount Melville, Peat Inn and St Andrews attractions.', sourceUrl: osm('node', 443043511) },
  { id: 'peat-inn-scotland', requestedName: 'Peat Inn', name: 'Peat Inn', centre: [-2.8838913, 56.2773998], radius: 550, initialScore: 45, dogRating: 1, character: 'Small rural hamlet with destination dining', rationale: 'A notable restaurant is assessed under Eat but cannot by itself turn the hamlet into a tourist town.', sourceUrl: osm('node', 963101912) },
  { id: 'st-andrews-scotland', requestedName: 'St Andrews', name: 'St Andrews', centre: [-2.7950440, 56.3403678], radius: 2300, initialScore: 58, dogRating: 2, character: 'Historic university, cathedral and golf town', rationale: 'A major destination deliberately held below publication until its unusually large heritage and visitor dataset passes the complete audit.', sourceUrl: osm('node', 21511530) },
  { id: 'brownhills-st-andrews-scotland', requestedName: 'Brownhills', name: 'Brownhills', centre: [-2.7659317, 56.3261311], radius: 500, initialScore: 22, dogRating: 1, character: 'Rural St Andrews-edge steading', rationale: 'Brownhills is a named rural locality rather than a visitor settlement and does not inherit St Andrews attractions.', sourceUrl: osm('way', 413602525), resolutionNote: 'Mapped today as Brownhills Steadings.', boundaryConfidence: 'medium' },
  { id: 'boarhills-scotland', requestedName: 'Boarhills', name: 'Boarhills', centre: [-2.7040609, 56.3169026], radius: 650, initialScore: 52, dogRating: 2, character: 'Historic East Fife hamlet', rationale: 'Church, landscape and walking evidence require checking without transferring nearby coast or estate attractions into the hamlet score.', sourceUrl: osm('node', 29594456) },
  { id: 'kingsbarns-scotland', requestedName: 'Kinmgsbarns', name: 'Kingsbarns', centre: [-2.6601739, 56.2989409], radius: 850, initialScore: 58, dogRating: 2, character: 'Historic village near the East Neuk coast', rationale: 'The village, beach, golf and nearby estate/distillery relationships require strict boundary separation before a final score is published.', sourceUrl: osm('node', 29594454), resolutionNote: 'The requested spelling is normalised to Kingsbarns.' },
  { id: 'prior-muir-scotland', requestedName: 'Prior Muir', name: 'Prior Muir', centre: [-2.7649596, 56.3102695], radius: 500, initialScore: 24, dogRating: 1, character: 'Small rural St Andrews locality', rationale: 'Prior Muir remains selectable but does not inherit St Andrews, Dunino or coastal attractions.', sourceUrl: osm('node', 13966263093) },
  { id: 'stravithie-scotland', requestedName: 'Stavithie', name: 'Stravithie', centre: [-2.7556859, 56.2908317], radius: 550, initialScore: 28, dogRating: 1, character: 'Historic Dunino parish locality', rationale: 'The surviving rural locality is separated from the wider medieval lands and vanished castle site when scoring a visit.', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=1985', resolutionNote: 'The requested spelling is normalised to Stravithie.' },
  { id: 'dunino-scotland', requestedName: 'Dunino', name: 'Dunino', centre: [-2.7465088, 56.2879284], radius: 700, initialScore: 58, dogRating: 2, character: 'Small historic church hamlet', rationale: 'The kirk, den and related heritage may support a specialist stop, but the hamlet must pass the complete facilities and boundary audit first.', sourceUrl: osm('node', 1516981137) },
  { id: 'balcomie-scotland', requestedName: 'Balcomie', name: 'Balcomie', centre: [-2.6091217, 56.2804237], radius: 600, initialScore: 26, dogRating: 1, character: 'Rural Crail estate locality', rationale: 'Balcomie is retained as a locality; the golf links, beach and castle are separate attractions and cannot manufacture a town score.', sourceUrl: osm('way', 430098295), boundaryConfidence: 'medium' },
  { id: 'craighead-crail-scotland', requestedName: 'Craighead', name: 'Craighead', centre: [-2.5944034, 56.2793188], radius: 500, initialScore: 22, dogRating: 1, character: 'Small coastal-edge Crail locality', rationale: 'Craighead at NO632098 is retained without treating Craighead Links or the Fife Ness coast as a settlement offer.', sourceUrl: 'https://fife-placenames.glasgow.ac.uk/placename/?id=1891', resolutionNote: 'Resolved from the Fife Place-name Data grid reference NO632098.', boundaryConfidence: 'medium' },
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
        methodVersion: '2026-08-31-strict-settlement-intake-v1',
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

const packages = seeds.map(packageFor);
for (const pkg of packages) {
  await writeFile(resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

for (const filename of ['data/east-neuk-visitor-planner-curation.json', 'data/east-neuk-dog-access-curation.json']) {
  const library = JSON.parse(await readFile(resolve(filename), 'utf8')) as { reviewedAt?: string; projects: Record<string, unknown> };
  for (const seed of seeds) library.projects[seed.id] ??= {};
  library.reviewedAt = reviewedAt;
  await writeFile(resolve(filename), `${JSON.stringify(library, null, 2)}\n`, 'utf8');
}

await writeFile(resolve('data/review/tayport-st-andrews-locality-additions-2026-08-31.json'), `${JSON.stringify({
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

console.log(`Added ${packages.length} Tayport-Craighead catalogue places for sequential full audit.`);
