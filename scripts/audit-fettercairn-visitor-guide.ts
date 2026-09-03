import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-08-27';
const reviewedAt = '2026-08-27T16:30:00Z';
const projectPath = resolve('data/projects/fettercairn.json');
const plannerPath = resolve('data/cairn-o-mount-visitor-planner-curation.json');
const dogPath = resolve('data/cairn-o-mount-dog-access-curation.json');
const projectId = 'fettercairn-scotland';

const urls = {
  distillery: 'https://www.fettercairnwhisky.com/en-gb/visit-us/',
  howe: 'https://visitabdn.com/places/howe-of-the-mearns',
  railTrail: 'https://visitabdn.com/blog/the-aberdeenshire-rail-trail',
  royalArchHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB39493',
  marketCrossHer: 'https://her.aberdeenshire.gov.uk/Monument/MAB39491/',
  cycleRoute: 'https://www.aberdeenshire.gov.uk/media/25046/stonehavenandmearns.pdf',
  fasqueWalk: 'https://themackwalks.wordpress.com/2018/06/27/002-fettercairn-fasque-estate-circular-aberdeenshire/',
  cafe: 'https://visitabdn.com/businesses/the-arch-cafe-and-bistro',
  cafeHours: 'https://www.tripadvisor.co.uk/Restaurant_Review-g1602201-d2214485-Reviews-The_Arch_Cafe-Fettercairn_Aberdeenshire_Scotland.html',
  parking: 'https://www.aberdeenshire.gov.uk/roads-and-travel/car-parking/car-parks',
  toilets: 'https://www.aberdeenshire.gov.uk/local/public-toilets',
  openSpace: 'https://www.aberdeenshire.gov.uk/media/6112/fettercairn.pdf',
  treasureTrails: 'https://www.treasuretrails.co.uk/pages/trail-search',
  outdoorCode: 'https://www.outdooraccess-scotland.scot/dog-owners',
};

