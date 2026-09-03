import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-26T21:05:00.000Z';
const reviewedDate = '2026-08-26';
const projectPath = resolve('data/projects/kilconquhar.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;

const urls = {
  conservation: 'https://www.fife.gov.uk/__data/assets/pdf_file/0025/155923/Kilconquhar-Conservation-Area-Appraisal-and-Management-Plan.pdf',
  placePlan: 'https://www.fife.gov.uk/__data/assets/pdf_file/0023/625262/Colinsburgh-and-Kilconquhar-Local-Place-Plan.pdf',
  villageTour: 'https://www.colinsburgh-community.org.uk/Index.asp?MainID=33770',
  birding: 'https://www.the-soc.org.uk/pages/birdwatching-in-fife',
  inn: 'https://www.kinneucharinn.com/',
  innHours: 'https://www.opentable.co.uk/r/kinneuchar-inn-kilconquhar',
  parking: 'https://www.fife.gov.uk/facilities/car-park/c40-car-park%2C-kilconquhar',
  parkingList: 'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-park-list',
  toilets: 'https://www.fife.gov.uk/facilities/public-toilet/public-toilets',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
  treasureTrails: 'https://www.treasuretrails.co.uk/collections/fife',
};

function feature(id: string): HeritageFeature {
  const found = pkg.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Kilconquhar feature ${id}`);
  return found;
}

function source(sourceName: string, sourceOrganisation: string, sourceUrl: string, notes: string, reliability: 'official_statutory' | 'official_non_statutory' | 'local_authority' | 'secondary' = 'secondary') {
  return { sourceName, sourceOrganisation, sourceUrl, accessedAt: reviewedAt, licence: 'Source-linked editorial evidence; retain attribution and verify time-sensitive details before travel.', reliability, notes } as HeritageFeature['sourceRecords'][number];
}

function upsert(item: HeritageFeature): HeritageFeature {
  pkg.features = pkg.features.filter((existing) => existing.id !== item.id).concat(item);
  return item;
}

function currentFeature(id: string, name: string, featureType: string, coordinates: [number, number], shortDescription: string, sourceRecords: HeritageFeature['sourceRecords'], tags: string[]): HeritageFeature {
  return {
    id, projectId: pkg.project.id, name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality: 'Kilconquhar', featureType, significance: 'local',
    geometry: { type: 'Point', coordinates }, locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
    shortDescription, sourceRecords, licence: 'Source-linked editorial record; map location may include OpenStreetMap-derived discovery evidence.',
    tags: [...new Set(['current-context', ...tags])], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
    reviewNotes: 'Current visitor-place record researched in the 2026-08-26 Kilconquhar full audit.',
  };
}

function attractionReview(scoreRationale: string, evidenceUrls: string[], scores: [number, number, number, number, number, number]) {
  return { status: 'editorially_researched' as const, category: 'attraction' as const, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale, evidenceUrls, attractionAssessment: { experienceDepth: scores[0], distinctiveness: scores[1], presentation: scores[2], journeyWorth: scores[3], accessAndReliability: scores[4], evidenceConfidence: scores[5], visitability: 'full_visitor_experience' as const } };
}

const church = feature('curated-attraction:kilconquhar-1');
Object.assign(church, {
  name: 'Kilconquhar Parish Church, Old Kirk and Loch Viewpoint', featureType: 'church', significance: 'regional', geometry: { type: 'Point', coordinates: [-2.8312554, 56.2080536] },
  documentedDateText: 'Earlier church recorded in 1176; surviving late-medieval aisle; present church opened in 1821', earliestPossibleYear: 1176, latestPossibleYear: 1821,
  datePrecision: 'Documented phases', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high',
  shortDescription: 'A landmark 1821 parish church, medieval old-kirk remains and historic kirkyard, with the village’s lawful public viewing stance towards Kilconquhar Loch.',
  fullDescription: 'Kilconquhar’s strongest heritage stop brings together the present church, the late-medieval aisle of its predecessor, a kirkyard with 16th- to 18th-century monuments and a quiet garden/view towards the privately owned loch. The Scottish Ornithologists’ Club describes public access through the churchyard to a viewing stance; the estate hide is members-only and the loch shore is not a public circuit.',
  visitorWebsiteUrl: urls.birding, reviewed: true, updatedAt: reviewedAt,
  reviewNotes: 'Church, old-kirk remains, kirkyard and the confirmed viewing stance are treated as one coherent visit. The private loch is not scored as a separate attraction.',
  sourceRecords: [
    source('Kilconquhar Conservation Area Appraisal', 'Fife Council', urls.conservation, 'Official evidence for the church history, late-medieval remains, townscape role and private status of the loch.', 'local_authority'),
    source('Birdwatching in Fife: Kilconquhar Loch', 'Scottish Ornithologists’ Club', urls.birding, 'Publishes access through the churchyard to a viewing stance and distinguishes the Fife Bird Club members-only estate hide.', 'official_non_statutory'),
    source('Colinsburgh and Kilconquhar Local Place Plan', 'Colinsburgh and Kilconquhar community', urls.placePlan, 'Records the 12th-century old church ruins, 1821 present church, stained glass and Quiet Garden.', 'official_non_statutory'),
  ],
  attractionGuide: {
    headline: 'Church, medieval ruins and the village’s one public loch view',
    intro: 'Read the surviving church phases and kirkyard first, then use the churchyard route to the published birdwatching stance without straying onto private estate ground.',
    bestFor: ['Church architecture', 'Medieval remains', 'Kirkyard history', 'Birdwatching'],
    parking: 'Fife Council’s Main Street car park is free and has 20 surface spaces. No payment is required; accessible bays, maximum stay and overnight rules are not published on the facility page.',
    toilets: 'Fife Council lists no public toilet in Kilconquhar. Use the official facilities in Elie before or after this stop.',
    picnic: 'The Quiet Garden beside the church is for reflection rather than a promoted picnic site; a simple bench is mapped south of the village.',
    foodNote: 'The Kinneuchar Inn is a highly regarded in-village restaurant and pub; book ahead and confirm current service times.',
    trails: [{ name: 'Kilconquhar Village Heritage and Marsh Circuit', summary: 'A self-guided circuit joining the church, Main Street, Barnyards and the public marsh paths.', routeType: 'Short heritage and nature circuit', distance: 'Distance not published', duration: 'About 60–90 minutes', difficulty: 'Mostly village streets and paths; the marsh can be wet, narrow or overgrown.', externalUrl: urls.villageTour }],
    thingsToDo: [
      { name: 'Separate the church phases', summary: 'Compare the present 1821 building with the surviving late-medieval aisle and older grave monuments.' },
      { name: 'Use the lawful loch viewpoint', summary: 'Follow the published route through the churchyard to the viewing stance; do not imply general shore access.' },
      { name: 'Look for wintering waterbirds', summary: 'The shallow SSSI loch is particularly noted for ducks, grebes, coot and moorhen.' },
    ],
  },
});

const village = feature('curated-attraction:kilconquhar-2');
Object.assign(village, {
  name: 'Kilconquhar Historic Village Trail', featureType: 'street', significance: 'local', geometry: { type: 'Point', coordinates: [-2.82958, 56.20839] },
  documentedDateText: 'Medieval origins; streetscape chiefly 18th and 19th century', earliestPossibleYear: 1100, latestPossibleYear: 1899,
  datePrecision: 'Broad settlement and townscape development range', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'medium',
  shortDescription: 'A compact 12-stop self-guided heritage circuit through Main Street and Barnyards, covering wells, weaving cottages, the coaching inn, churches and former railway story.',
  fullDescription: 'Kilconquhar’s community heritage tour turns the exceptionally dense listed streetscape into a usable visitor experience. Twelve online stops link Barnyards Marsh, the old schoolhouse, wells, joinery and carriage works, post office, war memorial, churches, Kinneuchar Inn, manse, loch story, curling rinks and railway buildings. It remains a quiet outdoor circuit with digital interpretation rather than a staffed attraction.',
  visitorWebsiteUrl: urls.villageTour, reviewed: true, updatedAt: reviewedAt,
  reviewNotes: 'Published as the community’s existing 12-stop tour, not as a newly invented Treasure Trail. The Fife Treasure Trails catalogue was checked and no Kilconquhar product was found.',
  sourceRecords: [
    source('Kilconquhar Village Tour', 'Colinsburgh Community Trust', urls.villageTour, 'Current community-hosted 12-stop virtual/self-guided heritage tour and scanned local history source.', 'official_non_statutory'),
    source('Kilconquhar Conservation Area Appraisal', 'Fife Council', urls.conservation, 'Official evidence for the street pattern, unusually high concentration of listed buildings and significant village structures.', 'local_authority'),
    source('Fife Treasure Trails catalogue check', 'Treasure Trails', urls.treasureTrails, 'The current Fife catalogue was specifically searched; no Kilconquhar trail product was found, so none is claimed.', 'secondary'),
  ],
  attractionGuide: {
    headline: 'Twelve village stories in one compact listed streetscape',
    intro: 'Use the community tour to give purpose to a slow loop through Main Street and Barnyards rather than treating every listed cottage as a separate attraction.',
    bestFor: ['Historic streets', 'Vernacular cottages', 'Local history', 'Self-guided walks'],
    parking: 'Start from the free 20-space council car park on Main Street; avoid narrowing the residential lanes with informal parking.',
    toilets: 'There is no council public toilet in Kilconquhar.', picnic: 'No formal picnic area is confirmed in the audited visitor sources.',
    foodNote: 'Kinneuchar Inn occupies the former 18th-century coaching inn on the tour and is the village’s verified destination Eat.',
    trails: [{ name: 'Kilconquhar Village Heritage and Marsh Circuit', summary: 'Continue north through Barnyards and return by the public marsh paths.', routeType: 'Short circular walk', distance: 'Distance not published', duration: 'About 60–90 minutes including stops', difficulty: 'Easy village streets with potentially wet or overgrown marsh paths.', externalUrl: urls.villageTour }],
    thingsToDo: [
      { name: 'Open the 12-stop tour', summary: 'Use the community page to identify the old wells, coaching inn, school, manse and industrial traces.' },
      { name: 'Read the cottage details', summary: 'Look for pantiles, rubble walls, crowsteps, pend entrances and former weaving windows.' },
      { name: 'Link Kilconquhar and Barnyards', summary: 'The marsh paths make the two historic settlements legible as one conservation area.' },
    ],
  },
});

const marsh = feature('curated-attraction:kilconquhar-3');
Object.assign(marsh, {
  name: 'Barnyards Marsh Nature Reserve', featureType: 'nature_reserve', significance: 'local', geometry: { type: 'Point', coordinates: [-2.8313, 56.2094] },
  documentedDateText: 'Long-established wetland; community wildlife reserve by the late 20th century', earliestPossibleYear: 1900, latestPossibleYear: 1999,
  datePrecision: 'Landscape age not fixed; visitor management period only', dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'low',
  shortDescription: 'A small publicly accessible species-rich marsh with a through-path, boardwalk sections, information board and wetland wildlife between Kilconquhar and Barnyards.',
  fullDescription: 'Barnyards Marsh is a modest nature stop rather than a destination reserve. Fife Council identifies it as publicly accessible and describes sedges, wetland plants, birds, insects and amphibians. Community and photographic evidence confirms a through-path and bench, but the path may be wet, narrow or overgrown and should not be confused with the private loch shore.',
  visitorWebsiteUrl: urls.conservation, reviewed: true, updatedAt: reviewedAt,
  reviewNotes: 'Coordinates corrected from the private wet grassland east of the reserve to OSM way 750913969. Scored only for the short public marsh experience.',
  sourceRecords: [
    source('Kilconquhar Conservation Area Appraisal', 'Fife Council', urls.conservation, 'Officially identifies Barnyards Marsh as Scottish Wildlife Trust-managed, publicly accessible and species-rich.', 'local_authority'),
    source('Kilconquhar Village Tour', 'Colinsburgh Community Trust', urls.villageTour, 'Community tour identifies the Marsh and Wildlife Reserve as a visitor stop.', 'official_non_statutory'),
  ],
  attractionGuide: {
    headline: 'A small wetland thread between two village halves', intro: 'Use the public path as the nature section of the village circuit, allowing extra care after rain.',
    bestFor: ['Wetland plants', 'Birds and insects', 'Quiet nature', 'Short walks'],
    parking: 'Use the council Main Street car park rather than verge or residential parking.', toilets: 'No public toilet is listed in Kilconquhar.',
    picnic: 'A bench is reported inside the reserve, but no maintained picnic facility is promised.', foodNote: 'Return to Kinneuchar Inn for the village’s only verified Eat.',
    trails: [{ name: 'Marsh link path', summary: 'Public paths cross the wetland between Kilconquhar and Barnyards.', routeType: 'Short linear links', distance: 'Not published', duration: '20–35 minutes', difficulty: 'Natural wetland path; potentially muddy, narrow or overgrown.', externalUrl: urls.conservation }],
    thingsToDo: [{ name: 'Pause at the board', summary: 'Use the wildlife information board to understand the sedge-rich habitat.' }, { name: 'Watch without disturbing', summary: 'Keep to the path and minimise noise around birds, amphibians and insects.' }],
  },
});

const inn = upsert(currentFeature('curated-food:kilconquhar-kinneuchar-inn', 'Kinneuchar Inn', 'pub', [-2.8320066, 56.2084978], 'A destination 17th-century pub and restaurant serving seasonal, produce-led menus sourced around the East Neuk; advance booking is sensible.', [
  source('Kinneuchar Inn', 'Kinneuchar Inn', urls.inn, 'Official venue website and booking contact.', 'official_non_statutory'),
  source('Kinneuchar Inn current listing', 'OpenTable', urls.innHours, 'Current-place curation: visitor_place_type=Restaurant and pub; food_score=88; visit_score=88; price_band=£££; opening_hours:description=Lunch Friday-Sunday, bar Wednesday-Sunday and dinner Wednesday-Saturday as listed at review; cuisine=Seasonal European and British; payment_methods=American Express, Mastercard, Visa; dog_friendly=Published as dog-friendly; description=Destination East Neuk dining. Award-winning produce-led cooking in a historic village inn; confirm hours and book directly because the venue is not bookable through OpenTable.', 'secondary'),
], ['service-context-food', 'visitor-context-food']));
inn.visitorWebsiteUrl = urls.inn;
inn.editorialReview = { status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A nationally recognised, locally rooted restaurant in a historic inn, strong enough to be a journey-worthy Eat rather than a convenience listing.', evidenceUrls: [urls.inn, urls.innHours] };

const trail = upsert(currentFeature('curated-trail:kilconquhar-village-marsh-circuit', 'Kilconquhar Village Heritage and Marsh Circuit', 'walking_route', [-2.8301, 56.2093], 'A short self-guided circuit combining the community’s 12 heritage stops with the public paths across Barnyards Marsh.', [
  source('Kilconquhar Village Tour', 'Colinsburgh Community Trust', urls.villageTour, 'Current-place curation: visitor_place_type=Walking route; trail_score=72; trail_type=Short heritage and nature circuit; distance=Not published; time_to_spend=60-90 minutes; accessibility=Village streets plus potentially wet, narrow or overgrown marsh paths; entrance_fee=Free; treasure_trails_product=None found; description=Community interpretation for 12 heritage locations connected by public streets and marsh paths.', 'official_non_statutory'),
  source('Kilconquhar Conservation Area Appraisal', 'Fife Council', urls.conservation, 'Confirms public pedestrian routes across Barnyards Marsh and the historic street pattern.', 'local_authority'),
], ['service-context-trail', 'visitor-context-trail']));
trail.visitorWebsiteUrl = urls.villageTour;
trail.editorialReview = { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A usable, interpreted short circuit with 12 heritage subjects and a nature section, reduced for unpublished distance, variable marsh conditions and lack of a downloadable route file.', evidenceUrls: [urls.villageTour, urls.conservation] };

const parking = feature('osm-community:way-967273542');
Object.assign(parking, {
  name: 'C40 Main Street Car Park', shortDescription: 'Fife Council’s free 20-space surface car park on Main Street. No payment is required; accessible bays, maximum stay, height limits and overnight rules are not published.',
  reviewed: true, updatedAt: reviewedAt, reviewNotes: 'Matched to Fife Council C40 facility record. The council is the responsible source for the 20-space capacity and free tariff.',
  sourceRecords: [...parking.sourceRecords.filter((record) => !record.notes?.includes('capacity=')), source('C40 Car Park, Kilconquhar', 'Fife Council', urls.parking, 'Current-place curation: visitor_place_type=Parking; parking=surface; location=Main Street, Kilconquhar KY9 1LF; capacity=20; price_display=Free; payment_required=no; opening_hours:description=Not published; capacity:disabled=Not published; maxstay=Not published; overnight_parking=Not published.', 'local_authority')],
  tags: [...new Set([...parking.tags, 'service-context-parking', 'visitor-context-parking'])],
});

const highlights: VisitorHighlight[] = [
  { rank: 1, featureId: church.id, name: church.name, reason: 'The village’s most coherent visit combines 12th-century documentary origins, medieval remains, the 1821 church, kirkyard monuments and the confirmed public loch viewing stance.', visitorScore: 74, tagline: 'Old kirk and lawful loch view', timeToSpend: '45–75 minutes', openingTimes: 'Kirkyard, ruins and viewing stance in daylight; general church-interior hours are not published.', admission: 'Free exterior, kirkyard and viewpoint visit.', freeAdmission: true, visitorWebsiteUrl: urls.birding, sourceName: 'Fife Council and Scottish Ornithologists’ Club', sourceUrl: urls.conservation, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview('A visibly layered church-and-kirkyard ensemble with an unusual birdwatching viewpoint, reduced for unconfirmed interior access and the private loch shore.', [urls.conservation, urls.birding, urls.placePlan], [22, 16, 15, 10, 6, 5]) },
  { rank: 2, featureId: village.id, name: village.name, reason: 'A genuine community-authored 12-stop circuit gives purpose and interpretation to one of Fife’s densest small listed streetscapes.', visitorScore: 68, tagline: 'Twelve stories through a listed village', timeToSpend: '45–75 minutes', openingTimes: 'Public streets and paths; visit in daylight.', admission: 'Free; online tour.', freeAdmission: true, visitorWebsiteUrl: urls.villageTour, sourceName: 'Colinsburgh Community Trust and Fife Council', sourceUrl: urls.villageTour, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview('A coherent and interpreted historic-village walk, reduced for digital-only presentation, residential character and limited practical facilities.', [urls.villageTour, urls.conservation], [19, 14, 14, 9, 7, 5]) },
  { rank: 3, featureId: marsh.id, name: marsh.name, reason: 'The short public wetland path adds genuine nature value and links Kilconquhar with Barnyards without claiming access around the private loch.', visitorScore: 63, tagline: 'Small public wetland and village link', timeToSpend: '20–35 minutes', openingTimes: 'Open-air path in daylight; conditions are not staffed or guaranteed.', admission: 'Free.', freeAdmission: true, visitorWebsiteUrl: urls.conservation, sourceName: 'Fife Council and Colinsburgh Community Trust', sourceUrl: urls.conservation, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview('A locally valuable public nature stop with habitat interest and a through-route, reduced for small scale, variable path condition and limited interpretation.', [urls.conservation, urls.villageTour], [17, 12, 13, 8, 8, 5]) },
];
church.editorialReview = highlights[0].editorialReview;
village.editorialReview = highlights[1].editorialReview;
marsh.editorialReview = highlights[2].editorialReview;

pkg.project.visitorHighlights = highlights;
pkg.project.touristAppeal = {
  score: 65, dogOwnerScore: 63, dogAccessScoreAdjustment: -2, rating: 0, label: 'Notable Stop',
  summary: 'A compact inland East Neuk heritage stop whose layered church, 12-stop village circuit, public marsh path and exceptional destination inn clear the 60 gate without pretending that the private loch is a general attraction.',
  dogAccessRating: 2,
  dogAccessSummary: 'Good for a controlled outdoor circuit and unusually strong dog-friendly dining, but wildlife-sensitive marsh and loch viewing, traffic on Main Street and an unconfirmed church-interior policy keep it below the general visitor score.',
  methodVersion: '2026-08-26-strict-settlement-visitor-gate-v1', reviewedAt: reviewedDate,
  sourceUrls: [urls.conservation, urls.placePlan, urls.villageTour, urls.birding, urls.inn, urls.parking, urls.toilets, urls.outdoorCode],
};
pkg.project.townGuide = {
  characterTag: 'Church village, marsh and destination inn',
  headline: 'A layered kirk, twelve village stories and a wetland thread',
  intro: 'Kilconquhar is a small but coherent inland stop. Start with the church, medieval remains and lawful loch viewpoint, use the community’s 12-stop heritage trail through Main Street and Barnyards, then cross the public marsh path. The loch shore and estate hide are not general public attractions.',
  bestFor: ['Church heritage', 'Historic cottages', 'Birdwatching', 'Destination dining'],
  perfectFor: ['A focused 1½–3 hour East Neuk stop', 'Visitors combining a quiet heritage walk with a booked meal'],
  suggestedFirstVisit: { title: 'Start at the church and old kirk', summary: 'Explore the churchyard phases, use the confirmed loch viewing stance, then open the community heritage tour before walking into Barnyards.' },
  dontMiss: [church.name, village.name, marsh.name, inn.name], suggestedTime: '1½–3 hours; longer with a booked meal',
  visitorMood: 'Quiet, authentic and compact: the reward is in the combined church, cottage, marsh and food experience rather than a long attractions list.',
  sourceUrls: [urls.conservation, urls.placePlan, urls.villageTour, urls.birding, urls.inn, urls.innHours, urls.parking, urls.toilets, urls.treasureTrails], lastReviewedAt: reviewedDate,
};
pkg.project.visualIdentity = {
  theme: 'east-neuk-village-lane', badgeImage: '/town-guides/kilconquhar-village-lane-watercolour-guide-v1.png', badgeAlt: 'Watercolour illustration of a flower-lined Kilconquhar village lane with whitewashed cottages, pantile roofs and the parish church spire',
  heroImage: '/town-guides/kilconquhar-village-lane-watercolour-guide-v1.png', heroAlt: 'Watercolour illustration of a quiet Kilconquhar village lane with historic cottages and the parish church spire', heroObjectPosition: '50% 52%',
  motifs: ['Whitewashed cottages', 'Red pantile roofs', 'Stone garden walls', 'Parish church spire'], primaryColour: '#17464A', accentColour: '#B27713', backgroundColour: '#EEF2E8',
};

// Five HES descriptions do not match the automatic opening-date parser. Keep
// their published wording visible rather than leaving blank heritage date pins.
for (const [id, documentedDateText, earliestPossibleYear, latestPossibleYear, dateConfidence] of [
  ['hes-listed-building:kilconquhar-lb8506', 'Late-medieval church aisle; 16th- and 18th-century monuments', 1400, 1799, 'medium'],
  ['hes-listed-building:kilconquhar-lb8531', 'Late 18th and 19th centuries', 1760, 1899, 'medium'],
  ['hes-listed-building:kilconquhar-lb8543', 'Early 19th century', 1800, 1839, 'medium'],
  ['hes-listed-building:kilconquhar-lb8542', 'Mid-Victorian', 1837, 1901, 'low'],
  ['hes-listed-building:kilconquhar-lb8554', 'Date not stated in the HES listing description', undefined, undefined, 'unknown'],
] as const) {
  const item = feature(id);
  Object.assign(item, {
    documentedDateText,
    earliestPossibleYear,
    latestPossibleYear,
    dateBasis: earliestPossibleYear ? 'estimated_from_authoritative_source' : 'unknown',
    dateConfidence,
    updatedAt: reviewedAt,
    tags: [...new Set([...item.tags, 'date-reviewed'])],
    reviewNotes: `${item.reviewNotes ? `${item.reviewNotes} ` : ''}HES wording reviewed manually in the Kilconquhar audit.`,
  });
}

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { projects: Record<string, Record<string, string[]>> };
planner.projects[pkg.project.id] = { eat: [inn.id], trails: [trail.id], parking: [parking.id], toilets: [], picnic: [] };
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { reviewedAt: string; projects: Record<string, { attraction?: Record<string, unknown>; eat?: Record<string, unknown> }> };
dog.reviewedAt = reviewedDate;
dog.projects[pkg.project.id] = {
  attraction: {
    [church.id]: { rating: 2, status: 'restricted', label: 'Outdoor visit with wildlife care', summary: 'Dogs can accompany the outdoor churchyard and viewpoint visit under close control. The church interior policy is not published, and dogs should not disturb graves or birds at the loch viewpoint.', sourceName: 'Scottish Ornithologists’ Club and Outdoor Access Code review', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [village.id]: { rating: 3, status: 'welcoming', label: 'Outdoor village trail', summary: 'The 12-stop circuit uses public streets and paths. Keep dogs on a short lead beside Main Street traffic and clear waste in residential areas.', sourceName: 'Kilconquhar Village Tour and Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [marsh.id]: { rating: 2, status: 'restricted', label: 'Wildlife-sensitive wetland path', summary: 'Dogs can use the public path under responsible-access rules, but close control is essential around wetland birds, amphibians, grazing and narrow or muddy sections.', sourceName: 'Fife Council and Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [trail.id]: { rating: 2, status: 'restricted', label: 'Dog-suitable with road and wildlife care', summary: 'The circuit is largely outdoors and includes a dog-welcoming food stop, but leads are needed beside traffic, through the kirkyard and around the marsh and loch viewpoint.', sourceName: 'Kilconquhar audit and Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
  },
  eat: {
    [inn.id]: { rating: 3, status: 'welcoming', label: 'Dog-friendly pub and restaurant', summary: 'Current venue listings explicitly describe the Kinneuchar Inn as dog-friendly. Book directly and request a dog-suitable table because areas and service arrangements can vary.', sourceName: 'Kinneuchar Inn and current venue listing review', sourceUrl: urls.innHours, reviewedAt: reviewedDate },
  },
};
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Kilconquhar audit introduced ${errors.length} validation error(s): ${errors.map((item) => item.message).join('; ')}`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/review/kilconquhar-hes-date-enrichment-2026-08-26.json'), `${JSON.stringify({
  projectId: pkg.project.id,
  generatedAt: reviewedAt,
  method: '57 opening HES listing-description expressions normalised automatically; five non-matching descriptions reviewed manually.',
  candidates: 62,
  enriched: 57,
  manuallyReviewed: 5,
  reviewRequired: [],
}, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/review/kilconquhar-full-visitor-audit-2026-08-26.json'), `${JSON.stringify({
  reviewedAt, townScore: 65, dogOwnerScore: 63, publicationRule: 'visitor score > 60 with a complete current visitor contract',
  attractions: highlights.map(({ name, visitorScore }) => ({ name, score: visitorScore, published: visitorScore > 60 })),
  food: [{ name: inn.name, score: 88, dogRating: 3 }], trail: { name: trail.name, score: 72, distance: 'not published', duration: '60–90 minutes' },
  facilities: { parking: [{ name: parking.name, spaces: 20, pricing: 'Free', payment: 'Not applicable', openingHours: 'Not published' }], toilets: [], picnic: [] },
  dogAudit: { townScore: 63, church: '2 paws', village: '3 paws', marsh: '2 paws', trail: '2 paws', inn: '3 paws' },
  exclusions: ['Kilconquhar Loch shore and estate hide are not general public attractions', 'No Kilconquhar Treasure Trails product found', 'No Fife Council public toilet in Kilconquhar', 'No unverified parking, picnic or opening-hour claims added'],
}, null, 2)}\n`, 'utf8');
console.log('Kilconquhar audit complete: 3 attractions, 1 Eat, 1 trail, 1 council car park, no public toilets.');
