import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type {
  DataSourceDefinition,
  EditorialRecordReview,
  HeritageFeature,
  ProjectPackage,
  Reliability,
  SourceRecord,
  TouristAppealRating,
  VisitorHighlight,
} from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-09-02';
const reviewedAt = '2026-09-02T16:30:00.000Z';
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const treasureTrails = 'https://www.treasuretrails.co.uk/';
const curiousAbout = 'https://curiousabout.co.uk/';
const mysteryGuides = 'https://www.mysteryguides.co.uk/pages/scotland';
const goQuest = 'https://goquestadventures.com/';
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');

interface Seed {
  stem: string;
  id: string;
  name: string;
  region: 'Angus' | 'Dundee City' | 'Perth and Kinross' | 'Fife';
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  summary: string;
  identityUrl: string;
  boundarySource?: string;
}

const seeds: Seed[] = [
  { stem: 'coldstream-tealing', id: 'coldstream-tealing-scotland', name: 'Coldstream', region: 'Angus', centre: [-2.9927322, 56.5445114], radius: 500, score: 10, dogRating: 1, character: 'Isolated Tealing-area farm locality', summary: 'Coldstream is a named rural locality, not the Borders town. No independently visitable attraction, café, named visitor trail or public visitor facility was verified inside its strict boundary.', identityUrl: 'https://www.openstreetmap.org/?mlat=56.5445114&mlon=-2.9927322#map=16/56.5445114/-2.9927322' },
  { stem: 'bonnyton-auchterhouse', id: 'bonnyton-auchterhouse-scotland', name: 'Bonnyton', region: 'Angus', centre: [-3.08577, 56.5344478], radius: 550, score: 24, dogRating: 1, character: 'Small Auchterhouse-parish hamlet', summary: 'This is Bonnyton in Auchterhouse parish, not Bonnyton at Barnhead. Local heritage remains searchable, but the hamlet has no complete visitor offer of its own.', identityUrl: 'https://gazetteer.org.uk/place/Bonnyton,_Angus_4631', boundarySource: 'Gazetteer for Scotland identity point with a conservative editorial boundary' },
  { stem: 'kirkton-of-auchterhouse', id: 'kirkton-of-auchterhouse-scotland', name: 'Kirkton of Auchterhouse', region: 'Angus', centre: [-3.0687269, 56.5317542], radius: 850, score: 59, dogRating: 2, character: 'Historic Sidlaw-foot village with a useful public park', summary: 'Kirkton has a historic church, a public park with picnic tables and toilets, and a documented railway-path link. The lack of a verified daytime café and limited visitor depth keep it just below map publication.', identityUrl: 'https://auchterhouse.com/things-to-do', boundarySource: 'Auchterhouse community visitor information and OpenStreetMap village position' },
  { stem: 'leoch-auchterhouse', id: 'leoch-auchterhouse-scotland', name: 'Leoch', region: 'Angus', centre: [-3.04223, 56.5181743], radius: 500, score: 16, dogRating: 1, character: 'Small rural locality south-east of Auchterhouse', summary: 'Leoch has local historic records but no verified public attraction, café, named visitor trail or visitor facilities inside the strict locality boundary.', identityUrl: 'https://www.openstreetmap.org/?mlat=56.5181743&mlon=-3.0422300#map=16/56.5181743/-3.0422300' },
  { stem: 'bridgefoot-angus', id: 'bridgefoot-angus-scotland', name: 'Bridgefoot', region: 'Angus', centre: [-3.0130426, 56.5055208], radius: 650, score: 30, dogRating: 1, character: 'Small settlement at the foot of the Sidlaws', summary: 'Bridgefoot is a useful regional reference with local heritage, but it has no verified rounded visitor proposition or public facility set inside the strict boundary.', identityUrl: 'https://www.openstreetmap.org/?mlat=56.5055208&mlon=-3.0130426#map=16/56.5055208/-3.0130426' },
  { stem: 'downfield-dundee', id: 'downfield-dundee-scotland', name: 'Downfield', region: 'Dundee City', centre: [-2.9959464, 56.4902011], radius: 900, score: 43, dogRating: 1, character: 'Residential north-Dundee district', summary: 'Downfield has a park and a verified daytime supermarket café at the edge of the district, but no destination-level visitor attraction or named visitor trail. Customer parking and toilets are not published as general public facilities.', identityUrl: 'https://www.openstreetmap.org/?mlat=56.4902011&mlon=-2.9959464#map=15/56.4902011/-2.9959464' },
  { stem: 'birkhill-angus', id: 'birkhill-angus-scotland', name: 'Birkhill', region: 'Angus', centre: [-3.056782, 56.4962964], radius: 750, score: 42, dogRating: 2, character: 'Residential Sidlaw-edge village', summary: 'Birkhill has an official local path circuit and a documented public route base at the Millennium Hall, but limited sights and no qualifying café-led visitor offer.', identityUrl: 'https://www.angus.gov.uk/sites/default/files/2023-03/Sidlaw%20path%20network%20leaflet.pdf' },
  { stem: 'muirhead-angus', id: 'muirhead-angus-scotland', name: 'Muirhead', region: 'Angus', centre: [-3.0678975, 56.4973583], radius: 700, score: 40, dogRating: 2, character: 'Residential village adjoining Birkhill', summary: 'Muirhead shares access to the official Sidlaw path network, but facilities assigned to Birkhill are not duplicated and the village lacks independent visitor depth.', identityUrl: 'https://www.angus.gov.uk/sites/default/files/2023-03/Sidlaw%20path%20network%20leaflet.pdf' },
  { stem: 'dronley-angus', id: 'dronley-angus-scotland', name: 'Dronley', region: 'Angus', centre: [-3.0675252, 56.50813], radius: 1_150, score: 41, dogRating: 3, character: 'Small settlement beside community woodland', summary: 'Dronley Community Woodland and the railway path are genuine See and Trails entries, but the woodland is the attraction: the settlement itself is not a rounded tourist destination.', identityUrl: 'https://auchterhouse.com/things-to-do' },
  { stem: 'fowlis-easter', id: 'fowlis-easter-scotland', name: 'Fowlis Easter', region: 'Angus', centre: [-3.1035364, 56.4886244], radius: 750, score: 62, dogRating: 2, character: 'Compact historic village beside Fowlis Den', summary: 'Fowlis Easter earns a modest map place for its exceptional medieval church, compact historic core, Den walk and verified public parking. Limited church access and the absence of a qualifying café or public toilet cap the score.', identityUrl: 'https://www.carseandsidlawchurches.org/fowlis-and-liff' },
  { stem: 'liff', id: 'liff-scotland', name: 'Liff', region: 'Angus', centre: [-3.0837168, 56.483164], radius: 800, score: 52, dogRating: 2, character: 'Historic village beside woods and the Den of Fowlis', summary: 'Liff has a historic church, local archaeology and walking access towards Fowlis Den, but no current daytime café or complete public visitor-facility set.', identityUrl: 'https://www.carseandsidlawchurches.org/fowlis-and-liff' },
  { stem: 'denhead-of-gray', id: 'denhead-of-gray-scotland', name: 'Denhead of Gray', region: 'Angus', centre: [-3.0612804, 56.4735006], radius: 550, score: 22, dogRating: 1, character: 'Small rural settlement on Dundee’s western edge', summary: 'No independent attraction, café, named visitor trail or confirmed public visitor facility was found inside the strict settlement boundary.', identityUrl: 'https://www.openstreetmap.org/?mlat=56.4735006&mlon=-3.0612804#map=16/56.4735006/-3.0612804' },
  { stem: 'benvie', id: 'benvie-scotland', name: 'Benvie', region: 'Angus', centre: [-3.0910846, 56.4713196], radius: 650, score: 36, dogRating: 1, character: 'Rural former-parish locality with archaeological interest', summary: 'Benvie’s church and mill evidence belongs in See and the heritage layer, but the locality has no current visitor infrastructure and is not independently destination-worthy.', identityUrl: 'https://www.trove.scot/place/31932' },
  { stem: 'longforgan', id: 'longforgan-scotland', name: 'Longforgan', region: 'Perth and Kinross', centre: [-3.1199524, 56.4571784], radius: 950, score: 63, dogRating: 2, character: 'Historic Carse conservation village', summary: 'Longforgan clears the map threshold through its coherent historic core, mercat cross, church with limited visitor opening, community café session and local core paths. Restricted opening and modest all-day facilities keep it a notable stop rather than a destination.', identityUrl: 'https://www.scotlandschurchestrust.org.uk/church/longforgan-parish-church/' },
  { stem: 'castle-huntly', id: 'castle-huntly-scotland', name: 'Castle Huntly', region: 'Perth and Kinross', centre: [-3.1308885, 56.4506934], radius: 550, score: 20, dogRating: 0, character: 'Rural locality dominated by a working prison', summary: 'The castle is HMP Castle Huntly and is not a public visitor attraction. Its heritage is retained without assigning prison access or nearby Longforgan facilities to the locality.', identityUrl: 'https://www.sps.gov.uk/prisons/hmp-castle-huntly' },
  { stem: 'invergowrie', id: 'invergowrie-scotland', name: 'Invergowrie', region: 'Perth and Kinross', centre: [-3.0609511, 56.4592991], radius: 950, score: 59, dogRating: 2, character: 'Tay-side village with a strong path network and café stop', summary: 'Invergowrie has a verified independent café, a historic core and official paths towards the estuary and Kingoodie. Informal slippery shore access, no confirmed general visitor car park or public toilet, and limited See depth keep it below 60.', identityUrl: 'https://www.pkc.gov.uk/article/15386/Invergowrie-Path-Network' },
  { stem: 'kingoodie', id: 'kingoodie-scotland', name: 'Kingoodie', region: 'Perth and Kinross', centre: [-3.0739405, 56.4515506], radius: 700, score: 54, dogRating: 2, character: 'Former quarry village on the Inner Tay', summary: 'Kingoodie Quarry, estuary wildlife and the official loop path are worthwhile See and Trails entries, but the village lacks café, toilet and verified public parking breadth.', identityUrl: 'https://www.pkc.gov.uk/article/15386/Invergowrie-Path-Network' },
  { stem: 'woodhaven-fife', id: 'woodhaven-fife-scotland', name: 'Woodhaven', region: 'Fife', centre: [-2.9609167, 56.4308297], radius: 700, score: 55, dogRating: 2, character: 'Tay-side Newport-on-Tay locality', summary: 'Woodhaven has waterfront memorials, a playpark and direct Fife Coastal Path context, but no verified café or complete public facility set inside the locality boundary.', identityUrl: 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/leuchars-to-wormit-bay/' },
];

function sourceRecord(name: string, organisation: string, url: string, notes: string, reliability: Reliability = 'official_non_statutory'): SourceRecord {
  return { sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: reviewedAt, licence: 'Source-linked editorial evidence; check time-sensitive details before travel.', notes, reliability };
}

function packageFor(seed: Seed): ProjectPackage {
  const boundary = buffer(point(seed.centre), seed.radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
  const band = townScoreBand(seed.score);
  const source: DataSourceDefinition = {
    id: `${seed.id}-identity`, name: `${seed.name} identity and strict audit boundary`, organisation: new URL(seed.identityUrl).hostname,
    coverage: seed.name, accessMethod: 'Named-place identity and boundary-aware editorial review', sourceUrl: seed.identityUrl,
    reliability: seed.identityUrl.includes('openstreetmap') ? 'secondary' : 'official_non_statutory',
    limitations: 'The boundary is an editorial visitor study area, not an administrative claim.',
  };
  const pkg: ProjectPackage = {
    project: {
      id: seed.id, name: seed.name, countryCode: 'GB-SCT', country: 'Scotland', region: seed.region, locality: seed.name,
      centre: seed.centre, boundary, boundarySource: seed.boundarySource ?? 'Verified named-place position with a conservative strict editorial study buffer',
      boundaryConfidence: 'high', sourceLanguage: 'English', preferredBasemap: 'voyager', createdAt: reviewedAt,
      methodology: defaultMethodology,
      researchNotes: 'Completed as an individual, strict-boundary audit on 2026-09-02. Nearby attractions and facilities are excluded unless they lie inside the defined visitor study area.',
      touristAppeal: {
        score: seed.score, dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(seed.dogRating),
        rating: band.rating, label: band.label, summary: seed.summary, dogAccessRating: seed.dogRating,
        dogAccessSummary: seed.dogRating >= 2 ? 'Outdoor access is useful with responsible close control; indoor policies must be checked separately.' : 'No rounded dog-friendly visitor circuit is promoted.',
        methodVersion: '2026-09-02-full-settlement-visitor-audit-v1', reviewedAt: reviewedDate,
        sourceUrls: [seed.identityUrl, treasureTrails, curiousAbout, mysteryGuides, goQuest, outdoorCode],
      },
      visitorHighlights: [],
      townGuide: {
        characterTag: seed.character, headline: seed.score >= 60 ? 'A fully audited notable stop' : 'A fully audited regional reference', intro: seed.summary,
        bestFor: seed.score >= 60 ? ['A short planned heritage stop'] : ['Regional orientation and specific verified places'],
        perfectFor: seed.score >= 60 ? ['A focused half-day detour'] : ['Checking whether a named place has anything independently visitable'],
        suggestedFirstVisit: { title: 'Use the verified cards only', summary: 'The guide excludes neighbouring attractions and unverified facilities.' },
        dontMiss: [], suggestedTime: seed.score >= 60 ? '1–3 hours' : 'Pass-through or a specific See place only',
        visitorMood: seed.score >= 60 ? 'Published on the town map.' : 'Selector-only below the 60-point town-map threshold.',
        sourceUrls: [seed.identityUrl], lastReviewedAt: reviewedDate,
      },
      townStudyArea: {
        localityName: seed.name, sourceName: seed.boundarySource ?? 'Verified named-place position', sourceUrl: seed.identityUrl, sourceVersion: reviewedDate,
        bufferMetres: seed.radius, localityBoundary: boundary, bufferedBoundary: boundary,
        notes: 'Strict editorial visitor study area. Nearby attraction value is excluded from the settlement score.',
      },
    },
    features: [], sources: [source], historicMaps: [], settlementPolygons: [], validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  return pkg;
}

function currentFeature(pkg: ProjectPackage, input: { id: string; name: string; type: string; c: [number, number]; description: string; url: string; details: string; tags: string[] }): HeritageFeature {
  return {
    id: `west-dundee-curated:${input.id}`, projectId: pkg.project.id, name: input.name, alternativeNames: [], countryCode: pkg.project.countryCode,
    region: pkg.project.region, locality: pkg.project.locality, featureType: input.type, significance: 'local', geometry: { type: 'Point', coordinates: input.c },
    locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
    shortDescription: input.description, visitorWebsiteUrl: input.url,
    sourceRecords: [sourceRecord(input.name, new URL(input.url).hostname, input.url, input.details)],
    tags: ['current-context', ...input.tags], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
  };
}

function attractionReview(score: number, url: string, rationale: string): EditorialRecordReview {
  return { status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: rationale, evidenceUrls: [url], visitability: 'full_visitor_experience',
    attractionAssessment: { experienceDepth: 12, distinctiveness: Math.min(20, score - 45), presentation: 14, journeyWorth: 12, accessAndReliability: 10, evidenceConfidence: 5, visitability: 'full_visitor_experience' } };
}

function trailReview(url: string, rationale: string): EditorialRecordReview {
  return { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: rationale, evidenceUrls: [url] };
}

function foodReview(score: number, url: string, rationale: string): EditorialRecordReview {
  return { status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: rationale,
    evidenceUrls: [url], foodAssessment: { foodAndDrinkQuality: Math.min(30, score - 48), daytimeRelevance: 20, distinctiveness: 13, consistency: 14, visitorFit: 10, evidenceConfidence: 8 } };
}

const projects = new Map(seeds.map((seed) => [seed.id, packageFor(seed)]));
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { schemaVersion: number; reviewedAt?: string; projects: Record<string, Record<string, string[]>> };
planner.reviewedAt = reviewedDate;
for (const seed of seeds) planner.projects[seed.id] = { eat: [], trails: [], picnic: [], parking: [], toilets: [] };

function add(projectId: string, input: Parameters<typeof currentFeature>[1], need: 'eat' | 'trails' | 'picnic' | 'parking' | 'toilets' | 'see', score?: number): HeritageFeature {
  const pkg = projects.get(projectId)!;
  const feature = currentFeature(pkg, input);
  if (need === 'eat') feature.editorialReview = foodReview(score ?? 65, input.url, 'Audited for coffee, cake and light-lunch relevance from current operator information.');
  if (need === 'trails') feature.editorialReview = trailReview(input.url, 'A named, source-linked route with enough current information to plan responsibly.');
  if (need === 'see') feature.editorialReview = attractionReview(score ?? 65, input.url, 'A genuine in-boundary visitor place assessed separately from settlement-level appeal.');
  pkg.features.push(feature);
  if (need !== 'see') planner.projects[projectId][need].push(feature.id);
  return feature;
}

const sidlaw = 'https://www.angus.gov.uk/sites/default/files/2023-03/Sidlaw%20path%20network%20leaflet.pdf';
const auchterhouse = 'https://auchterhouse.com/things-to-do';
add('kirkton-of-auchterhouse-scotland', { id: 'auchterhouse-park', name: 'Auchterhouse Park', type: 'park', c: [-3.0676636, 56.5300209], description: 'Public park and play area with picnic tables and free public toilets.', url: auchterhouse, details: 'Official community visitor page confirms park, play equipment, picnic tables and free public toilets.', tags: ['service-context-visitor', 'curated-visitor-attraction'] }, 'see', 63);
add('kirkton-of-auchterhouse-scotland', { id: 'auchterhouse-park-picnic', name: 'Auchterhouse Park picnic tables', type: 'picnic_site', c: [-3.0676636, 56.5300209], description: 'Picnic tables in the public park.', url: auchterhouse, details: 'tourism=picnic_site; access=public; fee=no; check local signs.', tags: ['service-context-picnic', 'visitor-context-picnic'] }, 'picnic');
add('kirkton-of-auchterhouse-scotland', { id: 'auchterhouse-park-toilets', name: 'Auchterhouse Park public toilets', type: 'toilets', c: [-3.06758, 56.53008], description: 'Free public toilets beside the park; check local opening information.', url: auchterhouse, details: 'amenity=toilets; access=public; fee=no; opening hours not published.', tags: ['service-context-toilets', 'visitor-context-toilets'] }, 'toilets');
add('kirkton-of-auchterhouse-scotland', { id: 'auchterhouse-railway-path', name: 'Auchterhouse Railway Path', type: 'walking_route', c: [-3.0701, 56.5321], description: 'Local path using the former railway alignment between Dronley and Kirkton of Auchterhouse.', url: sidlaw, details: 'Council path-network leaflet; shared local route; use current access conditions.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');

add('dronley-angus-scotland', { id: 'dronley-community-woodland', name: 'Dronley Community Woodland', type: 'park', c: [-3.0700798, 56.5172248], description: 'Community woodland with waymarked local paths north of the settlement.', url: auchterhouse, details: 'Official community visitor page identifies the woodland and paths; the woodland is the attraction, not evidence that Dronley is a tourist town.', tags: ['service-context-visitor', 'curated-visitor-attraction'] }, 'see', 66);
add('dronley-angus-scotland', { id: 'dronley-wood-parking', name: 'Dronley Community Woodland parking area', type: 'parking', c: [-3.0707601, 56.5113341], description: 'Small public route parking area; capacity, surface and disabled bays are not published.', url: sidlaw, details: 'amenity=parking; access=public; fee=no; capacity=Not published; check signs and do not obstruct access.', tags: ['service-context-parking', 'visitor-context-parking'] }, 'parking');
add('dronley-angus-scotland', { id: 'dronley-railway-path', name: 'Dronley to Auchterhouse Railway Path', type: 'walking_route', c: [-3.0699, 56.5115], description: 'Former-railway path link from Dronley towards Kirkton of Auchterhouse.', url: sidlaw, details: 'Council path-network leaflet; shared route; use current access conditions.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');

add('birkhill-angus-scotland', { id: 'birkhill-local-circuit', name: 'Birkhill local path circuit', type: 'walking_route', c: [-3.0582, 56.4972], description: 'Official Sidlaw path-network circuit starting at Muirhead and Birkhill Millennium Hall.', url: sidlaw, details: 'Council path-network leaflet; use current access and weather conditions.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');
add('birkhill-angus-scotland', { id: 'millennium-hall-parking', name: 'Muirhead and Birkhill Millennium Hall route parking', type: 'parking', c: [-3.05876, 56.49654], description: 'Route-start parking identified by the council path leaflet; avoid events and follow site signs.', url: sidlaw, details: 'amenity=parking; access=public for path start when available; fee=not published; capacity=not published; event use can restrict availability.', tags: ['service-context-parking', 'visitor-context-parking'] }, 'parking');
add('muirhead-angus-scotland', { id: 'muirhead-path-network', name: 'Muirhead Sidlaw path links', type: 'walking_route', c: [-3.0672, 56.4981], description: 'Local links into the official Sidlaw path network.', url: sidlaw, details: 'Council path-network leaflet; facilities at Birkhill are not duplicated here.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');

const tesco = 'https://www.tesco.com/store-locator/dundee/kingsway';
add('downfield-dundee-scotland', { id: 'downfield-tesco-cafe', name: 'Tesco Café, Dundee Kingsway', type: 'cafe', c: [-2.9932085, 56.483117], description: 'Supermarket café for barista coffee and a straightforward light meal.', url: tesco, details: 'amenity=cafe; operator confirms Tesco Café, current daily hours and customer facilities; supermarket customer parking and toilets are not general public facilities.', tags: ['service-context-food', 'visitor-context-food'] }, 'eat', 64);
add('downfield-dundee-scotland', { id: 'downfield-park', name: 'Downfield Park', type: 'park', c: [-2.99454, 56.49045], description: 'Local public green and sports space, useful for a short outdoor break rather than a destination attraction.', url: 'https://www.dundeecity.gov.uk/service-area/neighbourhood-services/environment/parks-and-environment', details: 'Local-authority parks context; no separate attraction-level visitor facilities verified.', tags: ['service-context-visitor'] }, 'see', 55);

const fowlisChurch = 'https://www.carseandsidlawchurches.org/fowlis-and-liff';
const fowlisHall = 'https://fowlishall.squarespace.com/contact';
const denWalk = 'https://jamescarron.wordpress.com/walks/take-a-hike-den-of-fowlis/';
const fowlisSee = add('fowlis-easter-scotland', { id: 'fowlis-easter-church', name: 'Fowlis Easter Parish Church', type: 'church', c: [-3.1025593, 56.4882931], description: 'A nationally important medieval church interior with exceptional carved and painted fittings; access is limited and should be checked.', url: fowlisChurch, details: 'Current church page confirms the artistic importance and restricted service/access context; the building is not assumed to be open daily.', tags: ['service-context-visitor', 'curated-visitor-attraction'] }, 'see', 78);
add('fowlis-easter-scotland', { id: 'den-of-fowlis-loop', name: 'Den of Fowlis circular walk', type: 'walking_route', c: [-3.1012, 56.4869], description: 'A local circular linking the historic village, church and wooded Den; paths can be muddy and include awkward crossings.', url: denWalk, details: 'Named route checked against local geography; secondary route source, so current access must be confirmed.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');
add('fowlis-easter-scotland', { id: 'fowlis-public-parking', name: 'Fowlis Easter public car park', type: 'parking', c: [-3.10372, 56.48988], description: 'Public car park about 100 metres from Fowlis Hall; capacity and disabled bays are not published.', url: fowlisHall, details: 'amenity=parking; access=public; capacity=not published; fee=not published; hall’s on-site parking is event/customer parking and is excluded.', tags: ['service-context-parking', 'visitor-context-parking'] }, 'parking');

add('liff-scotland', { id: 'liff-den-walk', name: 'Liff and Den of Fowlis paths', type: 'walking_route', c: [-3.0828, 56.4832], description: 'Local paths connect Liff with the wooded Den and Fowlis Easter; use current signs and expect muddy ground.', url: denWalk, details: 'Named local circuit source; current access and crossings need checking.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');
add('liff-scotland', { id: 'backmuir-wood-parking', name: 'Backmuir Wood car park', type: 'parking', c: [-3.0734752, 56.4872614], description: 'Small free public woodland car park on the edge of the Liff study area; capacity and disabled bays are not published.', url: 'https://www.openstreetmap.org/node/1192398542', details: 'amenity=parking; access=public; fee=no; capacity=not published; check signs and surface conditions.', tags: ['service-context-parking', 'visitor-context-parking'] }, 'parking');

const longforganChurch = 'https://www.scotlandschurchestrust.org.uk/church/longforgan-parish-church/';
const longforganCommunity = 'https://www.carseandsidlawchurches.org/longforgan';
const pkcCorePaths = 'https://www.pkc.gov.uk/media/18296/List-of-Core-Paths/pdf/Core_Paths_List.pdf';
const longSee = add('longforgan-scotland', { id: 'longforgan-parish-church', name: 'Longforgan Parish Church', type: 'church', c: [-3.1222967, 56.4570639], description: 'Historic parish church with a 1690 tower, 1795 main body, medieval stones and limited summer visitor opening.', url: longforganChurch, details: 'Current trust page gives construction history, seasonal Wednesday opening and visitor toilet provision during opening.', tags: ['service-context-visitor', 'curated-visitor-attraction'] }, 'see', 72);
add('longforgan-scotland', { id: 'longforgan-pop-in-cafe', name: 'Longforgan Pop-in Café', type: 'cafe', c: [-3.12192, 56.45706], description: 'Weekly community coffee stop in the church hall, normally Wednesday mornings; check the current parish page before travel.', url: longforganCommunity, details: 'amenity=cafe; community weekly session; Wednesday 09:00–11:00 when advertised; coffee and light refreshments; not an all-day commercial café.', tags: ['service-context-food', 'visitor-context-food'] }, 'eat', 61);
add('longforgan-scotland', { id: 'longforgan-core-paths', name: 'Longforgan core paths', type: 'walking_route', c: [-3.1195, 56.4577], description: 'Local core-path links through and around the conservation village.', url: pkcCorePaths, details: 'Perth and Kinross Council core-path list; choose a route and check current path notices.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');
add('longforgan-scotland', { id: 'huntly-wood-parking', name: 'Huntly Wood car park', type: 'parking', c: [-3.1202248, 56.4619139], description: 'Small public woodland car park; capacity, surface and disabled bays are not published.', url: pkcCorePaths, details: 'amenity=parking; access=public; capacity=not published; fee=not published; check site signs.', tags: ['service-context-parking', 'visitor-context-parking'] }, 'parking');
add('longforgan-scotland', { id: 'longforgan-church-toilets', name: 'Longforgan Parish Church visitor toilet', type: 'toilets', c: [-3.1222967, 56.4570639], description: 'Accessible visitor toilet available only when the church is open.', url: longforganChurch, details: 'amenity=toilets; access=customers/visitors; opening_hours=church opening only; not a 24-hour public convenience.', tags: ['service-context-toilets', 'visitor-context-toilets'] }, 'toilets');

const postHouse = 'https://www.posthouseinvergowrie.co.uk/';
const invergowriePaths = 'https://www.pkc.gov.uk/article/15386/Invergowrie-Path-Network';
add('invergowrie-scotland', { id: 'post-house-coffee', name: 'Post House Coffee Co.', type: 'cafe', c: [-3.0613243, 56.4612419], description: 'Independent village café focused on coffee, home baking, breakfast and light lunches.', url: postHouse, details: 'amenity=cafe; independent operator; coffee, home baking and light lunch; check current opening days on the operator site.', tags: ['service-context-food', 'visitor-context-food'] }, 'eat', 78);
add('invergowrie-scotland', { id: 'invergowrie-path-network', name: 'Invergowrie Path Network', type: 'walking_route', c: [-3.0605, 56.4582], description: 'Official level surfaced links towards Kingoodie Quarry and Dundee, with informal slippery access to the Inner Tay shore.', url: invergowriePaths, details: 'Council path network; shoreline access is informal and can be slippery; check closures.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');
add('invergowrie-scotland', { id: 'invergowrie-war-memorial-park', name: 'Invergowrie War Memorial Park', type: 'park', c: [-3.0595825, 56.4580749], description: 'Small public green suitable for a brief informal rest; no formal picnic furniture is claimed.', url: invergowriePaths, details: 'Public green; informal rest only; no dedicated picnic claim.', tags: ['service-context-visitor'] }, 'see', 56);

const kingoodieSee = add('kingoodie-scotland', { id: 'kingoodie-quarry', name: 'Kingoodie Quarry', type: 'quarry', c: [-3.0741547, 56.4530487], description: 'Former quarry managed as woodland and open space, linked to the Inner Tay path network.', url: invergowriePaths, details: 'Council path page and forest plan; quarry and wildlife interest are the attraction, not evidence of a rounded tourist village.', tags: ['service-context-visitor', 'curated-visitor-attraction'] }, 'see', 68);
add('kingoodie-scotland', { id: 'kingoodie-quarry-loop', name: 'Kingoodie Quarry loop path', type: 'walking_route', c: [-3.0739, 56.4527], description: 'A council-listed 0.5 km loop through the former quarry.', url: pkcCorePaths, details: 'Core path INGI/101; check current path notices and ground conditions.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');

const fifeCoast = 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/leuchars-to-wormit-bay/';
add('woodhaven-fife-scotland', { id: 'woodhaven-fife-coastal-path', name: 'Fife Coastal Path at Woodhaven', type: 'walking_route', c: [-2.9611, 56.4311], description: 'Signed long-distance coastal route linking Tayport, the Tay Road Bridge and Wormit Bay.', url: fifeCoast, details: 'Official route page; check alerts and current route conditions before setting out.', tags: ['service-context-trail', 'visitor-context-trail'] }, 'trails');
add('woodhaven-fife-scotland', { id: 'woodhaven-playpark', name: 'Woodhaven Playpark', type: 'park', c: [-2.9624681, 56.4298544], description: 'Local public playpark and green, useful for families but not treated as a destination attraction.', url: 'https://www.openstreetmap.org/way/1339701234', details: 'Local current-place record; no café, public toilet or formal picnic provision verified.', tags: ['service-context-visitor'] }, 'see', 54);

for (const [projectId, feature, score, reason, tagline] of [
  ['fowlis-easter-scotland', fowlisSee, 78, 'The medieval church is the village’s defining visitor asset, with access limitations stated clearly.', 'Exceptional medieval art in a village church'],
  ['longforgan-scotland', longSee, 72, 'The church and historic core form a coherent short stop, not a full-day destination.', 'Nine centuries of worship in the Carse'],
  ['kingoodie-scotland', kingoodieSee, 68, 'The quarry is a genuine local nature and industrial-history stop while the settlement remains below 60.', 'A quarry reclaimed by woodland and wildlife'],
] as Array<[string, HeritageFeature, number, string, string]>) {
  const pkg = projects.get(projectId)!;
  const highlight: VisitorHighlight = { rank: 1, featureId: feature.id, name: feature.name, reason, tagline, visitorScore: score, timeToSpend: '30–75 minutes', openingTimes: 'Check the linked current visitor information.', admission: 'Free unless the operator states otherwise', freeAdmission: true, visitorWebsiteUrl: feature.visitorWebsiteUrl, sourceName: feature.sourceRecords[0].sourceName, sourceUrl: feature.sourceRecords[0].sourceUrl!, verifiedInBoundaryAt: reviewedDate, editorialReview: feature.editorialReview! };
  pkg.project.visitorHighlights = [highlight];
  pkg.project.townGuide!.dontMiss = [feature.name];
}

await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { schemaVersion: number; reviewedAt?: string; projects: Record<string, unknown> };
dog.reviewedAt = reviewedDate;
for (const seed of seeds) dog.projects[seed.id] = { attraction: {}, eat: {} };
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

for (const seed of seeds) {
  const pkg = projects.get(seed.id)!;
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${seed.name}: ${errors.map((item) => item.message).join('; ')}`);
  await writeFile(resolve('data/projects', `${seed.stem}.json`), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

const noProviderProduct = {
  treasureTrails: { url: treasureTrails, result: 'No locality-specific product verified' },
  curiousAbout: { url: curiousAbout, result: 'No locality-specific product verified' },
  mysteryGuides: { url: mysteryGuides, result: 'No locality-specific product verified' },
  goQuest: { url: goQuest, result: 'No locality-specific product verified' },
};
const requestedOrder = [
  ...seeds.slice(0, 4).map((seed) => seed.id), 'muir-of-pert-tealing-scotland', ...seeds.slice(4).map((seed) => seed.id),
];
const audit = requestedOrder.map((projectId, index) => {
  if (projectId === 'muir-of-pert-tealing-scotland') return {
    order: index + 1, requestedName: 'Muirs of Perk', resolvedName: 'Muir of Pert', projectId, score: 18, mapEligible: false,
    identityDecision: 'No gazetteer, OSM, web or map record supports “Muirs of Perk”; normalised to the existing Muir of Pert by Tealing rather than inventing a duplicate.',
    categoryChecks: { see: 'Former-airfield and prisoner-of-war evidence retained as heritage; not a public visitor attraction.', eat: 'None verified.', trails: 'No named locality trail verified.', picnic: 'None verified.', parking: 'No general public visitor parking verified.', toilets: 'None verified.', historicEnvironment: 'Existing local HES and NRHE extract retained for re-certification.', dogAccess: 'No promoted visitor circuit.' },
    providerChecks: noProviderProduct, exact58SecondPass: 'Not required: score is 18.', status: 'completed',
  };
  const seed = seeds.find((item) => item.id === projectId)!;
  const pkg = projects.get(projectId)!;
  const curation = planner.projects[projectId];
  return {
    order: index + 1, requestedName: seed.name, resolvedName: seed.name, projectId, score: seed.score, mapEligible: seed.score >= 60,
    identityDecision: `Resolved to ${seed.name} at ${seed.centre[1]}, ${seed.centre[0]}; strict ${seed.radius} m editorial boundary.`,
    categoryChecks: {
      see: pkg.project.visitorHighlights?.length ? `${pkg.project.visitorHighlights.length} lead visitor highlight; all current See records retained separately from the town score.` : `${pkg.features.filter((item) => item.tags.includes('service-context-visitor')).length} current See records; none used to manufacture destination status.`,
      eat: `${curation.eat.length} verified coffee, cake or light-lunch places; dinner-led venues excluded.`,
      trails: `${curation.trails.length} named and source-linked trails; provider catalogues checked separately.`,
      picnic: `${curation.picnic.length} verified picnic places; informal lawns are not mislabelled.`,
      parking: `${curation.parking.length} verified public visitor parking places; private and customer-only parking excluded.`,
      toilets: `${curation.toilets.length} verified toilet places with access limits stated.`,
      historicEnvironment: 'Local HES Listed Buildings, Scheduled Monuments and NRHE records queued for strict-boundary import and date certification.',
      dogAccess: 'Scottish Outdoor Access Code reviewed; indoor policies not inferred.',
    },
    evidenceUrls: [...new Set([seed.identityUrl, ...pkg.features.flatMap((item) => item.sourceRecords.map((record) => record.sourceUrl).filter(Boolean))])],
    providerChecks: noProviderProduct, exact58SecondPass: seed.score === 58 ? 'Mandatory second pass completed.' : `Not required: score is ${seed.score}.`,
    scoreRationale: seed.summary, status: 'completed',
  };
});
await writeFile(resolve('data/review/west-dundee-localities-full-audit-2026-09-02.json'), `${JSON.stringify({
  reviewedAt, methodVersion: '2026-09-02-full-settlement-visitor-audit-v1', auditRule: 'One place completed and recorded before the next; strict boundary; no borrowed attractions; all categories explicit.',
  requestedCount: 19, distinctNewProjects: 18, normalisedExistingProject: 'muir-of-pert-tealing-scotland', audits: audit,
}, null, 2)}\n`, 'utf8');

console.log(`Created and audited ${seeds.length} distinct projects plus the Muir of Pert spelling resolution.`);
