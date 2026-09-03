import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T02:00:00.000Z`;
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
  { id: 'milton-of-corsindae-scotland', requestedName: 'Milton of Corsindae', name: 'Milton of Corsindae', centre: [-2.5301, 57.1725], radius: 380, score: 20, dogRating: 1, character: 'Historic mill locality', summary: 'A small historic mill locality rather than an independently visitable settlement.', rationale: 'Centred on South Milton of Corsindae and its recorded mill. Corsindae House and Midmar remain separately bounded, and heritage does not imply public access.', sourceUrl: 'https://portal.historicenvironment.scot/designation/LB16258', boundarySource: 'Historic Environment Scotland listed mill location with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'bankhead-midmar-scotland', requestedName: 'Bankhead', name: 'Bankhead', centre: [-2.56223, 57.16413], radius: 430, score: 22, dogRating: 1, character: 'Midmar rural locality', summary: 'A small rural locality with historic context but no complete visitor offer.', rationale: 'This is Bankhead in Midmar, retained separately from the existing Aberdeen City district. The former chapel and farm do not create a destination-scale visit.', sourceUrl: 'https://www.getthedata.com/bankhead/where-is-bankhead', boundarySource: 'Ordnance Survey Open Names centre with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'corsindae-scotland', requestedName: 'Corsindae', name: 'Corsindae', centre: [-2.52185, 57.16891], radius: 430, score: 18, dogRating: 1, character: 'Historic estate locality', summary: 'A historic estate locality rather than a public visitor settlement.', rationale: 'Corsindae House and its policies are heritage evidence, not an assumption of visitor access. Milton of Corsindae and Midmar remain distinct.', sourceUrl: 'https://www.trove.scot/place/18002', boundarySource: 'National Record of the Historic Environment site location with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'comers-midmar-scotland', requestedName: 'Comets', name: 'Comers', centre: [-2.5420966, 57.1567465], radius: 340, score: 28, dogRating: 1, character: 'Small Midmar residential locality', summary: 'A small rural residential locality with limited independent visitor depth.', rationale: 'The requested spelling is corrected to Comers. Nearby Tillybirloch, Midmar and Corsindae remain separately bounded.', sourceUrl: 'https://www.openstreetmap.org/relation/15908167', boundarySource: 'OpenStreetMap residential relation with a tight editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'drumlasie-scotland', requestedName: 'Drumlasie', name: 'Drumlasie', centre: [-2.5445, 57.0961], radius: 430, score: 14, dogRating: 1, character: 'Dispersed rural locality', summary: 'A named rural locality rather than a tourist settlement.', rationale: 'The locality is retained for geographic completeness; nearby Deeside routes and estates are not borrowed into its score.', sourceUrl: 'https://publications.aberdeenshire.gov.uk/acblobstorage/3792cdd4-5ffe-46fe-89fe-146f9cdf13a1/central-highways-list.pdf', boundarySource: 'Aberdeenshire Council road-list evidence and gazetteer location with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'tillybirloch-scotland', requestedName: 'Tillybirloch', name: 'Tillybirloch', centre: [-2.531761, 57.15435], radius: 350, score: 28, dogRating: 1, character: 'Small Midmar residential locality', summary: 'A small residential and agricultural locality with limited visitor depth.', rationale: 'Tillybirloch is kept distinct from Comers and Midmar; their facilities, heritage and paths are not automatically transferred.', sourceUrl: 'https://api.postcodes.io/postcodes/AB517PS', boundarySource: 'Office for National Statistics postcode centroid with a tight editorial study buffer', boundaryConfidence: 'low' },
  { id: 'milton-of-campfield-scotland', requestedName: 'Milton of Campfield', name: 'Milton of Campfield', centre: [-2.587472, 57.094192], radius: 580, score: 34, dogRating: 2, character: 'Small Deeside hamlet', summary: 'A small rural settlement with local character but no verified complete visitor offer.', rationale: 'Torphins, Lumphanan and surrounding attractions remain separately assessed; this score reflects the hamlet itself.', sourceUrl: 'https://api.postcodes.io/postcodes/AB314DJ', boundarySource: 'Office for National Statistics postcode centroid with a conservative editorial study buffer', boundaryConfidence: 'low' },
  { id: 'torphins-scotland', requestedName: 'Torphins', name: 'Torphins', centre: [-2.6231389, 57.105248], radius: 1100, score: 58, dogRating: 2, character: 'Substantial Deeside village', summary: 'A sizeable village with clear heritage, service and outdoor potential, held below publication pending a full audit.', rationale: 'Torphins is likely to merit destination publication, but the 60+ gate requires complete attractions, trails, cafés, practical facilities and dated heritage rather than a guessed promotion.', sourceUrl: 'https://www.openstreetmap.org/node/250256262', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer pending a formal full-audit boundary', boundaryConfidence: 'medium' },
  { id: 'mid-beltie-scotland', requestedName: 'Mid Beltie', name: 'Mid Beltie', centre: [-2.6232972, 57.0934493], radius: 520, score: 32, dogRating: 2, character: 'Small rural hamlet', summary: 'A small hamlet with countryside character but limited independent visitor depth.', rationale: 'Torphins and wider Deeside visitor features remain separate from this compact hamlet assessment.', sourceUrl: 'https://www.openstreetmap.org/node/6035312555', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'midmar-scotland', requestedName: 'Midmarae', name: 'Midmar', centre: [-2.5258044, 57.159567], radius: 650, score: 52, dogRating: 2, character: 'Historic rural village', summary: 'A small village with notable historic surroundings but limited verified visitor facilities and depth.', rationale: 'The requested spelling is normalised to Midmar. Its surrounding stone circles and private historic properties belong in See coverage and do not automatically promote the village above 60.', sourceUrl: 'https://www.openstreetmap.org/node/5959637167', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
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

await writeFile(resolve('data/review/torphins-midmar-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  namingDecisions: ['Bankhead resolves to the Midmar locality, not the existing Aberdeen City district.', 'Comets is corrected to Comers.', 'Midmarae is normalised to Midmar.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Torphins–Midmar catalogue places; none publish on the town map before a full 60+ audit.`);
