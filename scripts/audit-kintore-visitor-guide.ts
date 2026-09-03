import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectId = 'kintore-scotland';
const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T23:30:00Z';
const projectPath = resolve('data/projects/kintore.json');
const plannerPath = resolve('data/aberdeen-north-visitor-planner-curation.json');
const dogPath = resolve('data/aberdeen-north-dog-access-curation.json');
const reportPath = resolve('data/review/kintore-full-visitor-audit-2026-08-27.json');

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: MutableFeature[] };

const urls = {
  destination: 'https://www.visitabdn.com/plan-your-trip/towns-villages/kintore/',
  community: 'https://kintore.org.uk/the-history-of-kintore',
  townHouse: 'https://portal.historicenvironment.scot/designation/LB36312',
  townHouseStatement: 'https://docs.planning.org.uk/20250421/168/SUV1CACALYL00/hqvifdeefez0e4ag.pdf',
  church: 'https://portal.historicenvironment.scot/designation/LB36310',
  churchHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB18203',
  pictishStone: 'https://portal.historicenvironment.scot/designation/SM76',
  pictishTrail: 'https://publications.aberdeenshire.gov.uk/acblobstorage/cd65f650-20f1-43ab-8dae-efbf5465c121/2022pictishstonetrail.pdf',
  walking: 'https://publications.aberdeenshire.gov.uk/acblobstorage/27660f59-0c7d-4ec6-9dcd-ecdb4791453a/kintore_walking_routes.pdf',
  goosecroft: 'https://portal.historicenvironment.scot/designation/LB36311',
  kintoreArms: 'https://portal.historicenvironment.scot/designation/LB36313',
  lodge: 'https://portal.historicenvironment.scot/designation/LB36314',
  lodgeGate: 'https://portal.historicenvironment.scot/designation/LB36315',
  bridge: 'https://portal.historicenvironment.scot/designation/LB36316',
  bridgeCanmore: 'https://canmore.org.uk/site/18650/kintore-don-bridge',
  bridgend: 'https://portal.historicenvironment.scot/designation/LB49868',
  cafeCouncil: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  crafty: 'https://www.restaurantji.co.uk/scotland/kintore/crafty-caf-/',
  hummingbird: 'https://www.tripadvisor.co.uk/Restaurant_Review-g7208090-d21392783-Reviews-Hummingbird_Cafe-Kintore_Aberdeenshire_Scotland.html',
  hummingbirdLaunch: 'https://www.agcc.co.uk/news-article/aberdeenshire-businesswomen-open-new-cafe-in-kintore',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  station: 'https://www.scotrail.co.uk/plan-your-journey/stations-and-facilities/ktr',
  stationLaunch: 'https://www.transport.gov.scot/news/rail-services-returning-to-kintore-after-almost-60-years/',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/aberdeenshire',
  curiousAbout: 'https://curiousabout.co.uk/',
  mysteryGuides: 'https://www.mysteryguides.co.uk/',
  goQuest: 'https://goquestadventures.com/',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  osm: 'https://www.openstreetmap.org/copyright',
};

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as any;
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as any;

const assessment = (score: number) => ({
  experienceDepth: Math.round(score * .30), distinctiveness: Math.round(score * .20),
  presentation: Math.round(score * .20), journeyWorth: Math.round(score * .15),
  accessAndReliability: Math.round(score * .10), evidenceConfidence: score - Math.round(score * .95),
  visitability: 'full_visitor_experience' as const,
});

const foodAssessment = (score: number) => {
  const result = { foodAndDrinkQuality: Math.round(score * .29), daytimeRelevance: Math.round(score * .21), distinctiveness: Math.round(score * .15), consistency: Math.round(score * .14), visitorFit: Math.round(score * .11), evidenceConfidence: 0 };
  result.evidenceConfidence = score - Object.values(result).reduce((sum, value) => sum + value, 0);
  return result;
};

const source = (name: string, organisation: string, url: string, notes: string, reliability: any = 'official_non_statutory') => ({
  sourceName: name, sourceOrganisation: organisation, sourceUrl: url, accessedAt: reviewedAt,
  reliability, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', notes,
});

