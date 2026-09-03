import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T12:00:00.000Z`;
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

interface Seed {
  id: string; requestedName: string; name: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; summary: string; rationale: string;
  sourceUrl: string; boundarySource: string; boundaryConfidence: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'dinnet-scotland', requestedName: 'dinnet', name: 'Dinnet', centre: [-2.8926313, 57.0769599], radius: 700, score: 54, dogRating: 3, character: 'Small Royal Deeside village', summary: 'A compact Deeside village with countryside access, held below publication pending a full audit.', rationale: 'The village is assessed independently. Muir of Dinnet National Nature Reserve and surrounding estates belong in See coverage and do not automatically promote Dinnet above 60.', sourceUrl: 'https://www.openstreetmap.org/node/5305610907', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'glen-tanar-house-scotland', requestedName: 'Glen Tanar House', name: 'Glen Tanar House', centre: [-2.87027, 57.04850], radius: 500, score: 22, dogRating: 1, character: 'Private historic estate locality', summary: 'A historic house and estate locality rather than an independently visitable settlement.', rationale: 'Glen Tanar House is retained in the selector as a named place. The wider estate, reserve, walks and event venue are separate visitor propositions and do not create a town rating.', sourceUrl: 'https://www.trove.scot/place/265080', boundarySource: 'National Record of the Historic Environment location with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'aboyne-scotland', requestedName: 'Aboyne', name: 'Aboyne', centre: [-2.7791521, 57.0765835], radius: 1500, score: 58, dogRating: 3, character: 'Substantial Royal Deeside village', summary: 'A well-served Deeside village with strong visitor potential, held below publication pending a full audit.', rationale: 'Aboyne is likely to qualify after a complete attractions, trails, café, facilities and dated-heritage audit; the catalogue addition does not guess a 60+ result.', sourceUrl: 'https://www.openstreetmap.org/node/2121641372', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer pending a formal full-audit boundary', boundaryConfidence: 'medium' },
  { id: 'birsemore-scotland', requestedName: 'Birsemore', name: 'Birsemore', centre: [-2.7812067, 57.0677081], radius: 650, score: 32, dogRating: 2, character: 'Small Deeside locality', summary: 'A small residential and rural locality south of Aboyne with limited independent visitor depth.', rationale: 'Birsemore Hill, Aboyne and the wider Birse landscape remain separately assessed; nearby scenery is not transferred into the locality score.', sourceUrl: 'https://www.openstreetmap.org/node/1445437563', boundarySource: 'OpenStreetMap locality node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'birse-scotland', requestedName: '~Birse', name: 'Birse', centre: [-2.7346091, 57.0622972], radius: 700, score: 42, dogRating: 2, character: 'Historic rural hamlet', summary: 'A small historic hamlet with local character but limited verified visitor facilities.', rationale: 'The leading tilde is removed from the requested name. Parish heritage and the Forest of Birse are retained as separate evidence rather than used to overstate the hamlet.', sourceUrl: 'https://www.openstreetmap.org/node/1445420089', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'kincardine-oneil-scotland', requestedName: "Kincardine o'neil", name: "Kincardine O'Neil", centre: [-2.6751106, 57.0863090], radius: 1100, score: 58, dogRating: 3, character: 'Historic Royal Deeside village', summary: 'A historic Deeside village with clear visitor potential, held below publication pending a full audit.', rationale: 'This is distinct from Kincardine-on-Forth. A complete audit must verify its own attractions, trails, cafés, parking, picnic provision, toilets and dated heritage before 60+ publication.', sourceUrl: 'https://www.openstreetmap.org/node/1021347706', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer pending a formal full-audit boundary', boundaryConfidence: 'medium' },
  { id: 'marywell-birse-scotland', requestedName: 'Marywell', name: 'Marywell', centre: [-2.690054, 57.050640], radius: 650, score: 34, dogRating: 2, character: 'Small Birse settlement', summary: 'A small rural settlement with limited independent visitor depth.', rationale: 'This is the AB34 Marywell in Birse, distinct from the existing Marywell near Portlethen. Nearby Finzean, Birse and Ballogie features are not borrowed into its score.', sourceUrl: 'https://www.getthedata.com/marywell/where-is-marywell', boundarySource: 'Ordnance Survey Open Names settlement evidence and ONS postcode centroid with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'finzean-scotland', requestedName: 'Finzean', name: 'Finzean', centre: [-2.6293802, 57.0218972], radius: 1300, score: 56, dogRating: 3, character: 'Historic rural Deeside community', summary: 'A distinctive rural community with visitor potential, held below publication pending a full audit.', rationale: 'Finzean may qualify after a full audit of its own trails, cafés, practical facilities, attractions and dated heritage. Estate and wider landscape interest do not justify guessed publication.', sourceUrl: 'https://www.openstreetmap.org/node/5923914723', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer pending a formal full-audit boundary', boundaryConfidence: 'medium' },
  { id: 'percie-scotland', requestedName: 'Perde', name: 'Percie', centre: [-2.6743456, 57.0154603], radius: 500, score: 18, dogRating: 1, character: 'Dispersed rural locality', summary: 'A small recorded rural locality rather than a tourist settlement.', rationale: 'The requested spelling is resolved to Percie using Birse parish and gazetteer evidence. Surrounding Finzean and Forest of Birse interest is not transferred to it.', sourceUrl: 'https://streetmap.co.uk/place/Percie_in_Aberdeenshire_460261_802805.htm', boundarySource: 'Ordnance Survey gazetteer location with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'ballochan-scotland', requestedName: 'Ballochan', name: 'Ballochan', centre: [-2.7855385, 57.0022495], radius: 600, score: 26, dogRating: 2, character: 'Remote Forest of Birse locality', summary: 'A remote named locality with landscape context but no complete independent visitor offer.', rationale: 'Birse Castle, scheduled archaeology, hill routes and the Forest of Birse belong in See or trail coverage. They do not turn the locality itself into a 60+ town.', sourceUrl: 'https://gazetteer.org.uk/place/Ballochan%2C_Aberdeenshire_2125', boundarySource: 'Gazetteer of British Place Names and OpenStreetMap locality evidence with a conservative editorial study buffer', boundaryConfidence: 'medium' },
];

function boundaryFor(seed: Seed): Feature<Polygon> {
  return buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = boundaryFor(seed);
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Aberdeenshire', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: seed.boundarySource, boundaryConfidence: seed.boundaryConfidence,
      sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, neighbouring settlements and private properties do not inflate the settlement score.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogRating,
        dogAccessSummary: seed.dogRating >= 2 ? 'Local outdoor access may support a dog walk, with close control around roads, livestock and wildlife.' : 'No destination-scale dog visit or dedicated dog facilities are verified.',
        methodVersion: '2026-08-29-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: 'A recorded locality pending any full destination audit', intro: seed.rationale,
        bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider route'], dontMiss: [],
        suggestedTime: 'Pass-through or local-purpose visit', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: seed.boundarySource, sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt,
        bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. HES records are selected from the bundled local Scotland datasets against this transparent boundary.',
      },
    },
    features: [],
    sources: [{ id: `${seed.id}-locality`, name: `${seed.name} settlement gate`, organisation: 'OpenStreetMap contributors / official gazetteer evidence', coverage: seed.name, accessMethod: 'Mapped locality identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap data under ODbL where used; source-linked editorial evidence.', reliability: 'secondary', limitations: 'Preliminary catalogue gate. A later full visitor audit may add verified facilities, trails and artwork without borrowing neighbouring attractions.' }],
    historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) {
  await writeFile(resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

const planner = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog = JSON.parse(await readFile(dogPath, 'utf8'));
for (const seed of seeds) { planner.projects[seed.id] = {}; dog.projects[seed.id] = {}; }
planner.reviewedAt = reviewedAt; dog.reviewedAt = reviewedAt;
await Promise.all([
  writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'),
  writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8'),
]);

await writeFile(resolve('data/review/dinnet-finzean-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  namingDecisions: ['The leading tilde is removed from Birse.', "Kincardine o'neil is normalised to Kincardine O'Neil and kept distinct from Kincardine-on-Forth.", 'Marywell resolves to the AB34 Birse settlement and is kept distinct from Marywell near Portlethen.', 'Perde is corrected to the recorded Birse locality Percie.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Dinnet–Finzean catalogue places; none publish on the town map before a full 60+ audit.`);
