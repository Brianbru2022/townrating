import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'cove-bay-scotland';
const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T23:59:00Z';
const projectPath = resolve('data/projects/cove-bay.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/cove-bay-full-visitor-audit-2026-08-27.json');
type F = HeritageFeature & Record<string, any>;
type P = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: F[] };

const urls = {
  communityHistory: 'https://cove-bay.com/cove-bay/',
  coastalTrail: 'https://www.firstbus.co.uk/aberdeen/news-and-service-updates/news/day-trip-cove-bay-bus',
  universityTrail: 'https://www.abdn.ac.uk/sbs/documents/cove_final_most_compressed.pdf',
  circuit: 'https://themackwalks.wordpress.com/2024/05/03/214-cove-bay-coastal-path-community-woodlands-circuit-aberdeen-city/',
  coastalGuide: 'https://www.visitabdn.com/assets/Aberdeen-City-Council-Guide-Coastal-Trail.pdf',
  hesHotel: 'https://portal.historicenvironment.scot/apex/f?p=1505:300:::::VIEWTYPE,VIEWREF:designation,LB15633',
  wartimeBlocks: 'https://her.aberdeenshire.gov.uk/Monument/MAB25995/',
  hotel: 'https://www.covebayhotel.co.uk/',
  hotelLunch: 'https://www.covebayhotel.co.uk/lunch-menu',
  hotelPub: 'https://www.covebayhotel.co.uk/public-house',
  dogCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as P;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;
const assess = (score: number) => ({ experienceDepth: Math.round(score * .3), distinctiveness: Math.round(score * .2), presentation: Math.round(score * .2), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .1), evidenceConfidence: score - Math.round(score * .3) - Math.round(score * .2) - Math.round(score * .2) - Math.round(score * .15) - Math.round(score * .1), visitability: 'full_visitor_experience' as const });
const foodAssess = (score: number) => ({ foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11), evidenceConfidence: score - Math.round(score * .29) - Math.round(score * .21) - Math.round(score * .15) - Math.round(score * .14) - Math.round(score * .11) });
const src = (name: string, org: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName: name, sourceOrganisation: org, sourceUrl: url, accessedAt: reviewedAt, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });
const review = (category: 'attraction' | 'trail' | 'food', score: number, reason: string, evidenceUrls: string[]) => ({ status: 'editorially_researched', category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: reason, evidenceUrls, ...(category === 'food' ? { foodAssessment: foodAssess(score) } : { attractionAssessment: assess(score) }) });
const make = (s: Record<string, any>): F => ({
  id: s.id, projectId, name: s.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeen City', locality: 'Cove Bay', featureType: s.featureType,
  significance: s.significance ?? 'local', geometry: { type: 'Point', coordinates: s.coordinates }, locationType: s.locationType ?? 'exact', locationConfidence: s.locationConfidence ?? 'high',
  dateBasis: s.dateBasis ?? 'unknown', dateConfidence: s.dateConfidence ?? 'unknown', survival: s.survival ?? 'substantially_intact', documentedDateText: s.dateText,
  earliestPossibleYear: s.earliest, latestPossibleYear: s.latest, datePrecision: s.datePrecision, shortDescription: s.description, visitorWebsiteUrl: s.website,
  attractionGuide: s.guide, editorialReview: s.category ? review(s.category, s.score, s.reason, s.evidenceUrls) : undefined,
  sourceRecords: s.evidenceUrls.map((url: string, i: number) => src(i ? `${s.name} supporting evidence` : s.sourceName, i ? 'Supporting publisher' : s.sourceOrganisation, url, `Current-place curation: visitor_place_type=${s.placeType}; ${s.score ? `visit_score=${s.score}; ` : ''}${s.details ?? ''}; description=${s.description}`, url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('aberdeencity.gov.uk') || url.includes('abdn.ac.uk') || url.includes('aberdeenshire.gov.uk') ? 'local_authority' : 'official_non_statutory')),
  tags: s.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
}) as F;

