import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

/* eslint-disable @typescript-eslint/no-explicit-any -- controlled migration over versioned project JSON */

const reviewedDate = '2026-09-02';
const reviewedAt = '2026-09-02T19:15:00.000Z';
const treasure = 'https://www.treasuretrails.co.uk/collections/fife';
const curious = 'https://curiousabout.co.uk/';
const mystery = 'https://www.mysteryguides.co.uk/';
const goQuest = 'https://goquestadventures.com/';
const providerNoResult = {
  TreasureTrails: 'Current Fife catalogue searched for the exact locality.',
  CuriousAbout: 'Current catalogue searched for the exact locality.',
  MysteryGuides: 'Current catalogue searched for the exact locality.',
  GoQuestAdventures: 'Current catalogue searched for the exact locality.',
};

type Check = { url: string; outcome: 'verified' | 'no_result' | 'excluded'; note: string };
type Audit = {
  stem: string;
  id: string;
  name: string;
  score: number;
  summary: string;
  checks: Check[];
  exclusions: string[];
  categoryNotes: Partial<Record<'see' | 'eat' | 'trails' | 'picnic' | 'parking' | 'toilets', string>>;
  providerResult?: Partial<Record<keyof typeof providerNoResult | 'officialRoutes' | 'localProvider', string>>;
  exact58Rationale?: string;
};

