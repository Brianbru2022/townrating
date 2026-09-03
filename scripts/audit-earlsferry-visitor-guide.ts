import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-26T23:45:00.000Z';
const reviewedDate = '2026-08-26';
const projectPath = resolve('data/projects/earlsferry.json');
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
for (const item of pkg.features) item.sourceRecords = item.sourceRecords.filter((record) => record.accessedAt !== reviewedAt);

const urls = {
  destination: 'https://www.welcometofife.com/destination/elie--earlsferry',
  conservation: 'https://www.fife.gov.uk/__data/assets/pdf_file/0023/155921/Elie-and-Earlsferry-Conservation-Area-Appraisal-and-Management-Plan.pdf',
  golfWelcome: 'https://www.golfhouseclub.co.uk/visitor_welcome',
  golfFees: 'https://www.golfhouseclub.co.uk/visitor-information/green-fees/',
  coastalPath: 'https://www.fife.gov.uk/environment/harbours-and-coast/fife-coastal-path',
  coastalStage: 'https://www.welcometofife.com/view-business/fife-coastal-path---east-wemyss-to-lower-largo',
  chainWalk: 'https://www.gps-routes.co.uk/routes/home.nsf/RoutesLinksWalks/elie-and-earlsferry-chain-walk',
  treasure: 'https://www.treasuretrails.co.uk/products/things-to-do-elie-earlsferry-fife',
  nineteenth: 'https://www.the19th-hole.co.uk/about-us.php',
  nineteenthMenu: 'https://www.the19th-hole.co.uk/our-menu.php',
  townHall: 'https://earlsferrytownhall.co.uk/',
  toilets: 'https://www.fife.gov.uk/facilities/public-toilet/elie-public-toilets',
  placePlan: 'https://www.fife.gov.uk/__data/assets/pdf_file/0025/653308/Elie-and-Earlsferry-Local-Place-Plan.pdf',
};

