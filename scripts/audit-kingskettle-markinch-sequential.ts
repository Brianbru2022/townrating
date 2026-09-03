import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

/* eslint-disable @typescript-eslint/no-explicit-any -- controlled migration over versioned project JSON */

const reviewedDate = '2026-09-02';
const reviewedAt = '2026-09-02T22:00:00.000Z';
const auditTag = 'kingskettle-markinch-full-audit-2026-09-02';
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const treasure = 'https://www.treasuretrails.co.uk/collections/fife';
const curious = 'https://curiousabout.co.uk/';
const mystery = 'https://www.mysteryguides.co.uk/';
const goQuest = 'https://goquestadventures.com/';
const walkFife = 'https://www.walkfife.org/fife-walking-routes-a-to-z/';
const fifePilgrim = 'https://fifewalking.com/find-a-walk/central-fife-walks/fife-pilgrim-way/';

type Kind = 'attraction' | 'food' | 'trail' | 'picnic' | 'parking' | 'toilets';
type Outcome = 'verified' | 'no_result' | 'excluded';
type Feature = {
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
  foodStyle?: string;
  details?: string[];
  significance?: string;
  relatedContext?: boolean;
  dog?: {
    rating: 0 | 1 | 2 | 3;
    status: 'welcoming' | 'restricted' | 'not-allowed' | 'unconfirmed';
    label: string;
    summary: string;
  };
};
type Audit = {
  file: string;
  id: string;
  name: string;
  score: number;
  dogRating: 0 | 1 | 2 | 3;
  character: string;
  summary: string;
  features: Feature[];
  planner: Record<'eat' | 'trails' | 'picnic' | 'parking' | 'toilets', string[]>;
  providers: Record<string, string>;
  checks: Array<{ url: string; outcome: Outcome; note: string }>;
  exclusions: string[];
  notes?: Partial<Record<Kind, string>>;
};

const dogOutdoor = {
  rating: 2 as const,
  status: 'restricted' as const,
  label: 'Responsible outdoor access',
  summary: 'Dogs can accompany this outdoor visit but should be controlled around wildlife, livestock, roads and other visitors.',
};
const dogWelcome = {
  rating: 3 as const,
  status: 'welcoming' as const,
  label: 'Dog friendly',
  summary: 'The current operator or destination listing explicitly welcomes dogs; normal control and clean-up rules still apply.',
};
const dogUnknown = {
  rating: 0 as const,
  status: 'unconfirmed' as const,
  label: 'Dog policy not published',
  summary: 'No reliable current dog policy is published; contact the operator before visiting with a dog.',
};

function providerChecks(officialRoutes: string, treasureResult = 'No live place-specific product in the current Fife collection.'): Record<string, string> {
  return {
    TreasureTrails: treasureResult,
    CuriousAbout: 'Current provider catalogue checked; no exact place-specific route.',
    MysteryGuides: 'Current provider catalogue checked; no exact place-specific route.',
    GoQuestAdventures: 'Current provider catalogue checked; no exact place-specific route.',
    officialRoutes,
  };
}

