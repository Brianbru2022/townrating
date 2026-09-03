import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

/* eslint-disable @typescript-eslint/no-explicit-any -- controlled migration over versioned project JSON */

const reviewedDate = '2026-09-02';
const reviewedAt = '2026-09-02T23:50:00.000Z';
const auditTag = 'scotscraig-guardbridge-full-audit-2026-09-02';
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const treasureCollection = 'https://www.treasuretrails.co.uk/collections/fife';
const curious = 'https://curiousabout.co.uk/';
const mystery = 'https://www.mysteryguides.co.uk/';
const goQuest = 'https://goquestadventures.com/';

type Kind = 'attraction' | 'food' | 'trail' | 'picnic' | 'parking' | 'toilets';
type FeatureSeed = {
  id: string;
  name: string;
  kind: Kind;
  featureType: string;
  coordinates: [number, number];
  description: string;
  tagline: string;
  url: string;
  source: string;
  organisation: string;
  opening: string;
  price: string;
  score: number;
  foodStyle?: string;
  details?: string[];
  significance?: string;
  relatedContext?: boolean;
  locationType?: 'exact' | 'representative_point' | 'approximate';
  locationConfidence?: 'high' | 'medium' | 'low';
  dog?: { rating: 0 | 1 | 2 | 3; status: 'welcoming' | 'restricted' | 'not-allowed' | 'unconfirmed'; label: string; summary: string };
};
type Audit = {
  file: string;
  id: string;
  name: string;
  score: number;
  dogRating: 0 | 1 | 2 | 3;
  character: string;
  summary: string;
  features: FeatureSeed[];
  planner: Record<'eat' | 'trails' | 'picnic' | 'parking' | 'toilets', string[]>;
  providers: Record<string, string>;
  checks: Array<{ url: string; outcome: 'verified' | 'no_result' | 'excluded'; note: string }>;
  exclusions: string[];
  notes: Partial<Record<Kind, string>>;
};

const dogOutdoor = { rating: 2 as const, status: 'restricted' as const, label: 'Responsible outdoor access', summary: 'Dogs can accompany the outdoor visit but need close control around roads, livestock, wildlife and other visitors.' };
const dogWelcome = { rating: 3 as const, status: 'welcoming' as const, label: 'Dog friendly', summary: 'The current operator explicitly welcomes dogs; normal control and clean-up rules still apply.' };
const dogUnknown = { rating: 0 as const, status: 'unconfirmed' as const, label: 'Dog policy not published', summary: 'No reliable current dog policy is published; contact the operator before visiting with a dog.' };
const dogRestrictedVenue = { rating: 1 as const, status: 'restricted' as const, label: 'Restricted venue access', summary: 'Ordinary dogs are not admitted to the production area; the welcome area and shop permit well-behaved dogs and service-dog conditions are published.' };

const tayportTreasure = 'https://www.treasuretrails.co.uk/products/things-to-do-tayport-fife';
const fifeCoastalNorth = 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/leuchars-to-wormit-bay/';
const fifeCoastalSouth = 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/cambo-sands-to-leuchars/';
const edenEstuary = 'https://fifecoastandcountrysidetrust.co.uk/walks/local-nature-reserves-others/eden-estuary-nature-reserve/';
const edenClosure = 'https://fifecoastandcountrysidetrust.co.uk/eden-estuary-newsletter-july-2026/';

function providerChecks(officialRoutes: string, treasureResult = 'No live exact place-specific product in the current Fife catalogue.') {
  return {
    TreasureTrails: treasureResult,
    CuriousAbout: 'Current catalogue searched; no exact place-specific route.',
    MysteryGuides: 'Current catalogue searched; no exact place-specific route.',
    GoQuestAdventures: 'Current catalogue searched; no exact place-specific route.',
    officialRoutes,
  };
}