function feature(id: string): HeritageFeature {
  const found = pkg.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Earlsferry feature ${id}`);
  return found;
}

function source(sourceName: string, sourceOrganisation: string, sourceUrl: string, notes: string, reliability: 'official_statutory' | 'official_non_statutory' | 'local_authority' | 'secondary' = 'secondary') {
  return { sourceName, sourceOrganisation, sourceUrl, accessedAt: reviewedAt, licence: 'Source-linked editorial evidence; retain attribution.', reliability, notes } as HeritageFeature['sourceRecords'][number];
}

function currentFeature(id: string, name: string, featureType: string, coordinates: [number, number], shortDescription: string, sourceRecords: HeritageFeature['sourceRecords'], tags: string[], evidenceScope: HeritageFeature['evidenceScope'] = 'parish_evidence'): HeritageFeature {
  return { id, projectId: pkg.project.id, name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality: 'Earlsferry', featureType, significance: 'local', geometry: { type: 'Point', coordinates }, locationType: 'exact', locationConfidence: 'medium', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription, sourceRecords, licence: 'Source-linked editorial record; map location may include OpenStreetMap-derived discovery evidence.', tags: [...new Set(['current-context', ...tags])], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope, reviewNotes: 'Current visitor-place record researched in the 2026-08-26 Earlsferry full audit.' };
}

function upsert(item: HeritageFeature): HeritageFeature {
  pkg.features = pkg.features.filter((existing) => existing.id !== item.id).concat(item);
  return item;
}

function attractionReview(scoreRationale: string, evidenceUrls: string[], scores: [number, number, number, number, number, number]) {
  return { status: 'editorially_researched' as const, category: 'attraction' as const, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale, evidenceUrls, attractionAssessment: { experienceDepth: scores[0], distinctiveness: scores[1], presentation: scores[2], journeyWorth: scores[3], accessAndReliability: scores[4], evidenceConfidence: scores[5], visitability: 'full_visitor_experience' as const } };
}

function curateFood(item: HeritageFeature, score: number, notes: string, website: string, openingTimes: string, cuisine: string, priceBand: '£' | '££' | '£££', evidenceUrls: string[]) {
  item.visitorWebsiteUrl = website;
  item.shortDescription = notes;
  item.reviewed = true;
  item.updatedAt = reviewedAt;
  item.tags = [...new Set([...item.tags, 'service-context-food', 'visitor-context-food'])];
  item.sourceRecords = item.sourceRecords.filter((record) => !record.notes?.includes('food_score=')).concat(source(`${item.name} visitor curation`, item.name, website, `Current-place curation: visitor_place_type=${item.featureType === 'pub' || item.featureType === 'restaurant' ? 'Restaurant or pub' : 'Cafe'}; food_score=${score}; visit_score=${score}; price_band=${priceBand}; opening_hours:description=${openingTimes}; cuisine=${cuisine}; description=${notes}`, 'official_non_statutory'));
  item.editorialReview = { status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: notes, evidenceUrls };
  return item;
}

const beach = feature('curated-attraction:earlsferry-1');
Object.assign(beach, {
  name: 'Earlsferry Beach and Historic Waterfront', significance: 'regional', visitorWebsiteUrl: urls.destination, reviewed: true, updatedAt: reviewedAt,
  shortDescription: 'A broad sandy shore below the old burgh, with stone sea walls, historic houses and the Fife Coastal Path continuing west.',
  fullDescription: 'Earlsferry’s most complete general visitor experience combines the long beach, layered stone waterfront and views back to the historic burgh. At low tide the sand joins Elie Harbour beach; visitors must still follow signed seasonal dog controls and tide conditions.',
  reviewNotes: 'Beach and waterfront treated as one coherent experience rather than separate duplicate attractions.',
  sourceRecords: [source('Elie and Earlsferry destination', 'Welcome to Fife', urls.destination, 'Official destination evidence for the linked beach, historic settlement and coastal setting.', 'official_non_statutory'), source('Conservation Area Appraisal', 'Fife Council', urls.conservation, 'Official evidence for Earlsferry High Street, historic fabric, waterfront character and seasonal congestion.', 'local_authority')],
});
beach.attractionGuide = { headline: 'Follow the old burgh down to the sand', intro: 'Link High Street, the stone waterfront and the broad beach in one compact walk.', bestFor: ['Beach walking', 'Historic waterfront', 'Photography', 'Coastal atmosphere'], parking: 'West End Beach Parking is the nearest audited public option; it is free in OpenStreetMap data but its capacity is not published. Summer demand can exceed supply.', toilets: 'No official public toilet is confirmed inside Earlsferry. The nearest council facility is Stenton Row in Elie, roughly 1 km east.', picnic: 'The beach and Chapel Green suit an informal picnic; no dedicated table, shelter or barbecue is promised.', foodNote: 'The 19th Hole serves meals in Links Road and has a dog-friendly bar; Pavilion opening should be checked locally.', trails: [], thingsToDo: [{ name: 'Walk the waterfront', summary: 'Use the wynds between High Street and the shore to read the old burgh’s relationship with the beach.' }, { name: 'Check the tide', summary: 'The linked sand is widest at low tide; keep clear of exposed rocks and changing water.' }] };

const burgh = feature('curated-attraction:earlsferry-2');
Object.assign(burgh, {
  name: 'Earlsferry Old Burgh and Town Hall', visitorWebsiteUrl: urls.townHall, reviewed: true, updatedAt: reviewedAt,
  shortDescription: 'A small but rewarding old-burgh walk focused on High Street, narrow shore wynds and the restored community-owned Town Hall.',
  fullDescription: 'Earlsferry retains a dense historic High Street, closes and shore routes with the Town Hall as its civic focus. The hall is an active hire and events venue rather than a daily museum, so the principal experience is the free exterior and street walk.',
  reviewNotes: 'The Town Hall is not presented as a guaranteed walk-in attraction; current events must be checked with the venue.',
  sourceRecords: [source('Earlsferry Town Hall', 'Earlsferry Town Hall', urls.townHall, 'Official current venue and events source; the building is community-owned and bookable rather than a daily museum.', 'official_non_statutory'), source('Conservation Area Appraisal', 'Fife Council', urls.conservation, 'Official appraisal of Earlsferry High Street and the settlement’s historic character.', 'local_authority')],
});
burgh.attractionGuide = { headline: 'Read a royal burgh in a few streets', intro: 'Walk High Street, School Wynd and the shore-facing lanes, using the Town Hall as the civic anchor.', bestFor: ['Historic streets', 'Architecture', 'Short walks', 'Local history'], parking: 'Use audited visitor parking rather than obstructing narrow residential streets.', toilets: 'No public toilet is confirmed within the Earlsferry boundary; Stenton Row in Elie is the nearest official council facility.', picnic: 'Continue to Chapel Green or the beach for an informal stop.', foodNote: 'The 19th Hole is the strongest verified local food stop.', trails: [], thingsToDo: [{ name: 'Look beyond the façades', summary: 'The value lies in the sequence of closes, wynds, sea walls and historic rooflines rather than a single monumental building.' }, { name: 'Check the hall calendar', summary: 'The Town Hall hosts community events but is not advertised as a daily museum.' }] };

const golf = feature('curated-attraction:earlsferry-3');
Object.assign(golf, {
  name: 'Elie Links and Golf House Club', significance: 'regional', visitorWebsiteUrl: urls.golfWelcome, reviewed: true, updatedAt: reviewedAt,
  shortDescription: 'A historic seaside links with bookable visitor tee times, a distinctive periscope starter’s hut and full clubhouse facilities.',
  fullDescription: 'Elie Links is Earlsferry’s strongest specialist draw. The Golf House Club publishes daily visitor windows outside its mid-July to mid-August members-only period, online booking and 2026 green fees. It is a paid golf experience, not a free public sightseeing route.',
  reviewNotes: 'Scored as a substantial bookable sporting experience; no score uplift is taken from the surrounding open landscape alone.',
  sourceRecords: [source('Visitor welcome', 'The Golf House Club', urls.golfWelcome, 'Official visitor windows, booking restrictions, starter arrangements and clubhouse facilities.', 'official_non_statutory'), source('2026 green fees', 'The Golf House Club', urls.golfFees, 'Official 2026 prices and seasonal definitions.', 'official_non_statutory')],
});
golf.attractionGuide = { headline: 'Play a distinctive historic links', intro: 'Book a visitor tee time, check in at the periscope-topped Starter’s Office and allow a full round.', bestFor: ['Experienced golfers', 'Links golf', 'Sporting heritage', 'Coastal scenery'], parking: 'Visitor parking is signposted near the club; it is customer parking, not general beach parking.', toilets: 'Clubhouse changing and catering facilities are available to booked golfers.', picnic: 'Not applicable on the course; use the beach or Chapel Green away from play.', foodNote: 'The clubhouse offers catering to visitors; The 19th Hole overlooks the fourth tee.', trails: [], thingsToDo: [{ name: 'Book before travelling', summary: 'Visitor windows and competition restrictions apply; mid-July to mid-August is reserved for members and guests.' }, { name: 'Meet the periscope starter', summary: 'The unusual starter’s hut uses a submarine periscope to check the blind first fairway.' }] };

const coastal = feature('curated-trail:earlsferry-fife-coastal-path');
Object.assign(coastal, { name: 'Fife Coastal Path: Lower Largo to Earlsferry', shortDescription: 'A demanding 13-mile / 20.9 km stage ending at Earlsferry after beaches, dunes, Kincraig cliffs and the golf course.', visitorWebsiteUrl: urls.coastalStage, reviewed: true, updatedAt: reviewedAt, tags: [...new Set([...coastal.tags, 'service-context-trail', 'visitor-context-trail'])], sourceRecords: [source('Fife Coastal Path', 'Fife Council', urls.coastalPath, 'Official long-distance route status and waymarking context.', 'local_authority'), source('Buckhaven to Elie stage', 'Welcome to Fife', urls.coastalStage, 'Current-place curation: visitor_place_type=Walking route; trail_score=86; trail_type=Long linear coastal walk; distance=13 miles / 20.9 km; accessibility=Long beaches, dunes, cliffs and golf-course crossing; entrance_fee=Free.', 'official_non_statutory')], editorialReview: { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A high-quality long coastal stage with Earlsferry as a natural finish; demanding length and exposed sections reduce general accessibility.', evidenceUrls: [urls.coastalPath, urls.coastalStage] } });

const chain = upsert(currentFeature('curated-trail:earlsferry-chain-walk-loop', 'Elie Chain Walk from Earlsferry', 'walking_route', [-2.8458, 56.1878], 'A 5.6-mile / 9 km tidal scramble route from Earlsferry to the fixed chains at Kincraig Point and back over the clifftop.', [source('Elie and Earlsferry Chain Walk', 'GPS Routes', urls.chainWalk, 'Current-place curation: visitor_place_type=Adventure walking route; trail_score=85; trail_type=Tidal chain scramble and clifftop loop; distance=5.6 miles / 9 km; accessibility=Expert-only scrambling; do not attempt at high tide; start chain section at least two hours before high tide; entrance_fee=Free; dog_friendly=No.', 'secondary')], ['service-context-trail', 'visitor-context-trail']));
chain.visitorWebsiteUrl = urls.chainWalk;
chain.editorialReview = { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A distinctive adventure route beginning in Earlsferry; kept in Trails because the fixed-chain section is outside the audited town boundary and unsuitable for ordinary walkers or dogs.', evidenceUrls: [urls.chainWalk] };

const treasure = upsert(currentFeature('curated-trail:earlsferry-ruby-bay-treasure-trail', 'Elie & Earlsferry – Ruby Bay & Back Treasure Trail', 'walking_route', [-2.8340, 56.1889], 'A 2.5-mile / 2.5-hour self-guided treasure hunt crossing both Elie and Earlsferry, sold as an instant download or printed booklet.', [source('Elie & Earlsferry – Ruby Bay & Back', 'Treasure Trails', urls.treasure, 'Current-place curation: visitor_place_type=Self-guided clue trail; trail_score=84; trail_type=Treasure Hunt; distance=2.5 miles; time_to_spend=2.5 hours; accessibility=Wheelchair and pushchair accessible; entrance_fee=£9.99 per booklet/download; app=Treasure Trails; dog_friendly=Yes.', 'official_non_statutory')], ['service-context-trail', 'visitor-context-trail']));
treasure.visitorWebsiteUrl = urls.treasure;
treasure.editorialReview = { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A polished, accessible and dog-friendly clue route that intentionally covers both halves of the settlement.', evidenceUrls: [urls.treasure] };

const nineteenth = curateFood(upsert(currentFeature('curated-food:earlsferry-19th-hole', 'The 19th Hole', 'pub', [-2.8345088, 56.1898539], 'A historic Links Road pub and restaurant serving locally sourced food, with a specifically dog-friendly bar overlooking the fourth tee.', [source('About The 19th Hole', 'The 19th Hole', urls.nineteenth, 'Official venue description, address, dog-friendly bar and current seven-day hours.', 'official_non_statutory'), source('Current menu', 'The 19th Hole', urls.nineteenthMenu, 'Official menu and food-service source.', 'official_non_statutory')], ['service-context-food', 'visitor-context-food'])), 84, 'Earlsferry’s strongest verified food stop: locally sourced pub meals, links views and an explicitly dog-friendly bar.', urls.nineteenth, 'Daily from 12:00; closing varies from 20:00 to 01:00. Check current kitchen hours when booking.', 'Scottish pub food and restaurant meals', '££', [urls.nineteenth, urls.nineteenthMenu]);

const pavilionFeature = feature('osm-community:node-3126707292');
pavilionFeature.featureType = 'cafe';
const pavilion = curateFood(pavilionFeature, 64, 'A golf-side café/restaurant useful for daytime refreshments; no reliable first-party current hours or dog policy were published, so check locally.', urls.destination, 'Seasonal/current hours not reliably published; check before relying on it.', 'Cafe meals, snacks and drinks', '££', [urls.destination]);

const westParking = feature('osm-community:way-307498100');
Object.assign(westParking, { name: 'Earlsferry West End Beach Parking', visitorWebsiteUrl: urls.placePlan, shortDescription: 'Small free surface parking near the west end of the beach and the approach to Kincraig; capacity is not published and summer demand is high.', reviewed: true, updatedAt: reviewedAt, tags: [...new Set([...westParking.tags, 'service-context-parking', 'visitor-context-parking'])], sourceRecords: [...westParking.sourceRecords, source('Current parking audit', 'OpenStreetMap contributors and Fife Council', urls.placePlan, 'Current-place curation: visitor_place_type=Parking; capacity=Not published; charge=Free in current OpenStreetMap data; payment_methods=None; disabled_parking=Not published; opening_hours=Not published. Local Place Plan confirms severe seasonal parking pressure.', 'secondary')] });
const golfParking = feature('osm-community:way-307498104');
Object.assign(golfParking, { name: 'Golf House Club Visitor Parking', visitorWebsiteUrl: urls.golfWelcome, shortDescription: 'Signposted customer parking for booked golf visitors; not a general beach car park. Capacity, accessible bays and tariff are not published.', reviewed: true, updatedAt: reviewedAt, tags: [...new Set([...golfParking.tags, 'service-context-parking', 'visitor-context-parking'])], sourceRecords: [...golfParking.sourceRecords, source('Visitor welcome', 'The Golf House Club', urls.golfWelcome, 'Current-place curation: visitor_place_type=Parking; access=Customers / booked golf visitors; capacity=Not published; charge=No separate tariff published; payment_methods=Not applicable or not published; disabled_parking=Not published.', 'official_non_statutory')] });
const pavilionParking = feature('osm-community:way-759701964');
Object.assign(pavilionParking, { name: 'Pavilion and Sports Club Parking', visitorWebsiteUrl: urls.placePlan, shortDescription: 'Small surface parking serving the Pavilion and sports facilities; public availability, capacity, accessible bays and tariffs are not published.', reviewed: true, updatedAt: reviewedAt, tags: [...new Set([...pavilionParking.tags, 'service-context-parking', 'visitor-context-parking'])], sourceRecords: [...pavilionParking.sourceRecords, source('Current parking audit', 'OpenStreetMap contributors and Fife Council', urls.placePlan, 'Current-place curation: visitor_place_type=Parking; access=Facility users / check signs; capacity=Not published; charge=Not published; payment_methods=Not published; disabled_parking=Not published. No unsupported free-parking claim is made.', 'secondary')] });

const nearestToilets = upsert(currentFeature('curated-toilets:earlsferry-nearest-stenton-row', 'Nearest public toilets – Stenton Row, Elie', 'toilets', [-2.8179098, 56.1900780], 'The nearest official council public toilets are roughly 1 km east in Elie; Earlsferry itself has no confirmed public toilet in the audited boundary.', [source('Elie Public Toilets', 'Fife Council', urls.toilets, 'Current-place curation: visitor_place_type=Nearest public toilets outside town; opening_hours=Daily 09:00–17:00; charge=Free; wheelchair=Yes; level_access=Yes; radar_key=Required; closures=25–26 December and 1–2 January.', 'local_authority'), source('Local Place Plan', 'Fife Council and Elie & Earlsferry community', urls.placePlan, 'The adopted plan identifies the need for additional public toilets in Earlsferry, supporting the finding that no in-boundary public toilet is currently confirmed.', 'local_authority')], ['service-context-toilets', 'visitor-context-toilets', 'outside-town-service'], 'related_context'));
nearestToilets.visitorWebsiteUrl = urls.toilets;

const picnic = upsert(currentFeature('curated-picnic:earlsferry-chapel-green', 'Chapel Green and Beach Picnic Stop', 'picnic_site', [-2.8391, 56.1875], 'An informal grass-and-beach picnic setting with sea views; no dedicated table, shelter, barbecue or nearby public toilet is promised.', [source('Elie and Earlsferry destination', 'Welcome to Fife', urls.destination, 'Official beach and destination context; picnic furniture and facilities are deliberately not inferred.', 'official_non_statutory')], ['service-context-picnic', 'visitor-context-picnic']));

const highlights: VisitorHighlight[] = [
  { rank: 1, featureId: golf.id, name: golf.name, reason: 'A nationally distinctive links experience with published visitor tee times, 2026 prices and the famous periscope starter.', visitorScore: 84, tagline: 'Historic links and periscope starter', timeToSpend: '4–5 hours for a round', openingTimes: 'Visitor windows normally 11:00–12:30 and 14:30–16:00, subject to daylight and competitions; no visitor tee times mid-July to mid-August.', admission: 'Paid golf: 2026 adult round £60–£200 depending on season and day; advance booking required.', freeAdmission: false, visitorWebsiteUrl: urls.golfWelcome, sourceName: 'The Golf House Club', sourceUrl: urls.golfWelcome, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview('A deep, bookable and unusual historic links experience; specialist appeal and high fees reduce its general-audience score.', [urls.golfWelcome, urls.golfFees], [29, 19, 16, 10, 6, 4]) },
  { rank: 2, featureId: beach.id, name: beach.name, reason: 'A broad linked beach and handsome stone waterfront provide Earlsferry’s strongest free general visit.', visitorScore: 80, tagline: 'Beach below the old burgh', timeToSpend: '60–120 minutes', openingTimes: 'Open-air shore; daylight, tide and signed seasonal controls apply.', admission: 'Free.', freeAdmission: true, visitorWebsiteUrl: urls.destination, sourceName: 'Welcome to Fife and Fife Council', sourceUrl: urls.destination, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview('A coherent, attractive and freely accessible coastal experience with strong historic character; limited facilities and tide/season constraints reduce reliability.', [urls.destination, urls.conservation], [25, 17, 17, 11, 6, 4]) },
  { rank: 3, featureId: burgh.id, name: burgh.name, reason: 'The old-burgh street plan, shore wynds and Town Hall reward a short architectural walk.', visitorScore: 69, tagline: 'Royal-burgh streets and shore wynds', timeToSpend: '30–60 minutes', openingTimes: 'Streets and exterior open at all times; Town Hall access depends on booked events.', admission: 'Free street walk; event charges vary.', freeAdmission: true, visitorWebsiteUrl: urls.townHall, sourceName: 'Fife Council and Earlsferry Town Hall', sourceUrl: urls.townHall, verifiedInBoundaryAt: reviewedDate, editorialReview: attractionReview('Good historic coherence and an active civic focus, but no daily interpreted interior and modest standalone depth.', [urls.townHall, urls.conservation], [21, 15, 14, 8, 6, 5]) },
];

pkg.project.visitorHighlights = highlights;
pkg.project.touristAppeal = { score: 78, dogOwnerScore: 71, dogAccessScoreAdjustment: -7, rating: 1, label: 'Worth a Visit', summary: 'Earlsferry supports a rewarding half-day through its historic links golf, broad beach and coherent old-burgh waterfront, with distinctive walking routes but limited independent facilities.', dogAccessRating: 2, dogAccessSummary: 'The beach, old streets, Treasure Trail and dog-friendly 19th Hole work with a dog, but seasonal shore controls, golf-course restrictions, limited local facilities and the dog-unsuitable Chain Walk reduce the practical visitor score by seven points.', methodVersion: '2026-08-26-full-settlement-visitor-audit-v1', reviewedAt: reviewedDate, sourceUrls: Object.values(urls) };
pkg.project.townGuide = { characterTag: 'Old burgh, broad beach and historic links', headline: 'A distinguished little burgh where golf and the shore still shape the visit', intro: 'Earlsferry is quieter and less serviced than neighbouring Elie, but it has three clear strengths of its own: the historic links, a handsome stone waterfront above a broad beach, and a compact old-burgh street pattern. It is also the natural starting point for westbound coast walking.', bestFor: ['Historic links golf', 'Beach walks', 'Old-burgh streets', 'Coastal routes'], perfectFor: ['A focused half-day on the East Neuk coast', 'Golfers, walkers and visitors who prefer quiet historic places'], suggestedFirstVisit: { title: 'Link High Street, the waterfront and the links', summary: 'Walk from the Town Hall through a shore wynd, follow the beach west, then return by Links Road and the edge of the golf course.' }, dontMiss: ['Earlsferry Beach and Historic Waterfront', 'Elie Links and Golf House Club', 'Earlsferry Old Burgh and Town Hall', 'The 19th Hole'], suggestedTime: '3–5 hours; a full day with golf or a long coastal route', visitorMood: 'A handsome, quietly self-contained coastal burgh whose depth comes from golf, beach and historic fabric rather than a large attraction inventory.', sourceUrls: Object.values(urls), lastReviewedAt: reviewedDate };
pkg.project.visualIdentity = { theme: 'earlsferry-stone-waterfront-and-beach', badgeImage: '/town-guides/earlsferry-waterfront-watercolour-guide-v1.png', badgeAlt: 'Watercolour shoreline view along Earlsferry’s stone sea walls and historic waterfront houses', heroImage: '/town-guides/earlsferry-waterfront-watercolour-guide-v1.png', heroAlt: 'Watercolour shoreline view along Earlsferry’s stone sea walls and historic waterfront houses', heroObjectPosition: '54% 52%', motifs: ['Stone waterfront', 'Broad sandy beach', 'Historic links', 'Shore wynds'], primaryColour: '#1E5964', accentColour: '#B98535', backgroundColour: '#EDF4EF' };

const visitorBoundary = pkg.project.townStudyArea?.visitorBoundary;
if (!visitorBoundary) throw new Error('Earlsferry visitor boundary is required for overlap review.');
for (const item of pkg.features.filter((candidate) => candidate.tags.includes('hes-listed-building'))) {
  const inside = item.geometry?.type === 'Point' && booleanPointInPolygon(point(item.geometry.coordinates), visitorBoundary);
  item.tags = inside
    ? [...new Set(item.tags.filter((tag) => tag !== 'map-hidden').concat('town-selection-inside-locality'))]
    : [...new Set(item.tags.filter((tag) => tag !== 'town-selection-inside-locality').concat('map-hidden', 'neighbouring-elie-record'))];
  item.evidenceScope = inside ? 'parish_evidence' : 'out_of_scope';
}

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { projects: Record<string, Record<string, string[]>> };
planner.projects[pkg.project.id] = { eat: [nineteenth.id], trails: [coastal.id, chain.id, treasure.id], parking: [westParking.id, golfParking.id, pavilionParking.id], toilets: [nearestToilets.id], picnic: [picnic.id] };

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { reviewedAt: string; projects: Record<string, { attraction?: Record<string, unknown>; eat?: Record<string, unknown> }> };
dog.reviewedAt = reviewedDate;
dog.projects[pkg.project.id] = { attraction: {
  [beach.id]: { rating: 2, status: 'restricted', label: 'Seasonal controls and close control required', summary: 'Outdoor beach walking is the core experience, but visitors must follow signed seasonal controls and keep dogs under effective control around other beach users, dunes and wildlife.', sourceName: 'Welcome to Fife and local access evidence', sourceUrl: urls.destination, reviewedAt: reviewedDate },
  [burgh.id]: { rating: 3, status: 'welcoming', label: 'Outdoor historic walk', summary: 'The principal experience is on public streets and shore wynds. The Town Hall is event-dependent and no pet access to booked events is assumed.', sourceName: 'Earlsferry Town Hall', sourceUrl: urls.townHall, reviewedAt: reviewedDate },
  [golf.id]: { rating: 0, status: 'unconfirmed', label: 'Pet-dog access not published', summary: 'No reliable current dog policy is published for visitor golf. Do not assume dogs may accompany players on the course or enter the clubhouse.', sourceName: 'The Golf House Club', sourceUrl: urls.golfWelcome, reviewedAt: reviewedDate },
  [coastal.id]: { rating: 2, status: 'restricted', label: 'Long coastal route with control needed', summary: 'Dogs can accompany suitable walkers on standard path sections, but livestock, golf-course crossings, cliffs and wildlife require close control.', sourceName: 'Fife Council and Welcome to Fife', sourceUrl: urls.coastalPath, reviewedAt: reviewedDate },
  [chain.id]: { rating: 0, status: 'prohibited', label: 'Not suitable for dogs', summary: 'The fixed-chain tidal scramble involves exposed rock, vertical movement and changing water. It should not be attempted with a dog.', sourceName: 'Elie and Earlsferry Chain Walk route guidance', sourceUrl: urls.chainWalk, reviewedAt: reviewedDate },
  [treasure.id]: { rating: 3, status: 'welcoming', label: 'Explicitly dog friendly', summary: 'Treasure Trails marks the joint Elie and Earlsferry route dog friendly; normal road, beach and wildlife controls still apply.', sourceName: 'Treasure Trails', sourceUrl: urls.treasure, reviewedAt: reviewedDate },
}, eat: {
  [nineteenth.id]: { rating: 3, status: 'welcoming', label: 'Dog-friendly bar', summary: 'The venue explicitly advertises its cosy bar as dog friendly; restaurant-area access should not be assumed.', sourceName: 'The 19th Hole', sourceUrl: urls.nineteenth, reviewedAt: reviewedDate },
  [pavilion.id]: { rating: 0, status: 'unconfirmed', label: 'Dog policy not confirmed', summary: 'No reliable current dog policy is published. Check directly before relying on indoor access.', sourceName: 'Reviewed current visitor sources', sourceUrl: urls.destination, reviewedAt: reviewedDate },
} };

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Earlsferry audit introduced validation errors: ${errors.map((item) => item.message).join('; ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/review/earlsferry-full-visitor-audit-2026-08-26.json'), `${JSON.stringify({ reviewedAt, townScore: 78, dogOwnerScore: 71, publicationRule: 'visitor score > 60 with a complete current visitor contract', attractions: highlights.map(({ name, visitorScore }) => ({ name, score: visitorScore, published: true })), trails: [{ name: coastal.name, score: 86 }, { name: chain.name, score: 85 }, { name: treasure.name, score: 84 }], facilities: { eat: [{ name: nineteenth.name, score: 84, published: true }, { name: pavilion.name, score: 64, published: false, reason: 'No reliable first-party current hours or dog policy' }], parking: [{ name: westParking.name, capacity: 'Not published', price: 'Free in current OSM data', payment: 'None' }, { name: golfParking.name, capacity: 'Not published', price: 'No separate tariff published', payment: 'Customer parking' }, { name: pavilionParking.name, capacity: 'Not published', price: 'Not published', payment: 'Check signs' }], toilets: [{ name: nearestToilets.name, hours: 'Daily 09:00–17:00', accessible: 'Level access; Radar key', location: 'Outside Earlsferry, roughly 1 km east' }] }, exclusions: ['Fixed-chain section kept in Trails because it lies beyond the audited town boundary', 'No in-boundary public toilet invented', 'Parking capacities and payment methods left unpublished where no authoritative evidence exists', 'Pavilion retained as researched map context but not published in Eats because current opening hours and dog policy are unconfirmed'] }, null, 2)}\n`, 'utf8');
console.log('Earlsferry audit complete: 3 attractions, 1 published Eat, 3 trails, 3 parking records, 1 nearest-toilet record and 1 picnic stop.');
