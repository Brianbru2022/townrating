import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'peterculter-scotland';
const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T22:15:00Z';
const projectPath = resolve('data/projects/peterculter.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/peterculter-full-visitor-audit-2026-08-27.json');

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: MutableFeature[] };

const urls = {
  heritageCentre: 'https://www.stpetersheritagecentre.org/the-heritage-centre',
  stPetersChurch: 'https://portal.historicenvironment.scot/designation/LB19753',
  stPetersChurchyard: 'https://portal.historicenvironment.scot/designation/LB15712',
  robRoy: 'https://www.robroyontherock.com/',
  robRoyTrove: 'https://www.trove.scot/place/149983',
  explorer: 'https://www.cultercc.org.uk/wp-content/uploads/2021/02/Culter-Explorer-Leaflet-12-Feb-2021.pdf',
  paths: 'https://www.cultercc.org.uk/wp-content/uploads/2021/02/202101-Revised-map-of-Culter-paths.pdf',
  deesideWay: 'https://visitabdn.com/businesses/the-deeside-way',
  neilSelbie: 'https://www.neilselbie.com/385-2/',
  crust: 'https://crustaberdeen.co.uk/',
  parkingOrder: 'https://tro.transportappeals.scot/TRO/Aberdeen%20City%20Council/1.pdf',
  councilParking: 'https://www.aberdeencity.gov.uk/services/roads-transport-and-parking/parking/car-parks',
  councilToilets: 'https://www.aberdeencity.gov.uk/services/people-and-communities/public-toilets',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curiousAbout: 'https://curiousabout.co.uk/',
  mysteryGuides: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  osm: 'https://www.openstreetmap.org/copyright',
};

const heritageDates: Record<string, { text: string; earliest: number; latest: number; precision: string; confidence?: 'high' | 'medium' }> = {
  LB15712: { text: 'Church built 1779; interior refurnished 1860; altered 1873; north aisle added 1895; churchyard includes a late-18th-century Patrick Duff monument', earliest: 1779, latest: 1895, precision: 'multi_period' },
  LB15713: { text: 'Early 18th-century manse; reroofed 1776–79; offices dated 1789; front addition by John Lyon 1826; remodelled circa 1845', earliest: 1700, latest: 1845, precision: 'multi_period', confidence: 'medium' },
  LB15714: { text: 'South-east part circa 1640–70; nine-window front circa 1730; north and south wings added and fire damage reinstated in 1910', earliest: 1640, latest: 1910, precision: 'multi_period', confidence: 'medium' },
  LB15715: { text: 'Dovecot, gate piers, gazebo and walled garden circa 1730', earliest: 1730, latest: 1730, precision: 'approximate_year', confidence: 'medium' },
  LB15716: { text: 'Kennerty House circa 1840', earliest: 1840, latest: 1840, precision: 'approximate_year', confidence: 'medium' },
  LB15717: { text: 'Upper Kennerty Mill dated 1838; burned in 1942 and rebuilt in 1942–43, retaining earlier masonry', earliest: 1838, latest: 1943, precision: 'multi_period' },
  LB15718: { text: 'Lower Kennerty Mill rebuilt in 1940 from earlier ruins', earliest: 1940, latest: 1940, precision: 'exact_year' },
  LB15719: { text: 'Kennerty Bridge rebuilt by Jenkins and Marr in 1888, retaining outer voussoirs and parapets from an older bridge', earliest: 1888, latest: 1888, precision: 'exact_year' },
  LB47267: { text: 'Kelman Memorial Church built 1895; later 20th-century additions and alterations', earliest: 1895, latest: 1999, precision: 'multi_period', confidence: 'medium' },
};