const harbour = make({
  id: 'curated-attractions:cove-harbour-old-village', name: 'Cove Harbour and Old Fishing Village', featureType: 'harbour', coordinates: [-2.0749262, 57.0967499],
  website: urls.communityHistory, dateText: 'The piers and breakwater were constructed in 1878, during the fishing village’s 19th-century peak', earliest: 1878, latest: 1878,
  dateBasis: 'documented_construction', dateConfidence: 'high', datePrecision: 'exact_year',
  description: 'A small rock-girt fishing harbour, 1878 pier and breakwater, old cottages and low-tide rock pools at Cove’s historic core.',
  reason: 'Cove’s harbour is its clearest destination-level sight: picturesque, historically legible and linked directly to the settlement’s fishing story, although it remains a compact open-air stop.',
  evidenceUrls: [urls.communityHistory, urls.coastalGuide, urls.circuit], sourceName: 'Cove Bay history', sourceOrganisation: 'Cove and Altens Community Council', placeType: 'Attraction', score: 74, category: 'attraction',
  tags: ['curated-visitor', 'home-standalone-place', 'historic-place', 'date-reviewed'],
  guide: { headline: 'Find the 1878 harbour below Cove’s old fishing-village lanes', parking: 'The harbour has no verified formal visitor car park. Balmoral Terrace and the harbour approach are narrow; park only where signs and access allow.', toilets: 'No dedicated public toilet has been verified at the harbour.', picnic: 'No formal picnic tables have been verified; the shore is an informal stop only and visitors should take litter away.', foodNote: 'Cove Bay Hotel is uphill on Colsea Road and serves coffee, light bites and lunch.' },
});

const hotel = make({
  id: 'hes-listed-building:LB15633', name: 'Cove Bay Hotel', featureType: 'hotel', coordinates: [-2.0774875, 57.0992581], website: urls.hesHotel,
  dateText: 'Mid-19th century', earliest: 1840, latest: 1870, dateBasis: 'documented_period', dateConfidence: 'high', datePrecision: 'period_range',
  description: 'A Category C listed mid-19th-century rubble-built former coaching inn overlooking the coast.', evidenceUrls: [urls.hesHotel, urls.hotel],
  sourceName: 'Cove Bay Hotel listing', sourceOrganisation: 'Historic Environment Scotland', placeType: 'Heritage', tags: ['hes-listed-building', 'historic-place', 'date-reviewed'],
});

const wartimeBlocks = make({
  id: 'historic-environment-record:MAB25995', name: 'Cove Harbour Anti-tank Blocks', featureType: 'fortification', coordinates: [-2.0761, 57.0972], website: urls.wartimeBlocks,
  dateText: 'Second World War, 1939–1945', earliest: 1939, latest: 1945, dateBasis: 'documented_period', dateConfidence: 'high', datePrecision: 'period_range',
  description: 'Surviving concrete anti-tank blocks placed around the harbour as Second World War anti-landing defences.', evidenceUrls: [urls.wartimeBlocks],
  sourceName: 'Balmoral Terrace historic-environment record', sourceOrganisation: 'Aberdeenshire Council Historic Environment Record', placeType: 'Heritage', tags: ['local-heritage-record', 'historic-place', 'date-reviewed'],
});

const isie = make({
  id: 'curated-attractions:cove-isie-caie-sculpture', name: 'Isie Caie Fishwife Sculpture', featureType: 'statue', coordinates: [-2.0782, 57.0988], website: urls.circuit,
  dateText: 'Unveiled in 2017', earliest: 2017, latest: 2017, dateBasis: 'documented_construction', dateConfidence: 'medium', datePrecision: 'exact_year',
  description: 'A community memorial and information board recalling Isie Caie, the last of Aberdeen’s traditional fishwives.',
  reason: 'The sculpture gives Cove’s fishing history a strong human focus and works well with the harbour walk, but is a brief outdoor stop rather than a journey-making attraction.',
  evidenceUrls: [urls.circuit, 'https://committees.aberdeencity.gov.uk/mgConvert2PDF.aspx?ID=2060&T=6'], sourceName: 'Cove circuit route guide', sourceOrganisation: 'The Mack Walks', placeType: 'Attraction', score: 62, category: 'attraction',
  tags: ['curated-visitor', 'home-standalone-place', 'public-art', 'date-reviewed'],
  guide: { headline: 'Meet the fishwife who carried Cove’s catch into Aberdeen', parking: 'No dedicated sculpture parking; include it on foot between the harbour and Cove Community Woodland.', toilets: 'No dedicated facility.', picnic: 'No dedicated provision.', foodNote: 'Cove Bay Hotel is the nearest verified visitor refreshment stop.' },
});

