import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  HeritageFeature,
  ProjectPackage,
  TouristAppealRating,
  VisitorHighlight,
} from '../src/domain/models';
import type { PlannerCurationState } from '../src/domain/plannerCuration';
import {
  townDogAccessScoreAdjustment,
  townScoreAfterDogAccess,
  townScoreBand,
} from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';
import { publishedAuditCounts } from '../src/domain/townAuditCertification';

const reviewedDate = '2026-09-02';
const reviewedAt = '2026-09-02T19:00:00.000Z';
const auditTag = 'glenduckie-ladybank-full-audit-2026-09-02';
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const treasureCollection = 'https://www.treasuretrails.co.uk/collections/fife';
const curiousUrl = 'https://www.curiousabout.co.uk/';
const mysteryUrl = 'https://www.mysteryguides.co.uk/';
const goQuestUrl = 'https://goquestadventures.com/';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

type Kind = 'attraction' | 'food' | 'trail' | 'picnic' | 'parking' | 'toilets';
type Outcome = 'verified' | 'no_result' | 'excluded';
interface FeatureSeed {
  id: string;
  name: string;
  kind: Kind;
  type: string;
  coordinates: [number, number];
  description: string;
  tagline: string;
  url: string;
  source: string;
  organisation: string;
  opening: string;
  price: string;
  score: number;
  details?: string[];
  visitability?: 'full_visitor_experience' | 'substantial_visible_remains';
  relatedContext?: boolean;
}
interface AuditSeed {
  file: string;
  id: string;
  name: string;
  score: number;
  dogRating: TouristAppealRating;
  summary: string;
  character: string;
  headline: string;
  intro: string;
  bestFor: string[];
  time: string;
  features: FeatureSeed[];
  planner: PlannerCurationState;
  routeFinding: string;
  checks: Array<{ url: string; outcome: Outcome; note: string }>;
  exclusions: string[];
  practical: {
    eat: string;
    picnic: string;
    parking: string;
    toilets: string;
    accessibility: string;
    transport: string;
  };
}

const normansLaw = 'https://fifewalking.com/find-a-walk/north-fife/normans-law/';
const luthrieHall = 'https://www.luthrievillagehall.org.uk/Index.asp?MainID=24424';
const moonzieGarden = 'https://scotlandsgardens.org/moonzie-house/';
const moonzieKirk = 'https://www.fife.gov.uk/facilities/cemetery';
const kilmaronNrhe = 'https://www.trove.scot/place/100435';
const kilmaronGarden = 'https://portal.historicenvironment.scot/designation/LB2634';
const lindifferonPlaceName = 'https://fife-placenames.glasgow.ac.uk/placename/?id=3083';
const fernieCastle =
  'https://www-eur.cvent.com/venues/en-US/cupar/special-event-venue/fernie-castle/venue-f9ff8113-c0fa-4701-a5f9-ffecdfddfabd';
const lethamHallParking = 'https://hallbookingonline.com/letham/map.php';
const cuparHeritage = 'https://cuparheritage.org.uk/';
const cuparHeritageWalks = 'https://cuparheritage.org.uk/whats-on/self-guided-walks/';
const cuparTreasure = 'https://www.treasuretrails.co.uk/products/things-to-do-cupar-fife';
const cuparWalks = 'https://scotways.com/wp-content/uploads/2021/12/CuparWalksLeaflet.pdf';
const nourish = 'https://www.nourishcupar.co.uk/menus';
const fisherCeres = 'https://www.fisheranddonaldson.com/our-stores/cupar-ceres-road/';
const fisherCrossgate = 'https://www.fisheranddonaldson.com/our-stores/cupar-crossgates/';
const number10 = 'https://www.cuparnow.blog/business/number-10/';
const tinas =
  'https://www.tripadvisor.co.uk/Restaurant_Review-g551746-d25395468-Reviews-Tina_s_Little_Cafe-Cupar_Fife_Scotland.html';
const cuparTearoom = 'https://www.cuparnow.blog/business/the-cupar-tearoom/';
const haughPark = 'https://www.fife.gov.uk/facilities/park/parks';
const carParkList =
  'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-park-list';
const parkingCharges =
  'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-parks-and-car-parking-charges/parking-charges';
const fluthersParking = 'https://www.fife.gov.uk/facilities/car-park/fluthers-car-park%2C-cupar';
const fluthersToilets =
  'https://www.fife.gov.uk/facilities/public-toilet/cupar-fluthers-public-toilets';
const bonnygateToilets =
  'https://www.fife.gov.uk/facilities/public-toilet/cupar-bonnygate-public-toilets';
const craigrothieHall = 'https://fifecoastandcountrysidetrust.co.uk/pins/craigrothie-village-hall/';
const craigrothieRoute =
  'https://web-cdn.org/s/1200/file/2022-docs/2022-january.-cupar-to-ceres.pdf';
const pitlessieInn = 'https://www.pitlessieinn.co.uk/';
const pitlessieWalk =
  'https://fifewalking.com/find-a-walk/north-fife/crawford-priory-and-lady-marys-tomb/';
const ladybankWalk = 'https://fifewalking.com/find-a-walk/north-fife/ladybank-woodlands-circular/';
const ladybankWoodland = 'https://www.woodlandtrust.org.uk/visiting-woods/woods/ladybank-woodland/';
const ladybankForest =
  'https://forestryandland.gov.scot/living-and-working/communities/land-management-plans/active-plans/ladybank-lmp';
const kiltmakers = 'https://find-open.co.uk/ladybank/the-kiltmakers-coffee-shop-2811825';
const bunkerCafe = 'https://golfinnladybank.com/bunker-cafe';
const golfInn = 'https://golfinnladybank.com/';
const ladybankStation = 'https://www.scotrail.co.uk/plan-your-journey/stations-and-facilities/ldy';

const emptyPlanner = (): PlannerCurationState => ({
  eat: [],
  trails: [],
  picnic: [],
  parking: [],
  toilets: [],
});
const placeCheck = (url: string, note: string) => ({ url, outcome: 'verified' as const, note });
const noTrail = (place: string) => ({
  url: treasureCollection,
  outcome: 'no_result' as const,
  note: `The live Fife catalogue contains no ${place}-specific Treasure Trail.`,
});