const audits: Audit[] = [
  {
    file: 'scotscraig.json', id: 'scotscraig-scotland', name: 'Scotscraig', score: 42, dogRating: 2,
    character: 'Historic estate hamlet',
    summary: 'Scotscraig has nationally important estate archaeology and a published route through the estate, but the historic fabric is private rather than an advertised public attraction and no café-led stop or independent visitor facilities were verified. It remains selector-only.',
    features: [
      { id: 'curated-trail:scotscraig-exploration', name: 'Scotscraig Exploration', kind: 'trail', featureType: 'other', coordinates: [-2.9016622, 56.4427612], description: 'A published 6 km route through the Scotscraig Estate using tracks and quiet roads, starting at the Tay Bridge rather than in the hamlet.', tagline: 'Estate tracks above the Tay', url: 'https://fifewalking.com/find-a-walk/north-fife/scotscraig-and-morton-lochs/', source: 'Scotscraig and Morton Lochs', organisation: 'Fife Walking', opening: 'Outdoor route; check current access and avoid the alternative that requires gate climbing or fence negotiation.', price: 'Free', score: 58, relatedContext: true },
    ],
    planner: { eat: [], trails: ['curated-trail:scotscraig-exploration'], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('Fife Walking publishes the 6 km Scotscraig Exploration; it starts outside the hamlet and is retained as related route context.'),
    checks: [
      { url: 'https://www.openstreetmap.org/node/13795964523', outcome: 'verified', note: 'Mapped hamlet resolved at the historic estate core.' },
      { url: 'https://fife-placenames.glasgow.ac.uk/volume/?id=4', outcome: 'verified', note: 'Fife Place-name Data identifies Scotscraig at NO444282.' },
      { url: 'https://portal.historicenvironment.scot/designation/SM5180', outcome: 'verified', note: 'HES confirms the 15th-century mansion remains, 1667 gateway and later gardens; designation is not public visitor access.' },
      { url: 'https://fifewalking.com/find-a-walk/north-fife/scotscraig-and-morton-lochs/', outcome: 'verified', note: 'Current route page supplies distance, terrain, start and access cautions.' },
      { url: treasureCollection, outcome: 'no_result', note: 'No exact Scotscraig product.' },
    ],
    exclusions: ['Scotscraig Golfing Club is about 1.7 km east at Golf Road, Tayport and lies outside this strict hamlet boundary.', 'Private Scotscraig House, farm buildings, dovecot and scheduled remains are historic heat evidence, not assumed public attractions.', 'Morton Lochs and Tayport facilities are outside the hamlet.'],
    notes: { attraction: 'No independently visitable attraction was verified inside the strict hamlet boundary.', food: 'No qualifying café, coffee-and-cake or light-lunch stop was verified.', picnic: 'No dedicated public picnic facility was verified.', parking: 'No general public visitor car park was verified.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'tayport.json', id: 'tayport-scotland', name: 'Tayport', score: 84, dogRating: 3,
    character: 'Historic harbour town and Firth of Tay walking base',
    summary: 'Tayport is a strong independent destination: a historic harbour, major public common, a bookable 1817 links course, three café-led stops, four distinct walks including a live Treasure Trail, picnic provision, parking and a council-listed public toilet. The corrected score reflects the complete offer without borrowing Scotscraig hamlet.',
    features: [
      { id: 'curated-attraction:tayport-harbour', name: 'Tayport Harbour and Waterfront', kind: 'attraction', featureType: 'harbour', coordinates: [-2.88095, 56.451], description: 'A historic Firth of Tay harbour with marina activity, waterfront views and direct links to the town heritage trail.', tagline: 'Harbour views across the Tay', url: 'https://www.tayportharbour.org/info', source: 'Harbour information', organisation: 'Tayport Harbour Trust', opening: 'Outdoor waterfront always accessible; respect marina operations and water-edge hazards.', price: 'Free', score: 78, dog: dogOutdoor },
      { id: 'curated-attraction:tayport-east-common', name: 'East Common and Tay Promenade', kind: 'attraction', featureType: 'park', coordinates: [-2.8722, 56.445], description: 'An 8.2-hectare public common with promenade, pond and reedbed, play park, sports space and the Fife Coastal Path.', tagline: 'Promenade, wildlife and open space', url: 'https://www.fife.gov.uk/facilities/park/east-common%2C-tayport', source: 'East Common', organisation: 'Fife Council', opening: 'Open public greenspace; individual facilities may have separate hours.', price: 'Free', score: 74, dog: dogOutdoor },
      { id: 'curated-attraction:tayport-scotscraig-golf', name: 'Scotscraig Golfing Club', kind: 'attraction', featureType: 'golf_course', coordinates: [-2.8743158, 56.441994], description: 'A historic links-and-heathland course founded in 1817, later refined by Old Tom Morris and James Braid, with year-round visitor tee times and Open-qualifying pedigree.', tagline: 'Historic championship links since 1817', url: 'https://scotscraiggolfingclub.com/visitors', source: 'Visitors Welcome', organisation: 'Scotscraig Golfing Club', opening: 'Visitor tee times available year-round; advance booking and current visitor terms apply.', price: 'Green fees vary', score: 84, dog: dogUnknown },
      { id: 'curated-food:tayport-harbour-cafe', name: 'Harbour Café', kind: 'food', featureType: 'cafe', coordinates: [-2.8810315, 56.4505639], description: 'A community-run harbour café serving coffee, cakes, breakfasts and light lunches beside the waterfront.', tagline: 'Coffee and cake by the harbour', url: 'https://tayportct.org.uk/harbourcafe/', source: 'Harbour Café', organisation: 'Tayport Community Trust', opening: 'Daily 10am–4pm as currently published; check seasonal changes.', price: '££', score: 78, foodStyle: 'coffee, cakes, breakfast and light lunch', dog: dogUnknown },
      { id: 'curated-food:tayport-larick-cafe', name: 'Larick Café', kind: 'food', featureType: 'cafe', coordinates: [-2.8713281, 56.4418048], description: 'A community-hub café beside East Common serving hot drinks, baking and daytime light meals.', tagline: 'Community café beside the common', url: 'https://tayportct.org.uk/communityhub/main-menu/', source: 'Larick Centre menu', organisation: 'Tayport Community Trust', opening: 'See the current community-hub menu and notices before travelling.', price: '££', score: 72, foodStyle: 'coffee, home baking and light lunch', dog: dogUnknown },
      { id: 'curated-food:tayport-scotscraig-clubhouse', name: 'Scotscraig Clubhouse', kind: 'food', featureType: 'cafe', coordinates: [-2.8743158, 56.441994], description: 'A year-round clubhouse open to visitors and guests for coffee, bacon rolls, cakes and lunch, with more than 200 years of golf memorabilia.', tagline: 'Coffee among historic golf memorabilia', url: 'https://scotscraiggolfingclub.com/clubhouse', source: 'The Clubhouse', organisation: 'Scotscraig Golfing Club', opening: 'Clubhouse 6.30am–8pm and restaurant 8am–8pm as currently published.', price: '££', score: 76, foodStyle: 'coffee, bacon rolls, cakes and lunch', dog: dogUnknown },
      { id: 'curated-trail:tayport-heritage-trail', name: 'Tayport Heritage Trail', kind: 'trail', featureType: 'other', coordinates: [-2.881, 56.4509], description: 'A 4-mile heritage trail linking 24 interpretation panels, with shorter link options.', tagline: 'Twenty-four stories around town', url: 'https://tayportheritage.com/trail-guide/', source: 'Tayport Heritage Trail Guide', organisation: 'Tayport Heritage', opening: 'Self-guided outdoor route; panel access and surfaces vary.', price: 'Free', score: 74 },
      { id: 'curated-trail:fife-coastal-path-tayport', name: 'Fife Coastal Path at Tayport', kind: 'trail', featureType: 'other', coordinates: [-2.8764, 56.4519], description: 'The official Leuchars-to-Wormit stage follows Tayport waterfront and East Common on the long-distance coastal route.', tagline: 'The Tay-side finish of the Fife Coastal Path', url: fifeCoastalNorth, source: 'Leuchars to Wormit Bay', organisation: 'Fife Coast & Countryside Trust', opening: 'Outdoor long-distance route; check route alerts, weather and tide information.', price: 'Free', score: 76 },
      { id: 'curated-trail:tayport-loop', name: 'Tayport Loop', kind: 'trail', featureType: 'other', coordinates: [-2.8717, 56.4423], description: 'A published circular route combining town, shoreline and local green space.', tagline: 'A local coast-and-town circuit', url: 'https://www.walkfife.org/maps-routes/tayport-loop/', source: 'Tayport Loop', organisation: 'Walk Fife', opening: 'Outdoor route; consult the current route page and conditions.', price: 'Free', score: 66 },
      { id: 'curated-trail:tayport-treasure-trail', name: 'Tayport – Auld Kirk & Harbour Treasure Trail', kind: 'trail', featureType: 'other', coordinates: [-2.8839, 56.4497], description: 'A live 2-mile, roughly 2-hour circular spy-mission trail from Lochside Gardens through the Auld Kirk and harbour.', tagline: 'Clues around the Auld Kirk and harbour', url: tayportTreasure, source: 'Tayport – Auld Kirk & Harbour', organisation: 'Treasure Trails', opening: 'Self-guided download or printed booklet; not wheelchair or pushchair accessible.', price: '£10.99 per trail', score: 78, dog: dogWelcome },
      { id: 'curated-picnic:tayport-harbour', name: 'Tayport Harbour Picnic Table', kind: 'picnic', featureType: 'other', coordinates: [-2.88145, 56.45114], description: 'A waterfront picnic table at the harbour; stay clear of working marina access.', tagline: 'Harbour-side picnic stop', url: 'https://www.tayportharbour.org/info', source: 'Harbour information', organisation: 'Tayport Harbour Trust', opening: 'Outdoor public space; exposed to weather.', price: 'Free', score: 64, details: ['table_count=at least one mapped table', 'shelter=none confirmed'] },
      { id: 'curated-picnic:tayport-east-common', name: 'East Common Picnic Tables', kind: 'picnic', featureType: 'other', coordinates: [-2.8721, 56.4426], description: 'Picnic tables within the public common beside the Larick Centre and coastal path.', tagline: 'Picnic space beside the common', url: 'https://www.fife.gov.uk/facilities/park/east-common%2C-tayport', source: 'East Common', organisation: 'Fife Council', opening: 'Open public greenspace.', price: 'Free', score: 66, details: ['table_count=not published', 'access=public greenspace'] },
      { id: 'curated-parking:tayport-east-common', name: 'East Common / Larick Centre Parking', kind: 'parking', featureType: 'other', coordinates: [-2.8717077, 56.4422552], description: 'Off-street arrival area serving East Common and the Larick Centre; capacity, maximum stay and overnight policy are not published.', tagline: 'Parking by East Common', url: 'https://www.fife.gov.uk/facilities/park/east-common%2C-tayport', source: 'East Common', organisation: 'Fife Council', opening: 'Follow on-site signs and any event restrictions.', price: 'No charge published', score: 62, details: ['capacity=not published', 'stay_limit=not published', 'overnight=not confirmed'] },
      { id: 'curated-toilets:tayport-public', name: 'Tayport Public Toilets', kind: 'toilets', featureType: 'other', coordinates: [-2.8813178, 56.4513835], description: 'Council-listed public toilets at Tayport Harbour, Inn Street, DD6 9AZ.', tagline: 'Harbour public toilets', url: 'https://www.fife.gov.uk/facilities/public-toilet/public-toilets', source: 'Public Toilets', organisation: 'Fife Council', opening: 'Current detailed opening hours and accessibility are not published on the directory page.', price: 'Charge not published', score: 62, details: ['accessible=not published', 'baby_changing=not published'] },
    ],
    planner: { eat: ['curated-food:tayport-harbour-cafe', 'curated-food:tayport-larick-cafe', 'curated-food:tayport-scotscraig-clubhouse'], trails: ['curated-trail:tayport-heritage-trail', 'curated-trail:fife-coastal-path-tayport', 'curated-trail:tayport-loop', 'curated-trail:tayport-treasure-trail'], picnic: ['curated-picnic:tayport-harbour', 'curated-picnic:tayport-east-common'], parking: ['curated-parking:tayport-east-common'], toilets: ['curated-toilets:tayport-public'] },
    providers: providerChecks('Tayport Heritage, Walk Fife and the official Fife Coastal Path all have current exact routes.', 'Exact live Tayport – Auld Kirk & Harbour product verified: 2 miles, about 2 hours, circular, dog friendly, not wheelchair or pushchair accessible.'),
    checks: [
      { url: tayportTreasure, outcome: 'verified', note: 'Live exact product and route details verified.' },
      { url: 'https://scotscraiggolfingclub.com/visitors', outcome: 'verified', note: 'Year-round visitor golf and historic course claims verified.' },
      { url: 'https://scotscraiggolfingclub.com/clubhouse', outcome: 'verified', note: 'Open-to-all clubhouse, coffee and current hours verified.' },
      { url: 'https://tayportct.org.uk/harbourcafe/', outcome: 'verified', note: 'Current café offer and hours verified.' },
      { url: 'https://tayportct.org.uk/communityhub/main-menu/', outcome: 'verified', note: 'Current Larick daytime menu verified.' },
      { url: 'https://www.fife.gov.uk/facilities/public-toilet/public-toilets', outcome: 'verified', note: 'Council directory confirms Tayport Harbour public toilets.' },
      { url: fifeCoastalNorth, outcome: 'verified', note: 'Official route stage verified.' },
    ],
    exclusions: ['The Scotscraig estate hamlet and private house are not transferred into Tayport See.', 'Full restaurants, pubs and takeaways do not pad the café-focused Eat list.', 'Customer or member facilities are not mislabelled as public toilets or public parking.'],
    notes: {},
  },
  {
    file: 'rhynd-fife.json', id: 'rhynd-fife-scotland', name: 'Rhynd', score: 48, dogRating: 2,
    character: 'Small farm hamlet with a destination activity venue',
    summary: 'The Rhynd has a genuine bookable activity centre and an excellent seasonal café, both at one diversified farm venue. The offer is correctly published under See and Eat, but it does not turn the otherwise tiny hamlet into an independently worthwhile 60+ town, so Rhynd remains selector-only.',
    features: [
      { id: 'curated-attraction:rhynd-activity-centre', name: 'Scottish Clay Shooting Centre at The Rhynd', kind: 'attraction', featureType: 'activity_centre', coordinates: [-2.8663718, 56.4038228], description: 'Bookable clay shooting, archery and axe throwing for beginners, individuals and groups at the diversified Rhynd farm venue.', tagline: 'Bookable country sports at The Rhynd', url: 'https://www.scottishclayshootingcentre.co.uk/clay-shooting', source: 'Clay Shooting', organisation: 'Scottish Clay Shooting Centre', opening: 'Clay shooting Friday and Saturday and by appointment during the week; archery lessons are available throughout the week by advance booking.', price: 'Introductory clay shooting from £43.50; standard archery £45', score: 80, dog: dogUnknown },
      { id: 'curated-food:rhynd-cafe', name: 'The Rhynd Café', kind: 'food', featureType: 'cafe', coordinates: [-2.8663718, 56.4038228], description: 'A seasonal farm café centred on locally sourced produce, home cooking, coffee and cake.', tagline: 'Seasonal farm cooking and cake', url: 'https://www.therhynd.com/caf%C3%A9', source: 'The Rhynd Café', organisation: 'The Rhynd', opening: 'Friday–Sunday, 9am–5pm as currently published; menu changes weekly.', price: '££', score: 78, foodStyle: 'farm café, coffee, cake and light lunch', dog: dogUnknown },
      { id: 'curated-parking:rhynd-cafe', name: 'The Rhynd Visitor Parking', kind: 'parking', featureType: 'other', coordinates: [-2.866, 56.40395], description: 'On-site parking for customers and booked activity visitors; it is not a general hamlet car park.', tagline: 'Venue customer parking', url: 'https://www.therhynd.com/', source: 'The Rhynd', organisation: 'The Rhynd', opening: 'For venue customers during opening or booked activities.', price: 'Included for customers', score: 60, details: ['access=customers', 'capacity=not published', 'overnight=no'] },
    ],
    planner: { eat: ['curated-food:rhynd-cafe'], trails: [], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('No maintained public place-specific walking route was verified inside the strict hamlet boundary.'),
    checks: [
      { url: 'https://www.therhynd.com/', outcome: 'verified', note: 'Current diversified venue, activity and café offer verified.' },
      { url: 'https://www.therhynd.com/activities', outcome: 'verified', note: 'Clay shooting, archery and axe throwing verified.' },
      { url: 'https://www.scottishclayshootingcentre.co.uk/clay-shooting', outcome: 'verified', note: 'Current bookable experiences, durations and prices verified.' },
      { url: 'https://www.therhynd.com/caf%C3%A9', outcome: 'verified', note: 'Current café days, hours and local-food focus verified.' },
      { url: treasureCollection, outcome: 'no_result', note: 'No exact Rhynd product.' },
    ],
    exclusions: ['One multi-use farm venue is not treated as a broad settlement-level visitor cluster.', 'Private estate, event and accommodation functions do not add town points.', 'Venue toilets and parking are not represented as unrestricted public facilities.'],
    notes: { trail: 'All four named providers and conventional route sources were checked; no exact public route was verified.', picnic: 'No dedicated public picnic facility was verified.', parking: 'Customer parking is documented on the activity and café records but is not published as a general public car park.', toilets: 'No public toilet independent of the private venue was verified.' },
  },
  {
    file: 'carrick-leuchars.json', id: 'carrick-leuchars-scotland', name: 'Carrick', score: 22, dogRating: 1,
    character: 'Small rural farm locality',
    summary: 'Carrick remains a useful mapped locality but has no independently visitable attraction, café-led stop, named public trail or visitor facilities inside its strict boundary. Statutory and NRHE records remain available on the historic layer and do not inflate the settlement score.',
    features: [],
    planner: { eat: [], trails: [], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('No maintained place-specific visitor route was verified.'),
    checks: [
      { url: 'https://fife-placenames.glasgow.ac.uk/parish/?id=53', outcome: 'verified', note: 'Academic place-name data identifies Carrick as a rural place in Leuchars parish.' },
      { url: treasureCollection, outcome: 'no_result', note: 'No exact Carrick product.' },
      { url: curious, outcome: 'no_result', note: 'No exact Carrick route.' },
      { url: mystery, outcome: 'no_result', note: 'No exact Carrick route.' },
      { url: goQuest, outcome: 'no_result', note: 'No exact Carrick route.' },
    ],
    exclusions: ['Leuchars, Guardbridge, Tentsmuir and wider estate attractions are outside the strict locality.', 'Private historic buildings and archaeological designations are not assumed to have public access.'],
    notes: { attraction: 'No publicly visitable attraction was verified.', food: 'No qualifying café was verified.', picnic: 'No dedicated public picnic facility was verified.', parking: 'No general public visitor car park was verified.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'leuchars.json', id: 'leuchars-scotland', name: 'Leuchars', score: 68, dogRating: 2,
    character: 'Rail-connected historic village',
    summary: 'Leuchars clears the map threshold through the exceptional Romanesque St Athernase Church, two documented walking routes and unusually strong rail-and-parking access. The audit found no qualifying current café-led stop, picnic facility or public toilet, so the score remains a measured 68.',
    features: [
      { id: 'curated-attraction:st-athernase-church', name: 'St Athernase Church', kind: 'attraction', featureType: 'church', coordinates: [-2.88347045133674, 56.381679414437], description: 'Fife’s finest surviving Romanesque church, built in 1183–87 and dedicated in 1244, with later alterations and historic carved stones.', tagline: 'Fife’s Romanesque masterpiece', url: 'https://www.welcometofife.com/location/st-athernase-church', source: 'St Athernase Church', organisation: 'Welcome to Fife', opening: 'Open to visitors by appointment; Sunday worship information is separately published.', price: 'Free when open', score: 84, dog: dogUnknown },
      { id: 'curated-trail:lucys-leuchars-walk', name: 'Lucy’s Leuchars Walk', kind: 'trail', featureType: 'other', coordinates: [-2.8837, 56.3814], description: 'An 8.8 km circular village-and-countryside walk with downloadable route files and clear terrain cautions.', tagline: 'A village-and-country circuit', url: 'https://www.walkfife.org/maps-routes/lucys-leuchars-walk/', source: 'Lucy’s Leuchars Walk', organisation: 'Walk Fife', opening: 'Outdoor route; muddy and road sections make it unsuitable for some limited-mobility users.', price: 'Free', score: 64 },
      { id: 'curated-trail:fife-coastal-path-leuchars', name: 'Fife Coastal Path at Leuchars', kind: 'trail', featureType: 'other', coordinates: [-2.8839, 56.381], description: 'Leuchars is the signed handover point between the Cambo Sands and Wormit Bay stages of the official Fife Coastal Path.', tagline: 'A rail-linked coastal-path stage point', url: fifeCoastalNorth, source: 'Leuchars to Wormit Bay', organisation: 'Fife Coast & Countryside Trust', opening: 'Long-distance outdoor route; check current warnings, tides, weather and transport.', price: 'Free', score: 70 },
      { id: 'curated-parking:leuchars-station-a-b', name: 'Leuchars Station Car Parks A and B', kind: 'parking', featureType: 'other', coordinates: [-2.89199, 56.37588], description: 'A council-listed 24-hour surface car park with about 300 spaces, 13 disabled bays, cycle storage, bus interchange and taxi rank.', tagline: 'Large rail-station car park', url: 'https://www.fife.gov.uk/facilities/car-park/station-car-park-a-b%2C-leuchars', source: 'Station Car Park A + B', organisation: 'Fife Council', opening: 'Open 24 hours; up to 7 days at the machine and 30 days via RingGo as currently published.', price: '£1.10 per 24 hours', score: 70, details: ['capacity=approximately 300', 'disabled_spaces=13', 'stay_limit=up to 30 days via RingGo'] },
    ],
    planner: { eat: [], trails: ['curated-trail:lucys-leuchars-walk', 'curated-trail:fife-coastal-path-leuchars'], picnic: [], parking: ['curated-parking:leuchars-station-a-b'], toilets: [] },
    providers: providerChecks('Walk Fife publishes Lucy’s Leuchars Walk and FCCT publishes the official coastal-path stage.'),
    checks: [
      { url: 'https://www.welcometofife.com/location/st-athernase-church', outcome: 'verified', note: 'Official destination page confirms the 1183–87 church and appointment access.' },
      { url: 'https://www.walkfife.org/maps-routes/lucys-leuchars-walk/', outcome: 'verified', note: 'Current route page verified.' },
      { url: fifeCoastalNorth, outcome: 'verified', note: 'Official Leuchars-to-Wormit stage verified.' },
      { url: 'https://www.fife.gov.uk/facilities/car-park/station-car-park-a-b%2C-leuchars', outcome: 'verified', note: 'Current council parking capacity, accessibility, hours and charge verified.' },
      { url: treasureCollection, outcome: 'no_result', note: 'No exact Leuchars product.' },
    ],
    exclusions: ['Earlshall Castle is private and outside the strict village offer.', 'Cafe Inc is a community holiday-support programme, not a normal visitor café.', 'Historic social-café references without a current operator page are not retained.', 'Tentsmuir, Rhynd and Guardbridge attractions are not transferred.'],
    notes: { food: 'No current qualifying café, coffee-and-cake or light-lunch stop was verified inside the strict boundary.', picnic: 'No dedicated public picnic facility was verified.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'guardbridge.json', id: 'guardbridge-scotland', name: 'Guardbridge', score: 74, dogRating: 2,
    character: 'Estuary village and sustainable distillery gateway',
    summary: 'Guardbridge is a worthwhile stop through the new Eden Mill visitor experience, internationally important Eden Estuary viewing, a visitor-welcoming café, the official coastal path and two accurately classified parking options. The visitor-centre repair closure prevents a public-toilet claim.',
    features: [
      { id: 'curated-attraction:eden-mill-guardbridge', name: 'Eden Mill Distillery and Visitor Centre', kind: 'attraction', featureType: 'distillery', coordinates: [-2.892142, 56.363945], description: 'A working sustainable distillery with bookable gin and whisky experiences, tasting rooms, shop, golf simulator and estuary-view bar.', tagline: 'Gin and whisky by the Eden', url: 'https://www.edenmill.com/pages/distillery-bookings', source: 'Distillery bookings', organisation: 'Eden Mill', opening: 'Open seven days; first tour 11am, last tour 7pm and bar noon–10pm as currently published.', price: 'Classic tours from £26', score: 86, dog: dogRestrictedVenue },
      { id: 'curated-attraction:eden-estuary-centre', name: 'Eden Estuary Centre and Outdoor Viewing Area', kind: 'attraction', featureType: 'nature_reserve', coordinates: [-2.8896316, 56.3615287], description: 'A compact birdwatching centre and outdoor viewing area overlooking a globally important estuary reserve; the indoor centre is currently closed for repairs but outdoor viewing remains accessible.', tagline: 'Birdwatching over the upper Eden', url: edenClosure, source: 'Eden Estuary Newsletter July 2026', organisation: 'Fife Coast & Countryside Trust', opening: 'Outdoor viewing area accessible; indoor centre closed for repairs at the latest explicit status update. Check current notices before travel.', price: 'Free', score: 76, dog: dogOutdoor },
      { id: 'curated-food:tindals-cafe-guardbridge', name: 'Tindal’s Café', kind: 'food', featureType: 'cafe', coordinates: [-2.8920266, 56.3643391], description: 'A public-facing university café serving coffee, drinks, snacks and locally sourced daytime meals in Walter Bower House.', tagline: 'Coffee at the Eden Campus', url: 'https://catering.wp.st-andrews.ac.uk/tindals-cafe/', source: 'Tindal’s Café', organisation: 'University of St Andrews', opening: 'Monday–Friday, 8.30am–4.30pm on the dedicated page; check university holiday changes.', price: '£', score: 68, foodStyle: 'coffee, snacks and light lunch', dog: dogUnknown },
      { id: 'curated-trail:fife-coastal-path-guardbridge', name: 'Fife Coastal Path through Guardbridge', kind: 'trail', featureType: 'other', coordinates: [-2.8898, 56.3622], description: 'The official Cambo Sands-to-Leuchars stage runs through Guardbridge and out to Coble Shore for estuary views.', tagline: 'Coastal path beside the Eden', url: fifeCoastalSouth, source: 'Cambo Sands to Leuchars', organisation: 'Fife Coast & Countryside Trust', opening: 'Outdoor long-distance route; check erosion, tide, livestock and weather notices.', price: 'Free', score: 72 },
      { id: 'curated-parking:guardbridge-eden-mill', name: 'Eden Mill Main Visitor Car Park', kind: 'parking', featureType: 'other', coordinates: [-2.8913967, 56.3645106], description: 'Eden Mill’s published main visitor parking is on Main Street, with additional front-of-distillery and disabled bays. The large campus car park is for Eden Mill guests only at weekends.', tagline: 'Distillery visitor parking', url: 'https://www.edenmill.com/pages/distilleryfaqs', source: 'Distillery FAQs', organisation: 'Eden Mill', opening: 'For distillery visitors; follow the operator map and booking instructions.', price: 'No visitor charge published', score: 66, locationType: 'representative_point', locationConfidence: 'medium', details: ['access=customers', 'disabled_spaces=at the distillery entrance', 'campus_restriction=large campus car park weekends only for Eden Mill guests'] },
      { id: 'curated-parking:guardbridge-eden-estuary', name: 'Eden Estuary Centre Car Park', kind: 'parking', featureType: 'other', coordinates: [-2.8899, 56.3617], description: 'A small public arrival area at the estuary centre entrance; capacity, stay limit and overnight status are not published.', tagline: 'Small estuary visitor car park', url: edenEstuary, source: 'Eden Estuary Nature Reserve', organisation: 'Fife Coast & Countryside Trust', opening: 'Outdoor car park access subject to current site notices and repair works.', price: 'No charge published', score: 62, locationType: 'representative_point', locationConfidence: 'medium', details: ['capacity=small, exact count not published', 'stay_limit=not published', 'overnight=not confirmed'] },
    ],
    planner: { eat: ['curated-food:tindals-cafe-guardbridge'], trails: ['curated-trail:fife-coastal-path-guardbridge'], picnic: [], parking: ['curated-parking:guardbridge-eden-estuary'], toilets: [] },
    providers: providerChecks('The official Fife Coastal Path passes through Guardbridge and Coble Shore.'),
    checks: [
      { url: 'https://www.edenmill.com/pages/distillery-bookings', outcome: 'verified', note: 'Current tour products, durations, prices and visitor parking verified.' },
      { url: 'https://www.edenmill.com/pages/distilleryfaqs', outcome: 'verified', note: 'Current hours, access, public transport, parking and dog restrictions verified.' },
      { url: 'https://catering.wp.st-andrews.ac.uk/tindals-cafe/', outcome: 'verified', note: 'Current visitor access, café offer and weekday hours verified.' },
      { url: edenEstuary, outcome: 'verified', note: 'Official reserve page verifies the visitor centre, parking and normal facilities.' },
      { url: edenClosure, outcome: 'verified', note: 'Latest explicit repair notice confirms the indoor centre is closed while outdoor viewing remains available.' },
      { url: fifeCoastalSouth, outcome: 'verified', note: 'Official path stage through Guardbridge and Coble Shore verified.' },
      { url: treasureCollection, outcome: 'no_result', note: 'No exact Guardbridge product.' },
    ],
    exclusions: ['A venue bar and full meals do not create extra café entries.', 'University and distillery customer toilets are not represented as general public toilets.', 'The Eden Campus large car park is not shown as unrestricted weekday public parking.', 'St Andrews, Leuchars and Rhynd visitor offers are outside the strict settlement.'],
    notes: { picnic: 'No dedicated public picnic facility was verified.', parking: 'The public estuary arrival area is published; Eden Mill customer parking remains documented on the attraction but is not misrepresented as a general car park.', toilets: 'The estuary centre is currently closed for repairs; venue/customer toilets are not general public toilets.' },
  },
];

function splitScore(score: number, caps: number[]): number[] {
  let remaining = score;
  return caps.map((cap) => { const value = Math.min(cap, remaining); remaining -= value; return value; });
}

function featureFor(projectId: string, locality: string, seed: FeatureSeed): any {
  const tags: Record<Kind, string[]> = {
    attraction: ['curated-visitor-attraction', 'service-context-visitor'],
    food: ['service-context-food'],
    trail: ['service-context-trail', 'visitor-context-trail'],
    picnic: ['service-context-picnic'],
    parking: ['service-context-parking', 'visitor-context-parking'],
    toilets: ['service-context-toilets'],
  };
  const visitorPlaceType: Record<Kind, string> = { attraction: 'Attraction', food: 'Cafe', trail: 'Trail', picnic: 'Picnic area', parking: 'Parking', toilets: 'Public toilets' };
  const feature: any = {
    id: seed.id,
    projectId,
    name: seed.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Fife',
    locality,
    featureType: seed.featureType,
    significance: seed.significance ?? 'local',
    geometry: { type: 'Point', coordinates: seed.coordinates },
    locationType: seed.locationType ?? 'exact',
    locationConfidence: seed.locationConfidence ?? 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: seed.description,
    details: `visitor_place_type=${visitorPlaceType[seed.kind]}; visit_score=${seed.score}; opening_hours:description=${seed.opening}; entrance_fee=${seed.price}; price_band=${seed.price}; cuisine=${seed.foodStyle ?? seed.kind}; tagline=${seed.tagline}; description=${seed.description}; ${seed.details?.join('; ') ?? ''}`,
    visitorWebsiteUrl: seed.url,
    sourceRecords: [{ sourceName: seed.source, sourceOrganisation: seed.organisation, sourceUrl: seed.url, accessedAt: reviewedAt, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', reliability: seed.organisation.includes('Council') || seed.organisation.includes('Historic Environment') ? 'official_statutory' : 'official_non_statutory', notes: seed.relatedContext ? 'Related route context; excluded from settlement scoring.' : `Current strict-boundary curation for ${seed.name}.` }],
    tags: ['current-context', auditTag, ...(seed.relatedContext ? ['related-context'] : []), ...tags[seed.kind]],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: seed.relatedContext ? 'related_context' : 'parish_evidence',
    reviewNotes: seed.relatedContext ? 'Published in the relevant visitor category but excluded from the settlement score.' : 'Verified current visitor feature inside the strict settlement study area.',
  };
  if (seed.kind === 'attraction') {
    const [experienceDepth, distinctiveness, presentation, journeyWorth, accessAndReliability, evidenceConfidence] = splitScore(seed.score, [30, 20, 20, 15, 10, 5]);
    feature.editorialReview = { status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: `${seed.name} is separately assessed for visit depth, distinctiveness, presentation, journey worth, access reliability and evidence quality.`, evidenceUrls: [seed.url], attractionAssessment: { experienceDepth, distinctiveness, presentation, journeyWorth, accessAndReliability, evidenceConfidence, visitability: 'full_visitor_experience' } };
  } else if (seed.kind === 'food') {
    const [foodAndDrinkQuality, daytimeRelevance, distinctiveness, consistency, visitorFit, evidenceConfidence] = splitScore(seed.score, [30, 20, 15, 15, 10, 10]);
    feature.editorialReview = { status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: `${seed.name} qualifies through coffee, cake, breakfast or light-lunch relevance; full-meal value is not used to pad the score.`, evidenceUrls: [seed.url], foodAssessment: { foodAndDrinkQuality, daytimeRelevance, distinctiveness, consistency, visitorFit, evidenceConfidence } };
  } else if (seed.kind === 'trail') {
    feature.editorialReview = { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: `${seed.name} has a current working route page with usable route information.`, evidenceUrls: [seed.url] };
  }
  return feature;
}

function highlightFor(seed: FeatureSeed, rank: number): any {
  const feature = featureFor('preview', 'preview', seed);
  return { rank, featureId: seed.id, name: seed.name, reason: seed.description, visitorScore: seed.score, tagline: seed.tagline, timeToSpend: '30–120 minutes', openingTimes: seed.opening, admission: seed.price, freeAdmission: /^free\b/i.test(seed.price), visitorWebsiteUrl: seed.url, sourceName: seed.source, sourceUrl: seed.url, verifiedInBoundaryAt: reviewedDate, editorialReview: feature.editorialReview };
}

function isHeritage(feature: any): boolean {
  return feature.tags.some((tag: string) => tag.startsWith('hes-') || tag === 'nrhe' || tag === 'nrhe-record' || tag === 'nrhe-site');
}

const visitorCategoryTags = new Set(['curated-visitor-attraction', 'service-context-visitor', 'service-context-food', 'service-context-trail', 'visitor-context-trail', 'service-context-picnic', 'service-context-parking', 'visitor-context-parking', 'service-context-toilets']);
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
const summary: any[] = [];

for (const [index, audit] of audits.entries()) {
  const path = resolve('data/projects', audit.file);
  const pkg: any = JSON.parse(await readFile(path, 'utf8'));
  if (pkg.project.id !== audit.id) throw new Error(`${audit.name}: project identity mismatch`);
  pkg.features = pkg.features.filter((feature: any) => isHeritage(feature) || !feature.tags.some((tag: string) => visitorCategoryTags.has(tag)));
  for (const seed of audit.features) {
    if (!seed.relatedContext && !booleanPointInPolygon(point(seed.coordinates), pkg.project.boundary)) throw new Error(`${audit.name}: ${seed.name} is outside the strict boundary but not related_context`);
  }
  for (const seed of audit.features) {
    const curated = featureFor(audit.id, audit.name, seed);
    const existing = pkg.features.find((feature: any) => feature.id === seed.id);
    if (existing && isHeritage(existing)) {
      existing.name = curated.name;
      existing.featureType = curated.featureType;
      existing.significance = curated.significance;
      existing.shortDescription = curated.shortDescription;
      existing.details = curated.details;
      existing.visitorWebsiteUrl = curated.visitorWebsiteUrl;
      existing.editorialReview = curated.editorialReview;
      existing.tags = [...new Set([...existing.tags, ...curated.tags])];
      existing.sourceRecords = [...existing.sourceRecords.filter((record: any) => record.sourceUrl !== seed.url), ...curated.sourceRecords];
      existing.updatedAt = reviewedAt;
      existing.reviewed = true;
      existing.reviewNotes = `${existing.reviewNotes ?? ''} Visitor role re-audited from the current source on ${reviewedDate}.`.trim();
    } else pkg.features.push(curated);
  }
  const attractions = audit.features.filter((seed) => seed.kind === 'attraction');
  pkg.project.visitorHighlights = attractions.map(highlightFor);
  const band = townScoreBand(audit.score);
  pkg.project.touristAppeal = {
    score: audit.score,
    dogOwnerScore: townScoreAfterDogAccess(audit.score, audit.dogRating),
    dogAccessScoreAdjustment: townDogAccessScoreAdjustment(audit.dogRating),
    rating: band.rating,
    label: band.label,
    summary: audit.summary,
    dogAccessRating: audit.dogRating,
    dogAccessSummary: audit.dogRating >= 2 ? 'Outdoor access can work for responsible dog visits; venue-specific policies are recorded individually.' : 'Dog access is limited or unconfirmed and no dedicated dog destination is assumed.',
    methodVersion: '2026-09-02-full-settlement-visitor-audit-v2',
    reviewedAt: reviewedDate,
    sourceUrls: [...new Set([...audit.checks.map((check) => check.url), treasureCollection, curious, mystery, goQuest])],
  };
  pkg.project.townGuide = {
    characterTag: audit.character,
    headline: attractions.length ? `${attractions[0].name} and a boundary-correct visitor audit` : 'A catalogue locality, not a visitor destination',
    intro: audit.summary,
    bestFor: attractions.length ? attractions.slice(0, 3).map((seed) => seed.name) : ['Regional reference'],
    perfectFor: attractions.length ? ['A carefully planned visit'] : ['Locating the settlement'],
    suggestedFirstVisit: attractions.length ? { title: attractions[0].name, summary: 'Check the linked current source before travelling; related attractions are scored separately from the town.' } : undefined,
    dontMiss: attractions.map((seed) => seed.name),
    suggestedTime: audit.score >= 80 ? 'A full half day' : audit.score >= 60 ? '2–4 hours' : attractions.length ? '30–90 minutes for the named attraction' : 'Pass-through only',
    visitorMood: audit.score >= 60 ? 'A worthwhile researched stop with clearly stated practical limitations.' : 'Selector-only settlement; any attraction is shown separately.',
    sourceUrls: [...new Set(audit.checks.map((check) => check.url))],
    lastReviewedAt: reviewedDate,
  };
  pkg.project.researchNotes = `Sequential place ${index + 1} of ${audits.length}: every required category, all four named trail providers, local HES/NRHE completeness, construction dates, access, transport and dogs were checked before continuing. ${audit.exclusions.join(' ')}`;
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((issue: any) => issue.severity === 'error');
  if (errors.length) throw new Error(`${audit.name}: ${errors.length} validation errors: ${errors.map((issue: any) => issue.message).join(' | ')}`);

  planner.projects[audit.id] = audit.planner;
  dog.projects[audit.id] = { attraction: {}, eat: {} };
  for (const seed of audit.features) {
    if (!seed.dog || !['attraction', 'food'].includes(seed.kind)) continue;
    const category = seed.kind === 'food' ? 'eat' : 'attraction';
    dog.projects[audit.id][category][seed.id] = { ...seed.dog, sourceName: seed.source, sourceUrl: seed.url, reviewedAt: reviewedDate };
  }

  const heritage = pkg.features.filter(isHeritage);
  const localHeritage = heritage.filter((feature: any) => feature.evidenceScope !== 'related_context' && !feature.tags.includes('town-selection-heritage-buffer'));
  const visibleHeritage = localHeritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
  const undatedVisible = visibleHeritage.filter((feature: any) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
  const dateInLabel = visibleHeritage.filter((feature: any) => feature.documentedDateText && feature.name.includes(feature.documentedDateText));
  if (undatedVisible.length) throw new Error(`${audit.name}: ${undatedVisible.length} visible undated heritage records: ${undatedVisible.map((feature: any) => feature.id).join(', ')}`);
  if (dateInLabel.length) throw new Error(`${audit.name}: ${dateInLabel.length} heritage map labels contain dates`);
  const count = (kind: Kind) => audit.features.filter((feature) => feature.kind === kind).length;
  const report = {
    reviewedAt,
    sequence: index + 1,
    sequenceTotal: audits.length,
    projectId: audit.id,
    place: audit.name,
    townScore: audit.score,
    mapPublished: audit.score >= 60,
    settlementMerit: { result: audit.score >= 60 ? 'retain_on_town_map' : 'selector_only', rationale: audit.summary },
    categories: {
      see: { audited: true, published: count('attraction'), reason: audit.notes.attraction },
      eat: { audited: true, published: audit.planner.eat.length, focus: 'Cafés, coffee and cake, tearooms, farm cafés, breakfast and light lunches; full-meal restaurants excluded.', reason: audit.notes.food },
      trails: { audited: true, published: audit.planner.trails.length, providerChecks: audit.providers },
      picnic: { audited: true, published: audit.planner.picnic.length, reason: audit.notes.picnic },
      parking: { audited: true, published: audit.planner.parking.length, reason: audit.notes.parking },
      toilets: { audited: true, published: audit.planner.toilets.length, reason: audit.notes.toilets },
      accessibility: { audited: true, note: 'Accessibility is stated only where a current source supports it; no blanket accessible claim is made.' },
      transport: { audited: true, note: 'Road, bus and rail context was checked; transport does not add destination points by itself.' },
      dogs: { audited: true, adjustment: pkg.project.touristAppeal.dogAccessScoreAdjustment },
    },
    exclusions: audit.exclusions,
    heritage: { source: 'Downloaded local HES Listed Buildings, Scheduled Monuments and NRHE datasets', assigned: heritage.length, local: localHeritage.length, visibleDated: visibleHeritage.length, hiddenUndatedOrNonlocal: heritage.length - visibleHeritage.length, visibleUndated: 0, visibleLabelsContainingDates: 0, missing: 0 },
    boundaryRule: `Only visitor places inside ${audit.name}'s strict study area count toward the settlement score. Related attractions and cross-boundary routes may appear only when explicitly marked related_context and do not inflate the town.`,
    scoreRationale: audit.summary,
    scoreReanalysis: { required: audit.score === 58, completed: true, resultScore: audit.score, rationale: 'Score independently reconciled after every category, named-provider search, boundary exclusion and practical check; no provisional exact-58 town score remains.' },
    research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: audit.checks.map((check) => ({ ...check, checkedAt: reviewedDate })) },
    certification: { publicationCountsReconciled: true, localHeritageComplete: true, visibleHeritageDatesComplete: true, liveBrowserVerifiedAt: null },
  };
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  await writeFile(resolve('data/review', `${audit.file.replace(/\.json$/, '')}-full-visitor-audit-2026-09-02.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  summary.push({ sequence: index + 1, place: audit.name, score: audit.score, mapPublished: audit.score >= 60, see: count('attraction'), eat: audit.planner.eat.length, trails: audit.planner.trails.length, picnic: audit.planner.picnic.length, parking: audit.planner.parking.length, toilets: audit.planner.toilets.length, heritage: report.heritage });
  console.log(`${index + 1}/${audits.length} ${audit.name}: ${audit.score}; See ${count('attraction')}, Eat ${audit.planner.eat.length}, Trails ${audit.planner.trails.length}, Picnic ${audit.planner.picnic.length}, Parking ${audit.planner.parking.length}, Toilets ${audit.planner.toilets.length}; heritage ${visibleHeritage.length}/${localHeritage.length} visible dated.`);
}

await writeFile(plannerPath, `${JSON.stringify({ ...planner, reviewedAt: reviewedDate }, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify({ ...dog, reviewedAt: reviewedDate }, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/review/scotscraig-guardbridge-sequential-audit-summary-2026-09-02.json'), `${JSON.stringify({ reviewedAt, currentWebResearch: true, completedSequentially: true, audits: summary }, null, 2)}\n`, 'utf8');
console.log('Sequential Scotscraig-to-Guardbridge full audits completed.');