type MutablePackage = ProjectPackage & { project: ProjectPackage['project'] & Record<string, any>; features: Array<HeritageFeature & Record<string, any>> };
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const feature = (id: string) => {
  const found = pkg.features.find((item) => item.id === id);
  if (!found) throw new Error(`Missing Fettercairn feature ${id}`);
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

const distillery = feature('curated-attraction:fettercairn-distillery');
Object.assign(distillery, {
  fullDescription: 'A working Highland malt distillery founded in 1824. The current visitor programme combines production history, the distinctive still-cooling ring, guided tastings and distillery-only whisky. Tours should be booked: walk-in capacity is limited, the minimum age is eight, and summer maintenance can alter the production route.',
  reviewNotes: 'Current operator page checked for hours, prices, age limit, booking and maintenance warning. No reliable published pet policy was found, so indoor dog access remains unconfirmed.',
  sourceRecords: [source('Visit Fettercairn Distillery', 'Fettercairn Distillery', urls.distillery, 'Current operator evidence: visitor centre and tours Wednesday-Saturday 10:00-16:30; advance booking encouraged; Taste tour from £20; minimum age eight; July-August production-route disruption possible.')],
  attractionGuide: {
    headline: 'Two centuries of whisky-making and a very distinctive still',
    intro: 'Book before travelling, then allow time for the production story, guided tasting and distillery-only bottles. Drivers can request takeaway drams.',
    bestFor: ['Whisky production', 'Guided tastings', 'Industrial heritage', 'Distillery exclusives'],
    parking: 'The operator gives driving directions but does not publish a visitor-space count, tariff, payment method or accessible-bay inventory. The council Cross car park is the documented town fallback: 13 free unmarked spaces plus 1 disabled space.',
    toilets: 'Visitor toilets are expected as part of a booked indoor experience but detailed accessibility is not published. The Arch Cafe is the council-listed comfort-partnership facility in the village.',
    picnic: 'No formal distillery picnic facility is published. Fettercairn village park is a council-audited open space, but tables are not promised.',
    foodNote: 'The Arch Cafe and Bistro is the verified daytime Eat; check its limited weekly opening before pairing it with a tour.',
    trails: [{ name: 'Fettercairn Village Heritage Circuit', summary: 'Walk from the distillery through the historic centre to the market cross, fountain, church and Royal Arch.', routeType: 'Short village circuit', distance: 'About 1.5 km, depending on detours', duration: '45–75 minutes', difficulty: 'Easy pavements and village streets; take care at road crossings.', externalUrl: urls.railTrail }],
    thingsToDo: [
      { name: 'Follow the cooling-ring story', summary: 'Look for the unusual system that cascades mountain water over the copper still.' },
      { name: 'Choose the right tasting', summary: 'The published experiences range from a three-dram introduction to a hand-filled single-cask bottle.' },
      { name: 'Take the village extension', summary: 'Continue to the 1670 market cross and 1864–65 Royal Arch rather than treating the distillery as an isolated stop.' },
    ],
  },
});

const royalArch = feature('curated-attraction:fettercairn-royal-arch');
Object.assign(royalArch, {
  fullDescription: 'John Milne’s Rhenish-Romanesque triumphal arch was erected in 1864–65 after a design competition assessed by Queen Victoria. It commemorates Victoria and Albert’s quiet 1861 visit and remains the village’s defining gateway, though live traffic passes through it.',
  reviewNotes: 'Official local HER evidence supplies the design, architect, purpose and 1864–65 date. The visit is a short outdoor landmark stop beside a working road.',
  sourceRecords: [
    source('Royal Arch, Fettercairn', 'Aberdeenshire Council Historic Environment Record', urls.royalArchHer, 'Official monument record: Rhenish-Romanesque arch by John Milne, built 1864-65 to commemorate the September 1861 royal visit.', 'official_statutory'),
    source('Howe of the Mearns', 'VisitAberdeenshire', urls.howe, 'Official tourism context identifies the Royal Arch as a principal Fettercairn landmark.'),
  ],
  attractionGuide: {
    headline: 'The royal gateway that gives Fettercairn its silhouette',
    intro: 'View the octagonal towers and carved centre from the pavement, then pass carefully into the historic core. The arch is a live road pinch-point, not a pedestrian monument court.',
    bestFor: ['Landmark architecture', 'Royal history', 'Photography', 'Short heritage stops'],
    parking: 'Use The Cross Car Park: 13 free unmarked spaces and 1 disabled space. It is accessible at all times unless an event uses the area; no payment is required.',
    toilets: 'The Arch Cafe comfort partnership allows free toilet use without a purchase during the venue’s opening hours. The former standalone Main Street toilets are not a current public facility.',
    picnic: 'No picnic provision is attached to the arch. Use the village park only as general open space; tables are not confirmed.',
    foodNote: 'The Arch Cafe is beside the landmark and is the only Eat retained after the current-source audit.',
    trails: [{ name: 'Fettercairn Village Heritage Circuit', summary: 'Join the arch to the fountain, church, market cross and distillery.', routeType: 'Short heritage walk', distance: 'About 1.5 km', duration: '45–75 minutes', difficulty: 'Easy, with live-road crossings and narrow pavements near the arch.', externalUrl: urls.railTrail }],
    thingsToDo: [
      { name: 'Read the twin towers', summary: 'Notice the buttressed octagonal towers, gabletted spirelets and crenellated parapet.' },
      { name: 'Connect it to 1861', summary: 'The arch was built three years after Victoria and Albert passed through the quiet village.' },
      { name: 'Continue to The Square', summary: 'The market cross gives the arch a deeper burgh-history setting.' },
    ],
  },
});

const historicCore = feature('curated-attraction:fettercairn-historic-core');
Object.assign(historicCore, {
  documentedDateText: 'Market licence granted 1504; cross renewed 1670; principal surviving streetscape 18th–19th centuries',
  earliestPossibleYear: 1504, latestPossibleYear: 1901, dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high',
  fullDescription: 'A compact conservation-area circuit centred on the Category A market cross, whose shaft may preserve the original 1504 monument and whose sundial capital is dated 1670. The route also links the 1869 Forbes fountain, 1804 parish church, traditional square, Royal Arch and distillery edge.',
  reviewNotes: 'The walk is scored as a single interpreted townscape experience rather than inflating every listed structure into a separate attraction. Fettercairn House and Fasque are not represented as freely accessible town attractions.',
  sourceRecords: [
    source('Fettercairn Market Cross', 'Aberdeenshire Council Historic Environment Record', urls.marketCrossHer, 'Official record: 1504 market licence, 1670 renewal and sundial capital, with the unproven Kincardine removal tradition clearly qualified.', 'official_statutory'),
    source('Aberdeenshire Rail Trail', 'VisitAberdeenshire', urls.railTrail, 'Official tourism trail provides the wider historical context for the old railway communities and Fettercairn stop.'),
  ],
  attractionGuide: {
    headline: 'A market cross, fountain, church and whisky village in one compact circuit',
    intro: 'Use the market cross as the historic anchor, then read the square, church, fountain, Royal Arch and distillery as one coherent village rather than isolated pins.',
    bestFor: ['Burgh history', 'Listed buildings', 'Village photography', 'Short walks'],
    parking: 'The Cross Car Park has 13 free unmarked spaces and 1 disabled space. Payment methods do not apply because the council tariff is free.',
    toilets: 'The council-listed comfort-partnership toilet is inside the Arch Cafe and free to use without purchase while the business is open.',
    picnic: 'The village park is documented as good-quality open space, but no formal picnic-table inventory is published.',
    foodNote: 'The Arch Cafe supplies cooked food, home baking and a Friday chippy service; current hours are limited and should be checked.',
    trails: [
      { name: 'Fettercairn Village Heritage Circuit', summary: 'A short circuit around the town’s strongest dated heritage.', routeType: 'Walking circuit', distance: 'About 1.5 km', duration: '45–75 minutes', difficulty: 'Easy pavements and public streets; road care required.', externalUrl: urls.railTrail },
      { name: 'Laurencekirk to Fettercairn Circular', summary: 'Aberdeenshire Council’s 15-mile on-road cycling loop, with Fettercairn and its arch as the named point of interest.', routeType: 'On-road cycle loop', distance: '15 miles / 24 km', duration: 'Allow roughly 2–3 hours, depending on pace and stops', difficulty: 'Easy to moderate; normal road-cycling confidence required.', externalUrl: urls.cycleRoute },
    ],
    thingsToDo: [
      { name: 'Inspect the market cross', summary: 'Its shaft may be older than the 1670 sundial capital; the popular Kincardine origin is not proven.' },
      { name: 'Find the Forbes fountain', summary: 'David Bryce designed the 1869 memorial fountain, carved by John Rhind.' },
      { name: 'Date the church and streets', summary: 'The 1804 parish church sits amid a particularly coherent 18th- and 19th-century village fabric.' },
    ],
  },
});

const villageTrail = feature('curated-trails:fettercairn-village-circuit');
villageTrail.shortDescription = 'A compact self-guided circuit around the 1504/1670 market cross, 1869 fountain, 1804 church, 1864–65 Royal Arch and the distillery edge.';
villageTrail.fullDescription = 'This is the practical walking spine of the town audit: a roughly 1.5 km public-street circuit that makes Fettercairn’s dated heritage legible without claiming access to private houses or estates.';
villageTrail.sourceRecords = historicCore.sourceRecords;
villageTrail.editorialReview = attractionReview('A coherent, easy and densely dated village route, reduced for limited formal waymarking and live-road crossings.', [urls.marketCrossHer, urls.railTrail], [20, 13, 13, 9, 7, 4]);

const cycleTrailId = 'curated-trails:fettercairn-laurencekirk-cycle-loop';
let cycleTrail = pkg.features.find((item) => item.id === cycleTrailId);
if (!cycleTrail) {
  cycleTrail = JSON.parse(JSON.stringify(villageTrail));
  pkg.features.push(cycleTrail!);
}
Object.assign(cycleTrail!, {
  id: cycleTrailId, name: 'Laurencekirk to Fettercairn Cycle Loop', alternativeNames: [], featureType: 'cycling_route',
  geometry: { type: 'Point', coordinates: [-2.5752, 56.8520] }, documentedDateText: undefined, earliestPossibleYear: undefined, latestPossibleYear: undefined,
  dateBasis: 'unknown', dateConfidence: 'unknown',
  shortDescription: 'Aberdeenshire Council’s 15-mile easy-to-moderate on-road circular route, using Fettercairn and the Royal Arch as its principal named heritage stop.',
  fullDescription: 'The official route starts behind the church in Laurencekirk and loops through the Mearns to Fettercairn. It adds a substantial cycling option but is not presented as a traffic-free family trail.',
  visitorWebsiteUrl: urls.cycleRoute, updatedAt: reviewedAt,
  sourceRecords: [source('Laurencekirk to Fettercairn Circular', 'Aberdeenshire Council', urls.cycleRoute, 'Official mapped 15-mile on-road cycle loop, graded easy to moderate; Fettercairn Royal Arch is the route point of interest.', 'local_authority')],
  editorialReview: attractionReview('A fully mapped official 15-mile loop with a genuine Fettercairn stop, reduced because it starts in Laurencekirk and uses public roads.', [urls.cycleRoute], [18, 12, 12, 9, 7, 6]),
});

const cafe = feature('curated-eat:fettercairn-arch-cafe');
cafe.shortDescription = 'Licensed village café and restaurant serving cooked breakfasts and lunches, homemade baking, vegetarian/vegan/gluten-free choices and a Friday chippy service.';
cafe.fullDescription = 'The audit’s retained daytime Eat: a central café with cooked food, home baking and a Friday evening chippy service. Current listings show Thursday–Sunday daytime opening, but hours should be checked directly before a dog-dependent or tightly timed visit.';
cafe.reviewNotes = 'VisitAberdeenshire confirms the venue and offer. A recently crawled managed listing corroborates current hours and payment/access features. No reliable explicit indoor dog policy was found; a customer comment is not treated as policy.';
cafe.sourceRecords = [
  source('The Arch Cafe and Bistro', 'VisitAberdeenshire', urls.cafe, 'Official tourism listing: licensed café and restaurant, freshly cooked food, gluten-free home baking and Friday chippy service.'),
  source('The Arch Cafe current listing', 'Tripadvisor', urls.cafeHours, 'Current secondary check: Thursday-Sunday 10:30-16:00; breakfast/lunch; vegetarian, vegan and gluten-free options; cards, wheelchair access and street parking reported.', 'secondary'),
];
cafe.sourceRecords[0].notes = 'Current-place curation: visitor_place_type=Cafe; amenity=cafe; visit_score=68; food_score=68; price_band=££; cuisine=Scottish cafe; opening_hours:description=Thursday-Sunday 10:30-16:00 at review; Friday chippy service 16:00-19:00 is published by VisitAberdeenshire; payment_methods=Cards reported; accessibility=Wheelchair accessible reported; description=Cafe beneath the Royal Arch. Licensed village cafe serving cooked breakfasts and lunches, homemade baking and Friday chippy service.';
cafe.editorialReview = { status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: 'A useful, well-evidenced daytime café beside the arch, clearing the publication gate without being inflated into destination dining.', evidenceUrls: [urls.cafe, urls.cafeHours], foodAssessment: { foodAndDrinkQuality: 20, daytimeRelevance: 14, distinctiveness: 9, consistency: 10, visitorFit: 8, evidenceConfidence: 7 } };

const parking = feature('curated-parking:fettercairn-cross-car-park');
parking.shortDescription = 'Free council car park with 13 unmarked spaces plus 1 disabled space. Open at all times unless an event uses the area; no ticket, app, cash or card payment is required.';
parking.sourceRecords = [source('The Cross Car Park, Fettercairn', 'Aberdeenshire Council', urls.parking, 'Current facility record: 13 free unmarked spaces plus 1 disabled space; free tariff; council car parks accessible at all times unless a specific event uses the area.', 'local_authority')];

const toilet = feature('curated-toilets:fettercairn-comfort-toilet');
toilet.shortDescription = 'Council comfort-partnership toilet inside the Arch Cafe. Free to use without any expectation to buy; access follows the café’s opening hours.';
toilet.sourceRecords = [source('Arch Cafe and Bistro comfort partnership scheme', 'Aberdeenshire Council', urls.toilets, 'Current council record: comfort-partnership toilet at the Arch Cafe, free to use without purchase. The former standalone Main Street toilets are not listed as open.', 'local_authority')];

pkg.project.touristAppeal = {
  score: 77, dogOwnerScore: 75, dogAccessScoreAdjustment: -2, rating: 1, label: 'Worth a Visit',
  summary: 'Worth a visit for a bookable working distillery, the unmistakable Royal Arch and a compact, unusually well-dated historic core. The score stays at 77: extra route and facility evidence improves planning confidence, not the intrinsic attraction total.',
  dogAccessRating: 1,
  dogAccessSummary: 'A controlled dog can share the outdoor heritage circuit, but neither the key distillery experience nor the Arch Cafe publishes a reliable pet policy. The dog-owner score is therefore lower, not boosted by general outdoor access.',
  methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1', reviewedAt: reviewedDate,
  sourceUrls: [urls.distillery, urls.howe, urls.royalArchHer, urls.marketCrossHer, urls.cycleRoute, urls.cafe, urls.parking, urls.toilets, urls.openSpace, urls.outdoorCode],
};
pkg.project.townGuide = {
  characterTag: 'Whisky, market cross and royal gateway',
  headline: 'A destination distillery behind one of Scotland’s most memorable village arches',
  intro: 'Fettercairn works as a genuine half-day stop: book the 1824 distillery, then walk the compact historic core from the 1504/1670 market cross and 1804 church to the 1864–65 Royal Arch. Practical facilities are modest but unusually clear.',
  bestFor: ['Whisky tours', 'Royal-arch architecture', 'Dated village heritage', 'Short walks and road cycling'],
  perfectFor: ['A focused 3–5 hour visit', 'A Mearns or Cairn o’ Mount touring day'],
  suggestedFirstVisit: { title: 'Book the distillery, then walk back through four centuries', summary: 'Allow 1–2 hours for the distillery and 45–75 minutes for the cross, fountain, church and Royal Arch circuit.' },
  dontMiss: ['Fettercairn Distillery', 'Fettercairn Royal Arch', 'Fettercairn Historic Village Walk', 'The Arch Cafe and Bistro'],
  suggestedTime: '3–5 hours',
  visitorMood: 'A small, handsome and highly legible Mearns village whose appeal comes from combining whisky with a genuinely coherent streetscape.',
  sourceUrls: [urls.distillery, urls.howe, urls.royalArchHer, urls.marketCrossHer, urls.cycleRoute, urls.cafe, urls.parking, urls.toilets, urls.openSpace, urls.treasureTrails],
  lastReviewedAt: reviewedDate,
};
pkg.project.visualIdentity = {
  theme: 'fettercairn-royal-arch', badgeImage: '/town-guides/fettercairn-royal-arch-watercolour-guide-v1.png',
  badgeAlt: 'Watercolour illustration of Fettercairn Royal Arch framed by village gardens',
  heroImage: '/town-guides/fettercairn-royal-arch-watercolour-guide-v1.png',
  heroAlt: 'Watercolour illustration of the twin-towered Fettercairn Royal Arch with the historic village and church spire beyond', heroObjectPosition: '50% 48%',
  motifs: ['Royal Arch towers', 'Warm sandstone', 'Market-cross village', 'Garden planting'], primaryColour: '#173F42', accentColour: '#A76A18', backgroundColour: '#EEF2E8',
};

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { projects: Record<string, Record<string, string[]>> };
planner.projects[projectId] = {
  eat: [cafe.id], trails: [villageTrail.id, cycleTrailId], parking: [parking.id], toilets: [toilet.id], picnic: [],
};
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');

const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { reviewedAt: string; projects: Record<string, any> };
dog.reviewedAt = reviewedDate;
dog.projects[projectId] = {
  attraction: {
    [distillery.id]: { rating: 0, status: 'unconfirmed', label: 'Dog policy not published', summary: 'No reliable current dog policy is published for the visitor centre or tours. Confirm directly; do not plan on indoor access.', sourceName: 'Fettercairn Distillery visitor-policy review', sourceUrl: urls.distillery, reviewedAt: reviewedDate },
    [royalArch.id]: { rating: 2, status: 'restricted', label: 'Outdoor landmark beside live traffic', summary: 'Dogs can accompany the outdoor stop on a short lead. The arch carries traffic and has narrow roadside space, so this is not a relaxed off-lead visit.', sourceName: 'Royal Arch access and Outdoor Access Code review', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [historicCore.id]: { rating: 2, status: 'restricted', label: 'Dog-suitable village circuit', summary: 'The outdoor public-street route is dog-suitable under close control, with care at road crossings, the churchyard and residential frontages.', sourceName: 'Fettercairn audit and Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [villageTrail.id]: { rating: 2, status: 'restricted', label: 'Outdoor route with road care', summary: 'A short lead is appropriate throughout the village circuit because several sections meet live traffic and the churchyard.', sourceName: 'Fettercairn audit and Outdoor Access Code', sourceUrl: urls.outdoorCode, reviewedAt: reviewedDate },
    [cycleTrailId]: { rating: 0, status: 'restricted', label: 'On-road cycle route', summary: 'This is a 15-mile public-road cycling loop, not a dog-walking route.', sourceName: 'Aberdeenshire Council route review', sourceUrl: urls.cycleRoute, reviewedAt: reviewedDate },
  },
  eat: {
    [cafe.id]: { rating: 0, status: 'unconfirmed', label: 'Indoor dog policy not confirmed', summary: 'No reliable current dog policy is published. A customer reference to a dog is not treated as venue policy; confirm directly before relying on indoor seating.', sourceName: 'Arch Cafe current-policy review', sourceUrl: urls.cafe, reviewedAt: reviewedDate },
  },
};
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Fettercairn audit introduced ${errors.length} validation error(s): ${errors.map((item) => item.message).join('; ')}`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const hesPins = pkg.features.filter((item) => item.tags.includes('hes-listed-building'));
const undated = hesPins.filter((item) => !item.documentedDateText?.trim());
await writeFile(resolve('data/review/fettercairn-full-visitor-audit-2026-08-27.json'), `${JSON.stringify({
  reviewedAt, townScore: 77, dogOwnerScore: 75, dogAccessRating: 1,
  publicationRule: 'Retain only visitor places scoring 60 or more with a current, reproducible visitor contract.',
  attractions: pkg.project.visitorHighlights?.map(({ name, visitorScore }) => ({ name, score: visitorScore, published: visitorScore >= 60 })),
  food: [{ name: cafe.name, score: 68, dogRating: 0, dogPolicy: 'Unconfirmed' }],
  trails: [
    { name: villageTrail.name, score: 66, distance: 'about 1.5 km', duration: '45-75 minutes' },
    { name: cycleTrail!.name, score: 64, distance: '15 miles / 24 km', grade: 'Easy to moderate', route: 'On-road' },
  ],
  facilities: {
    parking: [{ name: parking.name, spaces: '13 unmarked general plus 1 disabled', price: 'Free', payment: 'None required', access: 'All times unless an event uses the area' }],
    toilets: [{ name: toilet.name, type: 'Comfort partnership', price: 'Free without purchase', access: 'During cafe opening hours' }],
    picnic: [],
  },
  heritageDateAudit: { pins: hesPins.length, dated: hesPins.length - undated.length, undated: undated.map((item) => item.id) },
  exclusions: [
    'No Fettercairn Treasure Trails product found in the current product search.',
    'Fasque Estate circular not published as a recommended trail because the current route author warns of a potentially locked estate gate.',
    'Ramsay Arms not retained as an Eat because current official venue hours and service could not be verified reliably.',
    'Fasque House is a wedding, event and stay venue about a mile outside the village, not a freely accessible town attraction.',
    'Fettercairn House and private grounds are not promoted as public attractions.',
    'The former standalone Main Street toilets are not published as open.',
    'Village park is acknowledged as open space but no unverified picnic-table inventory is claimed.',
  ],
}, null, 2)}\n`, 'utf8');

console.log(`Fettercairn full audit complete: 3 attractions, 1 Eat, 2 trails, 1 car park, 1 comfort-partnership toilet; ${hesPins.length - undated.length}/${hesPins.length} heritage pins dated.`);
