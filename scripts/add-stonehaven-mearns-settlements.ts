import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-28';
const createdAt = `${reviewedAt}T22:45:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const plannerPath = resolve('data/stonehaven-coast-visitor-planner-curation.json');
const dogPath = resolve('data/stonehaven-coast-dog-access-curation.json');

interface Seed {
  id: string;
  requestedName: string;
  name: string;
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  summary: string;
  rationale: string;
  sourceUrl: string;
}

const seeds: Seed[] = [
  { id: 'rickarton-scotland', requestedName: 'Rickarton', name: 'Rickarton', centre: [-2.3039962, 56.9924844], radius: 500, score: 20, dogRating: 1, character: 'Dispersed rural hamlet', summary: 'A small agricultural hamlet without a verified public visitor experience.', rationale: 'Rickarton is distinct from Union Cottage and Mains of Rickarton. Private houses and nearby Stonehaven attractions do not create a town-scale visit.', sourceUrl: 'https://www.openstreetmap.org/node/12106624175' },
  { id: 'cowie-stonehaven-scotland', requestedName: 'Cowie', name: 'Cowie', centre: [-2.2015333, 56.9712281], radius: 520, score: 38, dogRating: 2, character: 'Northern Stonehaven quarter', summary: 'A named quarter at Stonehaven’s northern edge with riverside and geology context but no independent town-scale offer.', rationale: 'Cowie remains separately selectable, while Stonehaven promenade, cafés and facilities stay with Stonehaven and are not duplicated.', sourceUrl: 'https://www.openstreetmap.org/node/5500042041' },
  { id: 'fiddes-scotland', requestedName: 'Fiddes', name: 'Fiddes', centre: [-2.32241, 56.91833], radius: 450, score: 18, dogRating: 1, character: 'Scattered rural locality', summary: 'A dispersed farming locality rather than a visitor settlement.', rationale: 'Bridge of Fiddes services and neighbouring Glenbervie or Drumlithie are not transferred into the locality score.', sourceUrl: 'https://www.openstreetmap.org/?mlat=56.91833&mlon=-2.32241#map=16/56.91833/-2.32241' },
  { id: 'carmont-scotland', requestedName: 'Carmont', name: 'Carmont', centre: [-2.3456846, 56.938148], radius: 420, score: 18, dogRating: 1, character: 'Small railway-country hamlet', summary: 'A very small rural hamlet near the historic railway corridor, without public visitor facilities.', rationale: 'The railway history is retained as context, not treated as an open attraction or complete settlement visit.', sourceUrl: 'https://www.openstreetmap.org/node/5497020481' },
  { id: 'tewel-scotland', requestedName: 'Tewel', name: 'Tewel', centre: [-2.2812886, 56.9605304], radius: 430, score: 16, dogRating: 1, character: 'Agricultural hamlet', summary: 'A compact rural hamlet with no verified independent visitor offer.', rationale: 'Nearby estates, paths and Stonehaven services remain outside Tewel’s score.', sourceUrl: 'https://www.openstreetmap.org/node/10172538870' },
  { id: 'mergie-scotland', requestedName: 'Mergie', name: 'Mergie', centre: [-2.3379527, 56.9887525], radius: 430, score: 16, dogRating: 1, character: 'Agricultural hamlet', summary: 'A small rural locality without a documented public destination experience.', rationale: 'The catalogue records the place without borrowing attractions from Stonehaven or the wider Mearns.', sourceUrl: 'https://www.openstreetmap.org/node/10161999311' },
  { id: 'tannachie-scotland', requestedName: 'Tannachie', name: 'Tannachie', centre: [-2.3528657, 56.9446387], radius: 430, score: 16, dogRating: 1, character: 'Agricultural hamlet', summary: 'A small farming hamlet without verified visitor facilities or an open attraction.', rationale: 'Historic-map interest alone does not make the settlement a tourist destination.', sourceUrl: 'https://www.openstreetmap.org/node/10161999299' },
  { id: 'newmill-carmont-scotland', requestedName: 'New Mill', name: 'Newmill', centre: [-2.3509631, 56.9392205], radius: 380, score: 18, dogRating: 1, character: 'Railway-country hamlet', summary: 'A tiny hamlet beside the Carmont railway corridor, with no complete public visitor offer.', rationale: 'Normalised to the mapped Newmill at Carmont. The former station and signal-box story is context rather than an independently visitable attraction.', sourceUrl: 'https://www.openstreetmap.org/node/5497020475' },
  { id: 'mains-of-dellavaird-scotland', requestedName: 'Mains of Dellavaird', name: 'Mains of Dellavaird', centre: [-2.4255, 56.9248633], radius: 430, score: 18, dogRating: 1, character: 'Rural hamlet', summary: 'A small mapped hamlet in the Mearns without a verified public visitor experience.', rationale: 'Glenbervie House, Auchenblae and Drumlithie remain separate places and do not inflate this score.', sourceUrl: 'https://www.openstreetmap.org/node/10161999270' },
  { id: 'glenbervie-scotland', requestedName: 'Glenbervie', name: 'Glenbervie', centre: [-2.3847805, 56.9157487], radius: 650, score: 47, dogRating: 2, character: 'Historic Mearns hamlet', summary: 'A historic rural hamlet with church and estate context, but limited dependable visitor depth or facilities.', rationale: 'Glenbervie’s own historic fabric earns recognition, while private estate buildings and Drumlithie services are not counted as a complete visitor offer.', sourceUrl: 'https://www.openstreetmap.org/node/1463055040' },
  { id: 'drumlithie-scotland', requestedName: 'Drumlithir', name: 'Drumlithie', centre: [-2.3521694, 56.9187431], radius: 850, score: 56, dogRating: 2, character: 'Traditional Mearns village', summary: 'A recognisable village with historic character and local amenities, but not yet a sufficiently evidenced 60+ destination.', rationale: 'Normalised from Drumlithir to Drumlithie. The preliminary gate keeps it off the town map until a full audit verifies visitor attractions, trails, café-led food and practical facilities.', sourceUrl: 'https://www.openstreetmap.org/node/4770205813' },
  { id: 'glenfarquhar-lodge-scotland', requestedName: 'Glenfarquar Lodge', name: 'Glenfarquhar Lodge', centre: [-2.45, 56.91667], radius: 360, score: 14, dogRating: 1, character: 'Private Arts and Crafts lodge locality', summary: 'A named private lodge rather than a public visitor settlement.', rationale: 'The 1898–99 shooting lodge is retained in the selector for geographic completeness, but private architectural interest does not create a town rating.', sourceUrl: 'https://www.openstreetmap.org/?mlat=56.91667&mlon=-2.45#map=16/56.91667/-2.45' },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const adjustment = townDogAccessScoreAdjustment(seed.dogRating);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: `OpenStreetMap or Gazetteer locality position with a conservative ${seed.radius}m editorial study buffer`,
      boundaryConfidence: 'low', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, neighbouring settlements and private properties do not inflate the settlement score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: adjustment,
        rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogRating,
        dogAccessSummary: seed.dogRating >= 2 ? 'Local outdoor access may support a dog walk, with close control around roads, livestock and wildlife.' : 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-28-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded locality rather than a tourist destination', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider route'], dontMiss: [],
        suggestedTime: 'Pass-through or local-purpose visit', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: 'OpenStreetMap or Gazetteer locality position with editorial buffer', sourceUrl: seed.sourceUrl,
        sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} settlement gate`, organisation: 'OpenStreetMap contributors / Gazetteer evidence', coverage: seed.name, accessMethod: 'Mapped locality identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used; source-linked editorial evidence.', reliability: 'secondary', limitations: 'Preliminary catalogue gate. A later full visitor audit may add verified facilities, trails and artwork without borrowing neighbouring attractions.' }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) {
  const fileName = `${pkg.project.id.replace(/-scotland$/, '')}.json`;
  await writeFile(resolve('data/projects', fileName), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

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

await writeFile(resolve('data/review/stonehaven-mearns-settlement-additions-2026-08-28.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  namingDecisions: [
    'Barras resolves to the existing Midtown of Barras project.',
    'Drumlithir is normalised to the mapped village Drumlithie.',
    'New Mill is normalised to the mapped Carmont-area hamlet Newmill, not the separate Moray village.',
    'Glenfarquar Lodge is normalised to Glenfarquhar Lodge; historic sources also show the spelling Glenfarguhar.',
    'Rickarton is distinct from the existing Union Cottage near Rickarton and from Mains of Rickarton.',
  ],
  existingReaudited: ['stonehaven-scotland', 'kirktown-of-fetteresso-scotland', 'crawton-scotland', 'mill-of-uras-scotland', 'midtown-of-barras-scotland'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Stonehaven–Mearns catalogue places; none publish on the town map before a full 60+ audit.`);
