import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T18:00:00Z';
const projectId = 'strachan-scotland';
const projectPath = resolve('data/projects/strachan.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');

const urls = {
  circuit: 'https://themackwalks.wordpress.com/2021/08/17/163-strachan-scolty-hill-circuit-aberdeenshire/',
  circuitPdf: 'https://www.garioch.info/walks/Scotland/Aberdeenshire/Strachan-Scolty%20Hill%20Circuit.pdf',
  corePaths: 'https://www.aberdeenshire.gov.uk/outdoor-access-and-countryside/paths/core-paths-plan',
  flsScolty: 'https://forestryandland.gov.scot/visit/destinations/scolty',
  feughside: 'https://www.feughside.com/explore-feughside',
  hall: 'https://www.feughside.com/about-hall',
  heritage: 'https://www.clanstrachan.org/feughside/',
  churchHistory: 'https://catalogue.nrscotland.gov.uk/nrsonlinecatalogue/browseDetails.aspx?reference=CH2%2F1305',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  treasureTrails: 'https://www.treasuretrails.co.uk/pages/trail-search',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

type MutablePackage = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: Array<HeritageFeature & Record<string, any>> };
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const feature = (id: string) => {
  const found = pkg.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Strachan feature ${id}`);
  return found;
};

const source = (sourceName: string, sourceOrganisation: string, sourceUrl: string, notes: string, reliability: 'official_statutory' | 'official_non_statutory' | 'local_authority' | 'secondary' = 'official_non_statutory') => ({
  sourceName, sourceOrganisation, sourceUrl, accessedAt: reviewedAt,
  licence: 'Source-linked editorial evidence; retain attribution and verify time-sensitive details before travel.',
  reliability, notes,
});

const attractionReview = (scoreRationale: string, evidenceUrls: string[], values: [number, number, number, number, number, number]) => ({
  status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
  scoreRationale, evidenceUrls,
  attractionAssessment: { experienceDepth: values[0], distinctiveness: values[1], presentation: values[2], journeyWorth: values[3], accessAndReliability: values[4], evidenceConfidence: values[5], visitability: 'full_visitor_experience' },
});

const scoltyAttraction = feature('curated-attraction:strachan-scolty-circuit');
Object.assign(scoltyAttraction, {
  fullDescription: 'A quieter southern approach to Scolty Hill, starting and finishing at Strachan Village Hall. The 6.75 km route mixes paved sections, rough roads, grassy and stony paths, gains 314 metres and reaches the 1840 Burnett monument and wide Deeside views.',
  reviewNotes: 'Route author and downloadable waypoint guide checked for distance, duration, ascent, surfaces, parking and dog guidance. The tower lies outside the settlement study area and is not inflated into a separate Strachan attraction.',
  sourceRecords: [
    source('Strachan–Scolty Hill Circuit', 'The Mack Walks', urls.circuit, 'Current route summary: 6.75 km, 3.5 hours, 314 m ascent, medium difficulty, mixed paved/rough/grassy/stony surfaces; hall parking unless an event is running; dogs welcome with leads on roads and near farm animals.', 'secondary'),
    source('Strachan and Scolty Hill Core Paths', 'Aberdeenshire Council', urls.corePaths, 'The council publishes a dedicated Strachan and Scolty Hill core-path map.', 'local_authority'),
    source('Scolty Forest visitor guide', 'Forestry and Land Scotland', urls.flsScolty, 'Responsible land-manager context for current Scolty forest trails, terrain, wildlife and visitor conditions.', 'official_statutory'),
  ],
  attractionGuide: {
    headline: 'The quiet southern way to Scolty’s tower and Deeside views',
    intro: 'Start at Strachan Hall and follow the full waypoint guide: this is a medium 6.75 km hill circuit, not a short village stroll.',
    bestFor: ['Hill walking', 'Scolty Tower', 'Woodland wildlife', 'Deeside views'],
    parking: 'The route author uses Strachan Village Hall parking, but warns that it may be unavailable during events and suggests adapting the start from the war memorial. No capacity, tariff, accessible-bay count, maximum stay or overnight policy is published, so it is not listed as a general public car park.',
    toilets: 'There is no council-listed public toilet in Strachan. Hall toilets are for hall users and events, not promised to passing walkers; Forestry and Land Scotland identifies Bellfield car park in Banchory as the nearest public facility for Scolty.',
    picnic: 'No formal Strachan picnic facility is verified. Carry food responsibly and leave no trace rather than assuming access to hall or private grounds.',
    foodNote: 'No current public café, pub or restaurant in Strachan clears the evidence gate. Bring provisions or use verified services in Banchory.',
    trails: [
      { name: 'Strachan–Scolty Hill Circuit', summary: 'The complete village-hall loop to Scolty Hill and the Burnett monument.', routeType: 'Medium hill circuit', distance: '6.75 km / 4.22 miles', duration: 'About 3½ hours', difficulty: 'Medium; 314 m ascent on paved, rough-road, grassy and stony surfaces.', externalUrl: urls.circuitPdf },
      { name: 'Strachan and Scolty Hill Core Paths', summary: 'Aberdeenshire Council’s official map for the wider local path network.', routeType: 'Core-path planning map', distance: 'Multiple routes', duration: 'Choose according to route', difficulty: 'Varied; check the map and current land-manager notices.', externalUrl: urls.corePaths },
    ],
    thingsToDo: [
      { name: 'Take the southern approach', summary: 'The Strachan start is quieter than the standard Banchory-side ascent and gives the village a genuine role in the walk.' },
      { name: 'Climb the Burnett monument', summary: 'When open and safe, the internal staircase extends the summit panorama.' },
      { name: 'Watch for forest wildlife', summary: 'Scolty woodland supports red squirrels, roe deer and woodpeckers; minimise disturbance.' },
    ],
  },
});

const heritage = feature('curated-attraction:strachan-heritage-centre');
Object.assign(heritage, {
  documentedDateText: '17th-century inn building; heritage centre opened 31 July 2024',
  earliestPossibleYear: 1600, latestPossibleYear: 2024, dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium',
  fullDescription: 'A small specialist collection inside Feughside, a building described by the operator as a 17th-century nine-bedroom inn. Opened on 31 July 2024, the centre preserves local medieval records and relics, displays Clan Strachan heraldry and holds rare books. Visits are by prior appointment.',
  reviewNotes: 'The operator confirms the collection, building history, address, opening date and appointment-only access. No regular drop-in hours, price, accessibility detail or dog policy is published.',
  sourceRecords: [source('Clan Strachan Centre for Heritage', 'Clan Strachan Society and Charitable Trust', urls.heritage, 'Official centre page: opened 31 July 2024; medieval local records and relics, heraldry and rare books; housed in a stated 17th-century former inn; visits by appointment.')],
  attractionGuide: {
    headline: 'A small appointment-only centre for the name and medieval landscape',
    intro: 'Arrange the visit before travelling. The value is specialist—local medieval records, clan heraldry, rare books and the story of Feughside—rather than a conventional staffed museum.',
    bestFor: ['Clan history', 'Medieval records', 'Heraldry', 'Specialist research'],
    parking: 'The centre does not publish visitor-space numbers, tariff, payment types, disabled bays, maximum stay or overnight rules. Confirm parking as part of the appointment.',
    toilets: 'Visitor toilet and accessibility arrangements are not published; ask when booking. There is no council public toilet in Strachan.',
    picnic: 'No public picnic facility is published at Feughside.',
    foodNote: 'Feughside accommodation breakfast is not treated as a public Eat, and the historic Feughside Inn listing is not current evidence of a public restaurant.',
    trails: [{ name: 'Strachan and Scolty Hill Core Paths', summary: 'Use the council map to place the centre within the wider Feughside walking landscape.', routeType: 'Path network', distance: 'Multiple routes', duration: 'Variable', difficulty: 'Variable; confirm route and conditions.', externalUrl: urls.corePaths }],
    thingsToDo: [
      { name: 'Arrange a focused visit', summary: 'Tell the centre whether your interest is family history, medieval Strachan or local records.' },
      { name: 'Read the Feughside building', summary: 'The operator traces the present building to a 17th-century inn and an earlier mapped hostelry.' },
      { name: 'Connect name and place', summary: 'Use the collection to understand why the clan and village share this landscape.' },
    ],
  },
});

const trail = feature('curated-trails:strachan-scolty-circuit');
Object.assign(trail, {
  shortDescription: 'A 6.75 km medium hill circuit from Strachan Village Hall to Scolty Hill and the Burnett monument; allow about 3½ hours for 314 m of ascent.',
  fullDescription: 'A downloadable fourteen-waypoint route using paved sections, rough roads and grassy or stony paths. Parking at the hall is conditional on events; the war memorial is the route author’s fallback start.',
  sourceRecords: scoltyAttraction.sourceRecords,
  editorialReview: { ...attractionReview('A complete, distinctive and dog-usable hill circuit with downloadable waypoints, reduced for medium terrain, conditional hall parking and reliance on a responsible secondary route author.', [urls.circuit, urls.circuitPdf, urls.corePaths, urls.flsScolty], [21, 14, 14, 10, 7, 4]), category: 'trail' },
});
trail.sourceRecords[0].notes = 'Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=70; trail_score=70; trail_type=Medium hill circuit; distance=6.75 km / 4.22 miles; duration=3.5 hours; ascent=314 m; difficulty=Medium; dog_friendly=Yes, with leads on public roads and near farm animals; parking=Strachan Village Hall unless an event is running; description=Quiet southern Scolty circuit. A complete waypoint route from Strachan to Scolty Hill and the Burnett monument.';

const corePathTrail = feature('curated-trails:strachan-feughside-walks');
Object.assign(corePathTrail, {
  id: 'curated-trails:strachan-core-paths', name: 'Strachan and Scolty Hill Core Paths',
  shortDescription: 'Aberdeenshire Council’s official local core-path map, supported by the community’s Feughside route and landscape guide.',
  fullDescription: 'A planning resource rather than a single prescribed walk. It helps visitors connect Strachan with Scolty and understand which mapped paths belong to the wider network without claiming informal riverside or private-estate access.',
  visitorWebsiteUrl: urls.corePaths, updatedAt: reviewedAt,
  sourceRecords: [
    source('Strachan and Scolty Hill Core Paths', 'Aberdeenshire Council', urls.corePaths, 'Official dedicated core-path map for Strachan and Scolty Hill.', 'local_authority'),
    source('Explore Feughside', 'Feughside Community Council and partners', urls.feughside, 'Community guide to Scolty, local paths, geology, wildlife and responsible route planning.'),
  ],
  editorialReview: { ...attractionReview('A responsible official map for extending a Strachan visit, reduced because it is a network-planning resource rather than one fully described itinerary.', [urls.corePaths, urls.feughside], [18, 12, 12, 9, 7, 6]), category: 'trail' },
});
corePathTrail.sourceRecords[0].notes = 'Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=64; trail_score=64; trail_type=Core-path planning map; distance=Multiple routes; duration=Variable; difficulty=Variable; description=Official Strachan path network. Council core paths supported by current community landscape and route context.';

const churchPin = feature('hes-listed-building:strachan-lb16215');
churchPin.fullDescription = 'The listed parish kirk was rebuilt in 1866–67 on a site whose session records extend back to the late 16th century. It is an important village landmark, but no dependable general visitor opening is published.';
churchPin.sourceRecords.push(source('Records of Strachan Old Kirk Session', 'National Records of Scotland', urls.churchHistory, 'Official archive history: old church rebuilt in 1866; parish kirk documented in 1867; later congregational changes.', 'official_statutory'));

pkg.project.visitorHighlights = [
  {
    rank: 1, featureId: scoltyAttraction.id, name: scoltyAttraction.name,
    reason: 'A complete 6.75 km circuit starts at the village hall, takes the quieter southern approach to Scolty Hill and adds a substantial 314 m-ascent walking experience.',
    visitorScore: 70, tagline: 'The quiet way up Scolty', timeToSpend: 'About 3½ hours',
    openingTimes: 'Open-air route; check current forestry, path and severe-weather notices before setting out.',
    admission: 'Free route; hall parking is conditional on events.', freeAdmission: true,
    visitorWebsiteUrl: urls.circuit, sourceName: 'The Mack Walks and Aberdeenshire Council', sourceUrl: urls.circuit, verifiedInBoundaryAt: reviewedDate,
    editorialReview: attractionReview('A complete and distinctive village-start hill circuit with route detail, ascent and responsible access guidance, reduced for medium terrain and conditional parking.', [urls.circuit, urls.circuitPdf, urls.corePaths, urls.flsScolty], [21, 14, 14, 10, 7, 4]),
  },
  {
    rank: 2, featureId: heritage.id, name: heritage.name,
    reason: 'A specialist centre inside a historic Feughside building preserves local medieval records, heraldry, relics and rare books, but requires an appointment.',
    visitorScore: 61, tagline: 'Clan records at Feughside', timeToSpend: '30–60 minutes',
    openingTimes: 'By prior appointment; telephone the centre before travelling.',
    admission: 'Appointment required; ask whether a charge or donation applies.', freeAdmission: false,
    visitorWebsiteUrl: urls.heritage, sourceName: 'Clan Strachan Centre for Heritage', sourceUrl: urls.heritage, verifiedInBoundaryAt: reviewedDate,
    editorialReview: attractionReview('A genuine specialist collection with a confirmed 2024 opening and appointment route, reduced for limited scale, no regular drop-in hours and sparse practical information.', [urls.heritage], [18, 12, 12, 8, 6, 5]),
  },
];
scoltyAttraction.editorialReview = pkg.project.visitorHighlights[0].editorialReview;
heritage.editorialReview = pkg.project.visitorHighlights[1].editorialReview;

pkg.project.touristAppeal = {
  score: 62, dogOwnerScore: 61, dogAccessScoreAdjustment: -1, rating: 0, label: 'Notable Stop',
  summary: 'A narrow but legitimate notable stop: Strachan supplies a distinctive village-start circuit to Scolty and a small appointment-only clan centre, while its church, granite village and Feughside setting add context rather than separate score inflation.',
  dogAccessRating: 2,
  dogAccessSummary: 'The main hill circuit is explicitly dog-friendly with leads on roads and near livestock, but medium terrain, forestry activity, conditional parking and an unconfirmed heritage-centre policy keep the dog-owner score slightly below the visitor score.',
  methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1', reviewedAt: reviewedDate,
  sourceUrls: [urls.circuit, urls.circuitPdf, urls.corePaths, urls.flsScolty, urls.feughside, urls.heritage, urls.churchHistory, urls.hall, urls.parking, urls.toilets, urls.outdoorCode],
};
pkg.project.townGuide = {
  characterTag: 'Granite kirk and southern Scolty trailhead',
  headline: 'A quiet Feughside village with the less-travelled route to Scolty',
  intro: 'Strachan earns its place as a focused walking stop. Start from the 1927 village hall for the 6.75 km Scolty circuit, date the 1867 parish kirk and granite village, and arrange the small Clan Strachan centre in advance if its specialist collection matters to you.',
  bestFor: ['Scolty hill walking', 'Feughside scenery', 'Clan heritage', 'Quiet granite villages'],
  perfectFor: ['A focused 3½–5 hour walking stop', 'Visitors with a pre-booked clan-history appointment'],
  suggestedFirstVisit: { title: 'Start with the southern Scolty circuit', summary: 'Allow around 3½ hours for the 6.75 km medium route and confirm hall parking is not displaced by an event.' },
  dontMiss: [scoltyAttraction.name, heritage.name, 'Strachan Parish Kirk'],
  suggestedTime: '3½–5 hours; shorter only for a pre-booked heritage visit',
  visitorMood: 'Quiet, outdoors-led and lightly serviced: worthwhile when the Scolty route or Strachan history is the purpose, not as a general facilities stop.',
  sourceUrls: [urls.circuit, urls.circuitPdf, urls.corePaths, urls.flsScolty, urls.feughside, urls.heritage, urls.churchHistory, urls.hall, urls.parking, urls.toilets, urls.treasureTrails],
  lastReviewedAt: reviewedDate,
};
pkg.project.visualIdentity = {
  theme: 'strachan-feughside-granite', badgeImage: '/town-guides/strachan-kirk-feughside-watercolour-guide-v1.png',
  badgeAlt: 'Watercolour illustration of Strachan parish kirk and granite cottages beside a grassy Feughside path',
  heroImage: '/town-guides/strachan-kirk-feughside-watercolour-guide-v1.png',
  heroAlt: 'Watercolour illustration of Strachan parish kirk, granite cottages, stone walls and the wooded Feughside hills', heroObjectPosition: '55% 48%',
  motifs: ['Parish kirk bellcote', 'Granite cottages', 'Fieldstone walls', 'Feughside woodland'], primaryColour: '#1C4748', accentColour: '#9B641B', backgroundColour: '#EEF2E8',
};

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { projects: Record<string, Record<string, string[]>> };
planner.projects[projectId] = { eat: [], trails: [trail.id, corePathTrail.id], parking: [], toilets: [], picnic: [] };
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { reviewedAt: string; projects: Record<string, any> };
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [scoltyAttraction.id]: { rating: 2, status: 'restricted', label: 'Dog-friendly hill circuit with lead sections', summary: 'The route author explicitly marks the circuit dog-friendly, with dogs on leads on public roads and near farm animals. Also respect forestry operations and other users.', sourceName: 'The Mack Walks route guide', sourceUrl: urls.circuit, reviewedAt: reviewedDate },
    [heritage.id]: { rating: 0, status: 'unconfirmed', label: 'Dog policy not published', summary: 'No reliable current dog policy is published for appointment visits to the heritage centre. Confirm directly before making a dog-dependent booking.', sourceName: 'Clan Strachan Centre policy review', sourceUrl: urls.heritage, reviewedAt: reviewedDate },
    [trail.id]: { rating: 2, status: 'restricted', label: 'Dog-friendly with road and livestock care', summary: 'Dogs are explicitly allowed on the route, but leads are required on public roads and near farm animals; close control is also needed around forestry work and wildlife.', sourceName: 'The Mack Walks route guide', sourceUrl: urls.circuit, reviewedAt: reviewedDate },
    [corePathTrail.id]: { rating: 2, status: 'restricted', label: 'Responsible access varies by path', summary: 'The mapped network is suitable for planning dog walks, but control requirements vary with roads, livestock, wildlife, forestry operations and other path users.', sourceName: 'Aberdeenshire core paths and Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
  },
  eat: {},
};
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Strachan audit introduced ${errors.length} validation error(s): ${errors.map((item) => item.message).join('; ')}`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const hesPins = pkg.features.filter((item) => item.tags.includes('hes-listed-building'));
const undated = hesPins.filter((item) => !item.documentedDateText?.trim());
await writeFile(resolve('data/review/strachan-full-visitor-audit-2026-08-27.json'), `${JSON.stringify({
  reviewedAt, townScore: 62, dogOwnerScore: 61, dogAccessRating: 2,
  publicationRule: 'Retain only visitor places scoring 60 or more with a current, reproducible visitor contract.',
  attractions: pkg.project.visitorHighlights.map(({ name, visitorScore }) => ({ name, score: visitorScore, published: visitorScore >= 60 })),
  food: [],
  trails: [
    { name: trail.name, score: 70, distance: '6.75 km / 4.22 miles', duration: '3.5 hours', ascent: '314 m', difficulty: 'Medium', dogRating: 2 },
    { name: corePathTrail.name, score: 64, type: 'Official core-path planning map', distance: 'Multiple routes', dogRating: 2 },
  ],
  facilities: { parking: [], toilets: [], picnic: [] },
  conditionalFacilities: {
    parking: 'Village hall parking is used by the route author but may be unavailable during events; capacity and terms are not published.',
    toilets: 'Hall toilets are for hall use and events, not a public convenience. No Strachan facility appears in the council public-toilet directory.',
  },
  heritageDateAudit: { pins: hesPins.length, dated: hesPins.length - undated.length, undated: undated.map((item) => item.id) },
  exclusions: [
    'No Strachan Treasure Trails product found in the current product search.',
    'Scolty Tower remains part of the Strachan-start circuit but is outside the settlement study boundary and is not scored as a separate town attraction.',
    'Strachan Parish Kirk remains a dated heritage pin but does not clear 60 as a standalone visitor attraction because general interior opening is not published.',
    'The former Feughside Inn is not published as an Eat; current evidence supports accommodation and the appointment-only heritage centre, not a general restaurant.',
    'Village Hall parking and toilets are conditional hall facilities, not general public amenities.',
    'No unverified riverside path, public picnic site or Banchory facility is borrowed into Strachan.',
  ],
}, null, 2)}\n`, 'utf8');

console.log(`Strachan full audit complete: 2 attractions, 0 Eat, 2 trails, 0 public parking, 0 public toilets; ${hesPins.length - undated.length}/${hesPins.length} heritage pins dated.`);