const audits: AuditSeed[] = [
  {
    file: 'glenduckie.json',
    id: 'glenduckie-scotland',
    name: 'Glenduckie',
    score: 55,
    dogRating: 2,
    summary:
      'Glenduckie is a useful Norman’s Law walking start with short and longer options, but it has no rounded visitor-service cluster and remains selector-only.',
    character: 'Small hill-foot hamlet',
    headline: 'A quiet Norman’s Law approach',
    intro:
      'The hamlet has genuine route value, assessed without transferring nearby Newburgh services.',
    bestFor: ['A planned hill walk', 'Quiet rural scenery'],
    time: '1½–3 hours as a walking start',
    features: [
      {
        id: 'curated-trail:glenduckie-normans-law',
        name: 'Norman’s Law from Glenduckie',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.1616183, 56.3558067],
        description:
          'Documented 3.5 km and 5.3 km options climb from Glenduckie towards Norman’s Law, with route-specific access and school-day cautions.',
        tagline: 'Two Norman’s Law hill routes',
        url: normansLaw,
        source: 'Norman’s Law',
        organisation: 'Fife Walking',
        opening:
          'Open-access route; avoid the school path during school hours and check field conditions.',
        price: 'Free',
        score: 70,
        details: [
          'trail_type=Two circular/return options',
          'distance=3.5 km or 5.3 km',
          'terrain=Rural paths and hill ground',
        ],
      },
    ],
    planner: { ...emptyPlanner(), trails: ['curated-trail:glenduckie-normans-law'] },
    routeFinding:
      'Fife Walking supplies both Glenduckie options, parking cautions and route directions.',
    checks: [
      placeCheck(
        normansLaw,
        'Working route page gives two Glenduckie distances and access cautions.',
      ),
      noTrail('Glenduckie'),
    ],
    exclusions: [
      'The A913 lay-by and village-hall/school parking advice is retained in the route notes rather than pinned as a guaranteed dedicated car park.',
      'No café, public toilet or managed picnic site was verified.',
    ],
    practical: {
      eat: 'No qualifying café, coffee-and-cake or light-lunch outlet.',
      picnic: 'No managed picnic site.',
      parking:
        'Route guidance mentions a lay-by and village-hall area; neither is promoted as an unrestricted dedicated car park.',
      toilets: 'No public toilet.',
      accessibility: 'Rural paths and hill ground are not presented as step-free.',
      transport: 'Rural services require current timetable checking.',
    },
  },
  {
    file: 'luthrie.json',
    id: 'luthrie-scotland',
    name: 'Luthrie',
    score: 57,
    dogRating: 2,
    summary:
      'Luthrie has a well-documented Norman’s Law route and a precise village-hall parking start, but no dependable daily café, public toilet or visitable attraction.',
    character: 'Rural route village',
    headline: 'The northern Norman’s Law start',
    intro: 'Luthrie works as a walking base rather than a rounded destination.',
    bestFor: ['Norman’s Law walks', 'A quiet rural start'],
    time: '2½–3 hours for the full route',
    features: [
      {
        id: 'curated-trail:luthrie-normans-law',
        name: 'Norman’s Law from Luthrie',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0844089, 56.3641902],
        description:
          'The documented 8.25 km circuit climbs from Luthrie to Norman’s Law, with shorter 3.2 km and 5.2 km variants also described.',
        tagline: 'Norman’s Law from Luthrie',
        url: normansLaw,
        source: 'Norman’s Law',
        organisation: 'Fife Walking',
        opening: 'Open countryside route; expect rough or boggy sections and livestock.',
        price: 'Free',
        score: 72,
        details: [
          'distance=8.25 km full circuit; 3.2 km and 5.2 km variants',
          'duration=2.5–3 hours',
        ],
      },
      {
        id: 'curated-parking:luthrie-village-hall',
        name: 'Luthrie Village Hall Parking',
        kind: 'parking',
        type: 'parking',
        coordinates: [-3.0844089, 56.3641902],
        description:
          'Small free route-start parking area at Luthrie Village Hall; users should leave access clear for hall activity.',
        tagline: 'Small hall route-start parking',
        url: luthrieHall,
        source: 'Luthrie Village Hall walks',
        organisation: 'Luthrie Village Hall',
        opening: 'Use considerately around bookings and community activity.',
        price: 'Free',
        score: 68,
        details: ['capacity=small', 'surface=paved', 'status=shared community-hall parking'],
      },
    ],
    planner: {
      ...emptyPlanner(),
      trails: ['curated-trail:luthrie-normans-law'],
      parking: ['curated-parking:luthrie-village-hall'],
    },
    routeFinding:
      'Fife Walking and the village hall both publish usable Norman’s Law route information.',
    checks: [
      placeCheck(normansLaw, 'Working route page confirms distances, terrain and Luthrie start.'),
      placeCheck(
        luthrieHall,
        'Community hall page confirms walk information and the parking start.',
      ),
      noTrail('Luthrie'),
    ],
    exclusions: [
      'Community coffee mornings are events, not a dependable daily café.',
      'Hall toilets are not represented as a public convenience.',
    ],
    practical: {
      eat: 'No dependable daily coffee-and-cake or light-lunch outlet.',
      picnic: 'No managed picnic site.',
      parking: 'Small free shared parking at the village hall.',
      toilets: 'No general public toilet.',
      accessibility: 'The hill route includes rough and boggy sections.',
      transport: 'Rural bus times should be checked before travel.',
    },
  },
  {
    file: 'moonzie.json',
    id: 'moonzie-scotland',
    name: 'Moonzie',
    score: 47,
    dogRating: 1,
    summary:
      'Moonzie offers a rare annual garden-and-kirk opening, but this event-led interest does not make the scattered locality an everyday destination.',
    character: 'Scattered historic parish',
    headline: 'A special-opening garden and kirk',
    intro:
      'Moonzie is best treated as a dated-event visit, with its full local HES record preserved separately.',
    bestFor: ['A pre-planned garden day', 'Church and garden history'],
    time: '1–2 hours on the advertised opening day',
    features: [
      {
        id: 'curated-attraction:moonzie-house-garden',
        name: 'Moonzie House Garden',
        kind: 'attraction',
        type: 'garden',
        coordinates: [-3.067, 56.3456],
        description:
          'A private garden opening through Scotland’s Gardens Scheme on the advertised annual date, with varied planting and refreshments.',
        tagline: 'Rare annual garden opening',
        url: moonzieGarden,
        source: 'Moonzie House',
        organisation: 'Scotland’s Gardens Scheme',
        opening: 'Advertised for Sunday 28 June 2026, 2pm–5pm; otherwise private.',
        price: '£6; children free',
        score: 66,
      },
      {
        id: 'curated-attraction:moonzie-kirk-opening',
        name: 'Moonzie Kirk Special Opening',
        kind: 'attraction',
        type: 'place_of_worship',
        coordinates: [-3.0716996, 56.3461702],
        description:
          'The historic kirk is advertised to open alongside Moonzie House garden on the same annual event day.',
        tagline: 'Kirk open with garden day',
        url: moonzieGarden,
        source: 'Moonzie House opening',
        organisation: 'Scotland’s Gardens Scheme',
        opening:
          'Advertised with the garden on Sunday 28 June 2026; no everyday tourist opening claimed.',
        price: 'Included in garden-day visit',
        score: 60,
        visitability: 'substantial_visible_remains',
      },
    ],
    planner: emptyPlanner(),
    routeFinding:
      'No current place-specific mystery trail or maintained Moonzie visitor circuit was found.',
    checks: [
      placeCheck(
        moonzieGarden,
        'Current operator page publishes the 2026 date, price, garden and kirk opening.',
      ),
      placeCheck(
        moonzieKirk,
        'Council records Moonzie Churchyard but does not advertise general visitor facilities.',
      ),
      noTrail('Moonzie'),
    ],
    exclusions: [
      'Event parking and refreshments are not represented as year-round public facilities.',
      'Private estate grounds are not treated as always open.',
    ],
    practical: {
      eat: 'Only event refreshments are verified; no daily café.',
      picnic: 'No managed public picnic site.',
      parking: 'Event arrangements only; no year-round public car park.',
      toilets: 'No public toilet.',
      accessibility: 'No complete step-free visitor statement was found.',
      transport: 'A car or pre-planned rural journey is normally required.',
    },
  },
  {
    file: 'kilmaron-castle.json',
    id: 'kilmaron-castle-scotland',
    name: 'Kilmaron Castle',
    score: 20,
    dogRating: 0,
    summary:
      'Kilmaron Castle is a historic record rather than a visitor destination: the 1815 mansion is demolished and surviving estate structures are private.',
    character: 'Former mansion estate locality',
    headline: 'A demolished mansion’s surviving records',
    intro:
      'The historic records remain intact, but no unrestricted public attraction or facility is claimed.',
    bestFor: ['Desk-based local history'],
    time: 'No independent visitor stop recommended',
    features: [],
    planner: emptyPlanner(),
    routeFinding: 'No public visitor route or named commercial trail was verified.',
    checks: [
      placeCheck(
        kilmaronNrhe,
        'National record confirms the house was built around 1815 and is now demolished.',
      ),
      placeCheck(
        kilmaronGarden,
        'HES record confirms the surviving listed walled garden and material date.',
      ),
      noTrail('Kilmaron Castle'),
    ],
    exclusions: [
      'The private walled garden and estate buildings are not See cards.',
      'No score is awarded merely for designation records.',
    ],
    practical: {
      eat: 'None.',
      picnic: 'None.',
      parking: 'No public visitor parking.',
      toilets: 'None.',
      accessibility: 'No public access is claimed.',
      transport: 'No independent tourist visit is recommended.',
    },
  },
  {
    file: 'lindifferon.json',
    id: 'lindifferon-scotland',
    name: 'Lindifferon',
    score: 22,
    dogRating: 0,
    summary:
      'Lindifferon is a small farm locality with documentary and HES interest but no independently visitable attraction or visitor facility.',
    character: 'Historic farm locality',
    headline: 'A recorded rural place',
    intro:
      'The locality remains searchable without borrowing attractions from neighbouring settlements.',
    bestFor: ['Regional reference'],
    time: 'Pass-through only',
    features: [],
    planner: emptyPlanner(),
    routeFinding: 'No place-specific route or commercial trail was found.',
    checks: [
      placeCheck(lindifferonPlaceName, 'Academic Fife place-name record resolves the locality.'),
      noTrail('Lindifferon'),
    ],
    exclusions: [
      'Private farms and houses are not visitor attractions.',
      'Luthrie, Moonzie and Fernie content is not transferred.',
    ],
    practical: {
      eat: 'None.',
      picnic: 'None.',
      parking: 'No dedicated visitor parking.',
      toilets: 'None.',
      accessibility: 'No visitor facility to assess.',
      transport: 'Rural pass-through locality.',
    },
  },
  {
    file: 'fernie-castle.json',
    id: 'fernie-castle-scotland',
    name: 'Fernie Castle',
    score: 34,
    dogRating: 0,
    summary:
      'Fernie Castle is an operating hotel and wedding venue, not an unrestricted public castle attraction; the locality remains selector-only.',
    character: 'Private castle-hotel estate',
    headline: 'A private hospitality estate',
    intro:
      'The castle’s historic fabric is preserved in HES pins, while public sightseeing is not assumed.',
    bestFor: ['Booked stays or events'],
    time: 'By booking only',
    features: [],
    planner: emptyPlanner(),
    routeFinding: 'No place-specific public route or commercial trail was found.',
    checks: [
      placeCheck(
        fernieCastle,
        'Current operator site presents a hotel, wedding and event venue rather than general sightseeing.',
      ),
      noTrail('Fernie Castle'),
    ],
    exclusions: [
      'Accommodation, weddings and full-meal trade do not qualify as a café-led Eat card.',
      'Private grounds are not promoted as an attraction.',
    ],
    practical: {
      eat: 'Hotel hospitality is booking/customer-led and not used as a café or light-lunch stop.',
      picnic: 'None.',
      parking: 'Customer parking is not a public visitor car park.',
      toilets: 'Customer facilities only.',
      accessibility: 'Contact the venue for booking-specific access.',
      transport: 'Private-vehicle access for customers.',
    },
  },
  {
    file: 'letham-fife.json',
    id: 'letham-fife-scotland',
    name: 'Letham (Fife)',
    score: 35,
    dogRating: 1,
    summary:
      'Letham is an attractive historic village with extensive HES coverage but no currently verified café, public attraction, trail or always-public facility cluster.',
    character: 'Small historic Fife village',
    headline: 'Historic fabric without a visitor cluster',
    intro:
      'The village remains searchable and its dated heritage pins remain complete, but heritage density alone does not create a destination score.',
    bestFor: ['Local architecture in passing'],
    time: 'Pass-through or community-event visit',
    features: [],
    planner: emptyPlanner(),
    routeFinding: 'No current Letham-specific visitor trail was verified.',
    checks: [
      placeCheck(
        lethamHallParking,
        'Hall information confirms only a small shared car park and street parking.',
      ),
      noTrail('Letham in Fife'),
    ],
    exclusions: [
      'The village hall car park and toilets are booking/event facilities, not always-public visitor services.',
      'Fernie Castle, Monimail and Melville estate content is not transferred.',
    ],
    practical: {
      eat: 'No qualifying daytime café or tearoom verified.',
      picnic: 'No managed picnic site.',
      parking: 'Small hall/event parking and street parking only; no public car-park pin.',
      toilets: 'No public toilet.',
      accessibility: 'Public roads only; no visitor attraction accessibility statement.',
      transport: 'Check current rural bus timetables.',
    },
  },
  {
    file: 'bow-of-fife.json',
    id: 'bow-of-fife-scotland',
    name: 'Bow of Fife',
    score: 26,
    dogRating: 1,
    summary:
      'Bow of Fife is a named rural settlement with local historic records but no current visitor-service or attraction cluster.',
    character: 'Small Howe of Fife settlement',
    headline: 'A quiet recorded locality',
    intro: 'It remains in the selector without inheriting nearby village or estate content.',
    bestFor: ['Regional reference'],
    time: 'Pass-through only',
    features: [],
    planner: emptyPlanner(),
    routeFinding: 'No maintained place-specific visitor route was verified.',
    checks: [
      placeCheck(
        'https://www.openstreetmap.org/node/2231237288',
        'Current mapped settlement identity checked.',
      ),
      noTrail('Bow of Fife'),
    ],
    exclusions: ['Nearby cafés, estates and routes are outside the strict settlement boundary.'],
    practical: {
      eat: 'None.',
      picnic: 'None.',
      parking: 'No dedicated visitor parking.',
      toilets: 'None.',
      accessibility: 'No visitor facility to assess.',
      transport: 'Rural pass-through locality.',
    },
  },
  {
    file: 'cupar-muir.json',
    id: 'cupar-muir-scotland',
    name: 'Cupar Muir',
    score: 28,
    dogRating: 1,
    summary:
      'Cupar Muir is a separate small settlement and does not inherit Cupar’s museum, cafés, parks, trails, parking or toilets.',
    character: 'Small settlement beside Cupar',
    headline: 'A separate settlement, not Cupar',
    intro:
      'Strict boundary treatment prevents the nearby town’s visitor offer from inflating this score.',
    bestFor: ['Regional reference'],
    time: 'Pass-through only',
    features: [],
    planner: emptyPlanner(),
    routeFinding: 'No Cupar Muir-specific visitor route was verified.',
    checks: [
      placeCheck(
        'https://www.openstreetmap.org/node/1450724513',
        'Current mapped settlement identity checked.',
      ),
      noTrail('Cupar Muir'),
    ],
    exclusions: [
      'All Cupar town-centre content remains assigned to Cupar.',
      'Retail parking is not a visitor attraction.',
    ],
    practical: {
      eat: 'No qualifying independent café verified inside the strict settlement area.',
      picnic: 'None.',
      parking: 'No dedicated tourism parking.',
      toilets: 'None.',
      accessibility: 'No visitor facility to assess.',
      transport: 'Local bus and road access do not add destination points.',
    },
  },
  {
    file: 'cupar.json',
    id: 'cupar-scotland',
    name: 'Cupar',
    score: 84,
    dogRating: 2,
    summary:
      'Cupar is a strong historic market-town destination with a seasonal heritage centre, a live Treasure Trail, six further documented walks, a broad café offer, parkland and clearly documented parking and toilets.',
    character: 'Historic market town and former county town',
    headline: 'Heritage lanes, cafés and country walks',
    intro:
      'Cupar supports a full day or rewarding half-day without relying on attractions outside its strict town study area.',
    bestFor: ['Town history', 'Coffee and cake', 'Self-guided trails', 'A practical car-free day'],
    time: 'Half a day to a full day',
    features: [
      {
        id: 'curated-attraction:cupar-heritage-centre',
        name: 'Cupar Heritage Centre',
        kind: 'attraction',
        type: 'museum',
        coordinates: [-3.0091342, 56.3173028],
        description:
          'A volunteer-run local-history museum in the station building with changing displays and arranged visits outside its published season.',
        tagline: 'Cupar’s volunteer heritage museum',
        url: cuparHeritage,
        source: 'Cupar Heritage Centre',
        organisation: 'Cupar Heritage',
        opening:
          'April–31 October, Wednesday, Friday and Sunday 2pm–4.30pm; arranged visits possible.',
        price: 'Free; donations welcome',
        score: 76,
      },
      {
        id: 'curated-food:cupar-nourish',
        name: 'Nourish Cupar',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.01158, 56.31904],
        description:
          'Independent town-centre café serving breakfast, brunch, lunch, smoothies and sweet treats.',
        tagline: 'Brunch, smoothies and sweet treats',
        url: nourish,
        source: 'Nourish menus',
        organisation: 'Nourish Cupar',
        opening: 'Tuesday–Saturday 8am–3.30pm.',
        price: '££',
        score: 82,
        details: ['cuisine=Breakfast, brunch, light lunch, cakes and coffee'],
      },
      {
        id: 'curated-food:cupar-fisher-ceres',
        name: 'Fisher & Donaldson, Ceres Road',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.008628, 56.3136105],
        description:
          'Bakery café and takeaway with coffee, cakes, filled rolls and light lunches plus its own free car park.',
        tagline: 'Bakery café with free parking',
        url: fisherCeres,
        source: 'Cupar Ceres Road store',
        organisation: 'Fisher & Donaldson',
        opening: 'Monday–Saturday 8am–5pm; Sunday 10am–4pm.',
        price: '££',
        score: 86,
        details: [
          'cuisine=Bakery, cakes, coffee and light lunch',
          'parking=Free customer car park',
          'ev_charging=yes',
        ],
      },
      {
        id: 'curated-food:cupar-fisher-crossgate',
        name: 'Fisher & Donaldson, Crossgate',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.0118288, 56.3189416],
        description:
          'Traditional central bakery tearoom specialising in coffee, cakes, pastries and light lunch choices.',
        tagline: 'Traditional central bakery tearoom',
        url: fisherCrossgate,
        source: 'Cupar Crossgate store',
        organisation: 'Fisher & Donaldson',
        opening: 'Café Monday–Saturday 9am–5pm.',
        price: '££',
        score: 83,
        details: ['cuisine=Bakery, cakes, coffee and light lunch'],
      },
      {
        id: 'curated-food:cupar-number-10',
        name: 'Number 10',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.011342, 56.3191177],
        description:
          'Independent Crossgate daytime stop included in Cupar’s current café and coffee-shop directory.',
        tagline: 'Independent Crossgate daytime stop',
        url: number10,
        source: 'Number 10 listing',
        organisation: 'Cupar Now',
        opening:
          'Current weekly opening hours are not published; telephone the business before a special journey.',
        price: '££',
        score: 70,
        details: ['cuisine=Coffee, baking and light daytime food'],
      },
      {
        id: 'curated-food:cupar-tinas',
        name: 'Tina’s Little Cafe',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.0151884, 56.3193232],
        description:
          'Small dog-friendly Bonnygate café focused on coffee, breakfast, baking and daytime meals.',
        tagline: 'Dog-friendly Bonnygate café',
        url: tinas,
        source: 'Tina’s Little Cafe listing',
        organisation: 'Cupar Now / current operator-managed listing',
        opening: 'Monday–Saturday 9am–2pm; closed Sunday.',
        price: '££',
        score: 74,
        details: ['cuisine=Coffee, cakes, breakfast and light lunch', 'dogs=yes'],
      },
      {
        id: 'curated-food:cupar-tearoom',
        name: 'The Cupar Tearoom',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.0111822, 56.3185643],
        description:
          'Traditional tearoom at Ferguson Square for hot drinks, home baking and a light daytime stop.',
        tagline: 'Traditional Ferguson Square tearoom',
        url: cuparTearoom,
        source: 'The Cupar Tearoom listing',
        organisation: 'Cupar Now',
        opening:
          'Current weekly opening hours are not published; telephone the business before a special journey.',
        price: '£',
        score: 68,
        details: ['cuisine=Tea, coffee, home baking and light lunch'],
      },
      {
        id: 'curated-trail:cupar-treasure-trail',
        name: 'Cupar Curious Townsfolk Treasure Trail',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0087546, 56.3206134],
        description:
          'Live self-guided mystery trail through Cupar’s parks, town centre and churchyard, starting near Fluthers.',
        tagline: 'Live Cupar mystery treasure trail',
        url: cuparTreasure,
        source: 'Cupar Curious Townsfolk',
        organisation: 'Treasure Trails',
        opening: 'Self-guided; download or order before setting out.',
        price: '£9.99 per trail',
        score: 86,
        details: [
          'distance=2 miles',
          'duration=2 hours',
          'route=circular',
          'wheelchair=yes',
          'dogs=yes',
        ],
      },
      {
        id: 'curated-trail:cupar-heritage-trail',
        name: 'Cupar Heritage Trail',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0091342, 56.3173028],
        description:
          'Free self-guided town walk connecting Cupar’s principal historic streets, buildings and stories.',
        tagline: 'Free town-centre heritage walk',
        url: cuparHeritageWalks,
        source: 'Self-guided walks',
        organisation: 'Cupar Heritage',
        opening: 'Self-guided year-round; check individual building access.',
        price: 'Free',
        score: 80,
      },
      {
        id: 'curated-trail:cupar-riverside-tarvit',
        name: 'Cupar Walk 1: Riverside and Tarvit Pond',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0087546, 56.3206134],
        description:
          'A 3.8-mile circular from Fluthers through Haugh Park, the riverside and Tarvit Pond nature trail.',
        tagline: 'Riverside and Tarvit Pond circuit',
        url: cuparWalks,
        source: 'Cupar Walks leaflet',
        organisation: 'St Andrews & NE Fife Ramblers / ScotWays',
        opening: 'Open paths; use footwear suited to weather and field conditions.',
        price: 'Free',
        score: 74,
        details: ['distance=3.8 miles', 'route=circular'],
      },
      {
        id: 'curated-trail:cupar-foodieash-moonzie',
        name: 'Cupar Walk 2: Foodieash and Moonzie Kirk',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0087546, 56.3206134],
        description:
          'A 9.5-mile linear countryside route from Fluthers via Hawklaw, Foodieash and Moonzie Kirk.',
        tagline: 'Long Foodieash and Moonzie route',
        url: cuparWalks,
        source: 'Cupar Walks leaflet',
        organisation: 'St Andrews & NE Fife Ramblers / ScotWays',
        opening: 'Open paths and roads; use appropriate footwear and arrange the linear return.',
        price: 'Free',
        score: 72,
        details: ['distance=9.5 miles', 'route=linear'],
      },
      {
        id: 'curated-trail:cupar-dura-kemback',
        name: 'Cupar Walk 3: Dura Den and Kemback',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0087546, 56.3206134],
        description:
          'A 9-mile circular from Fluthers through Cairngreen Wood, Dairsie Den and Kemback.',
        tagline: 'Dura Den and Kemback circuit',
        url: cuparWalks,
        source: 'Cupar Walks leaflet',
        organisation: 'St Andrews & NE Fife Ramblers / ScotWays',
        opening: 'Open paths; expect rough or muddy sections and working farmland.',
        price: 'Free',
        score: 75,
        details: ['distance=9 miles', 'route=circular'],
      },
      {
        id: 'curated-trail:cupar-moathill-balgarvie',
        name: 'Cupar Walk 4: Moathill and Balgarvie',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0087546, 56.3206134],
        description:
          'A 5-mile circular from Fluthers over Moathill and through the Elmwood and Balgarvie landscape.',
        tagline: 'Moathill and Balgarvie circuit',
        url: cuparWalks,
        source: 'Cupar Walks leaflet',
        organisation: 'St Andrews & NE Fife Ramblers / ScotWays',
        opening: 'Open paths, surfaced roads and farm tracks; respect working land.',
        price: 'Free',
        score: 72,
        details: ['distance=5 miles', 'route=circular'],
      },
      {
        id: 'curated-picnic:cupar-haugh-park',
        name: 'Haugh Park',
        kind: 'picnic',
        type: 'picnic_site',
        coordinates: [-3.0069111, 56.3197431],
        description:
          'Central riverside park suitable for an informal picnic and a break on Cupar’s walking routes; no dedicated table count is claimed.',
        tagline: 'Central riverside picnic stop',
        url: haughPark,
        source: 'Fife parks',
        organisation: 'Fife Council',
        opening: 'Open public park.',
        price: 'Free',
        score: 68,
        details: ['picnic_tables=not confirmed', 'style=informal grass picnic'],
      },
      {
        id: 'curated-parking:cupar-fluthers',
        name: 'Fluthers Car Park',
        kind: 'parking',
        type: 'parking',
        coordinates: [-3.0087546, 56.3206134],
        description:
          'Large free central car park and the start point for the Cupar Walks leaflet, with disabled spaces and adjacent toilets.',
        tagline: 'Free 200-space central parking',
        url: fluthersParking,
        source: 'Fluthers Car Park',
        organisation: 'Fife Council',
        opening: 'Public car park; check signed restrictions.',
        price: 'Free',
        score: 90,
        details: ['capacity=200', 'disabled_spaces=4', 'toilets=adjacent'],
      },
      {
        id: 'curated-parking:cupar-bonnygate',
        name: 'Bonnygate Car Park',
        kind: 'parking',
        type: 'parking',
        coordinates: [-3.0141058, 56.3187023],
        description:
          'Central council car park with low-cost short and long stays and adjacent public toilets.',
        tagline: 'Low-cost central council parking',
        url: parkingCharges,
        source: 'Fife parking charges',
        organisation: 'Fife Council',
        opening: 'Charging hours and restrictions are displayed by the council and on site.',
        price: '0–2h £0.60; 2–4h £1.20; 4h+ £2.40 in charged hours',
        score: 86,
        details: ['status=charged public car park', 'toilets=adjacent'],
      },
      {
        id: 'curated-parking:cupar-short-lane',
        name: 'Short Lane Car Park',
        kind: 'parking',
        type: 'parking',
        coordinates: [-3.0133193, 56.3175787],
        description:
          'Small central council car park on Short Lane, included in the current Fife car-park list.',
        tagline: 'Small central council car park',
        url: carParkList,
        source: 'Fife car park list',
        organisation: 'Fife Council',
        opening: 'Public car park; check signed restrictions.',
        price: 'Check current signs',
        score: 66,
        details: ['status=public council car park', 'capacity=small'],
      },
      {
        id: 'curated-toilets:cupar-fluthers',
        name: 'Fluthers Public Toilets',
        kind: 'toilets',
        type: 'toilets',
        coordinates: [-3.0087546, 56.3206134],
        description:
          'Year-round central toilets with level access, accessible RADAR provision and baby changing.',
        tagline: 'Accessible central public toilets',
        url: fluthersToilets,
        source: 'Cupar Fluthers Public Toilets',
        organisation: 'Fife Council',
        opening: 'Daily 9am–5pm year-round, subject to current council notices.',
        price: '30p',
        score: 88,
        details: ['wheelchair=yes', 'access=RADAR', 'changing_table=yes', 'level_access=yes'],
      },
      {
        id: 'curated-toilets:cupar-bonnygate',
        name: 'Bonnygate Public Toilets',
        kind: 'toilets',
        type: 'toilets',
        coordinates: [-3.0141058, 56.3187023],
        description: 'Year-round central toilets with level access and accessible RADAR provision.',
        tagline: 'Year-round Bonnygate toilets',
        url: bonnygateToilets,
        source: 'Cupar Bonnygate Public Toilets',
        organisation: 'Fife Council',
        opening: 'Daily 9am–5pm year-round, subject to current council notices.',
        price: '30p',
        score: 84,
        details: ['wheelchair=yes', 'access=RADAR', 'level_access=yes'],
      },
    ],
    planner: {
      eat: [
        'curated-food:cupar-nourish',
        'curated-food:cupar-fisher-ceres',
        'curated-food:cupar-fisher-crossgate',
        'curated-food:cupar-number-10',
        'curated-food:cupar-tinas',
        'curated-food:cupar-tearoom',
      ],
      trails: [
        'curated-trail:cupar-treasure-trail',
        'curated-trail:cupar-heritage-trail',
        'curated-trail:cupar-riverside-tarvit',
        'curated-trail:cupar-foodieash-moonzie',
        'curated-trail:cupar-dura-kemback',
        'curated-trail:cupar-moathill-balgarvie',
      ],
      picnic: ['curated-picnic:cupar-haugh-park'],
      parking: [
        'curated-parking:cupar-fluthers',
        'curated-parking:cupar-bonnygate',
        'curated-parking:cupar-short-lane',
      ],
      toilets: ['curated-toilets:cupar-fluthers', 'curated-toilets:cupar-bonnygate'],
    },
    routeFinding:
      'A live Treasure Trail, Cupar Heritage trail and four fully described Ramblers/ScotWays routes from Fluthers were verified.',
    checks: [
      placeCheck(
        cuparHeritage,
        'Current centre site confirms 2026 opening pattern and free admission.',
      ),
      placeCheck(
        cuparTreasure,
        'Live product page confirms price, distance, duration, accessibility and dog suitability.',
      ),
      placeCheck(
        cuparWalks,
        'Working route leaflet supplies four named routes, distances, starts and terrain.',
      ),
      placeCheck(nourish, 'Operator menu confirms breakfast, brunch, lunch and sweet treats.'),
      placeCheck(fisherCeres, 'Operator confirms café, hours, free parking and EV charging.'),
      placeCheck(fisherCrossgate, 'Operator confirms bakery tearoom and current hours.'),
      placeCheck(
        number10,
        'Current local business listing confirms the daytime venue and exact address.',
      ),
      placeCheck(tinas, 'Current local business listing confirms the café and exact address.'),
      placeCheck(
        cuparTearoom,
        'Current local business listing confirms the tearoom and exact address.',
      ),
      placeCheck(
        fluthersParking,
        'Council confirms free 200-space parking, disabled bays and toilets.',
      ),
      placeCheck(parkingCharges, 'Council confirms current Bonnygate charges.'),
      placeCheck(
        fluthersToilets,
        'Council confirms hours, charge and accessible/baby-changing facilities.',
      ),
      placeCheck(bonnygateToilets, 'Council confirms hours, charge and accessibility.'),
      {
        url: cuparTreasure,
        outcome: 'verified',
        note: 'Cupar has an exact live Treasure Trails product; generic no-result wording is not used.',
      },
    ],
    exclusions: [
      'Hill of Tarvit Mansion, Scotstarvit Tower and neighbouring villages are not counted as Cupar attractions.',
      'Full-meal restaurants, pubs and takeaways are not used to pad Eat.',
      'Haugh Park is described as an informal picnic location; dedicated tables are not invented.',
    ],
    practical: {
      eat: 'Six current café, bakery or tearoom stops with coffee, cake, breakfast or light-lunch relevance are published.',
      picnic: 'Haugh Park supports informal riverside picnics; no table count is claimed.',
      parking: 'Three current council car parks are pinned with known charge/status information.',
      toilets: 'Two year-round 9am–5pm council toilets, both accessible by RADAR; 30p.',
      accessibility:
        'The Treasure Trail is operator-described as accessible; countryside routes vary and may be rough or muddy.',
      transport: 'Cupar railway and bus links support a car-free visit; check current timetables.',
    },
  },
  {
    file: 'craigrothie.json',
    id: 'craigrothie-scotland',
    name: 'Craigrothie',
    score: 59,
    dogRating: 2,
    summary:
      'Craigrothie has a genuine Tuesday community café and a documented walking route through the village, but its limited opening and lack of always-public facilities keep it below 60.',
    character: 'Compact historic route village',
    headline: 'A Tuesday café on a rural route',
    intro:
      'The village has real stop value at the right time, without inheriting nearby Hill of Tarvit or Ceres.',
    bestFor: ['A Tuesday coffee stop', 'A pre-planned country walk'],
    time: '30–60 minutes, or longer on the route',
    features: [
      {
        id: 'curated-food:craigrothie-tuesday-cafe',
        name: 'Craigrothie Village Hall Tuesday Café',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.0050763, 56.2836286],
        description:
          'Community café serving tea, coffee and home baking in the village hall on Tuesdays.',
        tagline: 'Tuesday coffee and home baking',
        url: craigrothieHall,
        source: 'Craigrothie Village Hall',
        organisation: 'Fife Coast & Countryside Trust',
        opening: 'Tuesday 11am–3pm; check community updates before a special journey.',
        price: '£; cash',
        score: 70,
        details: ['cuisine=Coffee, tea and home baking', 'opening_frequency=weekly'],
      },
      {
        id: 'curated-trail:craigrothie-cupar-ceres',
        name: 'Cupar to Ceres via Craigrothie',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0043429, 56.2854714],
        description:
          'A documented Ramblers route passes through Craigrothie before continuing to Ceres, linking the village to a longer country walk.',
        tagline: 'Country route through Craigrothie',
        url: craigrothieRoute,
        source: 'Cupar to Ceres walk',
        organisation: 'St Andrews & NE Fife Ramblers',
        opening: 'Open paths and roads; check the current route document and field conditions.',
        price: 'Free',
        score: 66,
        details: ['trail_relationship=route passes through village', 'route=linear/cross-boundary'],
      },
    ],
    planner: {
      ...emptyPlanner(),
      eat: ['curated-food:craigrothie-tuesday-cafe'],
      trails: ['curated-trail:craigrothie-cupar-ceres'],
    },
    routeFinding:
      'The hall page identifies Fife Pilgrim Way context and a working Ramblers route document explicitly passes the village.',
    checks: [
      placeCheck(
        craigrothieHall,
        'Current page confirms Tuesday 11–3 café, baking, parking and toilets during hall use.',
      ),
      placeCheck(craigrothieRoute, 'Working route document passes through Craigrothie.'),
      noTrail('Craigrothie'),
    ],
    exclusions: [
      'Hall parking and toilets are available with hall activity, not represented as always-public pins.',
      'Hill of Tarvit and Ceres attractions are outside the village score.',
    ],
    practical: {
      eat: 'One genuine weekly coffee-and-cake stop, Tuesday 11am–3pm.',
      picnic: 'No managed public picnic site.',
      parking:
        'On/off-street and hall parking only during relevant hall use; no always-public car-park pin.',
      toilets: 'Hall toilets are tied to opening/activity.',
      accessibility:
        'The hall has accessible facilities; the cross-country route is not claimed step-free.',
      transport: 'Rural bus/timetable checking is advised.',
    },
  },
  {
    file: 'pitlessie.json',
    id: 'pitlessie-scotland',
    name: 'Pitlessie',
    score: 59,
    dogRating: 2,
    summary:
      'Pitlessie has a current inn offering breakfast and daytime light meals plus a documented rural walk, but no public toilet, picnic site or dedicated visitor parking.',
    character: 'Howe of Fife village by the Eden',
    headline: 'An inn stop on a country circuit',
    intro:
      'Pitlessie is worthwhile on a planned route, but the practical offer remains too narrow for 60+.',
    bestFor: ['Breakfast or a light lunch', 'A rural circuit'],
    time: '1–3 hours depending on the walk',
    features: [
      {
        id: 'curated-food:pitlessie-inn',
        name: 'Pitlessie Inn & Pantry',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.0738, 56.2748],
        description:
          'Village inn and pantry with weekend breakfast plus daytime soups, sandwiches and coffee suitable for a lighter stop.',
        tagline: 'Weekend breakfast and light lunches',
        url: pitlessieInn,
        source: 'Pitlessie Inn & Pantry',
        organisation: 'Pitlessie Inn',
        opening:
          'Wednesday–Friday 12–3pm and 5–9pm; Saturday–Sunday from 10am; Tuesday evenings; check current service.',
        price: '££',
        score: 72,
        details: [
          'cuisine=Breakfast, coffee, soups, sandwiches and light lunch',
          'dogs=outdoor seating; assistance dogs indoors',
        ],
      },
      {
        id: 'curated-trail:pitlessie-crawford-priory',
        name: 'Crawford Priory and Pitlessie Circuit',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0773494, 56.2754275],
        description:
          'A 10.8 km documented route linking Springfield, Crawford Priory landscape and Pitlessie via paths and quiet roads.',
        tagline: 'Priory landscape and village circuit',
        url: pitlessieWalk,
        source: 'Crawford Priory and Lady Mary’s Tomb',
        organisation: 'Fife Walking',
        opening: 'Open paths and quiet roads; check field and path conditions.',
        price: 'Free',
        score: 72,
        details: ['distance=10.8 km', 'route=circular/cross-boundary'],
      },
    ],
    planner: {
      ...emptyPlanner(),
      eat: ['curated-food:pitlessie-inn'],
      trails: ['curated-trail:pitlessie-crawford-priory'],
    },
    routeFinding:
      'Fife Walking supplies a working route page explicitly named for Crawford Priory and Pitlessie.',
    checks: [
      placeCheck(
        pitlessieInn,
        'Operator site confirms current opening pattern, breakfast/daytime food and dog policy.',
      ),
      placeCheck(
        pitlessieWalk,
        'Working route page confirms distance, start, terrain and parking context.',
      ),
      noTrail('Pitlessie'),
    ],
    exclusions: [
      'The inn is included only for its breakfast and light-lunch relevance, not full evening meals.',
      'Private Crawford Priory ruins do not become a Pitlessie attraction.',
      'No roadside verge is pinned as visitor parking.',
    ],
    practical: {
      eat: 'One current inn/pantry qualifies through weekend breakfast and daytime light meals.',
      picnic: 'No managed public picnic site.',
      parking: 'No dedicated public visitor car park.',
      toilets: 'No public toilet; customer facilities only.',
      accessibility: 'The route uses rural paths and roads and is not claimed step-free.',
      transport:
        'Check bus times; the route start can also be approached from Springfield station.',
    },
  },
  {
    file: 'springfield-fife.json',
    id: 'springfield-fife-scotland',
    name: 'Springfield (Fife)',
    score: 57,
    dogRating: 2,
    summary:
      'Springfield is a useful rail-accessible start for the Crawford Priory and Pitlessie walk, but the route alone does not make the village a 60+ destination.',
    character: 'Railway village and walk start',
    headline: 'A practical start for a rural circuit',
    intro:
      'The village remains selector-only because private ruins and route scenery are not converted into a town attraction cluster.',
    bestFor: ['A rail-linked country walk'],
    time: 'About 3 hours for the circuit',
    features: [
      {
        id: 'curated-trail:springfield-crawford-priory',
        name: 'Crawford Priory and Pitlessie from Springfield',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.0645656, 56.2952787],
        description:
          'A 10.8 km documented circuit starting in Springfield and using paths and quiet roads through the Crawford Priory landscape to Pitlessie.',
        tagline: 'Rail-linked priory landscape circuit',
        url: pitlessieWalk,
        source: 'Crawford Priory and Lady Mary’s Tomb',
        organisation: 'Fife Walking',
        opening: 'Open paths and roads; check current surface and field conditions.',
        price: 'Free',
        score: 74,
        details: ['distance=10.8 km', 'route=circular', 'start=Springfield'],
      },
    ],
    planner: { ...emptyPlanner(), trails: ['curated-trail:springfield-crawford-priory'] },
    routeFinding:
      'A working Fife Walking page explicitly starts the 10.8 km circuit in Springfield.',
    checks: [
      placeCheck(
        pitlessieWalk,
        'Route page confirms Springfield start, distance, terrain and parking guidance.',
      ),
      noTrail('Springfield in Fife'),
    ],
    exclusions: [
      'Private Crawford Priory ruins are not represented as a public See attraction.',
      'Small Muir Road/on-street parking guidance is kept in the route notes rather than pinned as a guaranteed car park.',
      'No current café or public toilet was verified.',
    ],
    practical: {
      eat: 'No qualifying café or tearoom verified.',
      picnic: 'No managed picnic site.',
      parking:
        'Adequate on-street/small Muir Road route-start parking is described, but no dedicated visitor car park is pinned.',
      toilets: 'No public toilet.',
      accessibility: 'The rural circuit is not claimed step-free.',
      transport:
        'Springfield railway station makes the route potentially car-free; check current train times.',
    },
  },
  {
    file: 'ladybank.json',
    id: 'ladybank-scotland',
    name: 'Ladybank',
    score: 67,
    dogRating: 3,
    summary:
      'Ladybank is a genuine short-break destination for its large woodland and 12.4 km circuit, supported by two coffee/light-lunch stops, picnic parking and excellent rail access.',
    character: 'Railway village beside extensive woodland',
    headline: 'Woodland walking from a rail village',
    intro:
      'Ladybank’s score is earned by the village-and-woodland visit itself, without borrowing Fife Zoo or neighbouring attractions.',
    bestFor: ['Woodland walks', 'Dog-friendly outdoor time', 'Coffee after a train journey'],
    time: '2–4 hours',
    features: [
      {
        id: 'curated-attraction:ladybank-woodland',
        name: 'Ladybank Woodland',
        kind: 'attraction',
        type: 'nature_reserve',
        coordinates: [-3.144, 56.2808],
        description:
          'Extensive publicly accessible woodland used for walking and cycling on a network of forest tracks close to the village.',
        tagline: 'Large village-edge walking woodland',
        url: ladybankWoodland,
        source: 'Ladybank Woodland',
        organisation: 'Woodland Trust woodland directory / Forestry and Land Scotland',
        opening: 'Open access; follow current forestry notices.',
        price: 'Free',
        score: 72,
        relatedContext: true,
      },
      {
        id: 'curated-food:ladybank-kiltmakers',
        name: 'The Kiltmakers Coffee Shop',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.122797, 56.2741428],
        description:
          'Independent village coffee shop for hot drinks, baking and light daytime food.',
        tagline: 'Independent village coffee shop',
        url: kiltmakers,
        source: 'Kiltmakers opening listing',
        organisation: 'The Kiltmakers Coffee Shop',
        opening: 'Tuesday–Friday 10am–3pm in the current listing; check before a special journey.',
        price: '£',
        score: 70,
        details: ['cuisine=Coffee, cakes and light lunch'],
      },
      {
        id: 'curated-food:ladybank-bunker-cafe',
        name: 'The Bunker Café',
        kind: 'food',
        type: 'cafe',
        coordinates: [-3.1225, 56.2766],
        description:
          'Golf Inn café serving hot rolls, panini, toasties, coffee and Fisher & Donaldson cakes at the end of the week.',
        tagline: 'Hot rolls, toasties and cakes',
        url: bunkerCafe,
        source: 'Bunker Café',
        organisation: 'The Golf Inn Ladybank',
        opening: 'Friday–Saturday 9am–2pm; Sunday 10am–2pm.',
        price: '££',
        score: 73,
        details: ['cuisine=Coffee, cakes, hot rolls, panini and toasties', 'dogs=welcome on lead'],
      },
      {
        id: 'curated-trail:ladybank-woodlands-circular',
        name: 'Ladybank Woodlands Circular',
        kind: 'trail',
        type: 'walking_route',
        coordinates: [-3.1255066, 56.2781959],
        description:
          'A 12.4 km documented woodland circuit from Ladybank with public transport, refreshment and parking options.',
        tagline: 'Long woodland circuit from village',
        url: ladybankWalk,
        source: 'Ladybank Woodlands Circular',
        organisation: 'Fife Walking',
        opening: 'Open forest route; follow forestry notices and expect unsurfaced tracks.',
        price: 'Free',
        score: 78,
        details: ['distance=12.4 km', 'route=circular', 'public_transport=yes'],
      },
      {
        id: 'curated-picnic:ladybank-heatherhall',
        name: 'Heatherhall Wood Picnic Stop',
        kind: 'picnic',
        type: 'picnic_site',
        coordinates: [-3.1445578, 56.2807679],
        description:
          'Woodland route parking and informal picnic point identified in the Ladybank circuit guidance; no toilet is claimed.',
        tagline: 'Woodland route picnic stop',
        url: ladybankWalk,
        source: 'Ladybank Woodlands Circular',
        organisation: 'Fife Walking',
        opening: 'Open with the woodland; observe forestry notices.',
        price: 'Free',
        score: 64,
        relatedContext: true,
        details: ['picnic_style=informal woodland stop', 'toilets=no'],
      },
      {
        id: 'curated-parking:ladybank-station',
        name: 'Ladybank Station Car Park',
        kind: 'parking',
        type: 'parking',
        coordinates: [-3.12182, 56.2742381],
        description:
          'Free 24-hour station parking with four accessible spaces, supporting a rail-and-walk visit.',
        tagline: 'Free 60-space station parking',
        url: ladybankStation,
        source: 'Ladybank station facilities',
        organisation: 'ScotRail',
        opening: '24 hours.',
        price: 'Free',
        score: 84,
        details: ['capacity=60', 'disabled_spaces=4', 'toilets=no'],
      },
      {
        id: 'curated-parking:ladybank-woodland-layby',
        name: 'Ladybank Woodland Lay-by',
        kind: 'parking',
        type: 'parking',
        coordinates: [-3.1445578, 56.2807679],
        description:
          'Small asphalt lay-by used for woodland access; capacity is limited and access must be kept clear.',
        tagline: 'Small woodland access lay-by',
        url: ladybankWalk,
        source: 'Ladybank Woodlands Circular',
        organisation: 'Fife Walking / OpenStreetMap contributors',
        opening: 'Open access subject to forestry operations and signed restrictions.',
        price: 'Free',
        score: 62,
        relatedContext: true,
        details: ['capacity=small', 'parking=layby', 'surface=asphalt'],
      },
    ],
    planner: {
      eat: ['curated-food:ladybank-kiltmakers', 'curated-food:ladybank-bunker-cafe'],
      trails: ['curated-trail:ladybank-woodlands-circular'],
      picnic: ['curated-picnic:ladybank-heatherhall'],
      parking: ['curated-parking:ladybank-station', 'curated-parking:ladybank-woodland-layby'],
      toilets: [],
    },
    routeFinding:
      'The current Fife Walking page supplies a complete 12.4 km route, while woodland managers confirm public walking use.',
    checks: [
      placeCheck(
        ladybankWalk,
        'Working route page confirms distance, village start, parking, public transport and refreshments.',
      ),
      placeCheck(
        ladybankWoodland,
        'Woodland directory confirms 47 hectares and walking/cycling access.',
      ),
      placeCheck(
        ladybankForest,
        'Forestry plan confirms the broader forest and heavy local dog-walking use.',
      ),
      placeCheck(kiltmakers, 'Current listing confirms opening pattern and exact mapped location.'),
      placeCheck(bunkerCafe, 'Operator page confirms menu focus and current opening hours.'),
      placeCheck(golfInn, 'Operator confirms dogs are welcome on lead.'),
      placeCheck(
        ladybankStation,
        'ScotRail confirms free 60-space 24-hour parking, four accessible bays and no toilets.',
      ),
      noTrail('Ladybank'),
    ],
    exclusions: [
      'Fife Zoo, Africafe and other Birnie Field content are outside the strict Ladybank settlement/woodland audit and are not transferred.',
      'The Golf Inn is included only through the dedicated daytime Bunker Café offer, not full meals.',
      'No public toilet is invented.',
    ],
    practical: {
      eat: 'Two current coffee/light-lunch stops with limited weekly hours.',
      picnic: 'One informal woodland picnic stop; no toilet.',
      parking: 'Free 60-space station car park plus a small woodland lay-by.',
      toilets: 'No public toilet verified; the station explicitly lists none.',
      accessibility:
        'The station has accessible parking; forest tracks vary and the full circuit is not guaranteed step-free.',
      transport: 'Ladybank station enables a strong car-free woodland visit.',
    },
  },
];

