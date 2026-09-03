import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { ProjectPackage, TouristAppealRating } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-30';
const createdAt = `${reviewedAt}T16:30:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const osm = (type: 'node' | 'way', id: number) => `https://www.openstreetmap.org/${type}/${id}`;

interface Seed {
  id: string; requestedName: string; name: string; centre: [number, number]; radius: number;
  score: number; dogRating: TouristAppealRating; character: string; rationale: string;
  sourceUrl: string; boundaryConfidence?: ProjectPackage['project']['boundaryConfidence'];
}

const seeds: Seed[] = [
  { id: 'friockheim-scotland', requestedName: 'Froickhein', name: 'Friockheim', centre: [-2.6626186,56.6382042], radius: 700, score: 48, dogRating: 2, character: 'Established inland Angus village', rationale: 'The requested spelling is normalised to Friockheim. The village remains below the tourist-map threshold pending a full visitor audit.', sourceUrl: osm('node',540940205) },
  { id: 'boysack-scotland', requestedName: 'Boysack', name: 'Boysack', centre: [-2.615581,56.630681], radius: 500, score: 26, dogRating: 1, character: 'Small Kinnell parish locality', rationale: 'Boysack is retained as a distinct rural locality without inheriting nearby estate or village attractions.', sourceUrl: osm('node',4133659357) },
  { id: 'inverkeilor-scotland', requestedName: 'Inverkeilor', name: 'Inverkeilor', centre: [-2.5476525,56.6345252], radius: 700, score: 48, dogRating: 2, character: 'Historic Angus parish village', rationale: 'Inverkeilor has a coherent village identity but remains below 60 until its independent See, café, trail and visitor-facility offer is fully audited.', sourceUrl: osm('node',472226925) },
  { id: 'ethie-mains-scotland', requestedName: 'Ethie Mains', name: 'Ethie Mains', centre: [-2.4980719,56.6229516], radius: 500, score: 24, dogRating: 1, character: 'Rural Ethie estate locality', rationale: 'Ethie Mains remains a regional reference and does not inherit Ethie Castle or coastal attraction value.', sourceUrl: osm('node',1754377197) },
  { id: 'ethie-castle-scotland', requestedName: 'Ethie Castle', name: 'Ethie Castle', centre: [-2.51088,56.6125127], radius: 500, score: 28, dogRating: 1, character: 'Historic private estate locality', rationale: 'The castle is principally an attraction or heritage property, not evidence of a tourist settlement; any public visitor value belongs under See.', sourceUrl: osm('way',364367300) },
  { id: 'drunkendub-scotland', requestedName: 'Drunkendub', name: 'Drunkendub', centre: [-2.5503468,56.6075319], radius: 450, score: 20, dogRating: 1, character: 'Small rural Angus locality', rationale: 'Drunkendub is retained for regional selection but has no verified independent destination-scale offer.', sourceUrl: osm('node',4134265055) },
  { id: 'auchmithie-scotland', requestedName: 'Auchmithie', name: 'Auchmithie', centre: [-2.523799,56.5890198], radius: 650, score: 56, dogRating: 2, character: 'Historic clifftop fishing village', rationale: 'Auchmithie has strong independent character but remains just below 60 until a full audit checks access, cafés, trails, parking, toilets and picnic provision.', sourceUrl: osm('node',370779193) },
  { id: 'marywell-arbroath-scotland', requestedName: 'Marywell', name: 'Marywell', centre: [-2.5731521,56.5858182], radius: 550, score: 34, dogRating: 1, character: 'Linear village north of Arbroath', rationale: 'This is the Marywell in Arbroath and St Vigeans parish, kept distinct from the existing Birse and Portlethen records.', sourceUrl: 'https://saintsplaces.gla.ac.uk/place.php?id=1322824275' },
  { id: 'hayshead-arbroath-scotland', requestedName: 'Hayshead', name: 'Hayshead', centre: [-2.575129,56.5671728], radius: 450, score: 20, dogRating: 1, character: 'Arbroath residential district', rationale: 'Hayshead remains selectable as a named district but does not independently inherit Arbroath attractions or services.', sourceUrl: osm('node',3987033232) },
  { id: 'cliffburn-arbroath-scotland', requestedName: 'Cliffburn', name: 'Cliffburn', centre: [-2.5670993,56.5647959], radius: 500, score: 22, dogRating: 1, character: 'Arbroath coastal residential district', rationale: 'Cliffburn is retained as a district reference; nearby coast and Arbroath-wide attractions do not create an independent tourist-town score.', sourceUrl: osm('node',4223494311) },
  { id: 'arbroath-scotland', requestedName: 'Arbrouath', name: 'Arbroath', centre: [-2.5815669,56.5586729], radius: 1100, score: 58, dogRating: 2, character: 'Historic Angus harbour town and royal burgh', rationale: 'The requested spelling is normalised to Arbroath. It clearly merits a full audit but remains below 60 until its complete See, café, trails, parking, toilets, picnic and Treasure Trails evidence is checked.', sourceUrl: osm('node',5305193765) },
  { id: 'elliot-arbroath-scotland', requestedName: 'Elliot', name: 'Elliot', centre: [-2.6209075,56.5455494], radius: 600, score: 30, dogRating: 2, character: 'Western Arbroath coastal-edge locality', rationale: 'Elliot remains distinct from Arbroath and does not automatically inherit the beach, golf or wider town offer.', sourceUrl: osm('node',3910706950) },
  { id: 'st-vigeans-scotland', requestedName: 'St Vigeans', name: 'St Vigeans', centre: [-2.5894955,56.5766722], radius: 600, score: 54, dogRating: 2, character: 'Ancient historic village north of Arbroath', rationale: 'St Vigeans has strong church and village character, but remains below 60 pending a full independent visitor audit and separation from Arbroath services.', sourceUrl: osm('node',540940187) },
  { id: 'letham-grange-scotland', requestedName: 'Letham grange', name: 'Letham Grange', centre: [-2.6123885,56.6018506], radius: 650, score: 32, dogRating: 1, character: 'Estate and residential locality', rationale: 'Letham Grange is retained as a locality; estate or golf evidence is assessed separately and does not create a tourist settlement.', sourceUrl: osm('node',4133659301) },
  { id: 'cauldcots-scotland', requestedName: 'Cauldcots', name: 'Cauldcots', centre: [-2.5615904,56.6158569], radius: 500, score: 22, dogRating: 1, character: 'Small Inverkeilor-area rural locality', rationale: 'Cauldcots remains a regional reference without borrowing Inverkeilor or neighbouring estate value.', sourceUrl: osm('node',4133659350) },
  { id: 'leysmill-scotland', requestedName: 'Leysmill', name: 'Leysmill', centre: [-2.6441965,56.6190777], radius: 600, score: 30, dogRating: 1, character: 'Small historic quarrying locality', rationale: 'Leysmill has a distinct mapped identity but no verified complete visitor offer at the settlement level.', sourceUrl: osm('node',1591271116) },
  { id: 'chapeltown-inverkeilor-scotland', requestedName: 'Chapeltown', name: 'Chapeltown', centre: [-2.609901,56.620759], radius: 500, score: 28, dogRating: 1, character: 'Small Inverkeilor parish locality', rationale: 'Chapeltown resolves to the DD11 4RT locality near Inverkeilor. A postcode centroid requires a cautious boundary and no neighbouring attractions are borrowed.', sourceUrl: 'https://api.postcodes.io/postcodes/DD114RT', boundaryConfidence: 'low' },
];

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: 'Angus', locality: seed.name,
      centre: seed.centre, boundary, boundarySource: 'Mapped named-place location with a conservative editorial study buffer', boundaryConfidence: seed.boundaryConfidence ?? 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt, methodology: defaultMethodology,
      researchNotes: 'Catalogue-addition settlement gate. Nearby attractions, estates, coast and neighbouring settlements do not inflate the place score.',
      touristAppeal: { score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating), rating: band.rating, label: band.label, summary: `${seed.name} is retained as an Angus regional reference pending any full destination audit.`, dogAccessRating: seed.dogRating, dogAccessSummary: 'No destination-scale dog visit or dedicated dog facilities are verified.', methodVersion: '2026-08-30-strict-settlement-gate-v1', reviewedAt, sourceUrls: [seed.sourceUrl, osmCopyright, outdoorCode] },
      visitorHighlights: [],
      townGuide: { characterTag: seed.character, headline: 'A recorded place pending any full destination audit', intro: seed.rationale, bestFor: ['Regional reference'], perfectFor: ['Identifying the locality while planning a wider Arbroath and Angus coast route'], dontMiss: [], suggestedTime: 'Pass-through or pre-arranged visit only', visitorMood: 'Kept in the selector with its assessed score, but deliberately absent from the tourist-town map below 60.', sourceUrls: [seed.sourceUrl, osmCopyright], lastReviewedAt: reviewedAt },
      townStudyArea: { localityName: seed.name, sourceName: 'Mapped named-place location', sourceUrl: seed.sourceUrl, sourceVersion: reviewedAt, bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary, notes: 'Reference study area only; not an administrative boundary. Local HES records are selected against this transparent boundary.' },
    },
    features: [], sources: [{ id: `${seed.id}-locality`, name: `${seed.name} place gate`, organisation: 'OpenStreetMap contributors / cited open-data source', coverage: seed.name, accessMethod: 'Mapped place identification and boundary-aware editorial review', sourceUrl: seed.sourceUrl, licence: 'OpenStreetMap ODbL or cited source terms; retain attribution.', reliability: 'secondary', limitations: 'Preliminary catalogue gate; nearby attractions are not transferred into the settlement score.' }], historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

