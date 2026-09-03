import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T22:45:00.000Z`;
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

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
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;
const seeds: Seed[] = [
  { id: 'careston-castle-scotland', requestedName: 'Careston Castle', name: 'Careston Castle', centre: [-2.7687243, 56.7282760], radius: 500, score: 22, dogRating: 0, character: 'Private historic castle property', rationale: 'Careston Castle is retained as a named heritage property, not promoted as a tourist town or public attraction without verified visitor access.', sourceUrl: osm('way', 610240489) },
  { id: 'aldbar-castle-scotland', requestedName: 'Aldbar Castle', name: 'Aldbar Castle', centre: [-2.6976110, 56.7111180], radius: 450, score: 18, dogRating: 0, character: 'Ruined historic castle site', rationale: 'Aldbar Castle is an archaeological property reference rather than an independently visitable settlement or confirmed public attraction.', sourceUrl: osm('node', 5326102716) },
  { id: 'netherton-melgund-scotland', requestedName: 'Netherton', name: 'Netherton', centre: [-2.7409872, 56.7091324], radius: 550, score: 20, dogRating: 1, character: 'Small rural Angus hamlet', rationale: 'This resolves to the eastern Netherton near Melgund and Careston, not Netherton by Memus; it has no independent destination-scale visitor offer.', sourceUrl: osm('node', 5286884725) },
  { id: 'mains-of-melgund-scotland', requestedName: 'mains of melgund', name: 'Mains of Melgund', centre: [-2.7477829, 56.6982391], radius: 500, score: 18, dogRating: 0, character: 'Historic farm and estate locality', rationale: 'Mains of Melgund is a mapped farm locality; Melgund Castle and estate heritage do not turn it into a tourist settlement.', sourceUrl: osm('way', 415137803) },
  { id: 'aberlemno-scotland', requestedName: 'aberlemno', name: 'Aberlemno', centre: [-2.7811079, 56.6915212], radius: 850, score: 48, dogRating: 2, character: 'Small Pictish-stone village', rationale: 'Aberlemno has genuine village character, but the nationally important stones are a separate attraction and do not by themselves justify a 60+ town marker.', sourceUrl: osm('node', 2375525571) },
  { id: 'pitkennedy-scotland', requestedName: 'pitkennedy', name: 'Pitkennedy', centre: [-2.7485999, 56.6773971], radius: 550, score: 24, dogRating: 1, character: 'Rural Angus hamlet', rationale: 'Pitkennedy remains selectable as a named hamlet without borrowing interest from Aberlemno or the wider cycle route.', sourceUrl: osm('node', 5732490866) },
  { id: 'turin-angus-scotland', requestedName: 'turin', name: 'Turin', centre: [-2.7450680, 56.6651223], radius: 600, score: 24, dogRating: 1, character: 'Rural Rescobie hamlet', rationale: 'Turin is a small rural locality; Turin Hill and surrounding heritage remain separate landscape or attraction evidence.', sourceUrl: osm('node', 9934189974) },
  { id: 'rescobie-scotland', requestedName: 'recobie', name: 'Rescobie', centre: [-2.8032159, 56.6577502], radius: 750, score: 42, dogRating: 2, character: 'Historic lochside hamlet', rationale: 'The requested spelling resolves to Rescobie. The hamlet has local character, while Rescobie Loch and its wildlife interest remain a separate visitor proposition.', sourceUrl: osm('node', 4155878350) },
  { id: 'reswallie-scotland', requestedName: 'reswallie', name: 'Reswallie', centre: [-2.8113247, 56.6531122], radius: 550, score: 24, dogRating: 1, character: 'Small lochside Angus hamlet', rationale: 'Reswallie is retained independently and does not inherit the visitor value of Rescobie Loch or Forfar.', sourceUrl: osm('node', 4155878629) },
  { id: 'burnside-rescobie-scotland', requestedName: 'burnside', name: 'Burnside', centre: [-2.8146430, 56.6398201], radius: 500, score: 20, dogRating: 1, character: 'Historic Rescobie estate locality', rationale: 'This resolves to Burnside of Rescobie, centred on Burnside House, rather than the unrelated Burnside of Duntrune.', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB17686', boundaryConfidence: 'medium' },
  { id: 'balgavies-scotland', requestedName: 'balgavies', name: 'Balgavies', centre: [-2.7488387, 56.6506831], radius: 700, score: 38, dogRating: 2, character: 'Small Angus hamlet near Balgavies Loch', rationale: 'Balgavies is retained as a hamlet; the loch wildlife reserve is a separate attraction and does not inflate the settlement score.', sourceUrl: osm('node', 4155878299) },
  { id: 'milldens-scotland', requestedName: 'millden', name: 'Milldens', centre: [-2.7425355, 56.6448043], radius: 550, score: 20, dogRating: 1, character: 'Historic Rescobie mill locality', rationale: 'The contextual request resolves to Milldens near Balgavies, represented from West Milldens, and is distinct from Millden and Millden Lodge in Glen Esk.', sourceUrl: osm('way', 551728110), boundaryConfidence: 'medium' },
  { id: 'middle-drums-scotland', requestedName: 'Middle Drum', name: 'Middle Drums', centre: [-2.6710712, 56.7075990], radius: 550, score: 20, dogRating: 1, character: 'Rural Angus hamlet', rationale: 'The requested singular spelling resolves to mapped Middle Drums, a small rural locality rather than a visitor destination.', sourceUrl: osm('node', 6053568967) },
  { id: 'dubton-guthrie-scotland', requestedName: 'Dubton', name: 'Dubton', centre: [-2.7042536, 56.6646186], radius: 600, score: 24, dogRating: 1, character: 'Rural hamlet near Guthrie', rationale: 'This resolves to the Dubton west of Glasterlaw and Guthrie, not the separate properties near Hillside or Brechin.', sourceUrl: osm('node', 4155878328) },
  { id: 'glasterlaw-scotland', requestedName: 'Glasterlaw', name: 'Glasterlaw', centre: [-2.6632105, 56.6518101], radius: 600, score: 24, dogRating: 1, character: 'Rural Angus hamlet', rationale: 'Glasterlaw is a recognisable mapped hamlet but does not currently support an independent visitor-town experience.', sourceUrl: osm('node', 4134264928) },
  { id: 'guthrie-angus-scotland', requestedName: 'Gutherie', name: 'Guthrie', centre: [-2.7073521, 56.6438720], radius: 850, score: 44, dogRating: 2, character: 'Small historic Angus village', rationale: 'The requested spelling resolves to Guthrie. Its village and heritage character are genuine, while Guthrie Castle remains private and does not support a 60+ score.', sourceUrl: osm('node', 4870250693) },
  { id: 'kinnell-angus-scotland', requestedName: 'Kinnell', name: 'Kinnell', centre: [-2.6386394, 56.6436172], radius: 800, score: 44, dogRating: 2, character: 'Small historic Angus village', rationale: 'Kinnell has a distinct village and kirk setting but too little independently verified visitor depth for the town map.', sourceUrl: osm('node', 4134264930) },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: seed.boundaryConfidence ?? 'high',
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, heritage properties and nature reserves do not inflate the place score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: `${seed.name} is retained as an Angus regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating,
        dogAccessSummary: seed.dogRating === 0 ? 'No dependable public visitor or dog access has been verified.' : 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-29-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Angus route'], dontMiss: [],
        suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt,
        bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / cited mapping evidence', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) await writeFile(resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const planner = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog = JSON.parse(await readFile(dogPath, 'utf8'));
for (const seed of seeds) { planner.projects[seed.id] = {}; dog.projects[seed.id] = {}; }
planner.reviewedAt = reviewedAt;
dog.reviewedAt = reviewedAt;
await Promise.all([
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8'),
]);

await writeFile(resolve('data/review/aberlemno-guthrie-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1,
  reviewedAt,
  threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Isolated castles and nature reserves are not transferred into settlement scores.',
  namingDecisions: [
    'Recobie resolves to Rescobie.',
    'Middle Drum resolves to Middle Drums.',
    'Gutherie resolves to Guthrie.',
    'The contextual Millden request resolves to Milldens near Balgavies, distinct from Millden Lodge in Glen Esk.',
    'Netherton resolves to the eastern hamlet near Careston and Mains of Melgund, not Netherton by Memus.',
    'Burnside resolves to Burnside of Rescobie, not Burnside of Duntrune.',
    'Dubton resolves to the Guthrie-area hamlet, not the Hillside or Brechin properties.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence ?? 'high' })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Aberlemno–Guthrie catalogue places; none publish on the town map.`);