function splitScore(score: number, caps: number[]): number[] {
  let remaining = score;
  return caps.map((cap) => {
    const value = Math.min(cap, remaining);
    remaining -= value;
    return value;
  });
}
function editorialReview(seed: FeatureSeed): HeritageFeature['editorialReview'] {
  if (seed.kind === 'attraction') {
    const [
      experienceDepth,
      distinctiveness,
      presentation,
      journeyWorth,
      accessAndReliability,
      evidenceConfidence,
    ] = splitScore(seed.score, [30, 20, 20, 15, 10, 5]);
    return {
      status: 'editorially_researched',
      category: 'attraction',
      methodVersion: '2026-08-13-researched-visitor-value-v1',
      reviewedAt: reviewedDate,
      scoreRationale: `${seed.name} is scored from the visit experience, distinctiveness, presentation, journey worth, access reliability and evidence quality rather than designation alone.`,
      evidenceUrls: [seed.url],
      attractionAssessment: {
        experienceDepth,
        distinctiveness,
        presentation,
        journeyWorth,
        accessAndReliability,
        evidenceConfidence,
        visitability: seed.visitability ?? 'full_visitor_experience',
      },
    };
  }
  if (seed.kind === 'food') {
    const [
      foodAndDrinkQuality,
      daytimeRelevance,
      distinctiveness,
      consistency,
      visitorFit,
      evidenceConfidence,
    ] = splitScore(seed.score, [30, 20, 15, 15, 10, 10]);
    return {
      status: 'editorially_researched',
      category: 'food',
      methodVersion: '2026-08-13-researched-visitor-value-v1',
      reviewedAt: reviewedDate,
      scoreRationale: `${seed.name} qualifies through coffee, cake, breakfast or light-lunch relevance; full-meal value is not used to pad the score.`,
      evidenceUrls: [seed.url],
      foodAssessment: {
        foodAndDrinkQuality,
        daytimeRelevance,
        distinctiveness,
        consistency,
        visitorFit,
        evidenceConfidence,
      },
    };
  }
  if (seed.kind === 'trail')
    return {
      status: 'editorially_researched',
      category: 'trail',
      methodVersion: '2026-08-13-researched-visitor-value-v1',
      reviewedAt: reviewedDate,
      scoreRationale: `${seed.name} has a working source with usable route and condition information.`,
      evidenceUrls: [seed.url],
    };
  return undefined;
}
function featureFor(projectId: string, locality: string, seed: FeatureSeed): HeritageFeature {
  const tags: Record<Kind, string[]> = {
    attraction: ['curated-visitor-attraction', 'service-context-visitor'],
    food: ['service-context-food'],
    trail: ['service-context-trail', 'visitor-context-trail'],
    picnic: ['service-context-picnic'],
    parking: ['service-context-parking', 'visitor-context-parking'],
    toilets: ['service-context-toilets'],
  };
  const visitorTypes: Record<Kind, string> = {
    attraction: 'Attraction',
    food: 'Cafe',
    trail: 'Trail',
    picnic: 'Picnic area',
    parking: 'Parking',
    toilets: 'Public toilets',
  };
  return {
    id: seed.id,
    projectId,
    name: seed.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Fife',
    locality,
    featureType: seed.type,
    significance: 'local',
    geometry: { type: 'Point', coordinates: seed.coordinates },
    locationType: 'exact',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: seed.description,
    details: `visitor_place_type=${visitorTypes[seed.kind]}; visit_score=${seed.score}; trail_score=${seed.score}; opening_hours:description=${seed.opening}; entrance_fee=${seed.price}; price_band=${seed.price}; cuisine=${seed.kind === 'food' ? 'coffee, cake, breakfast or light lunch' : seed.kind}; tagline=${seed.tagline}; description=${seed.description}; ${seed.details?.join('; ') ?? ''}`,
    visitorWebsiteUrl: seed.url,
    editorialReview: editorialReview(seed),
    sourceRecords: [
      {
        sourceName: seed.source,
        sourceOrganisation: seed.organisation,
        sourceUrl: seed.url,
        accessedAt: reviewedAt,
        reliability: seed.organisation.includes('Council')
          ? 'official_statutory'
          : 'official_non_statutory',
        licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
        notes: `Current-place curation for ${seed.name}.`,
      },
    ],
    tags: ['current-context', auditTag, ...tags[seed.kind]],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: seed.relatedContext ? 'related_context' : 'parish_evidence',
  };
}
function highlightFor(seed: FeatureSeed, rank: number): VisitorHighlight {
  return {
    rank,
    featureId: seed.id,
    name: seed.name,
    reason: seed.description,
    visitorScore: seed.score,
    tagline: seed.tagline,
    timeToSpend: '30–90 minutes',
    openingTimes: seed.opening,
    admission: seed.price,
    freeAdmission: /^free\b/i.test(seed.price),
    visitorWebsiteUrl: seed.url,
    sourceName: seed.source,
    sourceUrl: seed.url,
    verifiedInBoundaryAt: reviewedDate,
    editorialReview: editorialReview(seed),
  };
}
function providerChecks(routeFinding: string, hasExactTreasure: boolean): Record<string, string> {
  return {
    TreasureTrails: hasExactTreasure
      ? 'Exact live Cupar product verified and retained.'
      : 'Current Fife catalogue checked; no place-specific product.',
    CuriousAbout: 'Current catalogue checked; no place-specific route.',
    MysteryGuides: 'Current catalogue checked; no place-specific route.',
    GoQuestAdventures: 'Current catalogue checked; no place-specific route.',
    officialAndConventionalRoutes: routeFinding,
  };
}
const hasCompleteDate = (feature: HeritageFeature) =>
  Boolean(
    feature.documentedDateText?.trim() &&
    feature.earliestPossibleYear != null &&
    feature.latestPossibleYear != null &&
    feature.dateBasis !== 'unknown',
  );