const packages = seeds.map(packageFor);
for (const pkg of packages) await writeFile(resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const planner = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog = JSON.parse(await readFile(dogPath, 'utf8'));
for (const seed of seeds) { planner.projects[seed.id] = {}; dog.projects[seed.id] = {}; }
planner.reviewedAt = reviewedAt; dog.reviewedAt = reviewedAt;
await Promise.all([writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8'), writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8')]);

await writeFile(resolve('data/review/friockheim-chapeltown-locality-additions-2026-08-30.json'), `${JSON.stringify({
  schemaVersion: 1, reviewedAt, threshold: 60,
  rule: 'Every resolved place remains selectable with its canonical score; only independently worthwhile settlements scoring 60 or more appear as town markers.',
  namingDecisions: [
    'Froickhein is normalised to Friockheim and Arbrouath to Arbroath.',
    'Marywell resolves to the Arbroath and St Vigeans settlement and remains distinct from Marywell at Birse and Marywell near Portlethen.',
    'Chapeltown resolves to the DD11 4RT locality near Inverkeilor.',
    'Ethie Castle and Letham Grange estate evidence remains separate from settlement merit.',
  ],
  additions: seeds.map((seed) => ({ requestedName: seed.requestedName, name: seed.name, projectId: seed.id, region: 'Angus', score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), publishOnTownMap: seed.score >= 60, rationale: seed.rationale, sourceUrl: seed.sourceUrl })),
}, null, 2)}\n`, 'utf8');

console.log(`Added ${packages.length} Friockheim-Chapeltown catalogue places; none publishes on the town map pending full audits.`);