const makeFeature = (spec: Record<string, any>): MutableFeature => {
  const category = spec.category;
  const review: any = category === 'food' ? {
    status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: spec.reason, evidenceUrls: spec.evidenceUrls,
    foodAssessment: foodAssessment(spec.score),
  } : category === 'attraction' || category === 'trail' ? {
    status: 'editorially_researched', category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: spec.reason, evidenceUrls: spec.evidenceUrls, attractionAssessment: assessment(spec.score),
  } : undefined;
  const notes = spec.notes ?? `Current-place curation: visitor_place_type=${spec.placeType}; ${spec.score ? `visit_score=${spec.score};` : ''} ${spec.details}; description=${spec.tagline ? `${spec.tagline}: ` : ''}${spec.description}`;
  return {
    id: spec.id, projectId, name: spec.name, alternativeNames: spec.alternativeNames ?? [], countryCode: 'GB-SCT', region: 'Aberdeenshire', locality: 'Kintore',
    featureType: spec.featureType, designationType: spec.designationType, designationCategory: spec.designationCategory, statutoryStatus: spec.statutoryStatus,
    significance: spec.significance ?? 'local', geometry: { type: 'Point', coordinates: spec.coordinates }, locationType: spec.locationType ?? 'exact',
    documentedDateText: spec.documentedDateText, earliestPossibleYear: spec.earliestPossibleYear, latestPossibleYear: spec.latestPossibleYear,
    datePrecision: spec.datePrecision, dateBasis: spec.dateBasis ?? 'unknown', dateConfidence: spec.dateConfidence ?? (spec.documentedDateText ? 'high' : 'unknown'),
    locationConfidence: spec.locationConfidence ?? 'high', survival: spec.survival ?? 'substantially_intact', shortDescription: spec.description,
    fullDescription: spec.fullDescription, visitorWebsiteUrl: spec.website, attractionGuide: spec.guide, editorialReview: review,
    sourceRecords: spec.evidenceUrls.map((url: string, index: number) => source(index ? `${spec.name} supporting evidence` : spec.sourceName, index ? 'Supporting publisher' : spec.sourceOrganisation, url, index ? 'Supporting current visitor, access or dating evidence.' : notes, url.includes('historicenvironment.scot') ? 'official_statutory' : url.includes('aberdeenshire.gov.uk') ? 'local_authority' : 'official_non_statutory')),
    tags: spec.tags, createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: spec.evidenceScope ?? 'parish_evidence',
  } as MutableFeature;
};