const historicMeta: Record<string, { name: string; type: string; description: string }> = {
  LB15712: { name: 'St Peter’s Heritage Centre, Church and Churchyard', type: 'church', description: 'The former parish church now houses a volunteer-run local museum; the churchyard and altered 1779 building form one visitor stop.' },
  LB15713: { name: 'Old Manse, Howie Lane', type: 'house', description: 'A private former manse with an early-18th-century core and documented 18th- and 19th-century alterations; exterior context only.' },
  LB15714: { name: 'Culter House', type: 'house', description: 'A private historic house with fabric from circa 1640–70 and major later phases; not a public attraction.' },
  LB15715: { name: 'Culter House Garden Structures', type: 'garden', description: 'Private circa-1730 dovecot, gazebo, gate piers and walled-garden structures; contextual exterior pin only.' },
  LB15716: { name: 'Kennerty House', type: 'house', description: 'A private circa-1840 house beside the Kennerty heritage cluster; exterior context only.' },
  LB15717: { name: 'Upper Kennerty Mill', type: 'industrial_building', description: 'The dated 1838 mill was rebuilt after a 1942 fire; appreciate from public routes without entering private ground.' },
  LB15718: { name: 'Lower Kennerty Mill', type: 'industrial_building', description: 'A former mill rebuilt from ruins in 1940; exterior context only.' },
  LB15719: { name: 'Kennerty Bridge', type: 'bridge', description: 'The 1888 bridge incorporates fabric from its predecessor and anchors the compact Kennerty mill landscape.' },
  LB47267: { name: 'Kelman Memorial Church', type: 'church', description: 'A prominent 1895 granite church on North Deeside Road; exterior viewing is dependable but interior visitor access is not.' },
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;

const assessment = (score: number) => {
  const result = { experienceDepth: Math.round(score * .30), distinctiveness: Math.round(score * .20), presentation: Math.round(score * .20), journeyWorth: Math.round(score * .15), accessAndReliability: Math.round(score * .10), evidenceConfidence: 0, visitability: 'full_visitor_experience' as const };
  result.evidenceConfidence = score - result.experienceDepth - result.distinctiveness - result.presentation - result.journeyWorth - result.accessAndReliability;
  return result;
};
const foodAssessment = (score: number) => {
  const result = { foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11), evidenceConfidence: 0 };
  result.evidenceConfidence = score - result.foodAndDrinkQuality - result.daytimeRelevance - result.distinctiveness - result.consistency - result.visitorFit;
  return result;
};
const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({ sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: reviewedAt, reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes });
const review = (category: 'attraction' | 'trail' | 'food', score: number, rationale: string, evidenceUrls: string[]) => ({ status: 'editorially_researched', category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: rationale, evidenceUrls, ...(category === 'food' ? { foodAssessment: foodAssessment(score) } : { attractionAssessment: assessment(score) }) });
const makeFeature = (spec: Record<string, any>): MutableFeature => ({
  id: spec.id, projectId, name: spec.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Aberdeen City', locality: 'Peterculter', featureType: spec.featureType,
  significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates }, locationType: spec.locationType ?? 'exact', locationConfidence: 'high',
  dateBasis: spec.dateBasis ?? 'unknown', dateConfidence: spec.dateConfidence ?? 'unknown', survival: spec.survival ?? 'substantially_intact', documentedDateText: spec.documentedDateText,
  earliestPossibleYear: spec.earliestPossibleYear, latestPossibleYear: spec.latestPossibleYear, datePrecision: spec.datePrecision,
  shortDescription: spec.description, fullDescription: spec.fullDescription, visitorWebsiteUrl: spec.website, attractionGuide: spec.guide,
  editorialReview: spec.category ? review(spec.category, spec.score, spec.reason, spec.evidenceUrls) : undefined,
  sourceRecords: spec.evidenceUrls.map((url: string, index: number) => source(index ? `${spec.name} supporting evidence` : spec.sourceName, index ? 'Supporting publisher' : spec.sourceOrganisation, url, `Current-place curation: visitor_place_type=${spec.placeType}; ${spec.score ? `visit_score=${spec.score}; ` : ''}${spec.details}; description=${spec.description}`, url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('aberdeencity.gov.uk') || url.includes('transportappeals.scot') ? 'local_authority' : 'official_non_statutory')),
  tags: spec.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: spec.evidenceScope ?? 'parish_evidence',
}) as MutableFeature;