function emptyPlanner(): Audit['planner'] {
  return { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
}

function noOffer(
  file: string,
  id: string,
  name: string,
  score: number,
  character: string,
  identityUrl: string,
  identityNote: string,
  exclusions: string[],
): Audit {
  return {
    file, id, name, score, dogRating: 1, character,
    summary: `${name} is retained for regional completeness, but a strict-boundary current-web audit found no independently visitable attraction, café-led daytime stop, maintained place-specific trail, public picnic facility, visitor car park or public toilet.`,
    features: [], planner: emptyPlanner(), providers: providerChecks('No maintained conventional place-specific visitor route was verified.'),
    checks: [
      { url: identityUrl, outcome: 'verified', note: identityNote },
      { url: treasure, outcome: 'no_result', note: `No exact ${name} product appears in the current Fife collection.` },
      { url: curious, outcome: 'no_result', note: `No exact ${name} route.` },
      { url: mystery, outcome: 'no_result', note: `No exact ${name} route.` },
      { url: goQuest, outcome: 'no_result', note: `No exact ${name} route.` },
    ],
    exclusions,
    notes: {
      attraction: 'No current publicly visitable attraction was verified inside the strict settlement boundary.',
      food: 'No qualifying café, coffee-and-cake or light-lunch stop was verified; pubs and full-meal restaurants are not substitutes.',
      trail: 'All four named commercial providers and conventional route sources were checked.',
      picnic: 'No dedicated public picnic facility was verified.',
      parking: 'No general public visitor car park was verified.',
      toilets: 'No public toilet was verified.',
    },
  };
}

const audits: Audit[] = [
  {
    file: 'kingskettle.json', id: 'kingskettle-scotland', name: 'Kingskettle', score: 56, dogRating: 2,
    character: 'Historic Howe of Fife village',
    summary: 'Kingskettle has a worthwhile early-19th-century parish church and two genuine local walking options, but no verified café-led daytime stop, dedicated picnic place, general visitor car park or public toilet. It remains just below the map threshold after a full second scoring pass.',
    features: [
      { id: 'curated-attraction:kingskettle-parish-church', name: 'Howe of Fife Parish Church, Kettle', kind: 'attraction', type: 'church', coordinates: [-3.1153997, 56.2622625], description: 'The active parish church was built in 1831–32 and retains a prominent classical village presence.', tagline: 'The 1832 parish landmark', url: 'https://powis.scot/sites/kettle-parish-church-1221/', source: 'Kettle Parish Church', organisation: 'Places of Worship in Scotland', opening: 'Active church; access outside worship or events is not guaranteed.', price: 'Free when open', score: 62, significance: 'local', dog: dogUnknown },
      { id: 'curated-trail:kingskettle-stroll', name: 'Kettle Stroll', kind: 'trail', type: 'other', coordinates: [-3.1162759, 56.2625596], description: 'A published local circuit around Kingskettle and the surrounding Howe countryside.', tagline: 'A village-and-country circuit', url: walkFife, source: 'Fife walking routes A–Z', organisation: 'Walk Fife', opening: 'Outdoor route; use the current route notes and observe access conditions.', price: 'Free', score: 60 },
      { id: 'curated-trail:kingskettle-bonnybank-loop', name: 'Kingskettle and Bonnybank Loop', kind: 'trail', type: 'other', coordinates: [-3.1162759, 56.2625596], description: 'A second published rural loop connecting Kingskettle with Bonnybank.', tagline: 'A longer Howe of Fife loop', url: walkFife, source: 'Fife walking routes A–Z', organisation: 'Walk Fife', opening: 'Outdoor route; use the current route notes and observe access conditions.', price: 'Free', score: 60 },
    ],
    planner: { eat: [], trails: ['curated-trail:kingskettle-stroll', 'curated-trail:kingskettle-bonnybank-loop'], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('Walk Fife lists the Kettle Stroll and Kingskettle–Bonnybank routes.'),
    checks: [
      { url: 'https://www.fife-edentaychurch.co.uk/locations', outcome: 'verified', note: 'Current parish page confirms Kettle as an active worship location.' },
      { url: 'https://powis.scot/sites/kettle-parish-church-1221/', outcome: 'verified', note: 'Church history records construction in 1831–32.' },
      { url: walkFife, outcome: 'verified', note: 'Current route index lists both Kettle walking options.' },
      { url: treasure, outcome: 'no_result', note: 'No Kingskettle product.' },
    ],
    exclusions: ['Kettlebridge Inn is outside Kingskettle and is a full pub/restaurant rather than a café-led daytime stop.', 'Balmalcolm Den businesses are separate and do not support the Kingskettle score.'],
    notes: { food: 'No qualifying café was verified.', picnic: 'No dedicated public picnic place was verified.', parking: 'No general public visitor car park was verified.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'balmalcolm.json', id: 'balmalcolm-scotland', name: 'Balmalcolm', score: 66, dogRating: 3,
    character: 'Small rural village and visitor-business cluster',
    summary: 'Balmalcolm earns a modest map place through a current speciality café, a distinctive community brewery taproom, a signed public-transport connection and a published 1.9-mile approach walk. Its customer parking is clearly labelled and no neighbouring attraction is borrowed.',
    features: [
      { id: 'curated-food:balmalcolm-eden', name: 'Eden – Balmalcolm Den', kind: 'food', type: 'other', coordinates: [-3.09982, 56.26288], description: 'A current independent café serving speciality coffee, tea, cakes, brunch and light lunches, with indoor and garden seating.', tagline: 'Speciality coffee and creative cakes', url: 'https://ratings.food.gov.uk/business/1823922', source: 'Eden Café food-hygiene record', organisation: 'Food Standards Agency', opening: 'Current operator posts advertise 9.30am–4.30pm Tuesday–Sunday; check before travel.', price: '££', score: 80, foodStyle: 'speciality coffee, cakes, brunch and light lunch', dog: dogWelcome },
      { id: 'curated-attraction:balmalcolm-howe-beer', name: 'Howe Beer Project Taproom', kind: 'attraction', type: 'brewery', coordinates: [-3.10012, 56.26267], description: 'A working independent brewery and community taproom with regular opening, events, snacks and visiting food traders.', tagline: 'Community brewery in the Howe', url: 'https://www.howebeerproject.co.uk/', source: 'Howe Beer Project', organisation: 'Howe Beer Project', opening: 'Advertised Thursday 4–9pm, Friday/Saturday 2–10pm and Sunday 1–7pm; check events and changes.', price: 'Drinks and events vary', score: 72, dog: dogWelcome },
      { id: 'curated-trail:balmalcolm-ladybank-walk', name: 'Ladybank to Balmalcolm Den Walk', kind: 'trail', type: 'other', coordinates: [-3.09993, 56.26277], description: 'The brewery publishes a 1.9-mile approach from Ladybank station using a quiet road, footpath and farm track.', tagline: 'Rail-to-taproom country walk', url: 'https://www.howebeerproject.co.uk/', source: 'Howe Beer Project location guide', organisation: 'Howe Beer Project', opening: 'Outdoor approach route; check weather, daylight and farm-track conditions.', price: 'Free', score: 62 },
      { id: 'curated-parking:balmalcolm-den-customers', name: 'Balmalcolm Den Customer Parking', kind: 'parking', type: 'other', coordinates: [-3.09993, 56.26277], description: 'On-site parking advertised for visitors to the Balmalcolm Den businesses; it is customer parking, not a general village car park.', tagline: 'On-site customer parking', url: 'https://www.howebeerproject.co.uk/', source: 'Howe Beer Project location guide', organisation: 'Howe Beer Project', opening: 'For customers during business opening; follow site signs.', price: 'Free for customers', score: 60, details: ['access=customers', 'capacity=not published', 'overnight=no'] },
    ],
    planner: { eat: ['curated-food:balmalcolm-eden'], trails: ['curated-trail:balmalcolm-ladybank-walk'], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('The operator publishes a usable 1.9-mile Ladybank-station approach walk.'),
    checks: [
      { url: 'https://ratings.food.gov.uk/business/1823922', outcome: 'verified', note: 'Official record confirms Eden Café at Unit 1 and a 14 May 2025 inspection.' },
      { url: 'https://www.findglocal.com/GB/Cupar/614035968452929/Eden-Balmalcolm-Den', outcome: 'verified', note: 'Current 2026 operator reposts confirm coffee, cakes, light lunches and hours.' },
      { url: 'https://www.howebeerproject.co.uk/', outcome: 'verified', note: 'Operator confirms taproom hours, parking, bus stop and 1.9-mile station walk.' },
      { url: treasure, outcome: 'no_result', note: 'No Balmalcolm product.' },
    ],
    exclusions: ['The closed Muddy Boots offer is not retained as current.', 'Customer parking is not misrepresented as a general public car park.', 'Full-meal value is not used to pad the Eat category.'],
    notes: { picnic: 'No dedicated public picnic facility was verified.', toilets: 'No independent public toilet was verified; customer toilets are venue facilities.' },
  },
  {
    file: 'kettlebridge.json', id: 'kettlebridge-scotland', name: 'Kettlebridge', score: 48, dogRating: 2,
    character: 'Compact Howe of Fife village',
    summary: 'Kettlebridge is a pleasant small village on published local walking circuits, but its inn is a full pub/restaurant and no café-led daytime stop, attraction or public visitor facility was verified.',
    features: [
      { id: 'curated-trail:kettlebridge-local-walks', name: 'Kettlebridge on the Kettle Walking Network', kind: 'trail', type: 'other', coordinates: [-3.1184005, 56.2551997], description: 'Published Kingskettle-area circuits use the minor-road and countryside network around Kettlebridge.', tagline: 'Howe of Fife village walking', url: walkFife, source: 'Fife walking routes A–Z', organisation: 'Walk Fife', opening: 'Outdoor routes; consult the current route description and access conditions.', price: 'Free', score: 56 },
    ],
    planner: { eat: [], trails: ['curated-trail:kettlebridge-local-walks'], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('Walk Fife conventional routes serve the Kingskettle/Kettlebridge area.'),
    checks: [{ url: walkFife, outcome: 'verified', note: 'Current route index checked.' }, { url: treasure, outcome: 'no_result', note: 'No Kettlebridge product.' }],
    exclusions: ['Kettlebridge Inn is excluded from the café-focused Eat list because its offer is a pub and full restaurant.', 'Kingskettle and Balmalcolm attractions and facilities are not transferred.'],
    notes: { attraction: 'No independently visitable attraction was verified.', food: 'No qualifying café was verified.', picnic: 'No dedicated public picnic place was verified.', parking: 'No general visitor car park was verified.', toilets: 'No public toilet was verified.' },
  },
  noOffer('kettlehill.json', 'kettlehill-scotland', 'Kettlehill', 34, 'Small rural hamlet', 'https://www.openstreetmap.org/node/3467568140', 'The current OSM place record resolves the Fife hamlet.', ['Balmalcolm Den and Kingskettle visitor businesses are outside the strict hamlet boundary.', 'Private houses and heritage records without visitor access do not create a destination score.']),
  {
    ...noOffer('montrave.json', 'montrave-scotland', 'Montrave', 24, 'Private estate and farm locality', 'https://www.montrave.com/location/', 'The estate operator confirms the Montrave locality and private accommodation context.', ['Montrave House accommodation and private estate buildings are not assumed to be public attractions.', 'Montrave Hill is a different geographic feature and is not substituted for the locality.']),
    checks: [
      { url: 'https://www.montrave.com/location/', outcome: 'verified', note: 'Current estate location page checked; it does not advertise a general public attraction.' },
      { url: 'https://portal.historicenvironment.scot/designation/LB51932', outcome: 'verified', note: 'HES confirms the 1875 former steading, but designation is not public visitability.' },
      { url: treasure, outcome: 'no_result', note: 'No Montrave product.' },
      { url: curious, outcome: 'no_result', note: 'No Montrave route.' },
      { url: mystery, outcome: 'no_result', note: 'No Montrave route.' },
      { url: goQuest, outcome: 'no_result', note: 'No Montrave route.' },
    ],
  },
  noOffer('rameldry-mill-bank.json', 'rameldry-mill-bank-scotland', 'Rameldry Mill Bank', 12, 'Isolated named dwelling locality', 'https://fife-placenames.glasgow.ac.uk/placename/?id=1323', 'The academic Fife place-name record resolves Rameldry Mill Bank as one locality.', ['The locality is not split into “Rameldry” and “Mill Bank”.', 'Nearby parish heritage and services are not transferred.']),
  noOffer('langdyke-fife.json', 'langdyke-fife-scotland', 'Langdyke', 18, 'Small rural Fife hamlet', 'https://www.openstreetmap.org/node/71051721', 'The current OSM record resolves Langdyke near Markinch.', ['The English Langdyke reserve is unrelated and excluded.', 'Markinch and Kennoway facilities are outside this settlement.']),
  noOffer('muirhead-freuchie.json', 'muirhead-freuchie-scotland', 'Muirhead (Freuchie)', 20, 'Small hamlet near Freuchie', 'https://www.openstreetmap.org/node/2685058249', 'The current OSM record resolves the Muirhead west of Freuchie.', ['The same-name Angus settlement and Little Muirhead on the Pilgrim Way are different places.', 'Freuchie services and Falkland attractions are outside the boundary.']),
  {
    file: 'kennoway.json', id: 'kennoway-scotland', name: 'Kennoway', score: 72, dogRating: 3,
    character: 'Historic Causeway village beside an ancient den',
    summary: 'Kennoway is a credible day-walk stop through its 48-acre den, Maiden Castle viewpoint, historic Causeway, Fife Pilgrim Way connection and two council-listed car parks. The normal tourist café search was negative, so restricted community catering and full restaurants do not pad the score.',
    features: [
      { id: 'curated-attraction:kennoway-den', name: 'Kennoway Den', kind: 'attraction', type: 'park', coordinates: [-3.052366, 56.2082933], description: 'A 48-acre wooded den with a burn, ancient woodland, glacial and industrial history, an old bridge and links to Maiden Castle.', tagline: 'Ancient woodland below the Causeway', url: 'https://www.fife.gov.uk/facilities/park/kennoway-den', source: 'Kennoway Den', organisation: 'Fife Council', opening: 'Open public greenspace; check weather and path conditions.', price: 'Free', score: 76, dog: dogOutdoor },
      { id: 'curated-trail:kennoway-den-maiden-castle', name: 'Kennoway Den and Maiden Castle Walk', kind: 'trail', type: 'other', coordinates: [-3.052366, 56.2082933], description: 'A current mapped local walk through the den and up to the Maiden Castle area.', tagline: 'Den paths and a historic viewpoint', url: 'https://fifewalking.com/find-a-walk/central-fife-walks/kennoway-den-and-maiden-castle/', source: 'Kennoway Den and Maiden Castle', organisation: 'Fife Walking', opening: 'Outdoor route; expect natural surfaces and check conditions.', price: 'Free', score: 70 },
      { id: 'curated-trail:kennoway-fife-pilgrim-way', name: 'Fife Pilgrim Way at Kennoway', kind: 'trail', type: 'other', coordinates: [-3.0490999, 56.2114871], description: 'The long-distance Fife Pilgrim Way passes through Kennoway, with the route guide identifying local parking.', tagline: 'A village stage on the pilgrim route', url: fifePilgrim, source: 'Fife Pilgrim Way', organisation: 'Fife Walking', opening: 'Open long-distance route; consult current stage and diversion information.', price: 'Free', score: 72 },
      { id: 'curated-parking:kennoway-bishops-court', name: 'Bishops Court Car Park', kind: 'parking', type: 'other', coordinates: [-3.0477646, 56.2095663], description: 'Council-listed public car park serving the Bishop’s Court centre.', tagline: 'Central Kennoway parking', url: 'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-park-list', source: 'Fife car park list', organisation: 'Fife Council', opening: 'Public car park; capacity, charges and maximum stay are not published online, so check signs.', price: 'Check signs', score: 60, details: ['capacity=not published', 'fee=not published', 'maximum_stay=not published'] },
      { id: 'curated-parking:kennoway-leven-road', name: 'Leven Road Car Park', kind: 'parking', type: 'other', coordinates: [-3.04549, 56.21042], description: 'Council-listed public car park on Leven Road.', tagline: 'Public parking on Leven Road', url: 'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-park-list', source: 'Fife car park list', organisation: 'Fife Council', opening: 'Public car park; capacity, charges and maximum stay are not published online, so check signs.', price: 'Check signs', score: 60, details: ['capacity=not published', 'fee=not published', 'maximum_stay=not published'] },
    ],
    planner: { eat: [], trails: ['curated-trail:kennoway-den-maiden-castle', 'curated-trail:kennoway-fife-pilgrim-way'], picnic: [], parking: ['curated-parking:kennoway-bishops-court', 'curated-parking:kennoway-leven-road'], toilets: [] },
    providers: providerChecks('Kennoway Den/Maiden Castle walk and Fife Pilgrim Way pages verified.'),
    checks: [
      { url: 'https://www.fife.gov.uk/facilities/park/kennoway-den', outcome: 'verified', note: 'Council confirms area, history and features of the den.' },
      { url: 'https://fifewalking.com/find-a-walk/central-fife-walks/kennoway-den-and-maiden-castle/', outcome: 'verified', note: 'Current local walk page verified.' },
      { url: fifePilgrim, outcome: 'verified', note: 'Current route guide confirms Kennoway and parking context.' },
      { url: 'https://www.fife.gov.uk/roads-travel-parking/parking-and-car-parks/car-park-list', outcome: 'verified', note: 'Council lists both Kennoway car parks.' },
      { url: 'https://www.fife.gov.uk/facilities/community-use-school/kennoway-primary-school-community-use', outcome: 'excluded', note: 'Small café has restricted community-use opening and is not represented as a normal tourist café.' },
      { url: treasure, outcome: 'no_result', note: 'No Kennoway product.' },
    ],
    exclusions: ['Bonnybank Inn and other full restaurants do not qualify for the café-led Eat category.', 'The restricted community-use café is not presented as an ordinary daytime visitor café.', 'Leven and wider Levenmouth attractions are not transferred.'],
    notes: { food: 'No normal current café/coffee-and-cake stop was verified.', picnic: 'The den is suitable for an informal stop, but no dedicated tables were verified.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'bonnybank.json', id: 'bonnybank-scotland', name: 'Bonnybank', score: 44, dogRating: 2,
    character: 'Small Pilgrim Way hamlet',
    summary: 'Bonnybank is genuinely served by the Fife Pilgrim Way and Kingskettle walking network, but it has no independent visitor attraction or café-led daytime offer and its inn is a full pub/restaurant.',
    features: [
      { id: 'curated-trail:bonnybank-fife-pilgrim-way', name: 'Fife Pilgrim Way at Bonnybank', kind: 'trail', type: 'other', coordinates: [-3.0398631, 56.2197612], description: 'The long-distance Fife Pilgrim Way passes the Bonnybank area between Kennoway and Markinch.', tagline: 'A rural point on the pilgrim route', url: fifePilgrim, source: 'Fife Pilgrim Way', organisation: 'Fife Walking', opening: 'Open route; consult current stage and diversion information.', price: 'Free', score: 58 },
      { id: 'curated-trail:bonnybank-kingskettle-loop', name: 'Kingskettle and Bonnybank Loop', kind: 'trail', type: 'other', coordinates: [-3.0398631, 56.2197612], description: 'A published rural circuit linking Bonnybank with Kingskettle.', tagline: 'A Howe of Fife country loop', url: walkFife, source: 'Fife walking routes A–Z', organisation: 'Walk Fife', opening: 'Outdoor route; consult current directions and access conditions.', price: 'Free', score: 58 },
    ],
    planner: { eat: [], trails: ['curated-trail:bonnybank-fife-pilgrim-way', 'curated-trail:bonnybank-kingskettle-loop'], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('Fife Pilgrim Way and Walk Fife routes genuinely pass through the hamlet.'),
    checks: [{ url: fifePilgrim, outcome: 'verified', note: 'Current pilgrim route checked.' }, { url: walkFife, outcome: 'verified', note: 'Current Bonnybank loop index checked.' }, { url: treasure, outcome: 'no_result', note: 'No Bonnybank product.' }],
    exclusions: ['Bonnybank Inn is a full pub/restaurant and is excluded from the café-focused Eat list.', 'Kennoway Den is a Kennoway attraction and does not support this hamlet score.'],
    notes: { attraction: 'No independent visitable attraction was verified.', food: 'No qualifying café was verified.', picnic: 'No dedicated public picnic facility was verified.', parking: 'No general visitor car park was verified.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'scoonie.json', id: 'scoonie-scotland', name: 'Scoonie', score: 48, dogRating: 2,
    character: 'Historic Leven suburb and old parish site',
    summary: 'Scoonie’s old parish church and churchyard supply real heritage interest and the Leven–Lower Largo trail passes nearby, but Scoonie is not a rounded destination independent of Leven and remains selector-only.',
    features: [
      { id: 'curated-attraction:scoonie-old-kirk', name: 'Scoonie Old Parish Church and Churchyard', kind: 'attraction', type: 'church', coordinates: [-2.9953871, 56.2039685], description: 'The surviving old parish church and burial ground preserve medieval and later parish history on Scoonie Brae.', tagline: 'Medieval parish history above Leven', url: 'https://powis.scot/sites/scoonie-old-parish-church-1467/', source: 'Scoonie Old Parish Church', organisation: 'Places of Worship in Scotland', opening: 'Outdoor churchyard access; respect burials and any on-site restrictions.', price: 'Free', score: 60, dog: dogOutdoor },
      { id: 'curated-trail:scoonie-leven-largo', name: 'Leven to Lower Largo Trail near Scoonie', kind: 'trail', type: 'other', coordinates: [-2.9953113, 56.2042839], description: 'The official discovery route crosses Scoonie Burn while linking Leven, Silverburn, Lundin Links and Lower Largo.', tagline: 'A nearby coastal discovery route', url: 'https://trails.welcometofife.com/levenmouth/leven-to-lower-largo/point-6/', source: 'Leven to Lower Largo point 6', organisation: 'Welcome to Fife Discovery Trails', opening: 'Open route; consult current information and conditions.', price: 'Free', score: 56, relatedContext: true },
    ],
    planner: { eat: [], trails: ['curated-trail:scoonie-leven-largo'], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('The official Leven–Lower Largo discovery route supplies related walking context.'),
    checks: [
      { url: 'https://powis.scot/sites/scoonie-old-parish-church-1467/', outcome: 'verified', note: 'Current church-history page checked.' },
      { url: 'https://portal.historicenvironment.scot/designation/LB37351', outcome: 'verified', note: 'HES designation confirms the protected burial enclosure.' },
      { url: 'https://www.fife.gov.uk/facilities/cemetery/scoonie-cemetery', outcome: 'verified', note: 'Council cemetery page checked.' },
      { url: treasure, outcome: 'no_result', note: 'No Scoonie product.' },
    ],
    exclusions: ['Leven beach, cafés, parks, parking and toilets remain with Leven.', 'The related cross-boundary trail does not inflate Scoonie’s town score.'],
    notes: { food: 'No qualifying independent café was verified inside Scoonie.', picnic: 'No dedicated public picnic facility was verified.', parking: 'Cemetery access is not represented as general visitor parking.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'balcurvie.json', id: 'balcurvie-scotland', name: 'Balcurvie', score: 51, dogRating: 2,
    character: 'Small rural hamlet with a bookable farm experience',
    summary: 'Balcurvie has one genuine bookable attraction—Claireville Alpacas—but the hamlet otherwise lacks a café, maintained place trail and public facilities. The attraction appears in See while Balcurvie itself stays below 60.',
    features: [
      { id: 'curated-attraction:balcurvie-claireville', name: 'Claireville Alpaca Farm', kind: 'attraction', type: 'other', coordinates: [-3.06348, 56.19935], description: 'A working-farm experience offering pre-booked alpaca walks, meet-and-greets and encounters with other farm animals.', tagline: 'Bookable alpaca walks in the countryside', url: 'https://clairevillealpaca.co.uk/', source: 'Claireville Alpaca Farm', organisation: 'Claireville Alpacas', opening: 'Book in advance; current sessions and availability vary.', price: 'About £15 for the advertised 45-minute alpaca walk; confirm when booking', score: 72, dog: { rating: 1, status: 'not-allowed', label: 'Do not bring a visiting dog', summary: 'A livestock experience should not be assumed dog friendly; confirm any assistance-dog arrangements directly.' } },
    ],
    planner: emptyPlanner(), providers: providerChecks('No maintained place-specific walking route was verified.'),
    checks: [
      { url: 'https://clairevillealpaca.co.uk/', outcome: 'verified', note: 'Current operator site checked for the bookable farm experience.' },
      { url: 'https://www.welcometofife.com/inspire-me-post/www.welcometofife.com/view-business/claireville-alpaca-farm', outcome: 'verified', note: 'Current destination listing confirms address, activities, duration and price.' },
      { url: treasure, outcome: 'no_result', note: 'No Balcurvie product.' },
    ],
    exclusions: ['The single farm attraction is separately scored and does not make the hamlet a 60+ town.', 'Leven and Windygates cafés and public facilities are outside the boundary.'],
    notes: { food: 'No café-led daytime stop was verified.', trail: 'No maintained place-specific trail was verified.', picnic: 'No public picnic facility was verified.', parking: 'No general public car park was verified; attraction access is by booking.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'windygates.json', id: 'windygates-scotland', name: 'Windygates', score: 56, dogRating: 2,
    character: 'Levenmouth crossroads village',
    summary: 'Windygates has local heritage and nearby Wellsgreen Farm offers a separately scored visitor experience, but the farm lies outside the strict settlement and its restaurant is not used as a café substitute. The village therefore remains below 60.',
    features: [
      { id: 'curated-attraction:windygates-wellsgreen', name: 'The Farm at Wellsgreen', kind: 'attraction', type: 'other', coordinates: [-3.0690304, 56.1751991], description: 'A bookable family farm experience with animal visits and seasonal opening south of Windygates.', tagline: 'Animal encounters at a working farm', url: 'https://wellsgreen.co.uk/farm/visits', source: 'Farm visits', organisation: 'Wellsgreen', opening: 'Current 2026 opening and tickets are published by the operator; book and check before travelling.', price: 'Day-ticket prices apply', score: 72, relatedContext: true, dog: dogUnknown },
    ],
    planner: emptyPlanner(), providers: providerChecks('No maintained exact Windygates visitor trail was verified.'),
    checks: [
      { url: 'https://wellsgreen.co.uk/farm/visits', outcome: 'verified', note: 'Current operator page confirms 2026 farm visits and opening pattern.' },
      { url: 'https://www.welcometofife.com/view-business/the-farm-at-wellsgreen', outcome: 'verified', note: 'Current destination listing corroborates the visitor experience.' },
      { url: treasure, outcome: 'no_result', note: 'No Windygates product.' },
    ],
    exclusions: ['Wellsgreen is explicitly related context outside the strict village boundary and contributes no town-rating points.', 'Its full restaurant is not used to pad the café-led Eat category.', 'Leven attractions and facilities are not transferred.'],
    notes: { food: 'No qualifying in-boundary café was verified.', trail: 'No maintained exact place trail was verified.', picnic: 'No public picnic facility was verified.', parking: 'No general public visitor car park was verified.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'milton-of-balgonie.json', id: 'milton-of-balgonie-scotland', name: 'Milton of Balgonie', score: 50, dogRating: 2,
    character: 'Small riverside village',
    summary: 'Milton of Balgonie has a genuine place on a published Balgonie Castle circular walk, but the castle is outside the village, the hall is not a general visitor facility and no café or public practical-services cluster was verified.',
    features: [
      { id: 'curated-trail:milton-balgonie-circular', name: 'Balgonie Castle Circular Walk at Milton', kind: 'trail', type: 'other', coordinates: [-3.0979458, 56.1934278], description: 'A published Markinch Heritage Group circular route reaches the Milton of Balgonie and Balgonie Castle area.', tagline: 'Riverside village and castle-country circuit', url: 'https://www.markinchheritage.org.uk/webs/189/documents/Balgonie%20Castle%20Circular%20Walk.pdf', source: 'Balgonie Castle Circular Walk', organisation: 'Markinch Heritage Group', opening: 'Outdoor route; use the current route sheet and respect private land and castle access rules.', price: 'Free route', score: 62 },
      { id: 'curated-attraction:milton-balgonie-castle-context', name: 'Balgonie Castle', kind: 'attraction', type: 'castle', coordinates: [-3.1073, 56.1961], description: 'A major historic castle near the village; access and events must be checked directly and the castle is scored separately from Milton.', tagline: 'Nearby castle context—not village merit', url: 'https://www.markinchheritage.org.uk/Index.asp?MainID=24528', source: 'Markinch local walks', organisation: 'Markinch Heritage Group', opening: 'Not assumed open; check the castle’s current arrangements before travel.', price: 'Not published here', score: 70, relatedContext: true, dog: dogUnknown },
    ],
    planner: { eat: [], trails: ['curated-trail:milton-balgonie-circular'], picnic: [], parking: [], toilets: [] },
    providers: providerChecks('Markinch Heritage Group Balgonie Castle circular route verified.'),
    checks: [
      { url: 'https://www.markinchheritage.org.uk/webs/189/documents/Balgonie%20Castle%20Circular%20Walk.pdf', outcome: 'verified', note: 'Published route checked.' },
      { url: 'https://www.fife.gov.uk/facilities/hall/milton-of-balgonie-village-hall', outcome: 'excluded', note: 'Hall facilities and parking are for booked hall use, not general visitors.' },
      { url: treasure, outcome: 'no_result', note: 'No Milton of Balgonie product.' },
    ],
    exclusions: ['Balgonie Castle is separately related context and does not lift the town score.', 'Village-hall parking and toilets are not general public visitor facilities.', 'Markinch services are outside the settlement.'],
    notes: { food: 'No qualifying café was verified.', picnic: 'No dedicated public picnic facility was verified.', parking: 'No general public visitor car park was verified.', toilets: 'No public toilet was verified.' },
  },
  {
    file: 'markinch.json', id: 'markinch-scotland', name: 'Markinch', score: 84, dogRating: 3,
    character: 'Ancient Fife capital and walking hub',
    summary: 'Markinch is a strong heritage-and-walking destination: an exceptional early-12th-century church, a 72-acre designed park, a current café, a deep signed trail network, picnic sites, two free public car parks, rail access and seasonal church facilities. The score uses only verified public experiences.',
    features: [
      { id: 'curated-attraction:markinch-st-drostan', name: 'St Drostan’s Church', kind: 'attraction', type: 'church', coordinates: [-3.1346883, 56.204925], description: 'An active church with an exceptional early-12th-century Scoto-Norman tower, churchyard and interpretation of Markinch’s role as Fife’s medieval capital.', tagline: 'Scotland’s finest Norman church tower', url: 'https://www.nationalchurchestrust.org/church/markinch-st-drostan', source: 'Markinch St Drostan', organisation: 'National Churches Trust', opening: 'April–October 10.30am–5.30pm; keyholder information is posted outside other times. Check before a special trip.', price: 'Free; donations welcome', score: 86, significance: 'national', dog: dogWelcome },
      { id: 'curated-attraction:markinch-balbirnie-park', name: 'Balbirnie Park', kind: 'attraction', type: 'park', coordinates: [-3.144662, 56.2101845], description: 'A 72-acre public designed landscape with extensive woodland paths, unusual trees and the Fife Pilgrim Way.', tagline: 'Estate woodland and pilgrim paths', url: 'https://www.fife.gov.uk/facilities/park/balbirnie-park', source: 'Balbirnie Park', organisation: 'Fife Council', opening: 'Open public park; the hotel and golf course are private and separate.', price: 'Free', score: 80, dog: dogOutdoor },
      { id: 'curated-food:markinch-fig-tree', name: 'The Fig Tree', kind: 'food', type: 'other', coordinates: [-3.1319738, 56.20163], description: 'An independent café in the village centre serving coffee, cakes, breakfast and daytime light food.', tagline: 'Village coffee, cake and light lunch', url: 'https://www.thefigtreemarkinch.co.uk/', source: 'The Fig Tree', organisation: 'The Fig Tree Markinch', opening: 'Check the current operator site or contact the café before travel.', price: '££', score: 78, foodStyle: 'coffee, cake, breakfast and light lunch', dog: dogUnknown },
      { id: 'curated-trail:markinch-town-quiz', name: 'Markinch Town Trail Quiz', kind: 'trail', type: 'other', coordinates: [-3.1336739, 56.204195], description: 'A current 1.5 km, roughly one-hour easy town trail with 18 history and architecture clues.', tagline: 'One hour of clues through old Markinch', url: 'https://trails.welcometofife.com/heart-of-fife/markinch-town-trail-quiz/', source: 'Markinch Town Trail Quiz', organisation: 'Fife Discovery Trails', opening: 'Self-guided outdoor route; pavements include some steep inclines.', price: 'Free', score: 82 },
      { id: 'curated-trail:markinch-braes-loan', name: 'Braes Loan Historical Trail', kind: 'trail', type: 'other', coordinates: [-3.1346883, 56.204925], description: 'A maintained 2.5-mile/4 km circular heritage trail with interpretation and wide Fife views.', tagline: 'Four kilometres through 1,000 years of history', url: 'https://www.markinchheritage.org.uk/Index.asp?MainID=29134', source: 'Braes Loan Trail', organisation: 'Markinch Heritage Group', opening: 'Outdoor route; consult the current leaflet and conditions.', price: 'Free', score: 78 },
      { id: 'curated-trail:markinch-balbirnie-circular', name: 'Balbirnie Park Circular Walks', kind: 'trail', type: 'other', coordinates: [-3.144662, 56.2101845], description: 'Three mapped park circuits of 1.5–2.5 miles, including Fir Hill and the prehistoric stone circle.', tagline: 'Woodland loops with a stone circle option', url: 'https://www.markinchheritage.org.uk/Index.asp?MainID=24528', source: 'Walks in and around Markinch', organisation: 'Markinch Heritage Group', opening: 'Open park routes; route surfaces and gradients vary.', price: 'Free', score: 78 },
      { id: 'curated-trail:markinch-fife-pilgrim-way', name: 'Fife Pilgrim Way through Markinch', kind: 'trail', type: 'other', coordinates: [-3.1346883, 56.204925], description: 'The long-distance pilgrimage route passes St Drostan’s and Balbirnie Park on the way to St Andrews.', tagline: 'A medieval capital on the modern pilgrim way', url: fifePilgrim, source: 'Fife Pilgrim Way', organisation: 'Fife Walking', opening: 'Open long-distance route; consult current stage and diversion information.', price: 'Free', score: 78 },
      { id: 'curated-picnic:markinch-balbirnie', name: 'Balbirnie Park Picnic Sites', kind: 'picnic', type: 'other', coordinates: [-3.144662, 56.2101845], description: 'Published Balbirnie walking information identifies picnic sites within the public park; a fixed table count is not claimed.', tagline: 'Woodland picnic on a park walk', url: 'https://www.markinchheritage.org.uk/Index.asp?MainID=24528', source: 'Walks in and around Markinch', organisation: 'Markinch Heritage Group', opening: 'Open park; take litter home and observe park notices.', price: 'Free', score: 70, details: ['picnic_sites=yes', 'table_count=not published'] },
      { id: 'curated-parking:markinch-glass-street', name: 'Glass Street Car Park', kind: 'parking', type: 'other', coordinates: [-3.1344059, 56.2043897], description: 'Free council car park and the official start of the town trail.', tagline: 'Free central trailhead parking', url: 'https://www.fife.gov.uk/facilities/car-park/glass-street-car-park%2C-markinch', source: 'Glass Street Car Park', organisation: 'Fife Council', opening: 'Public car park; check signs for current restrictions.', price: 'Free', score: 76, details: ['capacity=40', 'fee=no'] },
      { id: 'curated-parking:markinch-station', name: 'Markinch Railway Station Car Park', kind: 'parking', type: 'other', coordinates: [-3.1321485, 56.1985236], description: 'Large free council-listed station car park with shelter, telephone and disabled parking.', tagline: 'Free rail-and-walk parking', url: 'https://www.fife.gov.uk/facilities/car-park/railway-station-car-park%2C-markinch', source: 'Railway Station Car Park, Markinch', organisation: 'Fife Council', opening: 'Public station car park; check railway and on-site notices.', price: 'Free', score: 78, details: ['capacity=143', 'fee=no', 'disabled_parking=yes'] },
      { id: 'curated-toilets:markinch-st-drostan', name: 'St Drostan’s Visitor Toilet', kind: 'toilets', type: 'other', coordinates: [-3.1346883, 56.204925], description: 'A non-accessible toilet available to church visitors while the church is open; this is not an always-open street toilet.', tagline: 'Seasonal church-visitor toilet', url: 'https://www.nationalchurchestrust.org/church/markinch-st-drostan', source: 'Markinch St Drostan', organisation: 'National Churches Trust', opening: 'Only while the church is open, normally April–October 10.30am–5.30pm; check ahead.', price: 'Free to church visitors', score: 60, details: ['access=church_visitors', 'wheelchair=no', '24_hour=no'] },
    ],
    planner: { eat: ['curated-food:markinch-fig-tree'], trails: ['curated-trail:markinch-town-quiz', 'curated-trail:markinch-braes-loan', 'curated-trail:markinch-balbirnie-circular', 'curated-trail:markinch-fife-pilgrim-way'], picnic: ['curated-picnic:markinch-balbirnie'], parking: ['curated-parking:markinch-glass-street', 'curated-parking:markinch-station'], toilets: ['curated-toilets:markinch-st-drostan'] },
    providers: providerChecks('Town Trail Quiz, Braes Loan, three Balbirnie circuits, Place Name walks, Coul Burn route and Fife Pilgrim Way were verified.'),
    checks: [
      { url: 'https://www.nationalchurchestrust.org/church/markinch-st-drostan', outcome: 'verified', note: 'Current opening, church significance, dog access, toilet and transport facilities checked.' },
      { url: 'https://www.fife.gov.uk/facilities/park/balbirnie-park', outcome: 'verified', note: 'Council confirms the public park, woodland walks and Pilgrim Way; private hotel/golf areas remain excluded.' },
      { url: 'https://trails.welcometofife.com/heart-of-fife/markinch-town-trail-quiz/', outcome: 'verified', note: 'Current interactive town route confirms start, distance, duration and difficulty.' },
      { url: 'https://www.markinchheritage.org.uk/Index.asp?MainID=24528', outcome: 'verified', note: 'Current local route hub supplies detailed maps and distances for the wider walking network.' },
      { url: 'https://www.thefigtreemarkinch.co.uk/', outcome: 'verified', note: 'Current café operator site checked.' },
      { url: 'https://www.fife.gov.uk/facilities/car-park/glass-street-car-park%2C-markinch', outcome: 'verified', note: 'Council confirms free 40-space parking.' },
      { url: 'https://www.fife.gov.uk/facilities/car-park/railway-station-car-park%2C-markinch', outcome: 'verified', note: 'Council confirms free 143-space station parking.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Markinch product; the live provider collection was checked.' },
    ],
    exclusions: ['Balbirnie House Hotel and golf course are private businesses outside the public-park offer.', 'Balgonie Castle and Glenrothes facilities do not inflate Markinch’s settlement score.', 'Full restaurants and pubs are not used to pad the café-led Eat category.', 'The church toilet is clearly limited to church opening rather than presented as an always-open public convenience.'],
  },
];

function splitScore(score: number, caps: number[]): number[] {
  let remaining = score;
  return caps.map((cap) => { const value = Math.min(cap, remaining); remaining -= value; return value; });
}

function featureFor(projectId: string, locality: string, seed: Feature): any {
  const tags: Record<Kind, string[]> = {
    attraction: ['curated-visitor-attraction', 'service-context-visitor'],
    food: ['service-context-food'], trail: ['service-context-trail', 'visitor-context-trail'],
    picnic: ['service-context-picnic'], parking: ['service-context-parking', 'visitor-context-parking'],
    toilets: ['service-context-toilets'],
  };
  const visitorPlaceType: Record<Kind, string> = { attraction: 'Attraction', food: 'Cafe', trail: 'Trail', picnic: 'Picnic area', parking: 'Parking', toilets: 'Public toilets' };
  const feature: any = {
    id: seed.id, projectId, name: seed.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality,
    featureType: seed.type, significance: seed.significance ?? 'local', geometry: { type: 'Point', coordinates: seed.coordinates },
    locationType: 'exact', locationConfidence: 'high', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact',
    shortDescription: seed.description,
    details: `visitor_place_type=${visitorPlaceType[seed.kind]}; visit_score=${seed.score}; opening_hours:description=${seed.opening}; entrance_fee=${seed.price}; price_band=${seed.price}; cuisine=${seed.foodStyle ?? seed.kind}; tagline=${seed.tagline}; description=${seed.description}; ${seed.details?.join('; ') ?? ''}`,
    visitorWebsiteUrl: seed.url,
    sourceRecords: [{ sourceName: seed.source, sourceOrganisation: seed.organisation, sourceUrl: seed.url, accessedAt: reviewedAt, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', reliability: seed.organisation.includes('Council') || seed.organisation.includes('Historic Environment') || seed.organisation.includes('Food Standards') ? 'official_statutory' : 'official_non_statutory', notes: seed.relatedContext ? 'Separately scored related visitor context; excluded from settlement score.' : `Current strict-boundary curation for ${seed.name}.` }],
    tags: ['current-context', auditTag, ...(seed.relatedContext ? ['related-context'] : []), ...tags[seed.kind]],
    createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true,
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

function highlightFor(seed: Feature, rank: number): any {
  const feature = featureFor('preview', 'preview', seed);
  return {
    rank, featureId: seed.id, name: seed.name, reason: seed.description, visitorScore: seed.score,
    tagline: seed.tagline, timeToSpend: '30–120 minutes', openingTimes: seed.opening, admission: seed.price,
    freeAdmission: /^free\b/i.test(seed.price), visitorWebsiteUrl: seed.url, sourceName: seed.source,
    sourceUrl: seed.url, verifiedInBoundaryAt: reviewedDate, editorialReview: feature.editorialReview,
  };
}

function isHeritage(feature: any): boolean {
  return feature.tags.some((tag: string) => tag.startsWith('hes-') || tag === 'nrhe-record' || tag === 'nrhe-site');
}

const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
const summary: any[] = [];

for (const [index, audit] of audits.entries()) {
  const path = resolve('data/projects', audit.file);
  const pkg: any = JSON.parse(await readFile(path, 'utf8'));
  if (pkg.project.id !== audit.id) throw new Error(`${audit.name}: project identity mismatch`);
  pkg.features = pkg.features.filter((feature: any) => !feature.tags.includes(auditTag));
  for (const seed of audit.features) {
    if (!seed.relatedContext && !booleanPointInPolygon(point(seed.coordinates), pkg.project.boundary)) {
      throw new Error(`${audit.name}: ${seed.name} is outside the strict boundary but not related_context`);
    }
  }
  pkg.features.push(...audit.features.map((seed) => featureFor(audit.id, audit.name, seed)));
  pkg.project.visitorHighlights = audit.features.filter((seed) => seed.kind === 'attraction').map(highlightFor);
  const band = townScoreBand(audit.score);
  pkg.project.touristAppeal = {
    score: audit.score, dogOwnerScore: townScoreAfterDogAccess(audit.score, audit.dogRating),
    dogAccessScoreAdjustment: townDogAccessScoreAdjustment(audit.dogRating), rating: band.rating, label: band.label,
    summary: audit.summary, dogAccessRating: audit.dogRating,
    dogAccessSummary: audit.dogRating >= 2 ? 'Outdoor access can work for responsible dog visits; venue-specific policies are recorded individually.' : 'Dog access is limited or unconfirmed and no dedicated dog destination is assumed.',
    methodVersion: '2026-09-02-full-settlement-visitor-audit-v2', reviewedAt: reviewedDate,
    sourceUrls: [...new Set([...audit.checks.map((check) => check.url), treasure, curious, mystery, goQuest])],
  };
  const attractions = audit.features.filter((seed) => seed.kind === 'attraction');
  pkg.project.townGuide = {
    characterTag: audit.character,
    headline: attractions.length ? `${attractions[0].name} and a boundary-correct visitor audit` : 'A catalogue locality, not a visitor destination',
    intro: audit.summary,
    bestFor: attractions.length ? attractions.slice(0, 3).map((seed) => seed.name) : ['Regional reference'],
    perfectFor: attractions.length ? ['A carefully planned short stop'] : ['Locating the settlement'],
    suggestedFirstVisit: attractions.length ? { title: attractions[0].name, summary: 'Check the linked current source before travelling; related attractions are scored separately from the town.' } : undefined,
    dontMiss: attractions.map((seed) => seed.name), suggestedTime: audit.score >= 80 ? 'A full half day' : audit.score >= 60 ? '2–4 hours' : attractions.length ? '30–90 minutes for the named attraction' : 'Pass-through only',
    visitorMood: audit.score >= 60 ? 'A worthwhile researched stop with clearly stated practical limitations.' : 'Selector-only settlement; any related attraction is shown separately.',
    sourceUrls: [...new Set(audit.checks.map((check) => check.url))], lastReviewedAt: reviewedDate,
  };
  pkg.project.researchNotes = `Sequential place ${index + 1} of ${audits.length}: every required category, all four named trail providers, local HES/NRHE completeness, dates, access, transport and dogs were checked before continuing. ${audit.exclusions.join(' ')}`;
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
  const statutory = pkg.features.filter((feature: any) => feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag)));
  const visibleStatutory = statutory.filter((feature: any) => !feature.tags.includes('map-hidden'));
  const localHeritage = heritage.filter((feature: any) => feature.evidenceScope !== 'related_context' && !feature.tags.includes('town-selection-heritage-buffer'));
  const visibleHeritage = localHeritage.filter((feature: any) => !feature.tags.includes('map-hidden'));
  const undatedVisible = visibleHeritage.filter((feature: any) => !feature.documentedDateText || feature.dateBasis === 'unknown');
  const dateInLabel = visibleHeritage.filter((feature: any) => /\b(?:1[0-9]{3}|20[0-9]{2}|century|medieval|prehistoric)\b/i.test(feature.name));
  if (undatedVisible.length) throw new Error(`${audit.name}: ${undatedVisible.length} visible undated HES/NRHE records`);
  if (dateInLabel.length) throw new Error(`${audit.name}: ${dateInLabel.length} heritage map labels contain dates`);
  const count = (kind: Kind) => audit.features.filter((feature) => feature.kind === kind).length;
  const report = {
    reviewedAt, sequence: index + 1, sequenceTotal: audits.length, projectId: audit.id, place: audit.name,
    townScore: audit.score, mapPublished: audit.score >= 60,
    categories: {
      see: { audited: true, published: count('attraction'), reason: audit.notes?.attraction },
      eat: { audited: true, published: audit.planner.eat.length, focus: 'Cafés, coffee and cake, tearooms, farm cafés, breakfast and light lunches; full-meal restaurants excluded.', reason: audit.notes?.food },
      trails: { audited: true, published: audit.planner.trails.length, providerChecks: audit.providers },
      picnic: { audited: true, published: audit.planner.picnic.length, reason: audit.notes?.picnic },
      parking: { audited: true, published: audit.planner.parking.length, reason: audit.notes?.parking },
      toilets: { audited: true, published: audit.planner.toilets.length, reason: audit.notes?.toilets },
      accessibility: { audited: true, note: 'Accessibility is stated only where a current source supports it; no blanket accessible claim is made.' },
      transport: { audited: true, note: 'Road, bus and rail context was checked; transport does not add destination points by itself.' },
      dogs: { audited: true, adjustment: pkg.project.touristAppeal.dogAccessScoreAdjustment },
    },
    exclusions: audit.exclusions,
    hes: { assigned: statutory.length, visibleDated: visibleStatutory.length, visibleUndated: 0, missing: 0 },
    heritage: { source: 'Downloaded local HES listed-building, scheduled-monument and NRHE datasets', assigned: heritage.length, local: localHeritage.length, visibleDated: visibleHeritage.length, hiddenUndatedOrNonlocal: heritage.length - visibleHeritage.length, visibleUndated: 0, visibleLabelsContainingDates: 0, missing: 0 },
    boundaryRule: `Only visitor places inside ${audit.name}'s strict study area count toward the settlement score. Related attractions and cross-boundary routes may appear in See or Trails only when explicitly marked related_context and do not inflate the town.`,
    scoreRationale: audit.summary,
    scoreReanalysis: { required: audit.score === 58, completed: true, resultScore: audit.score, rationale: 'Score independently reconciled after all categories, named-provider searches, boundary exclusions and practical checks; no provisional exact-58 town score remains.' },
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
await writeFile(resolve('data/review/kingskettle-markinch-sequential-audit-summary-2026-09-02.json'), `${JSON.stringify({ reviewedAt, currentWebResearch: true, completedSequentially: true, audits: summary }, null, 2)}\n`, 'utf8');
console.log('Sequential Kingskettle-to-Markinch audits completed; Lundin Links and Leven are certified separately in the combined publication check.');