const attractions = [
  makeFeature({
    id: 'curated-attraction:kintore-town-house', category: 'attraction', placeType: 'Attraction', name: 'Kintore Town House', score: 74,
    coordinates: [-2.3455944, 57.2370926], featureType: 'civic_building', significance: 'national', designationType: 'listed_building', designationCategory: 'A', statutoryStatus: 'designated',
    documentedDateText: 'Work began in 1737; completed in 1747', earliestPossibleYear: 1737, latestPossibleYear: 1747, datePrecision: 'year_range', dateBasis: 'documented_date_range',
    description: 'Kintore’s arcaded granite civic landmark, completed in 1747 with a clock tower, external stairs and former burgh rooms.',
    fullDescription: 'The Category A Town House anchors The Square. Its exterior, clock and fountain make a compact public-realm visit; the proposed former-jail exhibition is not treated as a dependable interior attraction until it opens.',
    reason: 'A handsome, nationally listed and well-documented burgh landmark with a clear public setting, reduced because the interior visitor offer is not yet dependable.',
    website: urls.townHouse, sourceName: 'Kintore Town House, LB36312', sourceOrganisation: 'Historic Environment Scotland', evidenceUrls: [urls.townHouse, urls.townHouseStatement, urls.community],
    details: 'opening_hours:description=Exterior visible at all times; interior visitor opening not established; fee=Free exterior; dog_friendly=Outdoor square only',
    tags: ['curated-visitor', 'home-standalone-place', 'hes-listed-building'],
    guide: { headline: 'Read 18th-century burgh life in stone', intro: 'Start in The Square for the clock tower, paired external stairs and fountain. Treat the building as an exterior landmark unless a current event advertises interior access.', bestFor: ['Civic history', 'Architecture', 'Photography'], parking: 'The Square has 15 free spaces and one disabled space; no payment is needed.', toilets: 'The Crafty Café comfort partnership toilet is free to use without a purchase during its published seasonal hours.', picnic: 'No verified formal picnic tables in the town centre; use public seating and take litter away.', foodNote: 'The Crafty Café is beside The Square; Hummingbird Café is in southern Kintore.' },
  }),
  makeFeature({
    id: 'curated-attraction:kintore-parish-church-pictish-stone', category: 'attraction', placeType: 'Attraction', name: 'Kintore Parish Church and Pictish Stone', score: 76,
    coordinates: [-2.3442261, 57.2368940], featureType: 'church', significance: 'national', designationType: 'listed_building_and_scheduled_monument', designationCategory: 'B / SM76', statutoryStatus: 'designated',
    documentedDateText: 'Pictish stone: late Iron Age/Pictish period (about AD 300–900), reset in 1854; church built 1819 with a circa-1528 sacrament house', earliestPossibleYear: 300, latestPossibleYear: 1854, datePrecision: 'multi_period', dateBasis: 'documented_date_range', dateConfidence: 'medium',
    description: 'An 1819 Archibald Simpson churchyard containing a nationally important Pictish symbol stone and an earlier sacrament house.',
    fullDescription: 'The scheduled symbol stone is an outdoor churchyard highlight from the later Iron Age/Pictish world. The present church was built in 1819 and preserves a circa-1528 sacrament house from its predecessor.',
    reason: 'The strongest concentrated heritage experience in Kintore: a nationally important Pictish stone, dated Georgian church and earlier church fabric in one accessible churchyard setting.',
    website: urls.pictishStone, sourceName: 'Kintore church and symbol stone designations', sourceOrganisation: 'Historic Environment Scotland', evidenceUrls: [urls.pictishStone, urls.church, urls.churchHer, urls.pictishTrail],
    details: 'opening_hours:description=Churchyard open-air; church interior opening not established; fee=Free; dog_friendly=Churchyard on a short lead, respecting graves',
    tags: ['curated-visitor', 'home-standalone-place', 'hes-listed-building', 'hes-scheduled-monument'],
    guide: { headline: 'Find Pictish Kintore beside its Georgian church', intro: 'Look for the carved stone in the churchyard, then compare the 1819 church with its older sacrament house. The churchyard is a place of burial and worship.', bestFor: ['Pictish art', 'Church architecture', 'Local history'], parking: 'The Square car park is a very short walk away.', toilets: 'Use the nearby comfort partnership toilet during its published hours.', picnic: 'This is a burial ground, not a picnic site.', foodNote: 'The Crafty Café is nearby.' },
  }),
];

const route = makeFeature({
  id: 'curated-trails:kintore-walking-routes', category: 'trail', placeType: 'Walking route', name: 'Kintore Walking and Cycling Routes', score: 72,
  coordinates: [-2.3455269, 57.2369921], featureType: 'walking_route', locationType: 'representative_point',
  description: 'Four council-mapped routes start at the Town House or library: 1.12 km, 3.09 km, 3.79 km and 5.35 km.',
  fullDescription: 'The official map gives three useful town circuits and a longer 5.35 km Hallforest Castle route. The castle lies outside the audited town boundary, so it is route context and does not increase Kintore’s town score.',
  reason: 'A useful official map with four exact distances and coherent town-centre starts, reduced because it gives no individual durations beyond map walking-time estimates and the longest route leaves the town boundary.',
  website: urls.walking, sourceName: 'Kintore Walking and Cycling Routes', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.walking],
  details: 'route=foot and cycle; trail_type=Four mapped local circuits; distances=1.12 km, 3.09 km, 3.79 km and 5.35 km; duration=About 15, 40, 50 and 70 minutes at the map walking pace; difficulty=Urban pavements, paths and field-edge sections; fee=Free; dog_friendly=Yes with road, livestock and wildlife close control',
  tags: ['curated-visitor', 'service-context-trail', 'visitor-context-trail', 'current-context'],
});