const retainedIds = new Set(Object.keys(heritageDates).map((reference) => `hes-listed-building:${reference}`));
const historicFeatures = pkg.features.filter((feature) => retainedIds.has(feature.id));
for (const feature of historicFeatures) {
  const reference = feature.id.split(':').at(-1)!;
  const date = heritageDates[reference];
  const meta = historicMeta[reference];
  Object.assign(feature, {
    name: meta.name, featureType: meta.type, shortDescription: meta.description, documentedDateText: date.text,
    earliestPossibleYear: date.earliest, latestPossibleYear: date.latest, datePrecision: date.precision,
    dateBasis: 'documented_date_range', dateConfidence: date.confidence ?? 'high', reviewed: true, updatedAt: reviewedAt,
    tags: [...new Set([...feature.tags.filter((tag: string) => tag !== 'hes-date-extracted'), 'date-reviewed'])],
    sourceRecords: [...feature.sourceRecords, source('Peterculter full-audit construction-date review', 'Historic Environment Scotland', `https://portal.historicenvironment.scot/designation/${reference}`, 'Construction period manually normalised from the HES designation description; designation dates were not used.', 'official_statutory')],
  });
}

const church = historicFeatures.find((feature) => feature.id === 'hes-listed-building:LB15712')!;
Object.assign(church, {
  significance: 'regional', visitorWebsiteUrl: urls.heritageCentre,
  fullDescription: 'The Heritage Centre interprets Peterculter’s mills, school, farming, wartime and local-life stories in the former St Peter’s Church. The exterior and churchyard remain legible outside the limited volunteer opening season.',
  editorialReview: review('attraction', 76, 'Peterculter’s strongest self-contained visitor experience: a volunteer museum with several locally distinctive displays in a dated historic building, reduced for its limited Sunday opening season.', [urls.heritageCentre, urls.stPetersChurch, urls.stPetersChurchyard]),
  attractionGuide: { headline: 'Put Peterculter’s mills, railway and village life into context', intro: 'Use the compact exhibitions before walking to the burn, Rob Roy statue and Kennerty mill landscape.', bestFor: ['Local history','Industrial heritage','Families','Architecture'], parking: 'St Mary’s Place and Millside are council-named free car parks; capacities and restrictions are not published.', toilets: 'No verified council public toilet is published in the audited settlement.', picnic: 'No formal in-boundary picnic site or table count was verified.', foodNote: 'Neil Selbie Coffee Shop and Crust provide the strongest coffee, cake and light-lunch choices.' },
  tags: [...new Set([...church.tags, 'curated-visitor', 'home-standalone-place'])],
});

const robRoy = makeFeature({ id: 'curated-attraction:peterculter-rob-roy', category: 'attraction', placeType: 'Attraction', name: 'Rob Roy Statue and Culter Burn', score: 70, coordinates: [-2.27271,57.09847], featureType: 'public_art', significance: 'regional', documentedDateText: 'A figure has occupied the rock since about 1850; the present composite statue by David J Mitchell was unveiled on 16 September 2017', earliestPossibleYear: 1850, latestPossibleYear: 2017, datePrecision: 'multi_period', dateBasis: 'documented_date_range', dateConfidence: 'high', description: 'A much-loved local landmark above the wooded burn, with a documented story from a repurposed figurehead to the present 2017 statue.', fullDescription: 'The statue rewards a short stop as part of a Culter Burn walk rather than a long visit on its own. View from safe public paths and respect closures or erosion controls.', reason: 'A distinctive local landmark with an unusually well-documented community story and an attractive burn setting, reduced because it is a brief outdoor stop rather than a deep attraction.', website: urls.robRoy, sourceName: 'Rob Roy on the Rock preservation history', sourceOrganisation: 'Rob Roy Preservation Trust', evidenceUrls: [urls.robRoy, urls.robRoyTrove, urls.explorer], details: 'opening_hours:description=Outdoor viewpoint; daylight and path conditions; fee=Free; accessibility=Uneven woodland approaches; dog_friendly=Yes with close control beside water, wildlife and path users', tags: ['curated-visitor','home-standalone-place','date-reviewed'], guide: { headline: 'Meet Peterculter’s figure on the rock', intro: 'Combine the statue viewpoint with the burn paths and nearby Kennerty industrial heritage.', bestFor: ['Local stories','Woodland walks','Photography','Short stops'], parking: 'Millside is the nearer council-named free car park; capacity and bay details are not published.', toilets: 'No verified public toilet is published in Peterculter.', picnic: 'No formal picnic provision was verified.', foodNote: 'Return to North Deeside Road for coffee, cake or pastries.' } });

