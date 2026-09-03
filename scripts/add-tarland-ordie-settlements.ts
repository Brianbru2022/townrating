import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T00:30:00.000Z`;
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
  { id: 'migvie-scotland', requestedName: 'Milgvie', name: 'Migvie', centre: [-2.9314945, 57.147753], radius: 600, score: 38, dogRating: 2, character: 'Small historic Cromar hamlet', summary: 'A small rural hamlet with local historic character but limited verified visitor depth.', rationale: 'The spelling is normalised to Migvie. Parish heritage and the wider Cromar landscape are not treated as a complete settlement visit.', sourceUrl: 'https://www.openstreetmap.org/node/12060249506', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'easter-davoch-scotland', requestedName: 'Easter Davoch', name: 'Easter Davoch', centre: [-2.8834039, 57.1536721], radius: 420, score: 16, dogRating: 1, character: 'Dispersed farm locality', summary: 'A named rural locality rather than an independently visitable settlement.', rationale: 'The farm and steading establish the locality, but private businesses and open-day activity do not create a general tourist destination.', sourceUrl: 'https://www.openstreetmap.org/node/12187097914', boundarySource: 'OpenStreetMap locality node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'douneside-scotland', requestedName: 'Douneside', name: 'Douneside', centre: [-2.8583993, 57.1416479], radius: 460, score: 18, dogRating: 1, character: 'Country-house locality', summary: 'A country-house and estate locality rather than a settlement destination.', rationale: 'Douneside House, its hotel and gardens belong in attraction or Eat coverage when independently audited; they do not support a town rating.', sourceUrl: 'https://www.openstreetmap.org/way/691519456', boundarySource: 'OpenStreetMap Douneside House footprint with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'tarland-scotland', requestedName: 'Tarland', name: 'Tarland', centre: [-2.8588658, 57.1274514], radius: 1000, score: 58, dogRating: 2, character: 'Historic Cromar village', summary: 'A substantial village with clear heritage, community and outdoor potential, held below publication pending a full audit.', rationale: 'Tarland is likely to merit destination publication, but the 60+ gate requires a complete attraction, trail, café, practical-facility and dated-heritage audit rather than a guessed promotion.', sourceUrl: 'https://www.openstreetmap.org/node/4966528174', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer pending a formal full-audit boundary', boundaryConfidence: 'medium' },
  { id: 'coynach-scotland', requestedName: 'Coynach', name: 'Coynach', centre: [-2.9272449, 57.1388203], radius: 430, score: 14, dogRating: 1, character: 'Farm and house locality', summary: 'A named rural property locality rather than a visitor settlement.', rationale: 'Coynach and Mains of Coynach provide geographic identity only; no public access or independent visitor offer is assumed.', sourceUrl: 'https://www.openstreetmap.org/way/1198102028', boundarySource: 'OpenStreetMap house and nearby farm locality with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'logie-coldstone-scotland', requestedName: 'Logie Coldstone', name: 'Logie Coldstone', centre: [-2.9347817, 57.1268995], radius: 750, score: 46, dogRating: 2, character: 'Small Cromar village', summary: 'A recognisable rural village with local heritage and landscape character but limited verified visitor depth.', rationale: 'The village is assessed independently; surrounding estates, hill routes and scattered parish heritage are not borrowed into its score.', sourceUrl: 'https://www.openstreetmap.org/node/2433705844', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'milton-of-logie-scotland', requestedName: 'Milton of Logie', name: 'Milton of Logie', centre: [-2.9143006, 57.1061422], radius: 600, score: 34, dogRating: 2, character: 'Small rural hamlet', summary: 'A small hamlet with countryside character but no verified complete visitor offer.', rationale: 'Milton of Logie remains separate from Logie Coldstone, Ordie and nearby properties, whose features are not transferred into this score.', sourceUrl: 'https://www.openstreetmap.org/node/5333589208', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'glendavan-house-scotland', requestedName: 'Glendavan Ho', name: 'Glendavan House', centre: [-2.9273598, 57.0989925], radius: 360, score: 12, dogRating: 1, character: 'Private house locality', summary: 'A named house rather than a visitor settlement.', rationale: 'The abbreviated request is expanded to Glendavan House. Accommodation history or nearby scenery does not create a town-level destination.', sourceUrl: 'https://www.openstreetmap.org/way/1171794717', boundarySource: 'OpenStreetMap house footprint with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'ordie-scotland', requestedName: 'Ordie', name: 'Ordie', centre: [-2.9056, 57.101665], radius: 620, score: 36, dogRating: 2, character: 'Small rural hamlet', summary: 'A small hamlet with local landscape character but limited independent visitor depth.', rationale: 'Resolved to Ordie near Dinnet and Milton of Logie, not the separate Ordie locality near Finzean. Nearby houses and attractions remain separately assessed.', sourceUrl: 'https://www.openstreetmap.org/node/1025198326', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
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

await writeFile(resolve('data/review/tarland-ordie-settlement-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  namingDecisions: ['Milgvie is normalised to Migvie.', 'Glendavan Ho is expanded to Glendavan House.', 'Ordie resolves to the hamlet near Dinnet and Milton of Logie, not the separate Finzean locality.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Tarland–Ordie catalogue places; none publish on the town map before a full 60+ audit.`);