const foods = [
  makeFeature({ id: 'curated-eat:kintore-crafty-cafe', category: 'food', placeType: 'Eat', name: 'The Crafty Café', score: 69, coordinates: [-2.34493, 57.23736], featureType: 'commercial_building', tagline: 'Coffee, cake and light lunches', description: 'A small town-centre café for coffee, cake, scones, soup, sandwiches and light lunches; it also hosts Kintore’s comfort-partnership toilet.', reason: 'A very useful cafe-led stop beside the heritage core with current council confirmation and a current secondary menu profile, reduced for limited first-party operating information and no verified operator dog policy.', website: urls.cafeCouncil, sourceName: 'The Crafty Café comfort partnership and café listing', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.cafeCouncil, urls.crafty], details: 'amenity=cafe; food_score=69; cuisine=Coffee, cakes, scones, soup, sandwiches and light lunches; opening_hours:description=Monday-Friday 10:00-16:00, Saturday 10:00-14:00, Sunday closed in the current secondary listing; dog_friendly=Visitor reports indicate dogs welcomed, but no current operator policy was found; price_band=££', tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'] }),
  makeFeature({ id: 'curated-eat:kintore-hummingbird-cafe', category: 'food', placeType: 'Eat', name: 'Hummingbird Café', score: 71, coordinates: [-2.34719, 57.22662], featureType: 'commercial_building', locationType: 'approximate', locationConfidence: 'medium', tagline: 'Coffee, homebakes and light lunches', description: 'Independent Midmill café for coffee, handmade cakes, breakfast and light lunches, with indoor and outdoor seating.', reason: 'A strong cafe-led match with current reviews and a documented local-business launch, reduced because hours and dog access rely on current managed or secondary listings rather than a complete operator page.', website: urls.hummingbird, sourceName: 'Hummingbird Café current listing', sourceOrganisation: 'Tripadvisor', evidenceUrls: [urls.hummingbird, urls.hummingbirdLaunch], details: 'amenity=cafe; food_score=71; cuisine=Coffee, handmade cakes, breakfast and light lunches; opening_hours:description=Tuesday-Thursday 09:00-16:30, Friday 09:00-19:00, Saturday 09:00-16:30, Sunday-Monday closed; dog_friendly=Current managed listing marks dog-friendly, with older review evidence for outdoor/gazebo seating; do not assume indoor dog access; price_band=££', tags: ['curated-visitor', 'service-context-food', 'visitor-context-food', 'current-context'] }),
];

const facilities = [
  makeFeature({ id: 'curated-parking:kintore-square', placeType: 'Parking', name: 'The Square Car Park', coordinates: [-2.34518, 57.23706], featureType: 'parking', description: 'Central council car park with 15 free spaces and one disabled space, accessible at all times unless used for a specific event.', website: urls.parking, sourceName: 'Kintore council car parks', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.parking], details: 'amenity=parking; access=public; capacity=15; capacity:disabled=1; fee=no; price_display=Free; payment_required=no; payment_methods=Not applicable; maxstay=Not published; overnight_parking=Not published', tags: ['service-context-parking', 'current-context'] }),
  makeFeature({ id: 'curated-parking:kintore-station', placeType: 'Parking', name: 'Kintore Railway Station Car Park', coordinates: [-2.35021, 57.24336], featureType: 'parking', description: 'Free station parking with 168 spaces, 12 accessible spaces, CCTV, 24 EV charging bays and 48 sheltered cycle spaces.', website: urls.station, sourceName: 'Kintore station facilities', sourceOrganisation: 'ScotRail', evidenceUrls: [urls.station, urls.stationLaunch], details: 'amenity=parking; access=rail passengers; capacity=168; capacity:disabled=12; fee=no; price_display=Free; payment_required=no; payment_methods=Not applicable; ev_charging=24 bays; bicycle_parking=48 sheltered spaces; maxstay=Not published; overnight_parking=Not published; step_free_access=All platforms; toilets=no; staffed=no; ticket_machine=yes', tags: ['service-context-parking', 'current-context'] }),
  makeFeature({ id: 'curated-toilets:kintore-crafty-cafe', placeType: 'Public toilets', name: 'The Crafty Café Comfort Partnership Toilet', coordinates: [-2.34493, 57.23736], featureType: 'toilets', description: 'Free public-use toilet at 1 Deans Court, with no purchase expected: April-September 8am-8pm and October-March 8am-6pm, excluding standard festive closures.', website: urls.toilets, sourceName: 'Kintore public toilets', sourceOrganisation: 'Aberdeenshire Council', evidenceUrls: [urls.toilets], details: 'amenity=toilets; access=public; fee=no; purchase_required=no; opening_hours:description=April-September 08:00-20:00, October-March 08:00-18:00; closed 25-26 December and 1-2 January; wheelchair=Not specified; baby_changing=Not specified; changing_places=no Kintore facility listed', tags: ['service-context-toilets', 'current-context'] }),
];

