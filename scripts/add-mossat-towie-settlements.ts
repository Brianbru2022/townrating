import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-28';
const createdAt = `${reviewedAt}T23:59:00.000Z`;
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
  { id: 'mossat-scotland', requestedName: 'Mossat', name: 'Mossat', centre: [-2.870926, 57.262059], radius: 520, score: 36, dogRating: 2, character: 'Small rural crossroads locality', summary: 'A recognisable rural locality with limited independent visitor depth.', rationale: 'Mossat remains distinct from Bridge of Alford and nearby private or commercial properties; those do not inflate its settlement score.', sourceUrl: 'https://api.postcodes.io/postcodes/AB338PL', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'rinmore-glenkindie-scotland', requestedName: 'Rinmore', name: 'Rinmore', centre: [-2.954642, 57.237502], radius: 420, score: 14, dogRating: 2, character: 'Upper Glen Kindie rural locality', summary: 'A dispersed rural locality rather than an independently visitable settlement.', rationale: 'The landscape and Kindie Burn route are wider-area context; no complete settlement visit or public facilities are assumed.', sourceUrl: 'https://api.postcodes.io/postcodes/AB338TD', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'kildrummy-scotland', requestedName: 'Kildrummy', name: 'Kildrummy', centre: [-2.8881534, 57.245055], radius: 650, score: 48, dogRating: 2, character: 'Small historic rural settlement', summary: 'A modest historic settlement whose independent visitor offer remains limited.', rationale: 'Kildrummy Castle is a separate See attraction and is deliberately excluded from the settlement rating; a later full audit may reassess the village itself.', sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB51882', boundarySource: 'Aberdeenshire HER and Ordnance Survey settlement location with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'sinnahard-scotland', requestedName: 'Sinnahard', name: 'Sinnahard', centre: [-2.876212, 57.208913], radius: 400, score: 16, dogRating: 1, character: 'Dispersed farm locality', summary: 'A named rural locality rather than a visitor settlement.', rationale: 'Heritage records and countryside setting are retained as local context without implying public access or a complete visit.', sourceUrl: 'https://api.postcodes.io/postcodes/AB338SH', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'milltown-of-towie-scotland', requestedName: 'Milton of Towie', name: 'Milltown of Towie', centre: [-2.898042, 57.199803], radius: 430, score: 18, dogRating: 1, character: 'Small farm locality', summary: 'A named rural locality rather than an independently visitable settlement.', rationale: 'The requested Milton form is normalised to the gazetteered Milltown of Towie. Towie village and parish-wide heritage remain separately bounded.', sourceUrl: 'https://api.postcodes.io/postcodes/AB338SJ', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'towie-scotland', requestedName: 'Towie', name: 'Towie', centre: [-2.9289597, 57.2034722], radius: 650, score: 42, dogRating: 2, character: 'Small upper Donside hamlet', summary: 'A recognisable hamlet with local character but limited verified visitor depth.', rationale: 'The settlement receives its own preliminary score; dispersed Towie parish heritage and neighbouring Glenkindie are not borrowed into it.', sourceUrl: 'https://www.openstreetmap.org/node/5923943784', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'glenkindie-scotland', requestedName: 'Glenkindie', name: 'Glenkindie', centre: [-2.9330236, 57.2116854], radius: 700, score: 40, dogRating: 2, character: 'Small Donside village', summary: 'A small rural village with landscape character but a limited independent visitor offer.', rationale: 'Glenkindie is assessed as a settlement in its own right; estate, riverside and wider parish attractions do not automatically raise the score.', sourceUrl: 'https://www.openstreetmap.org/node/5923923306', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'boultenstone-scotland', requestedName: 'Boultenstone', name: 'Boultenstone', centre: [-2.9693419, 57.1815707], radius: 380, score: 14, dogRating: 1, character: 'Bridge and rural locality', summary: 'A named bridge locality rather than a tourist settlement.', rationale: 'Boultenstone Bridge provides geographic identity but is not treated as a complete visitor destination or as evidence for a town rating above the publication threshold.', sourceUrl: 'https://aberdeenshire.moderngov.co.uk/documents/s32124/Appendix%20G%20Bridges%20Prioritised%20List.pdf', boundarySource: 'Official Aberdeenshire bridge record and Ordnance Survey grid location with a conservative editorial study buffer', boundaryConfidence: 'medium' },
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
        methodVersion: '2026-08-28-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
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

await writeFile(resolve('data/review/mossat-towie-settlement-additions-2026-08-28.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  namingDecisions: ['Milton of Towie is normalised to the gazetteered Milltown of Towie.', 'Kildrummy Castle remains a separate See attraction and is not counted towards the Kildrummy settlement score.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Mossat–Towie catalogue places; none publish on the town map before a full 60+ audit.`);