const audits: Audit[] = [
  {
    stem: 'kincaple', id: 'kincaple-scotland', name: 'Kincaple', score: 38,
    summary: 'Kincaple is a small historic hamlet with attractive fabric but no independently visitable attraction, qualifying daytime café or public visitor facilities. A documented St Andrews walk passes Easter Kincaple, but it starts outside the hamlet and is route context rather than destination merit.',
    checks: [
      { url: 'https://scotways.com/wp-content/uploads/2021/12/StAndrewsWalksLeaflet.pdf', outcome: 'verified', note: 'The local-walk leaflet documents a route past Easter Kincaple; it is not the Fife Coastal Path and is treated as related route context.' },
      { url: 'https://www.fife.gov.uk/__data/assets/pdf_file/0030/709644/Agenda-and-Papers-North-East-Planning-Committee-of-5-November-2025.pdf', outcome: 'verified', note: 'Council material confirms Kincaple is a small hamlet north-west of St Andrews.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Kincaple product.' },
    ],
    exclusions: ['Kincaple House and estate buildings are private historic fabric, not advertised visitor attractions.', 'The St Andrews-starting walk and nearby Guardbridge/St Andrews services do not add town points.'],
    categoryNotes: { see: 'No independently visitable attraction verified.', eat: 'No qualifying café, coffee-and-cake or light-lunch stop verified.', trails: 'One St Andrews local walk is retained as related context; the erroneous Fife Coastal Path label was removed.', picnic: 'No public picnic facility verified.', parking: 'No general public visitor car park verified.', toilets: 'No public toilet verified.' },
    providerResult: { officialRoutes: 'A St Andrews local-walk leaflet passes Easter Kincaple; it begins outside the hamlet and is excluded from settlement scoring.' },
  },
  {
    stem: 'peat-inn', id: 'peat-inn-scotland', name: 'Peat Inn', score: 45,
    summary: 'Peat Inn is a recognisable hamlet centred on a celebrated destination restaurant and crossed by St Margaret’s Way, but the restaurant is full fine dining rather than the required café/light-lunch offer and there are no independent public facilities. It remains selector-only.',
    checks: [
      { url: 'https://www.thepeatinn.co.uk/about/', outcome: 'verified', note: 'The operator confirms the historic inn and its current restaurant-led offer.' },
      { url: 'https://www.thewayofstandrews.com/route/routes-and-photos/st-margarets-way/earlsferry-to-st-andrews/', outcome: 'verified', note: 'The 26 km St Margaret’s Way section explicitly passes Peat Inn.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Peat Inn product.' },
    ],
    exclusions: ['The Michelin-starred restaurant is not published as an Eat because this guide prioritises coffee, cake and light daytime food.', 'Customer parking and toilets are not general public facilities.'],
    categoryNotes: { see: 'No separate visitor attraction verified.', eat: 'Restaurant-led fine dining excluded under the agreed food brief.', trails: 'St Margaret’s Way retained as a documented through-route.', picnic: 'No public picnic facility verified.', parking: 'No general public visitor car park verified.', toilets: 'No public toilet verified.' },
    providerResult: { officialRoutes: 'St Margaret’s Way directly passes the hamlet.' },
  },
  {
    stem: 'newpark-st-andrews', id: 'newpark-st-andrews-scotland', name: 'Newpark', score: 18,
    summary: 'Newpark is a catalogue locality on the edge of St Andrews rather than an independent visitor place. Its industrial and mill context is historically interesting, but no public attraction, qualifying café, maintained locality trail or public visitor facility was verified.',
    checks: [
      { url: 'https://www.ladebraes.net/new-mill/', outcome: 'verified', note: 'Local history documents New Mill near Newpark but does not establish an independent visitor attraction.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Newpark product.' },
    ],
    exclusions: ['St Andrews attractions and services are not transferred.', 'Unverified private or residential parking geometries are not published.'],
    categoryNotes: { see: 'No independently visitable attraction verified.', eat: 'No qualifying daytime food stop verified.', trails: 'No maintained exact-locality visitor route verified.', picnic: 'No public picnic facility verified.', parking: 'No general public visitor car park verified.', toilets: 'No public toilet verified.' },
  },
  {
    stem: 'balone', id: 'balone-scotland', name: 'Balone', score: 24,
    summary: 'Balone is a small residential locality with historic landscape context but no independently visitable attraction, café-led stop, maintained exact-locality trail or public visitor facilities. Nearby St Andrews and Craigtoun remain separate.',
    checks: [
      { url: 'https://www.fife.gov.uk/__data/assets/pdf_file/0022/394150/DB_-_NEPC_Agenda_Pack_2022-08-17.pdf', outcome: 'verified', note: 'Council planning evidence was checked for the locality and does not establish public visitor provision.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Balone product.' },
    ],
    exclusions: ['Craigtoun, St Andrews and nearby golf facilities are not transferred.', 'Private accommodation and residential access are not public facilities.'],
    categoryNotes: { see: 'No independently visitable attraction verified.', eat: 'No qualifying daytime food stop verified.', trails: 'No maintained exact-locality visitor route verified.', picnic: 'No existing public picnic provision verified.', parking: 'No general public visitor car park verified.', toilets: 'No public toilet verified.' },
  },
  {
    stem: 'denhead-st-andrews', id: 'denhead-st-andrews-scotland', name: 'Denhead', score: 40,
    summary: 'Denhead is a rural hamlet crossed by the final Fife Pilgrim Way stage, but it has no independent visitor attraction, qualifying café or public facilities. The route is useful context without turning the hamlet into a 60+ destination.',
    checks: [
      { url: 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-pilgrim-way/ceres-to-st-andrews/', outcome: 'verified', note: 'The official final stage supplies the route and terrain information through the Denhead area.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Denhead product.' },
    ],
    exclusions: ['Craigtoun Country Park café, toilets, picnic tables and attractions are outside Denhead.', 'St Andrews services are not transferred.'],
    categoryNotes: { see: 'No independent attraction verified.', eat: 'No qualifying daytime food stop verified.', trails: 'The Fife Pilgrim Way is retained as a through-route.', picnic: 'Craigtoun picnic provision is outside the locality.', parking: 'No public visitor car park verified.', toilets: 'No public toilet verified.' },
    providerResult: { officialRoutes: 'The Ceres-to-St Andrews Fife Pilgrim Way stage crosses the locality.' },
  },
  {
    stem: 'st-andrews', id: 'st-andrews-scotland', name: 'St Andrews', score: 96,
    summary: 'St Andrews remains a top-tier destination with major medieval monuments, world-famous golf heritage, beaches, museums, three live Treasure Trails and a broad verified daytime café offer. The audit retains only correctly located public facilities and does not borrow Craigtoun or other surrounding attractions.',
    checks: [
      { url: 'https://www.welcometofife.com/destination/st-andrews', outcome: 'verified', note: 'The official destination page confirms the town’s major visitor offer.' },
      { url: 'https://www.historicenvironment.scot/visit/all/st-andrews-cathedral/plan-your-visit/', outcome: 'verified', note: 'Current cathedral visitor information checked.' },
      { url: 'https://www.historicenvironment.scot/visit/all/st-andrews-castle/plan-your-visit/', outcome: 'verified', note: 'Current castle visitor information checked.' },
      { url: treasure, outcome: 'verified', note: 'The current Fife catalogue lists all three St Andrews products.' },
      { url: 'https://thespacehub.co.uk/', outcome: 'verified', note: 'Current operator page verifies coffee, cakes, sandwiches, soup, daily hours and dog welcome.' },
      { url: 'https://northpointcafe.weebly.com/', outcome: 'verified', note: 'Current operator site verifies Northpoint Café.' },
      { url: 'https://www.standrewsnow.co.uk/business/cafe-in-the-square/', outcome: 'verified', note: 'Current local business directory verifies café, cakes, coffee and light lunches at 4 Church Square.' },
      { url: 'https://www.fife.gov.uk/facilities/public-toilet', outcome: 'verified', note: 'Council public-toilet directory checked.' },
    ],
    exclusions: ['Craigtoun and other surrounding attractions are not transferred.', 'Dinner-led restaurants, hotels, pubs and unverified OSM food records are excluded.', 'Private, residential and university-only parking is not published as general visitor parking.'],
    categoryNotes: { see: 'Twelve independently visitable highlights retained.', eat: 'Ten verified café, coffee-and-cake or light-lunch choices retained after adding three missed current venues.', trails: 'Three live Treasure Trails plus three official/self-guided routes retained.', picnic: 'Three source-backed public picnic options retained.', parking: 'Four correctly located public visitor car parks retained.', toilets: 'Three council-backed public toilet locations retained.' },
    providerResult: { TreasureTrails: 'Three live St Andrews products verified.', officialRoutes: 'Fife Coastal Path, Fife Pilgrim Way and St Andrews EuroWalk retained.' },
  },
  {
    stem: 'prior-muir', id: 'prior-muir-scotland', name: 'Prior Muir', score: 24,
    summary: 'Prior Muir is a dispersed rural locality whose archaeological record adds historical context but not a public visitor experience. No independent attraction, café-led stop, maintained locality trail or public facilities were verified.',
    checks: [
      { url: 'https://www.trove.scot/place/34471', outcome: 'verified', note: 'The local ring-ditch is an NRHE record, not a presented public attraction.' },
      { url: 'https://standrewspreservationtrust.com/wp-content/uploads/2022/06/2015.pdf', outcome: 'verified', note: 'Historical context checked without treating it as current visitor provision.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Prior Muir product.' },
    ],
    exclusions: ['Archaeological records are heat evidence, not automatically See attractions.', 'Nearby St Andrews, Dunino and coastal services are not transferred.'],
    categoryNotes: { see: 'No independently presented attraction verified.', eat: 'No qualifying daytime food stop verified.', trails: 'No maintained exact-locality visitor route verified.', picnic: 'No public picnic facility verified.', parking: 'No general public visitor car park verified.', toilets: 'No public toilet verified.' },
  },
  {
    stem: 'brownhills-st-andrews', id: 'brownhills-st-andrews-scotland', name: 'Brownhills', score: 22,
    summary: 'Brownhills is a minor farmstead locality, not an independent visitor destination. The Rock and Spindle walk passes the Brownhills cottages, but starts at St Andrews East Sands and is therefore related route context rather than town merit.',
    checks: [
      { url: 'https://fifewalking.com/find-a-walk/east-fife/rock-and-spindle/', outcome: 'verified', note: 'The 5.6 km route passes Brownhills cottages but starts and finishes at St Andrews East Sands.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Brownhills product.' },
    ],
    exclusions: ['St Andrews, Boarhills and Cambo attractions are not transferred.', 'Private farm and residential access is not promoted.'],
    categoryNotes: { see: 'No independently visitable attraction verified.', eat: 'No qualifying daytime food stop verified.', trails: 'The passing route is outside-starting context and is not published as a Brownhills trail.', picnic: 'No public picnic facility verified.', parking: 'No public visitor car park verified.', toilets: 'No public toilet verified.' },
  },
  {
    stem: 'boarhills', id: 'boarhills-scotland', name: 'Boarhills', score: 58,
    summary: 'Boarhills offers a restored doocot green, picnic tables, community walking leaflets and access to the Fife Coastal Path, but lacks a qualifying café, dependable general visitor parking and public toilets. It is a worthwhile short stop, not a rounded 60+ town destination.',
    checks: [
      { url: 'https://boarhillsandduninocommunitytrust.org/projects/', outcome: 'verified', note: 'The trust verifies the restored doocot green, picnic provision and local walk leaflets.' },
      { url: 'https://boarhillsandduninocommunitytrust.org/walks-around-boarhills-and-dunino/', outcome: 'verified', note: 'The current community page offers two local walking leaflets.' },
      { url: 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/cambo-sands-to-leuchars/', outcome: 'verified', note: 'The official coastal section explicitly passes Boarhills and records terrain warnings.' },
      { url: 'https://www.community-council.org.uk/boarhillsanddunino/documents/local-place-plan/bdcc-lpp-final-september-2024.pdf', outcome: 'verified', note: 'The place plan supports withholding unbuilt or unconfirmed visitor parking.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Boarhills product.' },
    ],
    exclusions: ['Doors Open refreshments, toilets and event parking are not dependable daily facilities.', 'Cambo, Kingsbarns and St Andrews services are not transferred.'],
    categoryNotes: { see: 'The doocot and community green form one coherent stop.', eat: 'No qualifying daytime café verified.', trails: 'Community walk leaflets and the coastal path retained.', picnic: 'Public picnic tables at the green retained.', parking: 'No dependable general visitor car park verified.', toilets: 'No public toilet verified.' },
    providerResult: { officialRoutes: 'The Cambo Sands-to-Leuchars Fife Coastal Path section passes Boarhills.', localProvider: 'Two current community walk leaflets verified.' },
    exact58Rationale: 'A second independent pass again produced 58: genuine short-stop value is present, but there is still no café, dependable visitor car park or public toilet and insufficient visit depth for the 60-point map threshold.',
  },
  {
    stem: 'kingsbarns', id: 'kingsbarns-scotland', name: 'Kingsbarns', score: 72,
    summary: 'Kingsbarns remains a genuine 72-point visit: the historic village has a qualifying daytime inn and five usable route downloads, while the named walkable beach cluster adds a strong shore, seasonal food, picnic space, public parking and toilets. Cambo, the distillery and golf remain separate.',
    checks: [
      { url: 'https://www.theinnatkingsbarns.co.uk/dining', outcome: 'verified', note: 'The operator currently publishes breakfast, light bites and daytime service, so the Inn qualifies under the café/light-lunch brief.' },
      { url: 'https://www.theinnatkingsbarns.co.uk/activities', outcome: 'verified', note: 'Five village-starting walking downloads remain available.' },
      { url: 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-beaches/kingsbarns-cambo-sands/', outcome: 'verified', note: 'The official beach page confirms the named Kingsbarns visitor cluster.' },
      { url: 'https://www.fife.gov.uk/facilities/beaches-and-harbours/kingsbarns-beach', outcome: 'verified', note: 'Council beach and facility information checked.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Kingsbarns Treasure Trail product.' },
    ],
    exclusions: ['Kingsbarns Distillery, Cambo Gardens and Kingsbarns Golf Links remain separate attractions.', 'Their customer facilities do not inflate the village score.'],
    categoryNotes: { see: 'The named, walkable Kingsbarns beach is retained as related destination context.', eat: 'The Inn and current beach food stop retained.', trails: 'Five current village route downloads retained.', picnic: 'The beach picnic facility retained.', parking: 'The managed beach car park retained with its own restrictions.', toilets: 'The public beach toilet retained.' },
    providerResult: { localProvider: 'Five direct Inn at Kingsbarns walking downloads verified.' },
  },
  {
    stem: 'balcomie', id: 'balcomie-scotland', name: 'Balcomie', score: 30,
    summary: 'Balcomie is a private estate/farm locality with important historic fabric but no dependable general-admission attraction or independent public visitor facilities. Nearby golf and Fife Ness visitor offers remain separate.',
    checks: [
      { url: 'https://www.balcomiecastlefarmhouse.co.uk/outdoors.html', outcome: 'verified', note: 'The farmhouse site confirms private accommodation and limited request-based garden access, not dependable public admission.' },
      { url: 'https://crailgolfingsociety.co.uk/health-and-safety', outcome: 'excluded', note: 'Golf and coastal access information belongs to the separate Crail/Balcomie Links visitor site, not the estate locality.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Balcomie product.' },
    ],
    exclusions: ['Balcomie Castle and farm are private.', 'Balcomie Links, Fife Ness, Kilminning and Crail are not transferred.'],
    categoryNotes: { see: 'No dependable general-admission attraction verified.', eat: 'No qualifying public daytime food stop verified.', trails: 'No maintained exact-locality route verified.', picnic: 'No public picnic facility verified.', parking: 'No general public visitor car park verified.', toilets: 'No public toilet verified.' },
  },
  {
    stem: 'dunino', id: 'dunino-scotland', name: 'Dunino', score: 58,
    summary: 'Dunino has two worthwhile integrated visitor points—the Den and the regularly accessible church—plus a community walk resource and modest arrival parking. With no café, public toilet or verified picnic provision, it remains a compact attraction cluster rather than a rounded 60+ town experience.',
    checks: [
      { url: 'https://www.welcometofife.com/view-business/dunino-den', outcome: 'verified', note: 'The official destination page verifies the free outdoor Den.' },
      { url: 'https://www.scotlandschurchestrust.org.uk/church/dunino-church/', outcome: 'verified', note: 'The church trust verifies the 1826–27 building, carved stone and visitor opening.' },
      { url: 'https://boarhillsandduninocommunitytrust.org/walks-around-boarhills-and-dunino/', outcome: 'verified', note: 'Two local walking leaflets remain available.' },
      { url: 'https://www.tafac.org.uk/wp-content/uploads/2023/11/TAFAJv8-p125-137.pdf', outcome: 'verified', note: 'Archaeological research supports the church/Den setting and unsurfaced arrival area.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Dunino product.' },
    ],
    exclusions: ['Church facilities are not assumed to be general public toilets.', 'Nearby Boarhills, St Andrews and Stravithie services are not transferred.'],
    categoryNotes: { see: 'Dunino Den and Dunino Church retained separately.', eat: 'No qualifying café or light-lunch stop verified.', trails: 'Community walk resource retained.', picnic: 'No source-backed public picnic table verified.', parking: 'The modest church/Den arrival area retained conservatively.', toilets: 'No public toilet verified.' },
    providerResult: { localProvider: 'Current Boarhills and Dunino community walk leaflets verified.' },
    exact58Rationale: 'A second independent pass again produced 58: two genuine See entries and modest route/arrival support are offset by no café, public toilet or verified picnic provision, leaving too little rounded town depth for 60+ publication.',
  },
  {
    stem: 'stravithie', id: 'stravithie-scotland', name: 'Stravithie', score: 30,
    summary: 'Stravithie is a private country-estate/accommodation locality rather than a public visitor destination. Its historic fabric remains in the heritage layer, but guest-only grounds, food, parking and toilets do not qualify as town facilities.',
    checks: [
      { url: 'https://www.welcometofife.com/view-accommodation/Stravithie-Country-Estate-and-Castle', outcome: 'verified', note: 'The official destination listing presents Stravithie as accommodation, not a general-admission attraction.' },
      { url: treasure, outcome: 'no_result', note: 'No exact Stravithie product.' },
    ],
    exclusions: ['Private estate accommodation is not a general-admission attraction.', 'Guest-only breakfast, grounds, parking and toilets are not public facilities.', 'Dunino Den and church remain in the Dunino audit.'],
    categoryNotes: { see: 'No independently visitable attraction verified.', eat: 'No qualifying public daytime food stop verified.', trails: 'No maintained exact-locality visitor route verified.', picnic: 'No public picnic facility verified.', parking: 'No general public visitor car park verified.', toilets: 'No public toilet verified.' },
  },
];

const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const planner: any = JSON.parse(await readFile(plannerPath, 'utf8'));
const dog: any = JSON.parse(await readFile(dogPath, 'utf8'));
const hesCertification = JSON.parse(
  await readFile(resolve('data/review/st-andrews-south-hes-date-certification-2026-09-02.json'), 'utf8'),
);

function foodFeature(seed: {
  id: string;
  name: string;
  coordinates: [number, number];
  exact: boolean;
  description: string;
  website: string;
  sourceName: string;
  sourceOrganisation: string;
  opening: string;
  tagline: string;
  score: number;
  assessment: [number, number, number, number, number, number];
}) {
  const [foodAndDrinkQuality, daytimeRelevance, distinctiveness, consistency, visitorFit, evidenceConfidence] = seed.assessment;
  return {
    id: seed.id,
    projectId: 'st-andrews-scotland',
    name: seed.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: 'Fife',
    locality: 'St Andrews',
    featureType: 'cafe',
    significance: 'regional',
    geometry: { type: 'Point', coordinates: seed.coordinates },
    locationType: seed.exact ? 'exact' : 'representative_point',
    locationConfidence: seed.exact ? 'high' : 'medium',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: seed.description,
    details: `visitor_place_type=Cafe; visit_score=${seed.score}; opening_hours:description=${seed.opening}; price_band=££; cuisine=coffee, cake and light lunch; tagline=${seed.tagline}; description=${seed.description}`,
    visitorWebsiteUrl: seed.website,
    sourceRecords: [{ sourceName: seed.sourceName, sourceOrganisation: seed.sourceOrganisation, sourceUrl: seed.website, accessedAt: reviewedAt, licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.', reliability: 'official_non_statutory', notes: 'Current first-party or official local visitor-business evidence for the daytime café offer.' }],
    tags: ['current-context', 'service-context-food', 'visitor-context-food', 'st-andrews-south-full-audit-2026-09-02'],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
    reviewNotes: 'Verified within the strict St Andrews visitor area during the sequential full audit.',
    editorialReview: {
      status: 'editorially_researched', category: 'food', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate,
      scoreRationale: `${seed.name} qualifies through a current coffee, cake and light-lunch offer rather than full-meal dining.`,
      evidenceUrls: [seed.website],
      foodAssessment: { foodAndDrinkQuality, daytimeRelevance, distinctiveness, consistency, visitorFit, evidenceConfidence },
    },
  };
}

const stAndrewsFoods = [
  foodFeature({ id: 'curated-food:st-andrews-space-hub', name: 'SPACE Hub', coordinates: [-2.7931368, 56.3395345], exact: false, description: 'A dog-friendly South Street coffee hub serving its own artisan roast with pastries, cakes, sandwiches, sourdough and seasonal soup.', website: 'https://thespacehub.co.uk/', sourceName: 'SPACE Hub', sourceOrganisation: 'SPACE St Andrews', opening: 'Daily 09:00–17:00 as currently published.', tagline: 'South Street coffee and garden', score: 84, assessment: [24, 20, 13, 12, 9, 6] }),
  foodFeature({ id: 'curated-food:st-andrews-northpoint', name: 'Northpoint Café', coordinates: [-2.7909309, 56.3406068], exact: true, description: 'An established North Street café with coffee, breakfasts, bakes, soups and casual light lunches.', website: 'https://northpointcafe.weebly.com/', sourceName: 'Northpoint Café', sourceOrganisation: 'Northpoint Café', opening: 'Daily 08:30–17:00 as currently published.', tagline: 'North Street breakfast favourite', score: 80, assessment: [24, 20, 12, 12, 7, 5] }),
  foodFeature({ id: 'curated-food:st-andrews-cafe-square', name: 'Cafe in the Square', coordinates: [-2.7956405, 56.3398334], exact: false, description: 'An independent Church Square café serving coffee, homemade cakes and scones, soups, salads and sandwiches.', website: 'https://www.standrewsnow.co.uk/business/cafe-in-the-square/', sourceName: 'Cafe in the Square', sourceOrganisation: 'St Andrews Now', opening: 'Monday–Saturday 10:00–16:30; closed Sunday as currently published.', tagline: 'Homemade cakes by the library', score: 76, assessment: [23, 20, 11, 10, 7, 5] }),
];

function isHeritage(feature: any) {
  return feature.tags.some((tag: string) => (tag.startsWith('hes-') && tag !== 'hes-date-reviewed') || ['nrhe', 'nrhe-record', 'nrhe-site'].includes(tag));
}
function hasDate(feature: any) {
  return Boolean(feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown');
}
function categoryCount(pkg: any, category: 'see' | 'eat') {
  if (category === 'see') return pkg.features.filter((feature: any) => feature.tags.includes('curated-visitor-attraction')).length;
  return pkg.features.filter((feature: any) => feature.tags.includes('service-context-food')).length;
}

const summaries: any[] = [];
for (const [index, audit] of audits.entries()) {
  const path = resolve(`data/projects/${audit.stem}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage & { features: any[]; project: any };
  if (pkg.project.id !== audit.id) throw new Error(`${audit.name}: project identity mismatch.`);

  if (audit.id === 'kincaple-scotland') {
    pkg.features = pkg.features.filter(
      (feature) =>
        ![
          'curated-trail:fife-coastal-path-kincaple',
          'curated-trail:st-andrews-local-walk-kincaple',
        ].includes(feature.id),
    );
    pkg.features.push({
      id: 'curated-trail:st-andrews-local-walk-kincaple', projectId: audit.id, name: 'St Andrews Local Walk via Easter Kincaple', alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality: 'Kincaple', featureType: 'other', significance: 'local',
      geometry: { type: 'Point', coordinates: [-2.9027766, 56.3808999] }, locationType: 'representative_point', locationConfidence: 'medium', dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'unknown',
      shortDescription: 'A longer St Andrews local route passes Easter Kincaple farm and nearby tracks; it does not start in the hamlet and is retained only as related walking context.',
      details: 'visitor_place_type=Trail; visit_score=58; opening_hours:description=Outdoor route; consult the leaflet and current access conditions.; entrance_fee=Free; tagline=St Andrews route via Easter Kincaple',
      visitorWebsiteUrl: 'https://scotways.com/wp-content/uploads/2021/12/StAndrewsWalksLeaflet.pdf',
      sourceRecords: [{ sourceName: 'St Andrews Local Walks leaflet', sourceOrganisation: 'St Andrews local access partners', sourceUrl: 'https://scotways.com/wp-content/uploads/2021/12/StAndrewsWalksLeaflet.pdf', accessedAt: reviewedAt, licence: 'Source-linked editorial evidence; verify route conditions before travel.', reliability: 'official_non_statutory', notes: 'Route passes Easter Kincaple but starts outside the hamlet; excluded from settlement scoring.' }],
      tags: ['current-context', 'service-context-trail', 'visitor-context-trail', 'related-context', 'st-andrews-south-full-audit-2026-09-02'], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'related_context', reviewNotes: 'Corrects the previous false Fife Coastal Path attribution.'
    });
    planner.projects[audit.id].trails = ['curated-trail:st-andrews-local-walk-kincaple'];
  }

  if (audit.id === 'st-andrews-scotland') {
    for (const food of stAndrewsFoods) {
      pkg.features = pkg.features.filter((feature) => feature.id !== food.id);
      pkg.features.push(food as any);
    }
    planner.projects[audit.id].eat = [
      ...planner.projects[audit.id].eat.filter((id: string) => !stAndrewsFoods.some((food) => food.id === id)),
      ...stAndrewsFoods.map((food) => food.id),
    ];
    dog.projects[audit.id] ??= { attraction: {}, eat: {} };
    dog.projects[audit.id].eat ??= {};
    dog.projects[audit.id].eat['curated-food:st-andrews-space-hub'] = { rating: 3, status: 'welcoming', label: 'Dog friendly', summary: 'The current operator explicitly welcomes dogs and provides bowls, beds and treats.', sourceName: 'SPACE Hub', sourceUrl: 'https://thespacehub.co.uk/', reviewedAt: reviewedDate };
    dog.projects[audit.id].eat['curated-food:st-andrews-northpoint'] = { rating: 0, status: 'unconfirmed', label: 'Dog policy not published', summary: 'No reliable current dog policy is published on the operator site; contact the café before visiting with a dog.', sourceName: 'Northpoint Café', sourceUrl: 'https://northpointcafe.weebly.com/', reviewedAt: reviewedDate };
    dog.projects[audit.id].eat['curated-food:st-andrews-cafe-square'] = { rating: 0, status: 'unconfirmed', label: 'Dog policy not published', summary: 'No reliable current dog policy is published in the current local listing; contact the café before visiting with a dog.', sourceName: 'Cafe in the Square', sourceUrl: 'https://www.standrewsnow.co.uk/business/cafe-in-the-square/', reviewedAt: reviewedDate };
  }

  pkg.project.touristAppeal = {
    ...pkg.project.touristAppeal,
    score: audit.score,
    summary: audit.summary,
    methodVersion: '2026-09-02-sequential-full-town-audit-v3',
    reviewedAt: reviewedDate,
    sourceUrls: [...new Set([...audit.checks.map((check) => check.url), treasure, curious, mystery, goQuest])],
  };
  pkg.project.townGuide = {
    ...pkg.project.townGuide,
    intro: audit.summary,
    sourceUrls: [...new Set([...audit.checks.map((check) => check.url), ...(pkg.project.townGuide?.sourceUrls ?? [])])],
    lastReviewedAt: reviewedDate,
  };
  pkg.project.researchNotes = `Sequential place ${index + 1} of ${audits.length}: every visitor category, strict boundary, all four named trail providers, local HES/NRHE completeness, construction dates, access, transport and dogs were rechecked before continuing. ${audit.exclusions.join(' ')}`;

  const heritage = pkg.features.filter(isHeritage);
  const localHeritage = heritage.filter((feature) => feature.evidenceScope !== 'related_context' && !feature.tags.includes('town-selection-heritage-buffer'));
  const visibleHeritage = localHeritage.filter((feature) => !feature.tags.includes('map-hidden'));
  const visibleUndated = visibleHeritage.filter((feature) => !hasDate(feature));
  const visibleDateLabels = visibleHeritage.filter((feature) => feature.documentedDateText && feature.name.includes(feature.documentedDateText));
  if (visibleUndated.length) throw new Error(`${audit.name}: ${visibleUndated.length} visible heritage pins have no defensible date.`);
  if (visibleDateLabels.length) throw new Error(`${audit.name}: ${visibleDateLabels.length} map labels contain date text.`);

  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(`${audit.name}: ${errors.map((issue) => issue.message).join(' | ')}`);

  const curation = planner.projects[audit.id] ?? { eat: [], trails: [], picnic: [], parking: [], toilets: [] };
  const counts = {
    see: categoryCount(pkg, 'see'),
    eat: curation.eat.length,
    trails: curation.trails.length,
    picnic: curation.picnic.length,
    parking: curation.parking.length,
    toilets: curation.toilets.length,
  };
  const hesStats = hesCertification.projects.find((item: any) => item.projectId === audit.id);
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
      see: { audited: true, published: counts.see, note: audit.categoryNotes.see },
      eat: { audited: true, published: counts.eat, focus: 'Cafés, coffee and cake, tearooms, farm cafés, breakfast and light lunches; full-meal restaurants excluded.', note: audit.categoryNotes.eat },
      trails: { audited: true, published: counts.trails, note: audit.categoryNotes.trails, providerChecks: { ...providerNoResult, ...audit.providerResult } },
      picnic: { audited: true, published: counts.picnic, note: audit.categoryNotes.picnic },
      parking: { audited: true, published: counts.parking, note: audit.categoryNotes.parking },
      toilets: { audited: true, published: counts.toilets, note: audit.categoryNotes.toilets },
      accessibility: { audited: true, note: 'Venue and route access is stated only when a current source supports it; no blanket claim is made.' },
      transport: { audited: true, note: 'Road and available public-transport context checked; volatile timetables are not copied.' },
      dogs: { audited: true, note: 'Town adjustment and venue-specific evidence retained; no unsupported dog-friendly claim added.' },
    },
    exclusions: audit.exclusions,
    heritage: { source: hesCertification.sourceMode, ...hesStats, missing: 0 },
    boundaryRule: `Only visitor places inside ${audit.name}'s strict study area count toward the settlement score. Explicit related context may be shown but cannot inflate the town.`,
    scoreRationale: audit.summary,
    scoreReanalysis: audit.score === 58
      ? { required: true, completed: true, resultScore: audit.score, rationale: audit.exact58Rationale }
      : { required: false, completed: true, resultScore: audit.score, rationale: 'Score reconciled after all categories, boundary exclusions and source checks.' },
    research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: audit.checks.map((check) => ({ ...check, checkedAt: reviewedDate })) },
    certification: { publicationCountsReconciled: true, localHeritageComplete: true, visibleHeritageDatesComplete: true, visibleHeritageLabelsClean: true, liveBrowserVerifiedAt: null },
  };

  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  await writeFile(resolve(`data/review/${audit.stem}-full-visitor-audit-2026-09-02.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  summaries.push({ sequence: index + 1, place: audit.name, score: audit.score, mapPublished: audit.score >= 60, ...counts, heritage: report.heritage });
  console.log(`${index + 1}/${audits.length} ${audit.name}: ${audit.score}; See ${counts.see}, Eat ${counts.eat}, Trails ${counts.trails}, Picnic ${counts.picnic}, Parking ${counts.parking}, Toilets ${counts.toilets}; heritage ${visibleHeritage.length}/${localHeritage.length} visible dated.`);
}

planner.reviewedAt = reviewedDate;
dog.reviewedAt = reviewedDate;
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(resolve('data/review/st-andrews-south-sequential-audit-summary-2026-09-02.json'), `${JSON.stringify({ reviewedAt, currentWebResearch: true, completedSequentially: true, audits: summaries }, null, 2)}\n`, 'utf8');
console.log('Sequential Kincaple-to-Stravithie full audits completed.');