const heritage = [
  makeFeature({ id: 'hes-listed-building:kintore-lb36311', placeType: 'Heritage', name: 'Goosecroft House', coordinates: [-2.3465077, 57.2373236], featureType: 'house', designationType: 'listed_building', designationCategory: 'B', statutoryStatus: 'designated', significance: 'regional', documentedDateText: 'Built circa 1784; later additions', earliestPossibleYear: 1779, latestPossibleYear: 1789, datePrecision: 'circa_year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', description: 'A late-18th-century house contributing to the historic Square, with later additions.', website: urls.goosecroft, sourceName: 'Goosecroft House, LB36311', sourceOrganisation: 'Historic Environment Scotland', evidenceUrls: [urls.goosecroft, urls.townHouseStatement], details: 'designation=LB36311; date=circa 1784 with later additions', tags: ['hes-listed-building'] }),
  makeFeature({ id: 'hes-listed-building:kintore-lb36313', placeType: 'Heritage', name: 'Former Kintore Arms', coordinates: [-2.3454581, 57.2366887], featureType: 'commercial_building', designationType: 'listed_building', designationCategory: 'C', statutoryStatus: 'designated', significance: 'local', documentedDateText: 'Early 19th century', earliestPossibleYear: 1800, latestPossibleYear: 1839, datePrecision: 'early_century', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium', description: 'An early-19th-century former inn frontage in the historic town centre.', website: urls.kintoreArms, sourceName: 'Kintore Arms, LB36313', sourceOrganisation: 'Historic Environment Scotland', evidenceUrls: [urls.kintoreArms], details: 'designation=LB36313; date=early 19th century', tags: ['hes-listed-building'] }),
  makeFeature({ id: 'hes-listed-building:kintore-lb36314-lb36315', placeType: 'Heritage', name: 'Kintore Lodge, Gates and Boundary Wall', coordinates: [-2.3391244, 57.2343075], featureType: 'house', designationType: 'listed_building', designationCategory: 'B / C', statutoryStatus: 'designated', significance: 'regional', documentedDateText: 'Lodge circa 1800; associated gates and wall separately listed but not independently dated by HES', earliestPossibleYear: 1790, latestPossibleYear: 1810, datePrecision: 'circa_year', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low', description: 'A circa-1800 lodge with its separately listed gatepiers and boundary wall, merged as one map pin to avoid duplication.', website: urls.lodge, sourceName: 'Kintore Lodge and associated structures, LB36314/LB36315', sourceOrganisation: 'Historic Environment Scotland', evidenceUrls: [urls.lodge, urls.lodgeGate], details: 'designations=LB36314 and LB36315; date=circa 1800 for principal lodge; HES does not separately date the associated gates and wall', tags: ['hes-listed-building'] }),
  makeFeature({ id: 'hes-listed-building:kintore-lb36316', placeType: 'Heritage', name: 'Kintore Bridge', coordinates: [-2.3391907, 57.2361219], featureType: 'bridge', designationType: 'listed_building', designationCategory: 'B', statutoryStatus: 'designated', significance: 'regional', documentedDateText: 'Built in 1882; opened in 1883', earliestPossibleYear: 1882, latestPossibleYear: 1883, datePrecision: 'year_range', dateBasis: 'documented_date_range', dateConfidence: 'high', description: 'James Abernethy & Co’s 1882 iron bridge over the Don, opened in 1883 and replaced as a road crossing in the 1980s.', website: urls.bridgeCanmore, sourceName: 'Kintore Don Bridge', sourceOrganisation: 'Historic Environment Scotland / Canmore', evidenceUrls: [urls.bridge, urls.bridgeCanmore, urls.community], details: 'designation=LB36316; engineer=James Abernethy & Co, Aberdeen; construction=1882; opening=1883', tags: ['hes-listed-building'] }),
  makeFeature({ id: 'hes-listed-building:kintore-lb49868', placeType: 'Heritage', name: 'Bridgend Historic Group', coordinates: [-2.3512664, 57.2412270], featureType: 'house', designationType: 'listed_building', designationCategory: 'C', statutoryStatus: 'designated', significance: 'local', documentedDateText: 'Early 19th-century origins; later 19th-century reworking', earliestPossibleYear: 1800, latestPossibleYear: 1899, datePrecision: 'century', dateBasis: 'documented_date_range', dateConfidence: 'medium', description: 'A four-part listed roadside group with early-19th-century origins and later reworking, shown as one designation pin.', website: urls.bridgend, sourceName: 'Bridgend group, LB49868', sourceOrganisation: 'Historic Environment Scotland', evidenceUrls: [urls.bridgend], details: 'designation=LB49868; date=early 19th-century origin with later 19th-century reworking; four HES component points merged into one pin', tags: ['hes-listed-building'] }),
];

const auditedFeatures = [...attractions, route, ...foods, ...facilities, ...heritage];
const auditedFeatureIds = new Set(auditedFeatures.map((feature) => feature.id));
pkg.features = [...auditedFeatures, ...pkg.features.filter((feature) => feature.tags.includes('hes-listed-building') && !auditedFeatureIds.has(feature.id))];

// The seed used a generic 720 m circle around the place node. The full audit uses a
// transparent hand-curated study polygon around the continuous built-up settlement,
// including Midmill and the station but excluding detached rural visitor businesses.
pkg.project.boundary = {
  type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[
    [-2.3580, 57.2450], [-2.3470, 57.2470], [-2.3370, 57.2420], [-2.3340, 57.2340],
    [-2.3390, 57.2240], [-2.3520, 57.2230], [-2.3570, 57.2290], [-2.3600, 57.2380],
    [-2.3580, 57.2450],
  ]] },
};

const highlights: VisitorHighlight[] = attractions.map((feature, index) => ({
  rank: index + 1, featureId: feature.id, name: feature.name, reason: feature.editorialReview.scoreRationale,
  tagline: index ? 'Pictish stone and layered church history' : '1747 burgh landmark in The Square',
  visitorScore: index ? 76 : 74, timeToSpend: '20-45 minutes', openingTimes: index ? 'Churchyard open-air; church interior opening not established' : 'Exterior visible at all times; interior visitor opening not established',
  admission: 'Free exterior visit', freeAdmission: true, visitorWebsiteUrl: feature.visitorWebsiteUrl,
  editorialReview: feature.editorialReview, sourceName: feature.sourceRecords[0].sourceName, sourceUrl: feature.sourceRecords[0].sourceUrl!, verifiedInBoundaryAt: reviewedDate,
}));

pkg.project.preferredBasemap = 'voyager';
pkg.project.boundarySource = 'Curated Kintore settlement study boundary covering the continuous town, Midmill and station; nearby rural attractions remain excluded.';
pkg.project.boundaryConfidence = 'medium';
pkg.project.researchNotes = 'The original generic 720 m seed circle was replaced during the full audit by a transparent study polygon around the continuous Kintore built-up area. This is an editorial visitor-study boundary, not an administrative boundary.';
pkg.project.touristAppeal = { score: 68, dogOwnerScore: 65, dogAccessScoreAdjustment: -3, rating: 0, label: 'Notable Stop', summary: 'A compact royal-burgh heritage stop with a Pictish stone, 1747 Town House, four official local routes and two useful cafes.', dogAccessRating: 2, dogAccessSummary: 'Outdoor heritage and town routes work with a dog, but roads, churchyard etiquette, wildlife and unverified or outdoor-only café access reduce the dog-owner score.', methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.visitorHighlights = highlights;
pkg.project.townGuide = {
  characterTag: 'Pictish stone and 18th-century royal-burgh square', headline: 'A layered Garioch heritage stop with useful local circuits',
  intro: 'Kintore earns 68 inside its own settlement: the 1747 Town House and fountain face an 1819 churchyard with a nationally important Pictish stone, while four council routes, two cafes, complete central parking and a public-use toilet make a coherent short visit.',
  bestFor: ['Pictish heritage', 'Civic architecture', 'Short local walks', 'Coffee and cake'], perfectFor: ['A focused 2-3 hour heritage stop', 'A rail-accessible short visit'],
  suggestedFirstVisit: { title: 'Begin in The Square', summary: 'Compare the Town House and fountain, cross to the churchyard and Pictish stone, then choose the 1.12 km or 3.09 km council circuit.' },
  dontMiss: ['Kintore Parish Church and Pictish Stone', 'Kintore Town House', 'Kintore Walking and Cycling Routes'], suggestedTime: '2-3 hours; longer for the 5.35 km route',
  visitorMood: 'A notable heritage stop rather than a destination town: strongest as a compact square, churchyard, café and walk combination.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate,
};
pkg.project.visualIdentity = { theme: 'kintore-town-house-square', badgeImage: '/town-guides/kintore-town-house-fountain-guide-v1.png', badgeAlt: 'Illustrated view of Kintore Town House and fountain in a calm stone-paved square', heroImage: '/town-guides/kintore-town-house-fountain-guide-v1.png', heroAlt: 'Warm visitor-guide illustration of the 18th-century Kintore Town House, clock tower and fountain', heroObjectPosition: '50% 47%', motifs: ['Clock tower', 'Granite stairs', 'Town fountain', 'Leafy square'], primaryColour: '#294D52', accentColour: '#A66D1C', backgroundColour: '#EDF2E9' };

planner.projects[projectId] = { eat: foods.map((x) => x.id), trails: [route.id], parking: facilities.filter((x) => x.id.includes('parking')).map((x) => x.id), toilets: facilities.filter((x) => x.id.includes('toilets')).map((x) => x.id), picnic: [] };
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [attractions[0].id]: { rating: 2, status: 'restricted', label: 'Outdoor civic landmark', summary: 'Dogs can share the public square on a lead; no indoor access is claimed.', sourceName: 'Kintore audit and Scottish Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [attractions[1].id]: { rating: 2, status: 'restricted', label: 'Churchyard visit with respectful close control', summary: 'Use a short lead, keep off graves and prevent fouling; no church-interior dog access is claimed.', sourceName: 'Historic Environment Scotland and Scottish Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [route.id]: { rating: 2, status: 'restricted', label: 'Public routes with urban and field-edge controls', summary: 'Dogs can use the routes, with a short lead beside roads and reliable close control around wildlife, livestock and other users.', sourceName: 'Aberdeenshire Council and Scottish Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
  },
  eat: {
    [foods[0].id]: { rating: 2, status: 'restricted', label: 'Visitor reports indicate dogs are welcomed', summary: 'Current visitor reporting indicates dogs have been welcomed, but no current operator policy defines the seating areas; confirm before relying on indoor access.', sourceName: 'Separate Kintore dog-access search', sourceUrl: urls.crafty, reviewedAt: reviewedDate },
    [foods[1].id]: { rating: 2, status: 'restricted', label: 'Dog-friendly listing; outdoor evidence only', summary: 'The current listing marks the café dog-friendly and older visitor evidence confirms outdoor or gazebo seating. Indoor dog access is not claimed.', sourceName: 'Hummingbird Café current listing', sourceUrl: urls.hummingbird, reviewedAt: reviewedDate },
  },
};

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Kintore audit introduced ${errors.length} validation error(s): ${errors.map((item) => item.message).join('; ')}`);
const visibleHistoricPins = pkg.features.filter((item) => item.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument'].includes(tag)));
const undated = visibleHistoricPins.filter((item) => !item.documentedDateText?.trim());
if (undated.length) throw new Error(`Undated Kintore historic pins: ${undated.map((item) => item.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(reportPath, `${JSON.stringify({
  reviewedAt, townScore: 68, dogOwnerScore: 65, dogAccessRating: 2, publicationRule: 'Only visitor places scoring 60 or more are published; facilities are included for planning and do not inflate the town score.',
  boundary: { result: 'Continuous Kintore settlement only', included: ['Historic centre', 'Midmill', 'Kintore station'], excluded: ['Hallforest Castle', 'Marshalls Farm Shop', "Deer's Den scheduled archaeology", 'Tuach Hill', 'wider Garioch attractions'] },
  attractions: highlights.map((x) => ({ name: x.name, score: x.visitorScore, published: true })),
  food: [{ name: foods[0].name, score: 69, dogRating: 2 }, { name: foods[1].name, score: 71, dogRating: 2 }],
  trails: [{ name: route.name, score: 72, routes: [{ distance: '1.12 km', duration: 'about 15 minutes' }, { distance: '3.09 km', duration: 'about 40 minutes' }, { distance: '3.79 km', duration: 'about 50 minutes' }, { distance: '5.35 km', duration: 'about 70 minutes', boundaryNote: 'Hallforest Castle lies outside the town boundary and contributes no town score' }], accessibility: 'Mixed pavements, road crossings, park paths and field-edge sections; no step-free guarantee is published.', dogRating: 2 }],
  trailProviderSearches: [{ provider: 'Treasure Trails', result: 'No exact Kintore product in the current Aberdeenshire collection' }, { provider: 'Curious About', result: 'No exact Kintore product found' }, { provider: 'Mystery Guides', result: 'No exact Kintore product found' }, { provider: 'Go Quest Adventures', result: 'No exact Kintore quest found' }],
  facilities: { parking: [{ name: 'The Square Car Park', spaces: 15, disabledSpaces: 1, price: 'Free', payment: 'Not applicable', maxStay: 'Not published', overnight: 'Not published' }, { name: 'Kintore Railway Station Car Park', spaces: 168, disabledSpaces: 12, price: 'Free', payment: 'Not applicable', evChargingBays: 24, cycleSpaces: 48, maxStay: 'Not published', overnight: 'Not published' }], toilets: [{ name: 'The Crafty Café Comfort Partnership Toilet', price: 'Free; no purchase expected', opening: 'April-September 08:00-20:00; October-March 08:00-18:00', disabledAccess: 'Not specified', babyChanging: 'Not specified', changingPlaces: 'None listed in Kintore' }], picnic: { result: 'No formal public picnic tables or covered picnic area verified inside the town boundary; public seating is not mislabelled as a picnic site.' } },
  heritageDateAudit: { visiblePins: visibleHistoricPins.length, dated: visibleHistoricPins.length - undated.length, undated: undated.map((item) => item.id), mergedDuplicates: ['LB36310 church components merged with SM76 visitor stop', 'LB36314 and LB36315 merged as lodge group', 'Four LB49868 component points merged as one designation pin'], bufferOrExcluded: ['SM12465 Deer’s Den roundhouses', 'SM50 Tuach Hill', 'SM3958 long cairn', 'SM7674 canal', 'SM12435 Valleyview'] },
  accessibilityAndTransport: { rail: 'Kintore station: step-free to all platforms, ticket machine, unstaffed, no toilets', walking: 'Town routes mix pavements, crossings and less formal path sections', weather: 'Use daylight and suitable ground conditions for longer path sections' },
  exclusions: ['No below-60 visitor place is published.', 'The proposed Town House former-jail display is not treated as open.', 'Hallforest Castle remains an out-of-boundary route destination, not a Kintore attraction.', 'Marshalls Farm Shop is outside the audited settlement.', 'No dog policy, parking rule, toilet feature or picnic table is invented where current evidence is absent.'],
  art: { sourceInspiration: 'User-supplied Kintore Town House photograph', file: '/town-guides/kintore-town-house-fountain-guide-v1.png', treatment: 'New three-quarter visitor-guide composition with the Town House and fountain; cars, road markings, signs, poles, wires, bins, crowds and watermarks removed.' },
  verification: { heritagePinsDated: `${visibleHistoricPins.length - undated.length}/${visibleHistoricPins.length}`, undatedHistoricPins: undated.length },
}, null, 2)}\n`, 'utf8');

console.log(`Kintore full audit complete: ${highlights.length} attractions, ${foods.length} Eats, 1 trail bundle, 2 parking places, 1 public-use toilet, no verified formal picnic site; ${visibleHistoricPins.length - undated.length}/${visibleHistoricPins.length} historic pins dated.`);
