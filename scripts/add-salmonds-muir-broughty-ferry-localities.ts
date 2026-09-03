import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T23:59:55.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const angusPlan = 'https://www.angus.gov.uk/sites/default/files/Angus%20local%20development%20plan%20adopted%20September%202016.pdf';
const osm = (type: 'node' | 'way' | 'relation', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string;
  requestedName: string;
  name: string;
  region: 'Angus' | 'Dundee City';
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  rationale: string;
  sourceUrl: string;
  boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'salmonds-muir-scotland', requestedName: 'Salmonds Muir', name: "Salmond's Muir", region: 'Angus', centre: [-2.6832185, 56.5314645], radius: 500, score: 28, dogRating: 1, character: 'Small A92-edge Angus hamlet', rationale: "The apostrophe is restored in Salmond's Muir. It remains below 60 until its independent visitor offer is fully audited.", sourceUrl: osm('node', 5286742364) },
  { id: 'craigton-of-monikie-scotland', requestedName: 'Craigton', name: 'Craigton of Monikie', region: 'Angus', centre: [-2.7960265, 56.5333705], radius: 650, score: 44, dogRating: 2, character: 'Established Monikie parish village', rationale: 'Craigton resolves to Craigton of Monikie, not the separate Cortachy locality. Monikie Country Park is not transferred into its preliminary settlement score.', sourceUrl: osm('node', 5000008607) },
  { id: 'muirdrum-scotland', requestedName: 'Muirdrum', name: 'Muirdrum', region: 'Angus', centre: [-2.7128935, 56.5253709], radius: 650, score: 42, dogRating: 1, character: 'Compact east-Angus village', rationale: 'Muirdrum is retained as a distinct village without borrowing Carnoustie or Panbride visitor value.', sourceUrl: osm('node', 5000008610) },
  { id: 'east-haven-scotland', requestedName: 'East haven', name: 'East Haven', region: 'Angus', centre: [-2.6676628, 56.5164248], radius: 650, score: 58, dogRating: 2, character: 'Historic Angus coastal village', rationale: 'East Haven has clear coastal character but remains selector-only until its beach, heritage, trails, practical facilities and independent settlement merit are fully verified.', sourceUrl: osm('node', 242940462) },
  { id: 'panbride-scotland', requestedName: 'Panbride', name: 'Panbride', region: 'Angus', centre: [-2.697874, 56.5122245], radius: 650, score: 48, dogRating: 2, character: 'Historic parish village east of Carnoustie', rationale: 'Panbride has a coherent historic identity, but nearby Carnoustie facilities and coast are not inherited.', sourceUrl: osm('node', 242940523) },
  { id: 'carnoustie-scotland', requestedName: 'Carnoustire', name: 'Carnoustie', region: 'Angus', centre: [-2.711403, 56.5010506], radius: 1300, score: 58, dogRating: 2, character: 'Angus coast town and golfing centre', rationale: 'The requested spelling is normalised to Carnoustie. Its final score is deliberately withheld below the map threshold until a full audit verifies the complete town offer.', sourceUrl: osm('node', 21511355) },
  { id: 'newbigging-monifieth-scotland', requestedName: 'Newbigging', name: 'Newbigging', region: 'Angus', centre: [-2.8172128, 56.5151816], radius: 700, score: 46, dogRating: 2, character: 'Established Monikie parish village', rationale: 'This resolves to Newbigging by Monifieth, not another Scottish Newbigging. Neighbouring country-park value is excluded.', sourceUrl: osm('node', 241788892) },
  { id: 'barry-angus-scotland', requestedName: 'Barry', name: 'Barry', region: 'Angus', centre: [-2.7561228, 56.4991314], radius: 750, score: 46, dogRating: 2, character: 'Historic village west of Carnoustie', rationale: 'Barry remains distinct from Carnoustie and Barry Buddon; golf, beach and military-land value is not borrowed.', sourceUrl: osm('node', 3987033229) },
  { id: 'mains-of-ardestie-scotland', requestedName: 'Mains of Ardestie', name: 'Mains of Ardestie', region: 'Angus', centre: [-2.8052127, 56.4975402], radius: 550, score: 30, dogRating: 1, character: 'Small historic farm locality', rationale: 'The locality is kept separate from Ardestie Earth House and wider Monifieth attractions, which must be assessed under See rather than settlement merit.', sourceUrl: osm('node', 5715789432) },
  { id: 'monifieth-scotland', requestedName: 'Monifieth', name: 'Monifieth', region: 'Angus', centre: [-2.8180074, 56.481796], radius: 1200, score: 58, dogRating: 2, character: 'Established coastal town east of Dundee', rationale: 'Monifieth clearly warrants a full audit, but its final score is withheld below 60 until the town offer and Dundee boundary interactions are verified.', sourceUrl: osm('node', 21511420) },
  { id: 'wellbank-scotland', requestedName: 'Wellbank', name: 'Wellbank', region: 'Angus', centre: [-2.8614674, 56.5210095], radius: 750, score: 46, dogRating: 2, character: 'Established rural Angus village', rationale: 'Wellbank remains a distinct village and does not inherit Monikie Country Park or Dundee attractions.', sourceUrl: osm('node', 1297029357) },
  { id: 'drumsturdy-scotland', requestedName: 'Drumsturdy', name: 'Drumsturdy', region: 'Angus', centre: [-2.84818, 56.50384], radius: 600, score: 28, dogRating: 1, character: 'Historic roadside Angus locality', rationale: 'Drumsturdy is retained from gazetteer evidence with a cautious boundary; nearby Kellas, Kingennie and Monifieth merit is excluded.', sourceUrl: 'https://www.geonames.org/12261947/drumsturdy.html', boundaryConfidence: 'medium' },
  { id: 'kellas-angus-scotland', requestedName: 'Kellas', name: 'Kellas', region: 'Angus', centre: [-2.8838316, 56.5091163], radius: 650, score: 42, dogRating: 2, character: 'Established village north of Dundee', rationale: 'Kellas is assessed separately from Wellbank, Baldovie and Dundee suburban services.', sourceUrl: osm('node', 1297029358) },
  { id: 'baldovie-dundee-scotland', requestedName: 'Baldovie', name: 'Baldovie', region: 'Dundee City', centre: [-2.8925021, 56.4885625], radius: 550, score: 26, dogRating: 1, character: 'Historic Dundee-edge locality', rationale: 'This resolves to Baldovie on Kellas Road, not the separate Kirriemuir-area hamlet. Industrial and neighbouring Dundee facilities do not inflate the place score.', sourceUrl: osm('node', 11592371127) },
  { id: 'barnhill-dundee-scotland', requestedName: 'Barnhill', name: 'Barnhill', region: 'Dundee City', centre: [-2.8579403, 56.4772274], radius: 750, score: 34, dogRating: 2, character: 'Broughty Ferry residential quarter', rationale: 'Barnhill remains selectable as its own quarter but does not inherit Broughty Ferry Castle, beach or town-centre provision.', sourceUrl: osm('node', 1404342183) },
  { id: 'west-ferry-dundee-scotland', requestedName: 'West Ferry', name: 'West Ferry', region: 'Dundee City', centre: [-2.8972425, 56.4705856], radius: 700, score: 42, dogRating: 2, character: 'Historic western Broughty Ferry quarter', rationale: 'West Ferry has a distinct place identity but Broughty Ferry and Dundee-wide attractions are not transferred into its score.', sourceUrl: osm('node', 881888701) },
  { id: 'broughty-ferry-scotland', requestedName: 'Broughty Ferry', name: 'Broughty Ferry', region: 'Dundee City', centre: [-2.8731991, 56.4669251], radius: 1300, score: 58, dogRating: 2, character: 'Historic Tay-side town and Dundee district', rationale: 'Broughty Ferry clearly warrants a full audit, but its final map score is withheld until the complete independent visitor offer is verified.', sourceUrl: osm('relation', 18707937) },
  { id: 'bucklerheads-scotland', requestedName: 'Bucklerhead', name: 'Bucklerheads', region: 'Angus', centre: [-2.8772634, 56.5148507], radius: 650, score: 38, dogRating: 1, character: 'Small Angus village north of Monifieth', rationale: 'The requested singular form resolves to the mapped and council form Bucklerheads. Nearby Kellas and Wellbank value is excluded.', sourceUrl: osm('node', 5000008602) },
  { id: 'east-march-angus-scotland', requestedName: 'East march', name: 'East March', region: 'Angus', centre: [-2.9057705, 56.51933], radius: 500, score: 22, dogRating: 1, character: 'Small Angus rural locality', rationale: 'East March is retained from council mapping with a cautious building-centred reference boundary and no inherited Dundee or Wellbank attractions.', sourceUrl: angusPlan, boundaryConfidence: 'medium' },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id,
      name: seed.name,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: seed.region,
      locality: seed.name,
      centre: seed.centre,
      boundary,
      boundarySource: 'Mapped named-place location with a conservative editorial study buffer',
      boundaryConfidence: seed.boundaryConfidence ?? 'high',
      sourceLanguage: 'English',
      preferredBasemap: 'voyager',
      createdAt,
      methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate only. A full sequential audit must import local HES/NRHE records, verify material dates, visitor categories and practical facilities before this project can publish as a town marker.',
      touristAppeal: {
        score: seed.score,
        dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
        dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating,
        label: band.label,
        summary: `${seed.name} is retained as a regional reference pending its full sequential destination audit.`,
        dogAccessRating: seed.dogRating,
        dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are yet verified.',
        methodVersion: '2026-08-30-strict-settlement-gate-v1',
        reviewedAt,
        sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character,
        headline: 'A recorded place awaiting its full audit',
        intro: seed.rationale,
        bestFor: ['Regional reference'],
        perfectFor: ['Identifying the locality while planning the Angus coast and Dundee approaches'],
        dontMiss: [],
        suggestedTime: 'Pass-through or pre-arranged visit only until audited',
        visitorMood: 'Available in the regional selector with a conservative gate score, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: [seed.sourceUrl, osmCopyright],
        lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name,
        sourceName: 'Mapped named-place location',
        sourceUrl: seed.sourceUrl,
        sourceVersion: reviewedAt,
        bufferMetres: seed.radius,
        localityBoundary: boundary,
        bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary. The full audit must reconcile every local HES/NRHE record and keep materially undated heritage map-hidden.',
      },
    },
    features: [],
    sources: [{
      id: `${seed.id}-locality`,
      name: `${seed.name} place gate`,
      organisation: seed.sourceUrl.includes('angus.gov.uk') ? 'Angus Council' : seed.sourceUrl.includes('geonames.org') ? 'GeoNames' : 'OpenStreetMap contributors',
      coverage: seed.name,
      accessMethod: 'Mapped place identification and boundary-aware editorial review',
      sourceUrl: seed.sourceUrl,
      licence: seed.sourceUrl.includes('openstreetmap.org') ? 'OpenStreetMap ODbL; retain attribution.' : 'Cited source terms; retain attribution.',
      reliability: seed.sourceUrl.includes('angus.gov.uk') ? 'official_non_statutory' : 'secondary',
      limitations: 'Preliminary catalogue gate; no nearby attraction or facility is transferred into the settlement score.',
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

const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
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

await writeFile(resolve('data/review/salmonds-muir-broughty-ferry-locality-additions-2026-08-30.json'), `${JSON.stringify({
  schemaVersion: 1,
  reviewedAt,
  threshold: 60,
  rule: 'Every resolved place remains selectable with its gate score; only independently worthwhile settlements scoring 60 or more after a completed full audit appear as town markers.',
  existingRecordsReused: [
    { requestedName: 'Eliot', resolvedName: 'Elliot', projectId: 'elliot-arbroath-scotland', auditStatus: 'full audit already verified' },
    { requestedName: 'Balmirmir', resolvedName: 'Balmirmer', projectId: 'balmirmer-scotland' },
    { requestedName: 'Kirkton of Monikie', resolvedName: 'Kirkton of Monikie', projectId: 'kirkton-of-monikie-scotland' },
    { requestedName: 'Monikie', resolvedName: 'Monikie', projectId: 'monikie-scotland' },
  ],
  namingDecisions: [
    'Eliot resolves to the existing Elliot record; Balmirmir resolves to Balmirmer; Carnoustire resolves to Carnoustie.',
    'Craigton resolves to Craigton of Monikie, not Craigton near Cortachy or Craigton near Peterculter.',
    'Kellasm Baldovie is interpreted as two requested places: Kellas and Baldovie.',
    'Baldovie resolves to the Dundee-edge locality on Kellas Road, not the separate Kirriemuir-area hamlet.',
    'Bucklerhead resolves to the mapped and Angus Council form Bucklerheads.',
  ],
  additions: seeds.map((seed) => ({
    requestedName: seed.requestedName,
    resolvedName: seed.name,
    projectId: seed.id,
    region: seed.region,
    gateScore: seed.score,
    dogOwnerGateScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
    publishOnTownMap: false,
    rationale: seed.rationale,
    sourceUrl: seed.sourceUrl,
  })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} new catalogue places; all remain selector-only until their sequential full audits are complete.`);
