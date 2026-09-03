import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T20:00:00Z';
const projectId = 'potarch-scotland';
const projectPath = resolve('data/projects/potarch.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');

const urls = {
  bridge: 'https://portal.historicenvironment.scot/apex/f?p=1505:300:::::VIEWTYPE,VIEWREF:designation,LB3095',
  dinnie: 'https://www.thedinniestones.com/',
  dinnieRules: 'https://www.thedinniestones.com/Dinnie%20Steens%20Guidelines%2016th%20July%202024.pdf',
  craigmore: 'https://themackwalks.wordpress.com/2019/10/07/092-potarch-bridge-craigmore-circular-aberdeenshire/',
  craigmorePdf: 'https://www.garioch.info/walks/Scotland/Aberdeenshire/Potarch%20Bridge-Craigmore%20Circular.pdf',
  allTrails: 'https://www.alltrails.com/en-gb/trail/scotland/aberdeenshire/potarch-bridge-and-craigmore-circular',
  deesideWay: 'https://www.deesideway.org/walks/banchory-to-aboyne/',
  cafe: 'https://visitabdn.com/businesses/potarch-cafe-and-restaurant',
  cafeDogParking: 'https://www.northeast250.com/listing-item/potarch-cafe-and-restaurant/',
  cafeDetails: 'https://www.tripadvisor.co.uk/Restaurant_Review-g191281-d2174916-Reviews-Potarch_Cafe-Banchory_Aberdeenshire_Scotland.html',
  greenReport: 'https://aberdeenshire.moderngov.co.uk/Data/Infrastructure%20Services%20Committee/20230511/Agenda/%2809%29%20STIDP%20ISC%20Report.pdf',
  parkingCurrent: 'https://www.aberdeenshire.gov.uk/waste/recycling/recycling-point/',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  treasureTrails: 'https://www.treasuretrails.co.uk/pages/trail-search',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

type MutablePackage = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: Array<HeritageFeature & Record<string, any>> };
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const feature = (id: string) => {
  const found = pkg.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Potarch feature ${id}`);
  return found;
};

const source = (sourceName: string, sourceOrganisation: string, sourceUrl: string, notes: string, reliability: 'official_statutory' | 'official_non_statutory' | 'local_authority' | 'secondary' = 'official_non_statutory') => ({
  sourceName, sourceOrganisation, sourceUrl, accessedAt: reviewedAt,
  licence: 'Source-linked editorial evidence; retain attribution and verify time-sensitive details before travel.',
  reliability, notes,
});

const attractionReview = (scoreRationale: string, evidenceUrls: string[], values: [number, number, number, number, number, number], category: 'attraction' | 'trail' = 'attraction') => ({
  status: 'editorially_researched' as const, category, methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
  scoreRationale, evidenceUrls,
  attractionAssessment: { experienceDepth: values[0], distinctiveness: values[1], presentation: values[2], journeyWorth: values[3], accessAndReliability: values[4], evidenceConfidence: values[5], visitability: 'full_visitor_experience' as const },
});

const bridge = feature('curated-attraction:potarch-bridge-dinnie-stones');
const green = feature('curated-attraction:potarch-green');
const deeside = feature('curated-trails:potarch-deeside-way');
const cafe = feature('curated-eat:potarch-cafe');
const greenParking = feature('curated-parking:potarch-green-parking');
const picnic = feature('curated-picnic:potarch-green-picnic');
const toilet = pkg.features.find((item) =>
  ['curated-toilets:potarch-portable-toilet', 'curated-toilets:potarch-green-public-toilet'].includes(item.id),
);
if (!toilet) throw new Error('Missing Potarch public-toilet feature');
const listedBridge = feature('hes-listed-building:potarch-lb3095');

const craigmore = structuredClone(deeside) as HeritageFeature & Record<string, any>;
Object.assign(craigmore, {
  id: 'curated-trails:potarch-craigmore-circular',
  name: 'Potarch Bridge and Craigmore Circular',
  geometry: { type: 'Point', coordinates: [-2.65043, 57.06476] },
  shortDescription: 'A complete 6.12 km easy-to-medium woodland circuit from Potarch Bridge, taking about two hours with 164–174 m of ascent.',
  fullDescription: 'A gentle forest circuit through Ballogie Estate woodland, using mostly good forest roads and paths with a short road or pavement section. The standard route includes steeper, narrower rooted paths; an alternative stays on forest roads.',
  visitorWebsiteUrl: urls.craigmore,
  sourceRecords: [
    source('Potarch Bridge–Craigmore Circular', 'The Mack Walks', urls.craigmore, 'Current-place curation: visitor_place_type=Walking route; route=foot; visit_score=71; trail_score=71; trail_type=Woodland circular; distance=6.12 km / 3.83 miles; duration=About 2 hours; ascent=164 m in the waypoint guide and 174 m in current AllTrails data; difficulty=Easy to medium; surface=Short road or pavement section, otherwise forest roads and paths, with roots and steeper narrow sections on the summit variant; child_friendly=Yes for children used to the distance and ascent; dog_friendly=Yes, on lead beside public roads; parking=Potarch public car park; description=Complete Potarch woodland circuit.', 'secondary'),
    source('Potarch Bridge and Craigmore Circular', 'AllTrails', urls.allTrails, 'Current AllTrails record: 6.1 km circular, easy, usually 1.5–2 hours, 174 m ascent; dog-friendly and family-friendly; reviews note some steep sections.', 'secondary'),
  ],
  editorialReview: attractionReview('A complete, mapped and dog-friendly woodland circuit beginning at the visitor cluster, with route variants and downloadable guidance; reduced for some rooted or steep sections and secondary-source dependence.', [urls.craigmore, urls.craigmorePdf, urls.allTrails], [21, 14, 14, 9, 8, 5], 'trail'),
  updatedAt: reviewedAt,
});
pkg.features = pkg.features.filter((item) => item.id !== craigmore.id).concat(craigmore);

Object.assign(deeside, {
  shortDescription: 'Potarch is a useful staging point on the 21 km Banchory-to-Aboyne section of the signed Deeside Way for walkers and cyclists.',
  fullDescription: 'The official route reaches Potarch through Slewdrum Forest and farmland, crosses the River Dee on Potarch Bridge and continues towards Kincardine O’Neil and Aboyne. It is a long linear outing, not a short Potarch loop.',
  visitorWebsiteUrl: urls.deesideWay,
  sourceRecords: [source('Deeside Way: Banchory to Aboyne', 'Deeside Way', urls.deesideWay, 'Current-place curation: visitor_place_type=Walking and cycling route; route=hiking and cycling; visit_score=69; trail_score=69; trail_type=Long-distance linear route; distance=21 km / 13 miles for the full Banchory-to-Aboyne section; duration=About 4.5 hours; ascent=473 m across the full section; description=Official signed route through Potarch Green and over Potarch Bridge.')],
  editorialReview: attractionReview('A well-documented long-distance route with Potarch as a genuine staging point, reduced because the published 21 km section is a substantial linear journey rather than a self-contained hamlet walk.', [urls.deesideWay], [21, 14, 14, 10, 7, 3], 'trail'),
  updatedAt: reviewedAt,
});

Object.assign(cafe, {
  shortDescription: 'A current all-day brunch, coffee and seasonal-produce stop beside the bridge, welcoming well-behaved dogs indoors and in its garden.',
  fullDescription: 'Potarch’s only qualifying Eat serves brunch, coffee, baking and seasonal local produce. Current destination sources confirm dog-friendly indoor and garden seating, a children’s play area and ample customer parking.',
  visitorWebsiteUrl: urls.cafe,
  sourceRecords: [
    source('Potarch Cafe and Restaurant', 'VisitAberdeenshire', urls.cafe, 'Current-place curation: visitor_place_type=Cafe and restaurant; amenity=cafe; visit_score=74; food_score=74; price_band=££; cuisine=Brunch, coffee, baking and seasonal local produce; opening_hours:description=Current secondary listings show 10am–4pm daily, but verify directly before travel; dog_friendly=Family- and dog-friendly; parking=Ample onsite customer parking; description=Riverside brunch and trail stop: All-day brunch, coffee, baking and seasonal local produce beside Potarch Bridge.'),
    source('Potarch Cafe and Restaurant', 'North East 250', urls.cafeDogParking, 'Well-behaved dogs are welcome inside and in the garden. The listing records an extensive well-lit customer car park and complimentary electric charging points.', 'secondary'),
    source('Potarch Cafe visitor details', 'Tripadvisor', urls.cafeDetails, 'Current secondary listing used only for operational detail: 10am–4pm daily at review, credit cards including American Express, Mastercard and Visa, free off-street customer parking, wheelchair access and dog-friendly status. Confirm directly before relying on hours or access.', 'secondary'),
  ],
  editorialReview: {
    status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
    scoreRationale: 'A dependable and unusually useful rural brunch stop with current destination evidence, local produce, dog-friendly indoor access and direct trail relevance; reduced because it remains a single daytime venue with time-sensitive hours.',
    evidenceUrls: [urls.cafe, urls.cafeDogParking, urls.cafeDetails],
    foodAssessment: { foodAndDrinkQuality: 22, daytimeRelevance: 14, distinctiveness: 12, consistency: 11, visitorFit: 8, evidenceConfidence: 7 },
  },
  updatedAt: reviewedAt,
});

Object.assign(greenParking, {
  shortDescription: 'Public surface car park at Potarch Green. Current sources confirm the car park, but do not publish spaces, tariff, payment methods, accessible bays, maximum stay or overnight rules.',
  visitorWebsiteUrl: urls.parkingCurrent,
  sourceRecords: [
    source('Potarch Green car park', 'Aberdeenshire Council', urls.parkingCurrent, 'Current-place curation: visitor_place_type=Parking; amenity=parking; parking=surface; access=public; capacity=Not published; price_display=Not published; payment_required=unknown; payment_methods=Not published; capacity:disabled=Not published; opening_hours:description=Not published; maxstay=Not published; overnight_parking=Not published; recycling=Glass and textiles; description=Current council-confirmed Potarch Green public car park.', 'local_authority'),
    source('Potarch Bridge–Craigmore Circular parking', 'The Mack Walks', urls.craigmore, 'The route author identifies the car park at the walk start and end as public and notes the adjacent bus stop.', 'secondary'),
  ],
  updatedAt: reviewedAt,
});

const cafeParking = structuredClone(greenParking) as HeritageFeature & Record<string, any>;
Object.assign(cafeParking, {
  id: 'curated-parking:potarch-cafe-parking', name: 'Potarch Café Customer Car Park',
  geometry: { type: 'Point', coordinates: [-2.6498, 57.0642] },
  shortDescription: 'Ample off-street customer parking at Potarch Café, with complimentary EV charging. Capacity, charger count and type, accessible bays, maximum stay and overnight rules are not published.',
  visitorWebsiteUrl: urls.cafeDogParking,
  sourceRecords: [
    source('Potarch Café parking', 'VisitAberdeenshire', urls.cafe, 'Current-place curation: visitor_place_type=Customer parking; amenity=parking; parking=surface; access=customers; capacity=Described as ample, exact number not published; price_display=Free customer parking in current secondary listing; payment_required=no separate parking payment published; payment_methods=Not applicable; capacity:disabled=Not published; maxstay=Not published; overnight_parking=Not published; description=Onsite customer parking for the café.'),
    source('Potarch Café parking and charging', 'North East 250', urls.cafeDogParking, 'Current listing describes an extensive, well-lit car park with complimentary electric-car charging points; charger count, connector, power and network are not published.', 'secondary'),
  ],
  updatedAt: reviewedAt,
});
pkg.features = pkg.features.filter((item) => item.id !== cafeParking.id).concat(cafeParking);

Object.assign(toilet, {
  id: 'curated-toilets:potarch-green-public-toilet',
  name: 'Potarch Green Public Toilet',
  shortDescription: 'Council-listed public toilet at Potarch Green: normally 8am–8pm April–September and 8am–6pm October–March, with standard festive closures.',
  fullDescription: 'The current council directory supersedes the older portable-toilet description. It does not state baby-changing or disabled-access provision for Potarch.',
  visitorWebsiteUrl: urls.toilets,
  sourceRecords: [source('Potarch public toilet', 'Aberdeenshire Council', urls.toilets, 'Current-place curation: visitor_place_type=Public toilets; amenity=toilets; access=public; opening_hours:description=Summer April–September 8am–8pm; winter October–March 8am–6pm; closed 25 and 26 December and 1 and 2 January; wheelchair=Not specified; baby_changing=Not specified; address=Potarch Green, Potarch AB31 4BD; description=Current council-listed Potarch public toilet. The council page does not publish a charge.', 'local_authority')],
  updatedAt: reviewedAt,
});

Object.assign(picnic, {
  shortDescription: 'Council-documented picnic tables and barbecue areas at Potarch Green beside the River Dee; condition and availability should be checked on arrival.',
  sourceRecords: [source('Potarch Green visitor-management report', 'Aberdeenshire Council', urls.greenReport, 'Current-place curation: visitor_place_type=Picnic area; tourism=picnic_site; facilities=Picnic tables and barbecue areas documented in the 2023 visitor-management report; opening_hours:description=Open-air site; condition and availability not republished in the current facilities directory.', 'local_authority')],
  updatedAt: reviewedAt,
});

Object.assign(bridge, {
  documentedDateText: 'Thomas Telford bridge, 1811–1813; Donald Dinnie stone carry, 1860',
  earliestPossibleYear: 1811, latestPossibleYear: 1860, dateBasis: 'documented_date_range', dateConfidence: 'high',
  fullDescription: 'Thomas Telford’s Category A three-span granite bridge survives in exceptionally fine condition above the River Dee. Outside the café, the 144.47 kg and 188.02 kg Dinnie Stones recall Donald Dinnie’s famous 1860 carry across the bridge.',
  reviewNotes: 'The bridge date, designer, construction and physical form are statutory-source facts. Viewing the stones is distinct from lifting them: would-be lifters must use the current preservation and safety guidelines.',
  visitorWebsiteUrl: urls.dinnie,
  sourceRecords: [
    source('Potarch Bridge, LB3095', 'Historic Environment Scotland', urls.bridge, 'Category A listed bridge by Thomas Telford, constructed 1811–1813: three segmental granite arches, 200 feet long, surviving in exceptionally fine condition.', 'official_statutory'),
    source('The Dinnie Stones', 'Dinnie Stones custodians', urls.dinnie, 'Official stone history: 144.47 kg and 188.02 kg; Donald Dinnie carried both across the bridge in 1860; stones returned to Potarch in 2016.'),
    source('Dinnie Stones lifting guidelines', 'Ballogie Estate and Dinnie Stones custodians', urls.dinnieRules, 'Current handling rules protect the stones and lifters. Viewing is the normal visit; lifting or carrying requires compliance with the official guidelines.'),
  ],
  editorialReview: attractionReview('A highly distinctive pairing of a nationally important Telford bridge and an internationally recognised strength-sport story, with excellent visible fabric and current custodial evidence; the visit itself remains compact.', [urls.bridge, urls.dinnie, urls.dinnieRules], [24, 15, 15, 11, 8, 5]),
  attractionGuide: {
    headline: 'Telford engineering and the stones of a legendary 1860 feat',
    intro: 'Read the bridge first, then cross to the Dinnie Stones outside the café. Viewing is straightforward; lifting is a specialist activity governed by the custodians’ current safety rules.',
    bestFor: ['Engineering heritage', 'Strength-sport history', 'River Dee views', 'A compact landmark stop'],
    parking: 'Potarch Green public car park is current, but no defensible capacity, tariff, payment-method, accessible-bay, maximum-stay or overnight information is published. The café also has ample customer parking with complimentary EV charging; charger details are not published.',
    toilets: 'Potarch Green public toilet is council-listed for 8am–8pm April–September and 8am–6pm October–March, with standard festive closures. Disabled access and baby changing are not specified.',
    picnic: 'The council’s visitor-management report records picnic tables and barbecue areas on Potarch Green; check their condition on arrival.',
    food: [{ name: 'Potarch Cafe and Restaurant', visitorScore: 74, summary: 'All-day brunch, coffee, baking and seasonal local produce; well-behaved dogs are welcome inside and in the garden.', openingTimes: 'Current secondary listings show 10am–4pm daily; verify directly before travel.', priceBand: '££', externalUrl: urls.cafe }],
    trails: [
      { name: craigmore.name, summary: 'The strongest self-contained walk from Potarch: a complete woodland circuit returning to the bridge.', routeType: 'Easy-to-medium woodland circular', distance: '6.12 km / 3.83 miles', duration: 'About 2 hours', difficulty: 'Easy to medium; rooted and steeper narrow paths on the summit variant.', externalUrl: urls.craigmorePdf },
      { name: deeside.name, summary: 'Use Potarch as a staging point on the official Banchory-to-Aboyne section.', routeType: 'Long-distance linear walking and cycling route', distance: '21 km / 13 miles for the full section', duration: 'About 4½ hours', difficulty: 'Long, with 473 m ascent across the full section.', externalUrl: urls.deesideWay },
    ],
    thingsToDo: [
      { name: 'Read the three granite arches', summary: 'Look for the finely finished arch rings, cutwaters and parapet refuges described in the Category A listing.' },
      { name: 'Meet the Dinnie Stones', summary: 'Compare the 144.47 kg and 188.02 kg stones and the 17-foot bridge-width challenge.' },
      { name: 'Follow the official lifting rules', summary: 'Viewing is free; never attempt a lift without reading and following the custodians’ current guidance.' },
    ],
  },
  updatedAt: reviewedAt,
});

Object.assign(green, {
  fullDescription: 'A small riverside recreation cluster linking the bridge, public car park, picnic area, public toilet, café and two source-backed routes. Its value is practical and scenic rather than a separate destination-scale attraction.',
  reviewNotes: 'The score is held at 65: the Green is a useful base and picnic stop, but facilities are modest, river conditions require care and the 2023 report documents visitor-management pressures including inappropriate parking.',
  sourceRecords: [
    source('Potarch Green visitor-management report', 'Aberdeenshire Council', urls.greenReport, 'Council evidence for the Green, picnic tables, barbecue areas, parking pressures and the former toilet arrangement.', 'local_authority'),
    source('Potarch current public facilities', 'Aberdeenshire Council', urls.toilets, 'Current directory confirms Potarch Green public toilet and seasonal daily opening hours.', 'local_authority'),
    source('Potarch woodland and Deeside setting', 'Ballogie Estate', 'https://www.ballogie-estate.co.uk/experiences/explore/', 'Current estate visitor context for the Potarch forest path network and café.'),
  ],
  editorialReview: attractionReview('A scenic and genuinely useful riverside base connecting picnic, trail and practical facilities, held below destination level because the experience is informal, small and subject to road, river and visitor-management constraints.', [urls.greenReport, urls.toilets, urls.craigmore, urls.deesideWay], [20, 13, 13, 9, 7, 3]),
  attractionGuide: {
    headline: 'The practical riverside base for Potarch’s bridge, picnic and paths',
    intro: 'Use the Green as the orientation point rather than treating it as another major attraction: it brings the car park, picnic provision, toilet, café and routes into one compact stop.',
    bestFor: ['Riverside picnics', 'Walk starts', 'Families', 'A short outdoor pause'],
    parking: bridge.attractionGuide.parking,
    toilets: bridge.attractionGuide.toilets,
    picnic: bridge.attractionGuide.picnic,
    food: bridge.attractionGuide.food,
    trails: bridge.attractionGuide.trails,
    thingsToDo: [
      { name: 'Picnic with a bridge view', summary: 'Use the documented tables or barbecue area where available and leave the riverside clean.' },
      { name: 'Choose a complete circuit', summary: 'The Craigmore loop is the best-defined two-hour outing from the Green.' },
      { name: 'Respect the River Dee', summary: 'Fast water, uneven banks and fishing activity make close child and dog supervision essential.' },
    ],
  },
  updatedAt: reviewedAt,
});

listedBridge.fullDescription = 'Thomas Telford’s 1811–1813 Category A bridge crosses the River Dee in three granite segmental arches. The statutory record highlights its exceptional survival, 200-foot length and historical importance in connecting Birse with North Deeside.';
listedBridge.visitorWebsiteUrl = urls.bridge;
listedBridge.sourceRecords = [source('Potarch Bridge, LB3095', 'Historic Environment Scotland', urls.bridge, 'Statutory designation confirms Thomas Telford, 1811–1813, Category A, three spans and exceptionally fine survival.', 'official_statutory')];

pkg.project.visitorHighlights = [
  {
    rank: 1, featureId: bridge.id, name: bridge.name,
    reason: 'Thomas Telford’s 1811–13 granite bridge and Donald Dinnie’s famous 1860 stone carry create a nationally important engineering landmark with an internationally distinctive strength story.',
    visitorScore: 78, tagline: 'Telford arches and legendary stones', timeToSpend: '30–60 minutes',
    openingTimes: 'Open-air bridge; Dinnie Stones are outside the café. Use current custodial rules before any lifting attempt.',
    admission: 'Free to view.', freeAdmission: true, visitorWebsiteUrl: urls.dinnie,
    sourceName: 'Historic Environment Scotland and Dinnie Stones custodians', sourceUrl: urls.bridge, verifiedInBoundaryAt: reviewedDate,
    editorialReview: bridge.editorialReview,
  },
  {
    rank: 2, featureId: green.id, name: green.name,
    reason: 'A compact riverside base for picnics, public facilities, the café and direct access to the Craigmore circular and Deeside Way.',
    visitorScore: 65, tagline: 'Riverside base for bridge and paths', timeToSpend: '30–90 minutes',
    openingTimes: 'Open-air Green; daylight and suitable river conditions recommended.', admission: 'Free outdoor area.', freeAdmission: true,
    visitorWebsiteUrl: urls.greenReport, sourceName: 'Aberdeenshire Council', sourceUrl: urls.greenReport, verifiedInBoundaryAt: reviewedDate,
    editorialReview: green.editorialReview,
  },
];

pkg.project.touristAppeal = {
  score: 68, dogOwnerScore: 67, dogAccessScoreAdjustment: -1, rating: 0, label: 'Notable Stop',
  summary: 'A compact but unusually coherent Deeside stop: a Category A Telford bridge, the Dinnie Stones, riverside Green, current café and two genuine routes share one small visitor cluster.',
  dogAccessRating: 3,
  dogAccessSummary: 'Potarch is very usable with a dog because both routes and the outdoor cluster are suitable and the café welcomes well-behaved dogs indoors and outside. The dog-owner score remains one point lower for live roads, fast river edges, forestry, livestock and mixed trail users.',
  methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1', reviewedAt: reviewedDate,
  sourceUrls: [urls.bridge, urls.dinnie, urls.dinnieRules, urls.craigmore, urls.craigmorePdf, urls.allTrails, urls.deesideWay, urls.cafe, urls.cafeDogParking, urls.greenReport, urls.parkingCurrent, urls.toilets, urls.outdoorCode],
};
pkg.project.townGuide = {
  characterTag: 'Telford bridge, Dinnie Stones and Deeside paths',
  headline: 'A legendary bridge crossing with a complete riverside stop around it',
  intro: 'Potarch is tiny but unusually complete. Read Thomas Telford’s 1811–13 bridge, meet the Dinnie Stones of the 1860 carry, then choose the two-hour Craigmore woodland circuit or use the café and Green for a shorter stop.',
  bestFor: ['Engineering heritage', 'Strength-sport history', 'Woodland walking', 'Dog-friendly brunch'],
  perfectFor: ['A focused 2–4 hour bridge-and-walk stop', 'A Deeside Way rest and resupply pause'],
  suggestedFirstVisit: { title: 'Start at Potarch Bridge and the Dinnie Stones', summary: 'Allow 30–60 minutes for the landmark pairing, or about three hours when combined with the Craigmore circuit and café.' },
  dontMiss: [bridge.name, craigmore.name, cafe.name],
  suggestedTime: '1–2 hours for the visitor cluster; 3–4 hours with the Craigmore circuit and café',
  visitorMood: 'Compact, outdoors-led and memorable: stronger than an ordinary roadside halt, but still a notable stop rather than a full town destination.',
  sourceUrls: [urls.bridge, urls.dinnie, urls.dinnieRules, urls.craigmore, urls.craigmorePdf, urls.allTrails, urls.deesideWay, urls.cafe, urls.cafeDogParking, urls.greenReport, urls.parkingCurrent, urls.toilets, urls.treasureTrails],
  lastReviewedAt: reviewedDate,
};
pkg.project.visualIdentity = {
  theme: 'potarch-telford-river-dee',
  badgeImage: '/town-guides/potarch-bridge-river-dee-watercolour-guide-v1.png',
  badgeAlt: 'Watercolour illustration of Potarch Bridge and the River Dee from a riverside path',
  heroImage: '/town-guides/potarch-bridge-river-dee-watercolour-guide-v1.png',
  heroAlt: 'Watercolour illustration of the three granite arches of Potarch Bridge above the River Dee',
  heroObjectPosition: '52% 48%', motifs: ['Three arches', 'River stones', 'Deeside woods', 'Riverside path'],
  primaryColour: '#244D4A', accentColour: '#9A651D', backgroundColour: '#EEF2E9',
};

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { projects: Record<string, Record<string, string[]>> };
planner.projects[projectId] = {
  eat: [cafe.id], trails: [craigmore.id, deeside.id], parking: [greenParking.id, cafeParking.id],
  toilets: [toilet.id], picnic: [picnic.id],
};
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { reviewedAt: string; projects: Record<string, any> };
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [bridge.id]: { rating: 2, status: 'restricted', label: 'Outdoor landmark beside road and river', summary: 'Dogs can share the outdoor bridge and stones stop on a short lead. Live traffic, other visitors, the café forecourt and the River Dee prevent this being relaxed off-lead access.', sourceName: 'Potarch access audit and Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [green.id]: { rating: 3, status: 'welcoming', label: 'Dog-friendly riverside base with close-control hazards', summary: 'The open-air Green is useful with a dog, but fast river edges, picnics, children, traffic and fishing activity require close control and prompt waste removal.', sourceName: 'Potarch Green audit and Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [craigmore.id]: { rating: 3, status: 'welcoming', label: 'Dog-friendly woodland circular', summary: 'The route author and current AllTrails record both identify the circuit as dog-friendly. Use a lead beside public roads and close control around wildlife, forestry, livestock and other users.', sourceName: 'The Mack Walks and AllTrails route review', sourceUrl: urls.craigmore, reviewedAt: reviewedDate },
    [deeside.id]: { rating: 2, status: 'restricted', label: 'Long mixed-use route with control requirements', summary: 'Dogs can use the route responsibly, but its road approaches, farmland, livestock, cyclists, horses and long linear nature require reliable close control and lead sections.', sourceName: 'Deeside Way and Outdoor Access Code', sourceUrl: urls.deesideWay, reviewedAt: reviewedDate },
  },
  eat: {
    [cafe.id]: { rating: 3, status: 'welcoming', label: 'Dogs welcome inside and in the garden', summary: 'Current destination listings explicitly welcome well-behaved dogs both inside the restaurant and in the garden area.', sourceName: 'North East 250 current venue listing', sourceUrl: urls.cafeDogParking, reviewedAt: reviewedDate },
  },
};
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Potarch audit introduced ${errors.length} validation error(s): ${errors.map((item) => item.message).join('; ')}`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const hesPins = pkg.features.filter((item) => item.tags.includes('hes-listed-building'));
const undated = hesPins.filter((item) => !item.documentedDateText?.trim());
await writeFile(resolve('data/review/potarch-full-visitor-audit-2026-08-27.json'), `${JSON.stringify({
  reviewedAt, townScore: 68, dogOwnerScore: 67, dogAccessRating: 3,
  publicationRule: 'Retain only visitor places scoring 60 or more with a current, reproducible visitor contract.',
  attractions: pkg.project.visitorHighlights.map(({ name, visitorScore }) => ({ name, score: visitorScore, published: visitorScore >= 60 })),
  food: [{ name: cafe.name, score: 74, dogRating: 3, currentHours: 'Current secondary listings show 10am–4pm daily; verify directly.' }],
  trails: [
    { name: craigmore.name, score: 71, distance: '6.12 km / 3.83 miles', duration: 'About 2 hours', ascent: '164–174 m depending route dataset', difficulty: 'Easy to medium', dogRating: 3 },
    { name: deeside.name, score: 69, distance: '21 km / 13 miles for Banchory–Aboyne', duration: 'About 4.5 hours', ascent: '473 m across full section', difficulty: 'Long linear route', dogRating: 2 },
  ],
  facilities: {
    parking: [
      { name: greenParking.name, access: 'Public', spaces: 'Not published', pricing: 'Not published', payment: 'Not published', disabledSpaces: 'Not published', maxStay: 'Not published', overnight: 'Not published' },
      { name: cafeParking.name, access: 'Customers', spaces: 'Described as ample; exact number not published', pricing: 'Free customer parking in current secondary listing', payment: 'No separate payment published', evCharging: 'Complimentary; count, connector and speed not published' },
    ],
    toilets: [{ name: toilet.name, opening: 'April–September 8am–8pm; October–March 8am–6pm', disabledAccess: 'Not specified', babyChanging: 'Not specified' }],
    picnic: [{ name: picnic.name, provision: 'Picnic tables and barbecue areas documented in 2023 council report; verify condition on arrival' }],
  },
  heritageDateAudit: { pins: hesPins.length, dated: hesPins.length - undated.length, undated: undated.map((item) => item.id) },
  exclusions: [
    'No Potarch Treasure Trails product found in the current product search.',
    'The Dinnie Stones are not scored separately from Potarch Bridge because the paired story and location form one visitor experience.',
    'Potarch Lodge is accommodation, not a general attraction or public facility.',
    'Fishing access and Ballogie Estate sporting activities are not assumed to be free public recreation.',
    'The café’s customer car park is not presented as unrestricted public or overnight parking.',
    'No spaces, accessible bays, public-car-park tariff, payment methods, maximum stay or overnight permission are invented where sources do not publish them.',
  ],
}, null, 2)}\n`, 'utf8');

console.log(`Potarch full audit complete: 2 attractions, 1 Eat, 2 trails, 2 parking places, 1 public toilet, 1 picnic area; ${hesPins.length - undated.length}/${hesPins.length} heritage pins dated.`);