const trails = [
  makeFeature({ id: 'curated-trails:peterculter-explorer', category: 'trail', placeType: 'Trail', name: 'Culter Explorer Heritage Walks', score: 72, coordinates: [-2.2687,57.0966], featureType: 'walking_route', locationType: 'representative_point', description: 'A free illustrated local guide linking the Heritage Centre, Rob Roy, Culter Burn, Kennerty mills, historic bridges and village stories.', reason: 'The best exact-town self-guided option: locally produced, unusually rich in dated heritage and usable as several short walks, reduced because it is a downloadable guide rather than a staffed or commercial clue trail.', website: urls.explorer, sourceName: 'Culter Explorer', sourceOrganisation: 'Culter Community Council', evidenceUrls: [urls.explorer, urls.paths], details: 'trail_type=Self-guided heritage walks; format=Free PDF; app=no; price=Free; distance=Several selectable local walks, not published as one figure; duration=45 minutes to 3 hours; accessibility=Surfaces and gradients vary; dog_friendly=Close control beside roads, burns, wildlife and shared paths', tags: ['curated-visitor','service-context-trail','visitor-context-trail','current-context'] }),
  makeFeature({ id: 'curated-trails:peterculter-community-paths', category: 'trail', placeType: 'Trail', name: 'Peterculter Community Paths', score: 68, coordinates: [-2.26745,57.09611], featureType: 'walking_route', locationType: 'representative_point', description: 'The community path map connects the compact centre, Culter Burn, Kennerty, the river edge and the Deeside Way.', reason: 'A verified exact-town network that makes the village practical to explore on foot, reduced because it is a map rather than a fully described, waymarked single route.', website: urls.paths, sourceName: 'Revised map of Culter paths', sourceOrganisation: 'Culter Community Council', evidenceUrls: [urls.paths], details: 'trail_type=Community path network; format=Free PDF map; app=no; price=Free; distance=Varies; duration=30 minutes to several hours; accessibility=Mixed urban and unsurfaced paths, no step-free guarantee; dog_friendly=Close control beside water, wildlife, livestock, roads and shared paths', tags: ['curated-visitor','service-context-trail','visitor-context-trail','current-context'] }),
  makeFeature({ id: 'curated-trails:peterculter-deeside-way', category: 'trail', placeType: 'Trail', name: 'Deeside Way at Peterculter', score: 66, coordinates: [-2.2744,57.0994], featureType: 'walking_route', locationType: 'representative_point', description: 'A traffic-free former-railway route through Peterculter, useful for an out-and-back walk or a longer Deeside journey.', reason: 'A strong conventional trail passing directly through the settlement, reduced because it is not Peterculter-specific and the current operator page warns of a fallen-tree closure on the Peterculter section.', website: urls.deesideWay, sourceName: 'The Deeside Way', sourceOrganisation: 'VisitAberdeenshire', evidenceUrls: [urls.deesideWay, urls.paths], details: 'trail_type=Long-distance multi-use route; format=Web guide and signed path; app=no; price=Free; distance=Up to 41 miles end to end; duration=Local out-and-back from 45 minutes; accessibility=Generally easy gradients but surfaces and current closure conditions vary; dog_friendly=Listed as dog friendly, with close control around users, wildlife and adjoining land', tags: ['curated-visitor','service-context-trail','visitor-context-trail','current-context'] }),
];

