import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-29';
const createdAt = `${reviewedAt}T01:15:00.000Z`;
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
  { id: 'kintocher-scotland', requestedName: 'Kintocher', name: 'Kintocher', centre: [-2.70655, 57.17155], radius: 520, score: 18, dogRating: 1, character: 'Dispersed farm locality', summary: 'A named rural locality rather than an independently visitable settlement.', rationale: 'The study point covers Mill of Kintocher and East Kintocher. Nearby Craigievar and wider Howe of Alford attractions do not raise its settlement score.', sourceUrl: 'https://www.openstreetmap.org/way/697418320', boundarySource: 'OpenStreetMap Kintocher farm features with a conservative editorial study buffer', boundaryConfidence: 'low' },
  { id: 'findrack-house-scotland', requestedName: 'Findrack Ho', name: 'Findrack House', centre: [-2.64761, 57.13339], radius: 420, score: 12, dogRating: 1, character: 'Historic house locality', summary: 'A historic-house site rather than a visitor settlement.', rationale: 'The abbreviated request is expanded to Findrack House. The house, walled garden and dovecot are heritage records, not evidence of a town destination or general public access.', sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB15163/', boundarySource: 'Aberdeenshire Historic Environment Record site location with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'lumphanan-scotland', requestedName: 'Lumphanan', name: 'Lumphanan', centre: [-2.688454, 57.1289789], radius: 1050, score: 56, dogRating: 2, character: 'Historic Deeside village', summary: 'A substantial village with clear heritage and walking potential, held below publication pending a full visitor audit.', rationale: 'Lumphanan may merit destination publication, but Peel of Lumphanan and dispersed parish heritage cannot substitute for a complete attraction, trail, café and practical-facility audit.', sourceUrl: 'https://www.openstreetmap.org/node/250256257', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer pending a formal full-audit boundary', boundaryConfidence: 'medium' },
  { id: 'craskins-scotland', requestedName: 'Craskins', name: 'Craskins', centre: [-2.810076, 57.1431383], radius: 430, score: 14, dogRating: 1, character: 'Farm locality', summary: 'A named farm locality rather than a tourist settlement.', rationale: 'The farm establishes geographic identity only; surrounding Cromar landscape and estates are not borrowed into its score.', sourceUrl: 'https://www.openstreetmap.org/relation/18570431', boundarySource: 'OpenStreetMap farmyard relation with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'milton-of-auchinhove-scotland', requestedName: 'Milton of Auchinlobe', name: 'Milton of Auchinhove', centre: [-2.73671, 57.12115], radius: 520, score: 20, dogRating: 1, character: 'Historic rural locality', summary: 'A small historic property locality rather than an independently visitable settlement.', rationale: 'The requested name is corrected to Milton of Auchinhove using the official local heritage record. Historic buildings remain heritage evidence and do not imply public access.', sourceUrl: 'https://her.aberdeenshire.gov.uk/Monument/MAB12112', boundarySource: 'Aberdeenshire Historic Environment Record site location with a conservative editorial study buffer', boundaryConfidence: 'high' },
  { id: 'auchlossan-scotland', requestedName: 'Auchlossan', name: 'Auchlossan', centre: [-2.706248, 57.113486], radius: 540, score: 18, dogRating: 1, character: 'Dispersed rural locality', summary: 'A named rural house and steading locality rather than a visitor settlement.', rationale: 'Auchlossan House and steading provide historic context only; the former loch, railway history and nearby Lumphanan attractions are not transferred into the score.', sourceUrl: 'https://api.postcodes.io/postcodes/AB314SR', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
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

await writeFile(resolve('data/review/lumphanan-locality-additions-2026-08-29.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  existingEntries: [{ requestedName: 'Leochnel Cushnie', resolvedName: 'Leochel-Cushnie', projectId: 'leochel-cushnie-scotland', score: 38, action: 'Retained existing entry; no duplicate created.' }],
  namingDecisions: ['Leochnel Cushnie resolves to the existing Leochel-Cushnie entry.', 'Findrack Ho is expanded to Findrack House.', 'Milton of Auchinlobe is corrected to Milton of Auchinhove.'],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Retained Leochel-Cushnie and added ${packages.length} Lumphanan-area catalogue places; none publish on the town map before a full 60+ audit.`);
