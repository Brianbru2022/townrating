import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-28';
const createdAt = `${reviewedAt}T23:58:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');

interface Seed {
  id: string; requestedName: string; name: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; summary: string; rationale: string;
  sourceUrl: string; boundarySource: string; boundaryConfidence: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'tullynessle-scotland', requestedName: 'Jullynessie', name: 'Tullynessle', centre: [-2.7320239, 57.2645883], radius: 650, score: 44, dogRating: 2, character: 'Small historic Donside hamlet', summary: 'A quiet rural hamlet with local historic character but limited verified visitor depth.', rationale: 'The requested spelling is normalised to Tullynessle. Montgarrie, Alford and wider Donside attractions remain separate.', sourceUrl: 'https://www.openstreetmap.org/node/1279071637', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'montgarrie-scotland', requestedName: 'Montgairnie', name: 'Montgarrie', centre: [-2.7058046, 57.2489618], radius: 650, score: 42, dogRating: 2, character: 'Small riverside village', summary: 'A recognisable village beside the River Don, but with a limited independent visitor offer.', rationale: 'The requested spelling is normalised to Montgarrie. Alford’s museums, cafés and facilities are not transferred into this score.', sourceUrl: 'https://www.openstreetmap.org/node/1280071519', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'bridge-of-alford-scotland', requestedName: 'Bridge of Alford', name: 'Bridge of Alford', centre: [-2.726905, 57.2441707], radius: 600, score: 38, dogRating: 2, character: 'Small Donside village', summary: 'A small river-crossing village without a complete independently verified visitor offer.', rationale: 'The bridge and riverside setting provide local character, while neighbouring Alford and Montgarrie remain distinct destinations.', sourceUrl: 'https://www.openstreetmap.org/node/1280071654', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'auchintoul-alford-scotland', requestedName: 'Auchintoul', name: 'Auchintoul', centre: [-2.7497192, 57.2338525], radius: 380, score: 14, dogRating: 1, character: 'Rural property locality', summary: 'A named rural property rather than a visitor settlement.', rationale: 'Resolved to the Auchintoul at Muir of Alford in the requested cluster, not other Aberdeenshire namesakes.', sourceUrl: 'https://www.openstreetmap.org/way/492555716', boundarySource: 'OpenStreetMap property footprint with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'alford-aberdeenshire-scotland', requestedName: 'Alford', name: 'Alford', centre: [-2.7016251, 57.2318472], radius: 1350, score: 58, dogRating: 2, character: 'Howe of Alford service town', summary: 'A substantial rural centre with clear museum, park and heritage potential, held below publication until a full visitor audit verifies the complete offer.', rationale: 'Alford is likely to merit destination publication, but the 60+ gate requires a full attraction, trail, café, practical-facility and dated-heritage audit rather than a guessed score.', sourceUrl: 'https://www.openstreetmap.org/node/241795518', boundarySource: 'OpenStreetMap town node with a conservative editorial study buffer pending a formal full-audit boundary', boundaryConfidence: 'medium' },
  { id: 'asloun-scotland', requestedName: 'Asloun', name: 'Asloun', centre: [-2.7606871, 57.2219145], radius: 470, score: 28, dogRating: 1, character: 'Castle-country rural locality', summary: 'A small rural locality with historic context but no verified complete visitor experience.', rationale: 'Centred on Castleton of Asloun. Asloun Castle is heritage context and is not assumed to be an accessible town attraction.', sourceUrl: 'https://www.openstreetmap.org/way/638228340', boundarySource: 'OpenStreetMap Castleton of Asloun footprint with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'hillockhead-glenkindie-scotland', requestedName: 'Hillockhead', name: 'Hillockhead', centre: [-2.829811, 57.202293], radius: 380, score: 14, dogRating: 1, character: 'Rural property locality', summary: 'A named Glenkindie property rather than an independently visitable settlement.', rationale: 'Resolved to Hillockhead, Glenkindie, AB33 8SE. The postcode centroid requires a cautious boundary and no neighbouring attractions are borrowed.', sourceUrl: 'https://api.postcodes.io/postcodes/AB338SE', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'ley-glenkindie-scotland', requestedName: 'Ley', name: 'Ley', centre: [-2.881689, 57.218514], radius: 380, score: 14, dogRating: 1, character: 'Rural property locality', summary: 'A named Glenkindie property rather than a visitor settlement.', rationale: 'Resolved to Ley, Glenkindie, AB33 8RS, following the west-to-east sequence supplied; it is not Ley of Cushnie. The postcode centroid is intentionally treated with low confidence.', sourceUrl: 'https://api.postcodes.io/postcodes/AB338RS', boundarySource: 'Office for National Statistics postcode centroid supplied through Postcodes.io with an editorial study buffer', boundaryConfidence: 'low' },
  { id: 'little-lynturk-scotland', requestedName: 'Little Lynturk', name: 'Little Lynturk', centre: [-2.6998039, 57.2026462], radius: 340, score: 12, dogRating: 1, character: 'Isolated rural dwelling', summary: 'An isolated dwelling locality rather than a visitor settlement.', rationale: 'Its catalogue entry supports geographic completeness only; nearby Muir of Fowlis and Alford remain separate.', sourceUrl: 'https://www.openstreetmap.org/node/582465923', boundarySource: 'OpenStreetMap isolated-dwelling node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'bridgend-muir-of-fowlis-scotland', requestedName: 'Bridgend', name: 'Bridgend', centre: [-2.7018097, 57.1901011], radius: 390, score: 14, dogRating: 1, character: 'Farm locality', summary: 'A named farm locality rather than a tourist settlement.', rationale: 'Resolved to the Bridgend farmyard at Muir of Fowlis, AB33 8JB, not other Aberdeenshire places named Bridgend.', sourceUrl: 'https://www.openstreetmap.org/way/561522178', boundarySource: 'OpenStreetMap farmyard footprint with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'tillyfour-tough-scotland', requestedName: 'Tillyfour', name: 'Tillyfour', centre: [-2.6743463, 57.1836013], radius: 470, score: 24, dogRating: 1, character: 'Historic cattle-breeding estate locality', summary: 'A rural farm-estate locality with agricultural history but no verified public destination offer.', rationale: 'Resolved to Tillyfour, Tough, using the official planning coordinate. Aberdeen Angus history is retained as context and does not imply public access.', sourceUrl: 'https://planning.org.uk/app/168/SB2B2ICAMJD00', boundarySource: 'Official planning-site easting and northing converted from British National Grid to WGS84 with an editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'muir-of-fowlis-scotland', requestedName: 'Muir of Fowlis', name: 'Muir of Fowlis', centre: [-2.7259179, 57.1980549], radius: 650, score: 42, dogRating: 2, character: 'Small Howe of Alford village', summary: 'A recognisable rural village with local character but limited verified visitor depth.', rationale: 'The village retains its own score; Craigievar, Alford and dispersed Cushnie heritage are not borrowed into it.', sourceUrl: 'https://www.openstreetmap.org/node/582465929', boundarySource: 'OpenStreetMap village node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'leochel-cushnie-scotland', requestedName: 'Leochel Cushnie', name: 'Leochel-Cushnie', centre: [-2.7941632, 57.1843233], radius: 600, score: 38, dogRating: 2, character: 'Small upland hamlet', summary: 'A small rural hamlet with parish character but limited visitor facilities and depth.', rationale: 'The official hyphenated form is used. Parish-wide heritage is not treated as if it all belonged to the compact hamlet.', sourceUrl: 'https://www.openstreetmap.org/node/6420971193', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
  { id: 'milton-of-cushnie-scotland', requestedName: 'Milton fo Cushnie', name: 'Milton of Cushnie', centre: [-2.7961549, 57.1897625], radius: 520, score: 30, dogRating: 2, character: 'Small upland hamlet', summary: 'A small rural hamlet with local landscape character but no complete visitor offer.', rationale: 'The typing error is corrected to Milton of Cushnie. Leochel-Cushnie and wider Cushnie heritage remain separately bounded.', sourceUrl: 'https://www.openstreetmap.org/node/2424623326', boundarySource: 'OpenStreetMap hamlet node with a conservative editorial study buffer', boundaryConfidence: 'medium' },
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

await writeFile(resolve('data/review/alford-cushnie-settlement-additions-2026-08-28.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers. Attractions never inflate settlement scores.',
  namingDecisions: [
    'Jullynessie is normalised to Tullynessle.', 'Montgairnie is normalised to Montgarrie.',
    'Milton fo Cushnie is corrected to Milton of Cushnie.', 'Leochel Cushnie is normalised to Leochel-Cushnie.',
    'Ley resolves to Ley at Glenkindie, AB33 8RS, not Ley of Cushnie.',
    'Bridgend resolves to the farm locality at Muir of Fowlis, AB33 8JB.',
    'Auchintoul resolves to the Muir of Alford property in this cluster.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, resolvedName: seed.name, projectId: seed.id, score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl, boundaryConfidence: seed.boundaryConfidence })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Alford–Cushnie catalogue places; none publish on the town map before a full 60+ audit.`);