const foods = [
  makeFeature({ id: 'curated-eat:peterculter-neil-selbie', category: 'food', placeType: 'Eat', name: 'Neil Selbie Coffee Shop', score: 76, coordinates: [-2.265547,57.0959951], featureType: 'commercial_building', description: 'Coffee, cake and light lunches: A dog-friendly daytime coffee shop serving breakfasts, light lunches, traybakes and warm scones.', reason: 'An excellent match for the guide’s café-led brief with current first-party hours, a broad light-lunch offer and an explicit dog-friendly welcome.', website: urls.neilSelbie, sourceName: 'Neil Selbie Coffee Shop', sourceOrganisation: 'Neil Selbie', evidenceUrls: [urls.neilSelbie], details: 'amenity=cafe; cuisine=Coffee, breakfast, light lunches, traybakes and scones; opening_hours:description=Monday–Saturday 09:00–16:00, Sunday closed; dog_friendly=Yes, explicitly stated by operator; payment_methods=Not published; price_band=££', tags: ['curated-visitor','service-context-food','visitor-context-food','current-context'] }),
  makeFeature({ id: 'curated-eat:peterculter-crust', category: 'food', placeType: 'Eat', name: 'Crust', score: 70, coordinates: [-2.2735726,57.0964951], featureType: 'commercial_building', description: 'Artisan pastries and bread: An artisan bakery for bread, croissants, cookies and pastries, well suited to coffee-and-cake and takeaway picnic supplies.', reason: 'A distinctive current bakery with strong pastry relevance and long daytime opening, reduced because seating, light-lunch depth and dog access are not clearly published.', website: urls.crust, sourceName: 'Crust Peterculter', sourceOrganisation: 'Crust', evidenceUrls: [urls.crust], details: 'shop=bakery; cuisine=Artisan bread, croissants, cookies and pastries; opening_hours:description=Monday–Thursday 07:00–15:00, Friday–Saturday 07:00–16:00; dog_friendly=No reliable current policy found; payment_methods=Not published; price_band=££', tags: ['curated-visitor','service-context-food','visitor-context-food','current-context'] }),
];

const parking = [
  makeFeature({ id: 'curated-parking:peterculter-st-marys-place', placeType: 'Parking', name: 'St Mary’s Place Car Park', coordinates: [-2.2724241,57.0964537], featureType: 'parking', description: 'A council-named free off-street car park. The order does not publish capacity, accessible bays, maximum stay, overnight rules, surface or other restrictions.', website: urls.parkingOrder, sourceName: 'Aberdeen City Council off-street parking order', sourceOrganisation: 'Aberdeen City Council', evidenceUrls: [urls.parkingOrder, urls.councilParking], details: 'amenity=parking; capacity=Not published; capacity:disabled=Not published; fee=no; price_display=Free; payment_required=no; payment_methods=Not applicable; chargeable_hours=None; maxstay=Not published; overnight_parking=Not published; surface=Not published by council; restrictions=Check signs on arrival', tags: ['service-context-parking','current-context'] }),
  makeFeature({ id: 'curated-parking:peterculter-millside', placeType: 'Parking', name: 'Millside Car Park', coordinates: [-2.2694349,57.0958551], featureType: 'parking', description: 'A council-named free off-street car park. Capacity, accessible bays, maximum stay, overnight rules, surface and other restrictions are not published in the order.', website: urls.parkingOrder, sourceName: 'Aberdeen City Council off-street parking order', sourceOrganisation: 'Aberdeen City Council', evidenceUrls: [urls.parkingOrder, urls.councilParking], details: 'amenity=parking; capacity=Not published; capacity:disabled=Not published; fee=no; price_display=Free; payment_required=no; payment_methods=Not applicable; chargeable_hours=None; maxstay=Not published; overnight_parking=Not published; surface=Not published by council; restrictions=Check signs on arrival', tags: ['service-context-parking','current-context'] }),
];