const attractions = [
  { f: harbour, score: 74, tag: 'Historic 1878 fishing harbour', reason: harbour.editorialReview!.scoreRationale, web: urls.communityHistory, time: '45–90 minutes', open: 'Open-air harbour and public approaches; visit in daylight and watch tides', admission: 'Free', guide: harbour.attractionGuide },
  { f: isie, score: 62, tag: 'Cove’s fishwife story in stone', reason: isie.editorialReview!.scoreRationale, web: urls.circuit, time: '10–20 minutes', open: 'Open-air public sculpture', admission: 'Free', guide: isie.attractionGuide },
];

const trails = [
  make({ id: 'curated-trails:cove-bay-coastal-community-woodlands', name: 'Cove Bay Coastal Path and Community Woodlands Circuit', score: 76, coordinates: [-2.0835013, 57.0962919], website: urls.circuit, featureType: 'walking_route', locationType: 'representative_point', description: 'A verified 6.9 km circuit taking about 2.75 hours through modern Cove, heritage sculptures, clifftop coast, the 1878 harbour and community woodland.', reason: 'A working Cove-specific guide with route summary, duration, length, ascent, surface, parking, dog and access information plus downloadable mapping.', evidenceUrls: [urls.circuit], sourceName: 'Cove Bay coastal and woodland circuit', sourceOrganisation: 'The Mack Walks', placeType: 'Trail', details: 'distance=6.9 km; duration=2.75 hours; ascent=149 m; difficulty=Easy; surface=Mixed hard and rough paths; dog_friendly=yes, lead on roads; parking=Free at start/end; route_link_checked=2026-08-27', category: 'trail', tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'] }),
  make({ id: 'curated-trails:cove-aberdeen-coastal-trail', name: 'Aberdeen Coastal Trail: Cove Bay Section', score: 70, coordinates: [-2.0715, 57.101], website: urls.universityTrail, featureType: 'walking_route', locationType: 'representative_point', description: 'A free illustrated Cove coastal-path guide linking the old harbour with rugged cliffs, rock stacks and the wider south-Aberdeen shore.', reason: 'A downloadable Cove guide from the University of Aberdeen supports a distinct linear coastal walk; the linked PDF and supporting First Bus page were both checked.', evidenceUrls: [urls.universityTrail, urls.coastalTrail], sourceName: 'Cove coastal path guide', sourceOrganisation: 'University of Aberdeen', placeType: 'Trail', details: 'format=Free PDF; route_link_checked=2026-08-27; access=Clifftop and rough coastal sections; check weather, tides and current diversions', category: 'trail', tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'] }),
];

const foods = [make({
  id: 'curated-eat:cove-bay-hotel', name: 'Cove Bay Hotel Public House', score: 70, coordinates: [-2.0774875, 57.0992581], website: urls.hotelLunch, featureType: 'commercial_building',
  description: 'Sea-view coffee and lighter lunch stop: the public house welcomes visitors for coffee or a bite, with soup, wraps, baked potatoes and light bites as well as fuller meals.',
  reason: 'Cove has no dependable standalone café currently established in-boundary; this verified historic public house is the strongest visitor-fit daytime option because it explicitly serves coffee and lighter food.',
  evidenceUrls: [urls.hotelLunch, urls.hotelPub], sourceName: 'Cove Bay Hotel lunch menu', sourceOrganisation: 'Cove Bay Hotel', placeType: 'Eat', details: 'opening_hours:description=Lunch Mon–Sat 12:00–14:00, Sun 12:00–20:00; light bites available all day during published food service; price_band=££; cuisine=Coffee, soup, wraps, baked potatoes and light pub bites; dog_policy=Public house explicitly dog friendly', category: 'food', tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'],
})];

const parking = [make({
  id: 'curated-parking:cove-road-walk-start', name: 'Cove Road Circuit Start Parking', coordinates: [-2.0915826, 57.0961932], website: urls.circuit, featureType: 'parking', locationType: 'representative_point', locationConfidence: 'medium',
  description: 'Free parking is stated at the Cove circuit start/end just off Cove Road. The source does not publish a car-park name, capacity, Blue Badge bays, payment system, maximum stay or overnight rules; confirm the exact signed area on arrival.',
  evidenceUrls: [urls.circuit], sourceName: 'Cove Bay coastal and woodland circuit', sourceOrganisation: 'The Mack Walks', placeType: 'Parking', details: 'amenity=parking; location=Walk start/end just off Cove Road; capacity=Not published; capacity:disabled=Not published; fee=no; payment_methods=Not applicable; maxstay=Not published; overnight=Not published; surface=Not published; restrictions=Use only the signed legal area and keep residential access clear', tags: ['service-context-parking', 'current-context'],
})];
const toilets: F[] = [];
const picnic: F[] = [];

const auditedFeatures = [harbour, hotel, wartimeBlocks, isie, ...trails, ...foods, ...parking];
const auditedFeatureIds = new Set(auditedFeatures.map((feature) => feature.id));
pkg.features = [...auditedFeatures, ...pkg.features.filter((feature) => feature.tags.includes('hes-listed-building') && !auditedFeatureIds.has(feature.id))];
const highlights: VisitorHighlight[] = attractions.map((a, i) => ({ rank: i + 1, featureId: a.f.id, name: a.f.name, reason: a.reason, tagline: a.tag, visitorScore: a.score, timeToSpend: a.time, openingTimes: a.open, admission: a.admission, freeAdmission: true, visitorWebsiteUrl: a.web, attractionGuide: a.guide, editorialReview: a.f.editorialReview, sourceName: a.f.sourceRecords[0].sourceName, sourceUrl: a.web, verifiedInBoundaryAt: reviewedDate }));
pkg.project.preferredBasemap = 'voyager';
pkg.project.boundarySource = 'Conservative Cove Bay settlement boundary retaining the old village, harbour, community woodland and urban core; Torry, Nigg Bay, Doonies, Altens and Portlethen remain separate places';
pkg.project.boundaryConfidence = 'medium';
pkg.project.touristAppeal = { score: 64, dogOwnerScore: 63, dogAccessScoreAdjustment: -1, rating: 0, label: 'Notable Stop', summary: 'A compact historic fishing harbour with a strong local circuit, coastal scenery and modest but well-documented heritage.', dogAccessRating: 2, dogAccessSummary: 'The main circuit is explicitly dog friendly, but roads, livestock possibilities, nesting seabirds, cliffs and narrow coastal sections require close control; dog access does not raise the town score.', methodVersion: '2026-08-27-strict-settlement-full-audit-v2', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = highlights;
pkg.project.townGuide = { characterTag: 'Old fishing harbour and clifftop suburb', headline: 'A small historic harbour with a surprisingly complete local circuit', intro: 'Cove Bay remains a 64% Notable Stop. Its own visitor value comes from the 1878 harbour, fishing-village story and a verified coast-and-community-woodland circuit—not from Torry, Nigg Bay, Doonies or Portlethen.', bestFor: ['Fishing-village heritage', 'Clifftop walking', 'Rock pools at low tide', 'A dog-friendly outdoor circuit'], perfectFor: ['A two-to-three-hour coastal walk', 'A short harbour and coffee stop'], suggestedFirstVisit: { title: 'Walk the harbour and community-woodland circuit', summary: 'Start just off Cove Road, follow the heritage sculptures and coast to the 1878 harbour, then return through Cove Community Woodland.' }, dontMiss: ['Cove Harbour and Old Fishing Village', 'Isie Caie Fishwife Sculpture', 'Cove Bay Coastal Path and Community Woodlands Circuit'], suggestedTime: '1–3 hours', visitorMood: 'Weather-exposed, local and quietly historic rather than a major sightseeing destination.', practicalNote: 'The audited circuit identifies free start/end parking but publishes no capacity or stay rules. No dedicated public toilet or formal picnic site could be verified, and the harbour has no confirmed visitor car park.', transportNote: 'First Bus route 3A serves Cove from Aberdeen; the operator’s Cove day-trip guide points visitors towards the harbour and coastal trail.', accessibilityNote: 'The main circuit mixes tarmac and hard surfaces with rough, narrow coastal path and is not suitable for off-road mobility scooters. Harbour approaches are steep and the shore can be uneven.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate };

planner.projects[projectId] = { eat: foods.map((f) => f.id), trails: trails.map((f) => f.id), parking: parking.map((f) => f.id), toilets: [], picnic: [] };
const dr = (rating: number, status: string, label: string, summary: string, sourceUrl: string) => ({ rating, status, label, summary, sourceName: 'Cove Bay dog-access audit', sourceUrl, reviewedAt: reviewedDate });
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [harbour.id]: dr(2, 'restricted', 'Outdoor harbour with close control', 'Dogs can accompany the open-air stop, but use a short lead around vehicles, working boats, rock pools, cliffs and wildlife.', urls.dogCode),
    [isie.id]: dr(2, 'restricted', 'Outdoor sculpture with close control', 'The sculpture is on an outdoor walking route; keep dogs close on nearby roads and shared paths.', urls.dogCode),
  },
  trail: Object.fromEntries(trails.map((f) => [f.id, dr(2, 'restricted', 'Dog-friendly route with control points', 'The Cove circuit is described as dog friendly, with leads required on public roads; cliffs, nesting birds and shared paths add further close-control needs.', urls.circuit)])),
  eat: { [foods[0].id]: dr(3, 'welcoming', 'Dogs explicitly welcome in the public house', 'The operator invites visitors to bring their dog for coffee, a drink or food and publishes water, treats and a dog menu.', urls.hotelPub) },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((entry: any) => entry.severity === 'error');
if (errors.length) throw new Error(errors.map((entry: any) => entry.message).join('; '));
const historicPins = pkg.features.filter((feature) => feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record'].includes(tag)) && !feature.tags.includes('map-hidden'));
const undated = historicPins.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
if (undated.length) throw new Error(`Undated Cove Bay pins: ${undated.map((feature) => feature.id).join(', ')}`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`);
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({ reviewedAt, townScore: 64, dogOwnerScore: 63, dogAccessRating: 2, categoryCounts: { see: highlights.length, eat: foods.length, trails: trails.length, picnic: 0, parking: parking.length, toilets: 0, heritage: historicPins.length }, heritageDateAudit: { visiblePins: historicPins.length, dated: historicPins.length - undated.length, undated: undated.map((feature) => feature.id), dateRule: 'Construction, opening or material-period dates only, never designation dates.' }, trailProviderSearches: [{ provider: 'The Mack Walks', result: 'Exact Cove Bay Coastal Path and Community Woodlands Circuit verified; live page, PDF/GPX options and route facts recorded.' }, { provider: 'University of Aberdeen', result: 'Exact Cove coastal-path PDF verified with HTTP 200.' }, { provider: 'Aberdeen Coastal Trail / First Bus', result: 'Cove Harbour and Coastal Trail day-trip page verified with HTTP 200.' }, { provider: 'TreasureTrails.co.uk', result: 'No exact Cove Bay product established; none published.' }, { provider: 'Curious About', result: 'No exact Cove Bay route established.' }, { provider: 'Mystery Guides', result: 'No exact Cove Bay product established.' }, { provider: 'Go Quest Adventures', result: 'No exact Cove Bay product established.' }], eatAudit: { published: ['Cove Bay Hotel Public House'], excluded: ['KAVA Street Coffee has moved to Aberdeen Esplanade and is outside Cove Bay.', 'The Bread Guy result is delivered from Kincorth and was not treated as a Cove Bay premises.', 'No dependable current standalone Cove café was established.'] }, boundaryExclusions: ['Torry Battery and Greyhope Bay', 'Nigg Bay and St Fittick’s', 'Doonies Rare Breeds Farm', 'Altens', 'Portlethen'], parking: parking.map((feature) => ({ name: feature.name, detail: feature.shortDescription, source: feature.visitorWebsiteUrl })), toilets: { published: 0, result: 'No dedicated public visitor toilet in Cove Bay was established from dependable current evidence; customer facilities are not presented as public toilets.' }, picnic: { published: 0, result: 'No formal picnic site or confirmed picnic tables were established; informal greenspace is not mislabelled as a serviced picnic facility.' }, verification: { heritagePinsDated: `${historicPins.length - undated.length}/${historicPins.length}`, undatedHistoricPins: undated.length, checkedTrailLinks: [urls.circuit, urls.universityTrail, urls.coastalTrail, urls.hotelLunch, urls.hotelPub] } }, null, 2)}\n`);
console.log(`Cove Bay audit complete: ${highlights.length} See, ${foods.length} Eat, ${trails.length} Trails, 0 Picnic, ${parking.length} Parking, 0 Toilets; ${historicPins.length - undated.length}/${historicPins.length} historic pins dated.`);