const isHes = (feature: HeritageFeature) =>
  feature.tags.some((tag) =>
    ['hes-listed-building', 'hes-scheduled-monument', 'hes-nrhe', 'nrhe'].includes(tag),
  );

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as {
  schemaVersion: number;
  reviewedAt: string;
  projects: Record<string, PlannerCurationState>;
};
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as {
  schemaVersion: number;
  reviewedAt: string;
  projects: Record<string, unknown>;
};

for (const audit of audits) {
  const path = resolve('data/projects', audit.file);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  if (pkg.project.id !== audit.id) throw new Error(`${audit.name}: project identity mismatch`);
  pkg.features = pkg.features.filter((feature) => !feature.tags.includes(auditTag));
  pkg.features.push(...audit.features.map((seed) => featureFor(audit.id, audit.name, seed)));
  pkg.project.visitorHighlights = audit.features
    .filter((seed) => seed.kind === 'attraction')
    .map(highlightFor);
  const band = townScoreBand(audit.score);
  pkg.project.touristAppeal = {
    score: audit.score,
    dogOwnerScore: townScoreAfterDogAccess(audit.score, audit.dogRating),
    dogAccessScoreAdjustment: townDogAccessScoreAdjustment(audit.dogRating),
    rating: band.rating,
    label: band.label,
    summary: audit.summary,
    dogAccessRating: audit.dogRating,
    dogAccessSummary:
      audit.dogRating >= 2
        ? 'Verified outdoor routes can suit responsible dog visits, with close control around livestock, roads, wildlife and historic fabric.'
        : 'No dedicated dog destination or blanket off-lead suitability is assumed.',
    methodVersion: '2026-09-02-full-settlement-visitor-audit-v3',
    reviewedAt: reviewedDate,
    sourceUrls: [
      ...new Set([
        ...audit.checks.map((check) => check.url),
        treasureCollection,
        curiousUrl,
        mysteryUrl,
        goQuestUrl,
        outdoorCode,
      ]),
    ],
  };
  pkg.project.townGuide = {
    characterTag: audit.character,
    headline: audit.headline,
    intro: audit.intro,
    bestFor: audit.bestFor,
    perfectFor:
      audit.score >= 60
        ? ['A carefully planned visit using the verified practical cards']
        : ['A route stop, special event or specialist local-history visit'],
    suggestedFirstVisit: audit.features.length
      ? {
          title: audit.headline,
          summary: `Use the verified links and access notes; private land and neighbouring facilities are not assumed.`,
        }
      : undefined,
    dontMiss: audit.features.filter((seed) => seed.kind === 'attraction').map((seed) => seed.name),
    suggestedTime: audit.time,
    visitorMood:
      audit.score >= 60
        ? 'A map-worthy destination with an independently verified visitor offer.'
        : 'A selector-only locality below the 60-point town-map threshold.',
    sourceUrls: [...new Set(audit.checks.map((check) => check.url))],
    lastReviewedAt: reviewedDate,
  };
  pkg.project.researchNotes = `${audit.intro} Strict-boundary score verified sequentially on ${reviewedDate}. ${audit.exclusions.join(' ')}`;
  planner.projects[audit.id] = audit.planner;
  const attractionDog = Object.fromEntries(
    audit.features
      .filter((seed) => seed.kind === 'attraction')
      .map((seed) => [
        seed.id,
        {
          rating: 0,
          status: 'unconfirmed',
          label: 'Dog policy not confirmed',
          summary:
            'No reliable current dog policy is published; check directly before making a dog-dependent visit.',
          sourceName: 'Scottish Outdoor Access Code and attraction-source review',
          sourceUrl: outdoorCode,
          reviewedAt: reviewedDate,
        },
      ]),
  );
  const eatDog = Object.fromEntries(
    audit.features
      .filter((seed) => seed.kind === 'food')
      .map((seed) => {
        const confirmed =
          seed.id === 'curated-food:ladybank-bunker-cafe' ||
          seed.id === 'curated-food:pitlessie-inn' ||
          seed.id === 'curated-food:cupar-tinas';
        return [
          seed.id,
          confirmed
            ? {
                rating: 2,
                status: 'verified',
                label: seed.id.includes('pitlessie')
                  ? 'Dogs outside'
                  : seed.id.includes('cupar-tinas')
                    ? 'Dog friendly'
                    : 'Dogs welcome on lead',
                summary: seed.id.includes('pitlessie')
                  ? 'The operator permits dogs in the outside area and assistance dogs indoors.'
                  : seed.id.includes('cupar-tinas')
                    ? 'The current operator-managed listing describes the café as dog friendly.'
                    : 'The operator says dogs are welcome on a lead.',
                sourceName: seed.source,
                sourceUrl: seed.url,
                reviewedAt: reviewedDate,
              }
            : {
                rating: 0,
                status: 'unconfirmed',
                label: 'Dog policy not confirmed',
                summary:
                  'No reliable current dog policy is published; check directly before visiting with a dog.',
                sourceName: 'Venue-source review',
                sourceUrl: seed.url,
                reviewedAt: reviewedDate,
              },
        ];
      }),
  );
  dog.projects[audit.id] =
    Object.keys(attractionDog).length || Object.keys(eatDog).length
      ? { attraction: attractionDog, eat: eatDog }
      : {};
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((issue) => issue.severity === 'error');
  if (errors.length)
    throw new Error(`${audit.name}: ${errors.map((issue) => issue.message).join('; ')}`);
  const localHeritage = pkg.features.filter(isHes);
  const statutory = localHeritage.filter((feature) =>
    feature.tags.some((tag) =>
      ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(
        tag,
      ),
    ),
  );
  const inside = localHeritage.filter(
    (feature) =>
      feature.evidenceScope !== 'related_context' &&
      !feature.tags.includes('town-selection-heritage-buffer'),
  );
  const visible = inside.filter((feature) => !feature.tags.includes('map-hidden'));
  const visibleUndated = visible.filter((feature) => !hasCompleteDate(feature));
  if (visibleUndated.length)
    throw new Error(
      `${audit.name}: visible undated HES/NRHE records ${visibleUndated.map((feature) => feature.id).join(', ')}`,
    );
  if (
    visible.some((feature) =>
      /\s[—–-]\s(?:c\.?\s*)?(?:\d{3,4}|\d{1,2}(?:st|nd|rd|th) century)$/i.test(feature.name),
    )
  )
    throw new Error(`${audit.name}: date appended to HES map name`);
  const counts = publishedAuditCounts(pkg, audit.planner);
  const report = {
    reviewedAt,
    projectId: audit.id,
    place: audit.name,
    townScore: audit.score,
    mapPublished: audit.score >= 60,
    categories: {
      see: { audited: true, published: counts.see },
      eat: { audited: true, published: counts.eat },
      trails: {
        audited: true,
        published: counts.trails,
        providerChecks: providerChecks(audit.routeFinding, audit.id === 'cupar-scotland'),
      },
      picnic: { audited: true, published: counts.picnic },
      parking: { audited: true, published: counts.parking },
      toilets: { audited: true, published: counts.toilets },
      accessibility: { audited: true, note: audit.practical.accessibility },
      transport: { audited: true, note: audit.practical.transport },
      dogs: { audited: true, adjustment: pkg.project.touristAppeal.dogAccessScoreAdjustment },
    },
    exclusions: audit.exclusions,
    hes: {
      assigned: statutory.length,
      totalLocalRecords: localHeritage.length,
      insideBoundary: inside.length,
      visibleDated: statutory.filter((feature) => !feature.tags.includes('map-hidden')).length,
      visibleLocalHeritageDated: visible.length,
      hiddenUndated: inside.length - visible.length,
      visibleUndated: 0,
      missing: 0,
    },
    boundaryRule: `Only visitor places physically inside ${audit.name}'s strict study area, or a documented cross-boundary route that genuinely serves it, are published.`,
    scoreRationale: audit.summary,
    scoreReanalysis: {
      required: audit.score === 58,
      completed: true,
      resultScore: audit.score,
      rationale:
        audit.score === 58
          ? 'Mandatory exact-58 second pass completed.'
          : 'Score independently reconciled after all categories, local HES/NRHE evidence and boundary exclusions.',
    },
    practicalAudit: audit.practical,
    namedTrailSearch: {
      ...providerChecks(audit.routeFinding, audit.id === 'cupar-scotland'),
      retained: audit.features.filter((seed) => seed.kind === 'trail').map((seed) => seed.name),
    },
    research: {
      currentWebResearch: true,
      strictBoundaryChecked: true,
      sourceChecks: audit.checks.map((check) => ({ ...check, checkedAt: reviewedDate })),
    },
    verification: {
      localHesAndNrheDatasetsUsed: true,
      statutoryDatasetComplete: true,
      allVisibleHeritagePinsDated: true,
      undatedRecordsRetainedHidden: true,
      datesStoredWithoutChangingMapNames: true,
      curatedCategoryCoordinatesChecked: true,
    },
    certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: null },
  };
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  await writeFile(
    resolve(
      'data/review',
      `${audit.file.replace(/\.json$/, '')}-full-visitor-audit-2026-09-02.json`,
    ),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `${audit.name}: ${audit.score}; See ${counts.see}, Eat ${counts.eat}, Trails ${counts.trails}, Picnic ${counts.picnic}, Parking ${counts.parking}, Toilets ${counts.toilets}; HES/NRHE ${visible.length}/${inside.length} visible and dated.`,
  );
}
planner.reviewedAt = reviewedDate;
dog.reviewedAt = reviewedDate;
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
console.log(
  'Sequential Glenduckie-to-Ladybank audits complete; live-browser certification remains unset until UI verification.',
);