const auditedFeatures = [...historicFeatures, robRoy, ...trails, ...foods, ...parking];
const auditedFeatureIds = new Set(auditedFeatures.map((feature) => feature.id));
pkg.features = [...auditedFeatures, ...pkg.features.filter((feature) => feature.tags.includes('hes-listed-building') && !auditedFeatureIds.has(feature.id))];
const highlights: VisitorHighlight[] = [church, robRoy].map((feature, index) => ({ rank: index + 1, featureId: feature.id, name: feature.name, reason: feature.editorialReview!.scoreRationale, tagline: index === 0 ? 'Local museum in the former church' : 'Community landmark above the wooded burn', visitorScore: index === 0 ? 76 : 70, timeToSpend: index === 0 ? '45–75 minutes' : '20–40 minutes', openingTimes: index === 0 ? 'Sundays 14:00–16:00, 3 May–27 September 2026, or by arrangement; check before travel' : 'Outdoor viewpoint; daylight and path conditions', admission: 'Free; donations welcome where offered', freeAdmission: true, visitorWebsiteUrl: feature.visitorWebsiteUrl, editorialReview: feature.editorialReview, sourceName: feature.sourceRecords[0].sourceName, sourceUrl: feature.visitorWebsiteUrl!, verifiedInBoundaryAt: reviewedDate }));

pkg.project.preferredBasemap = 'voyager';
pkg.project.boundary = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-2.2835,57.0918],[-2.2540,57.0918],[-2.2510,57.1050],[-2.2630,57.1075],[-2.2825,57.1030],[-2.2835,57.0918]]] } };
pkg.project.boundarySource = 'Explicit editorial settlement polygon bounded by the River Dee and compact Peterculter built-up area; Maryculter and outlying buffer records excluded';
pkg.project.boundaryConfidence = 'medium';
pkg.project.touristAppeal = { score: 68, dogOwnerScore: 67, dogAccessScoreAdjustment: -1, rating: 0, label: 'Notable Stop', summary: 'A worthwhile Deeside village stop with a real local museum, a distinctive burn landmark, strong self-guided walks and two useful café-and-bakery choices.', dogAccessRating: 2, dogAccessSummary: 'Outdoor paths and the explicitly dog-friendly Neil Selbie Coffee Shop make a dog visit practical, but museum access is unconfirmed, Crust has no published policy and burn or long-distance paths require close control.', methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = highlights;
pkg.project.townGuide = { characterTag: 'Deeside path village with mill and burn heritage', headline: 'A local-history museum, wooded burn and unusually useful walking network', intro: 'Peterculter is a 68% Notable Stop on its own merits. The compact visit combines St Peter’s Heritage Centre, the Rob Roy landmark, Kennerty’s mill landscape and several genuine village walks; attractions south of the Dee or outside the settlement do not inflate the score.', bestFor: ['Local and industrial history','Coffee and cake','Woodland and railway-path walks','A compact half-day stop'], perfectFor: ['A 2–4 hour village visit','A museum-and-walk afternoon'], suggestedFirstVisit: { title: 'Start at St Peter’s, then follow the burn', summary: 'Visit the Heritage Centre when open, continue to Rob Roy and Kennerty, then return for coffee, scones or bakery pastries.' }, dontMiss: ['St Peter’s Heritage Centre','Rob Roy Statue and Culter Burn','Culter Explorer Heritage Walks'], suggestedTime: '2–4 hours; longer for a Deeside Way extension', visitorMood: 'A modest but coherent village whose strongest experiences are local history and accessible-from-town paths.', practicalNote: 'St Mary’s Place and Millside are free council-named car parks, but capacities, accessible spaces, maximum stay, overnight rules and surfaces are not published. No verified public toilet or formal picnic site was found inside the audited settlement.', transportNote: 'Peterculter lies on the North Deeside Road bus corridor; check current operator or Traveline information before travel.', accessibilityNote: 'The village centre is compact, but burn paths, woodland approaches and heritage routes have variable surfaces and gradients. The museum occupies a historic building; ask the operator about access needs.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate } as any;
pkg.project.townStudyArea = { localityName: 'Peterculter', sourceName: 'Peterculter full visitor audit', sourceUrl: urls.paths, sourceVersion: reviewedDate, bufferMetres: 0, localityBoundary: pkg.project.boundary, bufferedBoundary: pkg.project.boundary, notes: 'A manually reviewed visitor-study polygon for the compact settlement north of the River Dee. Maryculter, Belskavie Tower and Waulkmill Bridge are outside it; this is not an administrative boundary.' };

planner.projects[projectId] = { eat: foods.map((feature) => feature.id), trails: trails.map((feature) => feature.id), parking: parking.map((feature) => feature.id), toilets: [], picnic: [] };
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [church.id]: { rating: 1, status: 'unknown', label: 'Churchyard practical; museum dog policy unconfirmed', summary: 'Keep dogs on a short lead in the active churchyard and do not assume pet-dog access inside the Heritage Centre.', sourceName: 'Separate St Peter’s dog-access search', sourceUrl: urls.heritageCentre, reviewedAt: reviewedDate },
    [robRoy.id]: { rating: 2, status: 'allowed_with_conditions', label: 'Outdoor burn stop with close control', summary: 'Dogs can use public paths, but close control is needed beside water, wildlife, steep edges and other walkers.', sourceName: 'Rob Roy route and Scottish Outdoor Access Code review', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
  },
  trail: Object.fromEntries(trails.map((feature) => [feature.id, { rating: 2, status: 'allowed_with_conditions', label: 'Dog-suitable paths with close control', summary: 'Keep dogs close around water, wildlife, livestock, roads and other path users; obey any temporary closure.', sourceName: 'Route evidence and Scottish Outdoor Access Code', sourceUrl: feature.id.endsWith('deeside-way') ? urls.deesideWay : urls.outdoorCode, reviewedAt: reviewedDate }])),
  eat: {
    [foods[0].id]: { rating: 3, status: 'allowed', label: 'Explicitly dog friendly', summary: 'The operator explicitly describes the coffee shop as dog friendly.', sourceName: 'Neil Selbie Coffee Shop dog-policy search', sourceUrl: urls.neilSelbie, reviewedAt: reviewedDate },
    [foods[1].id]: { rating: 1, status: 'unknown', label: 'Dog policy not established', summary: 'No reliable current operator statement was found; confirm before entering.', sourceName: 'Separate Crust dog-policy search', sourceUrl: urls.crust, reviewedAt: reviewedDate },
  },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Peterculter audit introduced ${errors.length} validation error(s): ${errors.map((item) => item.message).join('; ')}`);
const visibleHistoricPins = pkg.features.filter((feature) => feature.tags.some((tag: string) => ['hes-listed-building','hes-scheduled-monument'].includes(tag)) && !feature.tags.includes('map-hidden'));
const undated = visibleHistoricPins.filter((feature) => !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null);
if (undated.length) throw new Error(`Undated Peterculter historic pins: ${undated.map((feature) => feature.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(reportPath, `${JSON.stringify({
  reviewedAt, townScore: 68, dogOwnerScore: 67, dogAccessRating: 2,
  publicationRule: 'Only independently assessed 60+ visitor places are published; private, cross-river and buffer-only places do not inflate the town score.',
  categoryCounts: { see: highlights.length, eat: foods.length, trails: trails.length, picnic: 0, parking: parking.length, toilets: 0, heritage: visibleHistoricPins.length },
  attractions: highlights.map((item) => ({ name: item.name, score: item.visitorScore, published: true })),
  food: [{ name: foods[0].name, score: 76, dogPolicy: 'Operator explicitly says dog friendly' }, { name: foods[1].name, score: 70, dogPolicy: 'No reliable policy found' }],
  trails: trails.map((feature, index) => ({ name: feature.name, score: [72,68,66][index], url: feature.visitorWebsiteUrl, linkCheck: 'HTTP 200 on 2026-08-27' })),
  trailProviderSearches: [
    { provider: 'TreasureTrails.co.uk', result: 'No exact Peterculter or Culter trail found; Aberdeenshire collection page checked and returned HTTP 200.' },
    { provider: 'Curious About', result: 'No exact Peterculter or Culter route found; provider returned HTTP 200.' },
    { provider: 'Mystery Guides', result: 'No exact Peterculter or Culter guide found; provider returned HTTP 200.' },
    { provider: 'Go Quest Adventures', result: 'No exact Peterculter or Culter quest found; provider returned HTTP 200.' },
    { provider: 'Culter Community Council', result: 'Exact-town Culter Explorer and community-path PDFs found; both returned HTTP 200.' },
    { provider: 'VisitAberdeenshire', result: 'Deeside Way page found and returned HTTP 200; current Peterculter fallen-tree closure warning retained.' },
  ],
  facilities: {
    parking: parking.map((feature) => ({ name: feature.name, capacity: 'Not published', disabledSpaces: 'Not published', price: 'Free', paymentMethods: 'Not applicable', chargeableHours: 'None', maxStay: 'Not published', overnight: 'Not published', surface: 'Not published by council', source: feature.visitorWebsiteUrl })),
    toilets: { result: 'No verified council public toilet or Changing Places facility found inside the audited Peterculter settlement. Customer toilets are not presented as public facilities.' },
    picnic: { result: 'No formal in-boundary picnic site or verified picnic-table count found. Crombie Park and path edges are not labelled as formal picnic facilities.' },
    transport: { result: 'North Deeside Road bus corridor retained as context; current journey details must be checked before travel.' },
  },
  heritageDateAudit: { importedCandidates: 14, visiblePins: visibleHistoricPins.length, dated: visibleHistoricPins.length - undated.length, undated: undated.map((feature) => feature.id), mergedDuplicates: ['LB15712 churchyard and LB19753 church presented as one visitor pin'], excludedCrossRiver: ['LB16496 Maryculter House Hotel','LB16499 Maryculter Old Manse'], excludedBuffer: ['LB3078 Belskavie Tower','LB15720 Waulkmill Bridge'], dateRule: 'Construction dates and periods come from HES descriptions; statutory designation dates are excluded.' },
  exclusions: ['Maryculter House Hotel and Maryculter Old Manse are south of the River Dee and outside Peterculter.', 'Belskavie Tower and Waulkmill Bridge are outside the strict compact-settlement polygon.', 'Culter House, its garden structures and Kennerty private buildings remain dated context pins but are not scored attractions.', 'Easter Anguston Farm and Blossom Café use a Peterculter postal address but are outside the audited settlement and do not inflate its score.', 'No capacity, accessible-bay count, maximum stay, overnight rule, toilet, picnic-table count or unverified dog policy is invented.'],
  linksChecked: [urls.robRoy,urls.explorer,urls.paths,urls.deesideWay,urls.neilSelbie,urls.crust,urls.treasureTrails,urls.curiousAbout,urls.mysteryGuides,urls.goQuest].map((url) => ({ url, status: 200, checkedAt: reviewedAt })),
  linkExceptions: [{ url: urls.heritageCentre, result: 'Current page was browser-indexed and content reviewed; direct PowerShell TLS check failed, so current hours should be rechecked with the operator before travel.' }],
  verification: { heritagePinsDated: `${visibleHistoricPins.length - undated.length}/${visibleHistoricPins.length}`, undatedHistoricPins: undated.length },
}, null, 2)}\n`, 'utf8');

console.log(`Peterculter full audit complete: ${highlights.length} See, ${foods.length} Eats, ${trails.length} Trails, no formal picnic site, ${parking.length} parking areas, no verified public toilet; ${visibleHistoricPins.length - undated.length}/${visibleHistoricPins.length} visible historic pins dated.`);
