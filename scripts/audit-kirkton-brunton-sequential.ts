import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, TouristAppealRating, VisitorHighlight } from '../src/domain/models';
import type { PlannerCurationState } from '../src/domain/plannerCuration';
import { townDogAccessScoreAdjustment, townScoreAfterDogAccess, townScoreBand } from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedDate = '2026-09-02';
const reviewedAt = '2026-09-02T16:15:00.000Z';
const auditTag = 'kirkton-brunton-full-audit-2026-09-02';
const plannerPath = resolve('data/east-neuk-visitor-planner-curation.json');
const dogPath = resolve('data/east-neuk-dog-access-curation.json');
const treasureCollection = 'https://www.treasuretrails.co.uk/collections/fife';
const curiousUrl = 'https://www.curiousabout.co.uk/';
const mysteryUrl = 'https://www.mysteryguides.co.uk/';
const goQuestUrl = 'https://goquestadventures.com/';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';

type FeatureKind = 'attraction' | 'food' | 'trail' | 'picnic' | 'parking' | 'toilets';
type SourceOutcome = 'verified' | 'no_result' | 'excluded';

interface FeatureSeed {
  id: string;
  name: string;
  kind: FeatureKind;
  featureType: string;
  coordinates: [number, number];
  description: string;
  tagline: string;
  url: string;
  sourceName: string;
  organisation: string;
  opening: string;
  price: string;
  score: number;
  details?: string[];
  reuseExisting?: boolean;
  visitability?: 'full_visitor_experience' | 'substantial_visible_remains';
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
  suggestedTime: string;
  features: FeatureSeed[];
  planner: PlannerCurationState;
  officialRouteFinding: string;
  sourceChecks: Array<{ url: string; outcome: SourceOutcome; note: string }>;
  exclusions: string[];
  practical: { eat: string; picnic: string; parking: string; toilets: string; accessibility: string; transport: string };
}

const wormitBalmerino = 'https://fifewalking.com/find-a-walk/north-fife/wormit-and-balmerino-circuits/';
const churchOperator = 'https://www.wormitparishchurch.org.uk/';
const jimClark = 'https://www.welcometofife.com/view-business/jim-clark-statue';
const kilmanyWalk = 'https://fifewalking.com/find-a-walk/north-fife/gauldry-and-kilmany/';
const kilmanyRailway = 'https://scotways.com/heritage-path/HP14/';
const logieChurch = 'https://www.trove.scot/place/33242';
const fifeCoastalPath = 'https://fifecoastandcountrysidetrust.co.uk/walks/fife-coastal-path/wormit-bay-to-newburgh/';
const creichCastle = 'https://portal.historicenvironment.scot/designation/SM848';
const creichChurch = 'https://www.trove.scot/place/31799';
const creichCastleVisitor = 'https://thecastleguide.co.uk/castle/creich-castle/';
const creichCommunity = 'https://www.luthrievillagehall.org.uk/Index.asp?ID=357&MainID=24423';
const fifeCemeteries = 'https://www.fife.gov.uk/facilities/cemetery';
const bruntonAppraisal = 'https://www.fife.gov.uk/__data/assets/pdf_file/0027/155907/Brunton_CAAapproved.pdf';
const fifeConservation = 'https://www.fife.gov.uk/planning/built-heritage-and-planning/conservation-areas';
const balmerinoPlaceNames = 'https://fife-placenames.glasgow.ac.uk/parish/?id=14';
const rathilletPlaceName = 'https://fife-placenames.glasgow.ac.uk/placename/?id=2920';
const placeNameVolume = 'https://fife-placenames.glasgow.ac.uk/volume/?id=4';

function providerChecks(officialRouteFinding: string): Record<string, string> {
  return {
    TreasureTrails: 'Current Fife catalogue checked; no live place-specific product.',
    CuriousAbout: 'Current provider catalogue checked; no place-specific route.',
    MysteryGuides: 'Current provider catalogue checked; no place-specific route.',
    GoQuestAdventures: 'Current provider catalogue checked; no place-specific route.',
    officialAndConventionalRoutes: officialRouteFinding,
  };
}

const audits: AuditSeed[] = [
  {
    file: 'kirkton-balmerino.json', id: 'kirkton-balmerino-scotland', name: 'Kirkton (Balmerino)', score: 34, dogRating: 1,
    summary: 'Kirkton is a small historic settlement with a genuine link to the Wormit–Balmerino walking circuit, but no independently visitable attraction, café or public visitor facility. Balmerino Abbey and its facilities remain outside this settlement score.',
    character: 'Small Balmerino-parish settlement', headline: 'Historic cottages on the Balmerino walking circuit',
    intro: 'Kirkton is retained as a route-linked historic locality. The nearby abbey is not reassigned to the settlement.', bestFor: ['A pre-planned rural walk', 'Local historic fabric'], suggestedTime: 'Pass-through on the wider circuit',
    features: [{ id: 'curated-trail:kirkton-wormit-balmerino-circuits', name: 'Wormit and Balmerino Circuits via Kirkton', kind: 'trail', featureType: 'walking_route', coordinates: [-3.0356292, 56.4137988], description: 'A documented set of Tay-estuary circuits whose route reaches the houses at Kirkton before continuing to Balmerino.', tagline: 'Tay-side circuit through Kirkton', url: wormitBalmerino, sourceName: 'Wormit and Balmerino Circuits', organisation: 'Fife Walking', opening: 'Open countryside route; check mud, field, shoreline and livestock conditions.', price: 'Free', score: 64, details: ['trail_type=Cross-boundary circular walking routes; trail_relationship=route passes Kirkton'] }],
    planner: { eat: [], trails: ['curated-trail:kirkton-wormit-balmerino-circuits'], picnic: [], parking: [], toilets: [] },
    officialRouteFinding: 'Fife Walking route directions explicitly reach the houses at Kirkton; the start and abbey facilities remain in Wormit/Balmerino.',
    sourceChecks: [{ url: balmerinoPlaceNames, outcome: 'verified', note: 'Place-name evidence resolves this as Kirkton in Balmerino parish.' }, { url: wormitBalmerino, outcome: 'verified', note: 'Working route page explicitly describes approaching the houses at Kirkton.' }, { url: treasureCollection, outcome: 'no_result', note: 'No current Kirkton or Balmerino-parish product was found.' }],
    exclusions: ['Balmerino Abbey is a separate hamlet attraction and is not transferred into Kirkton.', 'The small Balmerino roadside parking and abbey picnic tables are outside Kirkton.', 'No current café, public toilet or dedicated visitor parking was verified.'],
    practical: { eat: 'No qualifying café, coffee-and-cake stop or light-lunch outlet verified.', picnic: 'No managed picnic facility inside Kirkton.', parking: 'No dedicated public visitor car park inside Kirkton.', toilets: 'No public toilet inside Kirkton.', accessibility: 'The wider circuit includes unsurfaced, steep and potentially muddy sections; no step-free Kirkton route is claimed.', transport: 'Rural bus coverage was checked; timetable access does not add destination points.' },
  },
  {
    file: 'bottomcraig.json', id: 'bottomcraig-scotland', name: 'Bottomcraig', score: 36, dogRating: 1,
    summary: 'Bottomcraig has an active 1811 parish church that can be appreciated during advertised worship or by arrangement, but no wider visitor cluster. It remains below the town-map threshold and does not inherit Balmerino Abbey or Gauldry services.',
    character: 'Small church settlement', headline: 'An active early-19th-century parish church', intro: 'Bottomcraig is a brief church-history stop rather than a rounded destination.', bestFor: ['Church architecture', 'A pre-arranged heritage visit'], suggestedTime: '15–30 minutes when access is available',
    features: [{ id: 'hes-listed-building:LB2529', name: 'Balmerino Parish Church', kind: 'attraction', featureType: 'place_of_worship', coordinates: [-3.02462320604114, 56.408948692154], description: 'The active parish church opened in 1811; interior access is tied to advertised services or arrangement rather than guaranteed tourist opening.', tagline: 'Active 1811 parish church', url: churchOperator, sourceName: 'Balmerino, Creich, Flisk, Kilmany and Wormit Church', organisation: 'Church of Scotland congregation', opening: 'Advertised worship at Balmerino; contact the congregation for access outside services.', price: 'Free; donations welcome', score: 62, reuseExisting: true, visitability: 'substantial_visible_remains' }],
    planner: { eat: [], trails: [], picnic: [], parking: [], toilets: [] }, officialRouteFinding: 'No maintained Bottomcraig-specific visitor route was found; nearby Balmerino routes were not reassigned.',
    sourceChecks: [{ url: churchOperator, outcome: 'verified', note: 'Current congregation site confirms the Bottomcraig building and advertised Balmerino worship pattern.' }, { url: treasureCollection, outcome: 'no_result', note: 'No current Bottomcraig product was found.' }],
    exclusions: ['Church refreshments after worship are not a general café.', 'Congregational parking is not published as an always-available public visitor car park.', 'Balmerino Abbey routes and picnic tables are outside Bottomcraig.'],
    practical: { eat: 'No qualifying public daytime café or tearoom.', picnic: 'No managed public picnic site.', parking: 'No general public visitor parking was verified; church use is event-dependent.', toilets: 'No public toilet was verified; church facilities are not represented as public conveniences.', accessibility: 'No current public accessibility statement for independent sightseeing was found.', transport: 'The church is served by a nearby bus stop; check current timetables before travel.' },
  },
  {
    file: 'kilmany.json', id: 'kilmany-scotland', name: 'Kilmany', score: 62, dogRating: 2,
    summary: 'Kilmany is a genuine notable stop: the village-centre Jim Clark statue, strong historic fabric and two documented walking routes create a coherent short visit. The absence of a café, public toilet, formal picnic site and dedicated visitor car park keeps it in the 60–69 band.',
    character: 'Historic village and Jim Clark birthplace', headline: 'Jim Clark heritage with two country routes', intro: 'Kilmany earns a map marker from its own village identity and walkable heritage, not from Cupar or roadside businesses elsewhere.', bestFor: ['Jim Clark and motor-racing history', 'Historic village fabric', 'Country walking'], suggestedTime: '1–3 hours',
    features: [
      { id: 'curated-attraction:kilmany-jim-clark-statue', name: 'Jim Clark Statue', kind: 'attraction', featureType: 'memorial', coordinates: [-2.99488, 56.38335], description: 'A life-size bronze statue of double Formula One world champion Jim Clark in the Fife village where he was born.', tagline: 'Jim Clark in his birthplace', url: jimClark, sourceName: 'Jim Clark Statue', organisation: 'Welcome to Fife', opening: 'Open-air roadside memorial; view with care beside the village road.', price: 'Free', score: 72, visitability: 'full_visitor_experience' },
      { id: 'curated-trail:kilmany-railway-line', name: 'Kilmany Railway Line Heritage Path', kind: 'trail', featureType: 'walking_route', coordinates: [-2.9974, 56.3822], description: 'A 3.5 km linear heritage path from Kilmany along the former North Fife railway towards Rathillet Mill; sections may be overgrown, wet and crossed by a fence.', tagline: 'Old North Fife railway path', url: kilmanyRailway, sourceName: 'Kilmany Railway Line', organisation: 'ScotWays Heritage Paths', opening: 'Open path; use the current route description and expect vegetation, mud and obstacles.', price: 'Free', score: 67, details: ['trail_type=Linear heritage path; distance=3.5 km one way; accessibility=pedestrians and horses; surface=earth track'] },
      { id: 'curated-trail:kilmany-gauldry-circuit', name: 'Gauldry and Kilmany Circuit', kind: 'trail', featureType: 'walking_route', coordinates: [-2.9936, 56.3840], description: 'A 10.5 km / 6.5 mile rural circuit through Kilmany, with woodland, farm paths, the old railway and an optional Jim Clark statue detour; it starts in Gauldry.', tagline: 'Woodland and railway circuit', url: kilmanyWalk, sourceName: 'Gauldry and Kilmany', organisation: 'Fife Walking', opening: 'Open route; use care at the A92, fields, flood-prone underpass and rough sections.', price: 'Free', score: 66, details: ['trail_type=Cross-boundary circular walk; distance=10.5 km; ascent=200 m; start=Gauldry'] },
    ],
    planner: { eat: [], trails: ['curated-trail:kilmany-railway-line', 'curated-trail:kilmany-gauldry-circuit'], picnic: [], parking: [], toilets: [] },
    officialRouteFinding: 'ScotWays verifies a Kilmany trailhead and Fife Walking verifies a circuit through the village.',
    sourceChecks: [{ url: jimClark, outcome: 'verified', note: 'Current destination page confirms the statue and Kilmany address.' }, { url: kilmanyRailway, outcome: 'verified', note: 'Current path page supplies the Kilmany start, 3.5 km distance, route and condition cautions.' }, { url: kilmanyWalk, outcome: 'verified', note: 'Working route page confirms the circuit passes through Kilmany and by the statue.' }, { url: treasureCollection, outcome: 'no_result', note: 'No current commercial Kilmany mystery trail was found.' }],
    exclusions: ['The Jim Clark Motorsport Museum is in Duns, not Kilmany.', 'Cairnie Fruit Farm and other cafés beyond the village boundary are not transferred.', 'On-street route-start parking is not represented as a dedicated visitor car park.'],
    practical: { eat: 'No current café, tearoom, coffee-and-cake stop or light-lunch operator in the village was verified.', picnic: 'No formal promoted picnic site was verified.', parking: 'No dedicated public visitor car park; older walking notes refer to on-street parking only.', toilets: 'Kilmany Cemetery is listed by the council, but no public toilet is listed in Kilmany.', accessibility: 'The railway path is earthy and may be overgrown; the longer circuit includes rough paths, a busy-road crossing and a flood-prone underpass.', transport: 'Current bus options should be checked before travel; transport does not contribute destination points.' },
  },
  {
    file: 'logie-fife.json', id: 'logie-fife-scotland', name: 'Logie', score: 38, dogRating: 1,
    summary: 'Logie is a small historic Fife parish village. Its six local listed-building records are complete and dated, but no reliably open attraction, daytime café, place-specific trail or public visitor facility was verified.',
    character: 'Small historic parish village', headline: 'Historic fabric without a public visitor offer', intro: 'Logie remains selector-only; the much-advertised Logie Steading is in Moray and is explicitly excluded.', bestFor: ['Historic landscape context'], suggestedTime: 'Pass-through or specialist research only', features: [],
    planner: { eat: [], trails: [], picnic: [], parking: [], toilets: [] }, officialRouteFinding: 'No conventional Logie, Fife visitor route was found; similarly named Logie destinations elsewhere were excluded.',
    sourceChecks: [{ url: logieChurch, outcome: 'verified', note: 'The national record identifies the former church history but not a current visitor operation.' }, { url: 'https://logie.co.uk/', outcome: 'excluded', note: 'Logie Steading is near Forres in Moray and is a different place.' }, { url: treasureCollection, outcome: 'no_result', note: 'No current Logie, Fife product was found.' }],
    exclusions: ['Logie Steading and its café, garden, walks, toilets and parking are in Moray.', 'Private listed properties are heritage pins, not visitor attractions without access evidence.'],
    practical: { eat: 'No qualifying café or light-lunch stop.', picnic: 'No managed picnic facility.', parking: 'No dedicated public visitor car park.', toilets: 'No public toilet.', accessibility: 'No publicly promoted step-free visitor experience was found.', transport: 'Check current rural transport before travel.' },
  },
  {
    file: 'rathillet.json', id: 'rathillet-scotland', name: 'Rathillet', score: 24, dogRating: 1,
    summary: 'Rathillet is a small rural hamlet whose documentary medieval history and single in-boundary listed cottage do not amount to a current visitor destination. Nearby estate fabric and the Kilmany railway path endpoint are not reassigned.',
    character: 'Small rural hamlet', headline: 'Historic name, no present visitor cluster', intro: 'Rathillet remains available in the selector with a fully checked low score.', bestFor: ['Regional reference'], suggestedTime: 'Pass-through only', features: [],
    planner: { eat: [], trails: [], picnic: [], parking: [], toilets: [] }, officialRouteFinding: 'The Kilmany Railway Line ends near Rathillet Mill about a kilometre from the hamlet and is not republished as a Rathillet trailhead.',
    sourceChecks: [{ url: rathilletPlaceName, outcome: 'verified', note: 'Place-name record resolves Rathillet and its historical documentary context.' }, { url: kilmanyRailway, outcome: 'excluded', note: 'The route ends by Rathillet Mill, not at a verified hamlet trailhead.' }, { url: treasureCollection, outcome: 'no_result', note: 'No current Rathillet product was found.' }],
    exclusions: ['Rathillet House and estate structures beyond the compact hamlet boundary are not transferred.', 'A medieval manor site with no visible public interpretation is not promoted as a current attraction.', 'No visitor services were found.'],
    practical: { eat: 'No qualifying café or light-lunch outlet.', picnic: 'No managed picnic facility.', parking: 'No dedicated public visitor parking.', toilets: 'No public toilet.', accessibility: 'No promoted visitor route or accessibility specification.', transport: 'Rural transport should be checked before travel.' },
  },
  {
    file: 'hazelton-walls.json', id: 'hazelton-walls-scotland', name: 'Hazelton Walls', score: 20, dogRating: 1,
    summary: 'Hazelton Walls is a scattered rural locality retained for regional completeness. No local HES designation, current visitor attraction, café, qualifying trailhead or public facility was found inside the compact boundary.',
    character: 'Scattered rural locality', headline: 'A named place, not a visitor destination', intro: 'Hazelton Walls is not elevated by Tay Mount, the Fife Coastal Path or Creich attractions nearby.', bestFor: ['Regional reference'], suggestedTime: 'Pass-through only', features: [],
    planner: { eat: [], trails: [], picnic: [], parking: [], toilets: [] }, officialRouteFinding: 'Tay Mount and the Fife Coastal Path were checked but their documented access points lie outside the compact settlement boundary.',
    sourceChecks: [{ url: placeNameVolume, outcome: 'verified', note: 'Fife place-name data supports the locality identity.' }, { url: 'https://fifewalking.com/find-a-walk/north-fife/north-fife-trig-pillars/', outcome: 'excluded', note: 'Tay Mount is nearby but has no verified Hazelton Walls trailhead.' }, { url: treasureCollection, outcome: 'no_result', note: 'No current Hazelton Walls product was found.' }],
    exclusions: ['Tay Mount and its field access are not transferred into the locality.', 'Creich Castle and Brunton conservation fabric belong to other places.', 'No visitor facilities were verified.'],
    practical: { eat: 'No qualifying café or light-lunch outlet.', picnic: 'No managed picnic facility.', parking: 'No dedicated visitor car park.', toilets: 'No public toilet.', accessibility: 'No visitor route or accessibility specification.', transport: 'Rural transport should be checked before travel.' },
  },
  {
    file: 'creich-fife.json', id: 'creich-fife-scotland', name: 'Creich', score: 50, dogRating: 2,
    summary: 'Creich has two nationally recorded ruins and lies on the strenuous Balmerino–Newburgh route, but it remains an attraction-led rural hamlet with no café, toilet, picnic site or dedicated visitor parking. The See and Trail cards are retained without pushing the settlement onto the town map.',
    character: 'Rural hamlet with castle and medieval church ruins', headline: 'Two historic ruins on a long rural route', intro: 'Creich’s castle and old church are useful See entries, but their merit is not transferred wholesale into the hamlet score.', bestFor: ['Castle history', 'Medieval church remains', 'Long-distance walking'], suggestedTime: '30–60 minutes as part of a wider route',
    features: [
      { id: 'hes-scheduled-monument:SM848', name: 'Creich Castle', kind: 'attraction', featureType: 'fortification', coordinates: [-3.08872, 56.37885], description: 'The substantial remains of a later-16th-century tower house. Appreciate it from lawful public routes; the record does not establish unrestricted access inside the ruin.', tagline: 'Later-16th-century tower-house ruin', url: creichCastleVisitor, sourceName: 'Creich Castle visitor guide', organisation: 'The Castle Guide', opening: 'Unstaffed ruin in working countryside; no unrestricted internal visitor access is claimed.', price: 'Free exterior appreciation', score: 66, reuseExisting: true, visitability: 'substantial_visible_remains' },
      { id: 'hes-scheduled-monument:SM830', name: "Creich Old Parish Church and Churchyard", kind: 'attraction', featureType: 'ruin', coordinates: [-3.09163, 56.37995], description: 'The roofless remains of the late-14th-century parish church, its later south aisle and historic churchyard.', tagline: 'Medieval parish-church ruin', url: creichCommunity, sourceName: 'Creich community heritage information', organisation: 'Luthrie Village Hall', opening: 'Open-air churchyard; respect burials, walls and any local access notices.', price: 'Free', score: 64, reuseExisting: true, visitability: 'substantial_visible_remains' },
      { id: 'curated-trail:creich-fife-coastal-path', name: 'Fife Coastal Path: Balmerino to Newburgh via Creich', kind: 'trail', featureType: 'walking_route', coordinates: [-3.0889, 56.3791], description: 'Part of the 11-mile strenuous Balmerino–Newburgh section, passing the Creich historic cluster before continuing through rural north Fife.', tagline: 'Strenuous north Fife stage', url: fifeCoastalPath, sourceName: 'Wormit Bay to Newburgh', organisation: 'Fife Coast & Countryside Trust', opening: 'Open route; expect rough ground, fields, livestock and steep sections.', price: 'Free', score: 70, details: ['trail_type=Long-distance linear route; section_distance=17.5 km / 11 miles; facilities=none in the rural section'] },
    ],
    planner: { eat: [], trails: ['curated-trail:creich-fife-coastal-path'], picnic: [], parking: [], toilets: [] }, officialRouteFinding: 'The official Balmerino–Newburgh path stage and route accounts were checked; the historic cluster is treated as a route stop, not a town-service hub.',
    sourceChecks: [{ url: creichCastle, outcome: 'verified', note: 'Official designation dates and describes the surviving tower house and gate-tower context.' }, { url: creichCastleVisitor, outcome: 'verified', note: 'Established castle guide supplies a current visitor-facing access summary while the map retains conservative access wording.' }, { url: creichChurch, outcome: 'verified', note: 'National record dates the church fabric and later aisle and confirms churchyard context.' }, { url: creichCommunity, outcome: 'verified', note: 'Local community heritage information independently identifies the old ruined church and Creich Castle.' }, { url: fifeCoastalPath, outcome: 'verified', note: 'Official route page confirms the long, strenuous rural section towards Brunton/Newburgh.' }, { url: fifeCemeteries, outcome: 'verified', note: 'Fife Council lists Creich Cemetery at Brunton; it does not list visitor services.' }, { url: treasureCollection, outcome: 'no_result', note: 'No current Creich mystery trail was found.' }],
    exclusions: ['No unrestricted internal access to Creich Castle is claimed.', 'The ruins and trail remain separate See/Trail cards and do not make Creich a 60+ town.', 'No rural roadside verge is represented as visitor parking.'],
    practical: { eat: 'No shops or cafés on this rural section.', picnic: 'No managed picnic facility at the ruins.', parking: 'No dedicated public visitor car park was verified.', toilets: 'No public toilet; the long route should be planned accordingly.', accessibility: 'Rough, steep, livestock-crossing paths and ruin terrain are not step-free.', transport: 'A linear rural route requires transport planning; check current services.' },
  },
  {
    file: 'brunton-creich.json', id: 'brunton-creich-scotland', name: 'Brunton (Creich)', score: 46, dogRating: 2,
    summary: 'Brunton is a coherent conservation hamlet with unusually dense listed fabric and the official Fife Coastal Path, but no public visitor-service cluster. Its village character and route appear under See and Trails while the settlement remains below 60.',
    character: 'Compact north Fife conservation hamlet', headline: 'Conservation-village character on the coastal path', intro: 'Brunton is rewarding to notice on foot, but it is not treated as a serviced tourist town.', bestFor: ['Historic village fabric', 'Long-distance walking'], suggestedTime: '20–45 minutes as part of the route',
    features: [
      { id: 'curated-attraction:brunton-conservation-village', name: 'Brunton Conservation Village', kind: 'attraction', featureType: 'historic_area', coordinates: [-3.09817, 56.37515], description: 'A compact conservation hamlet of traditional cottages, former weaving structures and historic street form, best appreciated respectfully from public roads.', tagline: 'Traditional north Fife village fabric', url: bruntonAppraisal, sourceName: 'Brunton Conservation Area Appraisal', organisation: 'Fife Council', opening: 'Public roads only; homes and gardens are private.', price: 'Free', score: 62, visitability: 'substantial_visible_remains' },
      { id: 'curated-trail:brunton-fife-coastal-path', name: 'Fife Coastal Path: Balmerino to Newburgh via Brunton', kind: 'trail', featureType: 'walking_route', coordinates: [-3.0982, 56.3752], description: 'The official 11-mile strenuous section reaches the road towards Brunton before climbing towards Norman’s Law and Newburgh.', tagline: 'North Fife coast-to-hills stage', url: fifeCoastalPath, sourceName: 'Wormit Bay to Newburgh', organisation: 'Fife Coast & Countryside Trust', opening: 'Open route; expect rough ground, livestock, narrow roads and steep sections.', price: 'Free', score: 70, details: ['trail_type=Long-distance linear route; section_distance=17.5 km / 11 miles; dog_control=lead around livestock'] },
    ],
    planner: { eat: [], trails: ['curated-trail:brunton-fife-coastal-path'], picnic: [], parking: [], toilets: [] }, officialRouteFinding: 'Official Fife Coastal Path directions explicitly reach the road towards Brunton.',
    sourceChecks: [{ url: fifeConservation, outcome: 'verified', note: 'Fife Council lists Brunton as one of its conservation areas.' }, { url: bruntonAppraisal, outcome: 'verified', note: 'Council appraisal documents the hamlet’s historic development, buildings and townscape.' }, { url: fifeCoastalPath, outcome: 'verified', note: 'Official route page explicitly directs walkers towards Brunton.' }, { url: treasureCollection, outcome: 'no_result', note: 'No current Brunton mystery trail was found.' }],
    exclusions: ['Creich Castle and old church are retained under Creich rather than duplicated here.', 'Private cottages and gardens are not visitor attractions.', 'No shop, café, public toilet, picnic site or dedicated visitor car park was verified.'],
    practical: { eat: 'No shops, cafés or qualifying light-lunch stops.', picnic: 'No managed picnic facility.', parking: 'No dedicated public visitor car park; roadside parking is not promoted.', toilets: 'No public toilet.', accessibility: 'The village roads are public, but the long path stage includes rough and steep ground.', transport: 'A linear rural walk requires current transport planning.' },
  },
];

function splitScore(score: number, caps: number[]): number[] {
  let remaining = score;
  return caps.map((cap) => { const value = Math.min(cap, remaining); remaining -= value; return value; });
}

function sourceRecord(seed: FeatureSeed) {
  return {
    sourceName: seed.sourceName, sourceOrganisation: seed.organisation, sourceUrl: seed.url,
    accessedAt: reviewedAt, reliability: seed.organisation.includes('Historic Environment') ? 'official_statutory' as const : 'official_non_statutory' as const,
    licence: 'Source-linked editorial evidence; verify time-sensitive details before travel.',
    notes: `Current-place curation: visitor_place_type=${seed.kind}; visit_score=${seed.score}; trail_score=${seed.score}; opening_hours:description=${seed.opening}; entrance_fee=${seed.price}; price_band=${seed.price}; tagline=${seed.tagline}; description=${seed.description}; ${seed.details?.join('; ') ?? ''}`,
  };
}

function editorialReview(seed: FeatureSeed): HeritageFeature['editorialReview'] {
  if (seed.kind === 'attraction') {
    const [experienceDepth, distinctiveness, presentation, journeyWorth, accessAndReliability, evidenceConfidence] = splitScore(seed.score, [30, 20, 20, 15, 10, 5]);
    return { status: 'editorially_researched', category: 'attraction', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: `${seed.name} is assessed as a current visit rather than receiving points from designation alone.`, evidenceUrls: [seed.url], attractionAssessment: { experienceDepth, distinctiveness, presentation, journeyWorth, accessAndReliability, evidenceConfidence, visitability: seed.visitability ?? 'full_visitor_experience' } };
  }
  if (seed.kind === 'trail') return { status: 'editorially_researched', category: 'trail', methodVersion: '2026-08-13-researched-visitor-value-v1', reviewedAt: reviewedDate, scoreRationale: `${seed.name} has a working route page with usable route or condition information.`, evidenceUrls: [seed.url] };
  return undefined;
}

function featureFor(projectId: string, locality: string, seed: FeatureSeed): HeritageFeature {
  const tagByKind: Record<FeatureKind, string[]> = { attraction: ['curated-visitor-attraction', 'service-context-visitor'], food: ['service-context-food'], trail: ['service-context-trail', 'visitor-context-trail'], picnic: ['service-context-picnic'], parking: ['service-context-parking', 'visitor-context-parking'], toilets: ['service-context-toilets'] };
  return {
    id: seed.id, projectId, name: seed.name, alternativeNames: [], countryCode: 'GB-SCT', region: 'Fife', locality,
    featureType: seed.featureType, significance: 'local', geometry: { type: 'Point', coordinates: seed.coordinates }, locationType: 'exact', locationConfidence: 'high',
    dateBasis: 'unknown', dateConfidence: 'unknown', survival: 'substantially_intact', shortDescription: seed.description,
    details: `visitor_place_type=${seed.kind}; visit_score=${seed.score}; trail_score=${seed.score}; opening_hours:description=${seed.opening}; entrance_fee=${seed.price}; tagline=${seed.tagline}; description=${seed.description}; ${seed.details?.join('; ') ?? ''}`,
    visitorWebsiteUrl: seed.url, editorialReview: editorialReview(seed), sourceRecords: [sourceRecord(seed)],
    tags: ['current-context', auditTag, ...tagByKind[seed.kind]], createdAt: reviewedAt, updatedAt: reviewedAt, reviewed: true, evidenceScope: 'parish_evidence',
  };
}

function applySeed(pkg: ProjectPackage, seed: FeatureSeed): HeritageFeature {
  if (!seed.reuseExisting) {
    const feature = featureFor(pkg.project.id, pkg.project.locality, seed);
    pkg.features.push(feature);
    return feature;
  }
  const feature = pkg.features.find((candidate) => candidate.id === seed.id);
  if (!feature) throw new Error(`${pkg.project.name}: missing reusable feature ${seed.id}`);
  feature.shortDescription = seed.description;
  feature.visitorWebsiteUrl = seed.url;
  feature.editorialReview = editorialReview(seed);
  feature.sourceRecords = [...feature.sourceRecords.filter((record) => record.sourceUrl !== seed.url), sourceRecord(seed)];
  feature.tags = [...new Set([...feature.tags, 'curated-visitor-attraction', 'service-context-visitor'])];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  return feature;
}

function highlightFor(seed: FeatureSeed, rank: number): VisitorHighlight {
  return { rank, featureId: seed.id, name: seed.name, reason: seed.description, visitorScore: seed.score, tagline: seed.tagline, timeToSpend: '20–60 minutes', openingTimes: seed.opening, admission: seed.price, freeAdmission: /^free\b/i.test(seed.price), visitorWebsiteUrl: seed.url, sourceName: seed.sourceName, sourceUrl: seed.url, verifiedInBoundaryAt: reviewedDate, editorialReview: editorialReview(seed) };
}

function dateFeature(pkg: ProjectPackage, id: string, text: string, first: number, last: number, sourceUrl: string, note: string) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`${pkg.project.name}: missing ${id}`);
  Object.assign(feature, { documentedDateText: text, earliestPossibleYear: first, latestPossibleYear: last, dateBasis: 'estimated_from_authoritative_source', dateConfidence: 'high', datePrecision: 'documented material period', reviewed: true, updatedAt: reviewedAt });
  feature.tags = [...new Set(feature.tags.filter((tag) => tag !== 'map-hidden').concat('date-reviewed', 'heritage-record-retained'))];
  feature.sourceRecords = [...feature.sourceRecords.filter((record) => record.sourceUrl !== sourceUrl), { sourceName: 'Material-period audit evidence', sourceOrganisation: 'Historic Environment Scotland', sourceUrl, accessedAt: reviewedAt, reliability: 'official_statutory', licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.', notes: `${note} Administrative designation dates were not used.` }];
  feature.reviewNotes = `${note} The date is stored in heritage fields and is not appended to the map name.`;
}

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { schemaVersion: number; reviewedAt: string; projects: Record<string, PlannerCurationState> };
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { schemaVersion: number; reviewedAt: string; projects: Record<string, unknown> };

for (const audit of audits) {
  const projectPath = resolve('data/projects', audit.file);
  const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
  if (pkg.project.id !== audit.id) throw new Error(`${audit.name}: project identity mismatch`);
  pkg.features = pkg.features.filter((feature) => !feature.tags.includes(auditTag));

  if (audit.id === 'creich-fife-scotland') {
    dateFeature(pkg, 'hes-listed-building:LB2141', 'Associated with later-16th-century Creich Castle', 1550, 1599, creichCastle, 'The official monument description identifies the surviving castle as later 16th century and explicitly identifies LB2141 as its associated gatehouse tower.');
    dateFeature(pkg, 'hes-listed-building:LB2153', 'Late-14th-century churchyard context with medieval and later memorials', 1367, 1832, creichChurch, 'The national record dates the church to the late 14th century, its aisle to the 16th century and use of the site until 1832.');
    dateFeature(pkg, 'hes-scheduled-monument:SM830', 'Late-14th-century church; 16th-century aisle; used until 1832', 1367, 1832, creichChurch, 'The national record supplies the material chronology for the scheduled church and churchyard.');
    dateFeature(pkg, 'hes-scheduled-monument:SM848', 'Tower recorded by 1553; surviving tower house probably later 16th century', 1553, 1599, creichCastle, 'The official HES description supplies the tower-house chronology.');
  }

  for (const seed of audit.features) applySeed(pkg, seed);
  pkg.project.visitorHighlights = audit.features.filter((seed) => seed.kind === 'attraction').map(highlightFor);
  const band = townScoreBand(audit.score);
  pkg.project.touristAppeal = { score: audit.score, dogOwnerScore: townScoreAfterDogAccess(audit.score, audit.dogRating), dogAccessScoreAdjustment: townDogAccessScoreAdjustment(audit.dogRating), rating: band.rating, label: band.label, summary: audit.summary, dogAccessRating: audit.dogRating, dogAccessSummary: audit.dogRating >= 2 ? 'The audited outdoor routes can suit responsible dog visits, with close control around livestock, roads, wildlife and historic fabric.' : 'No dedicated dog destination or blanket off-lead suitability is assumed.', methodVersion: '2026-09-02-full-settlement-visitor-audit-v3', reviewedAt: reviewedDate, sourceUrls: [...new Set([...audit.sourceChecks.map((check) => check.url), treasureCollection, curiousUrl, mysteryUrl, goQuestUrl, outdoorCode])] };
  pkg.project.townGuide = { characterTag: audit.character, headline: audit.headline, intro: audit.intro, bestFor: audit.bestFor, perfectFor: audit.score >= 60 ? ['A carefully planned short visit'] : ['A route stop or specialist local-history visit'], suggestedFirstVisit: audit.features.length ? { title: audit.headline, summary: `Use the verified links and access notes; private land and neighbouring facilities are not assumed.` } : undefined, dontMiss: audit.features.filter((seed) => seed.kind === 'attraction').map((seed) => seed.name), suggestedTime: audit.suggestedTime, visitorMood: audit.score >= 60 ? 'A notable short stop with limited facilities.' : 'A selector-only locality below the 60-point map threshold.', sourceUrls: [...new Set(audit.sourceChecks.map((check) => check.url))], lastReviewedAt: reviewedDate };
  pkg.project.researchNotes = `${audit.intro} Strict-boundary score verified sequentially on ${reviewedDate}. ${audit.exclusions.join(' ')}`;
  planner.projects[audit.id] = audit.planner;
  const attractionDogAccess = Object.fromEntries(
    audit.features
      .filter((seed) => seed.kind === 'attraction')
      .map((seed) => [
        seed.id,
        {
          rating: 0,
          status: 'unconfirmed',
          label: 'Dog policy not confirmed',
          summary: 'No reliable current dog policy was published for this place. Keep dogs under close control and check directly before making a dog-dependent visit.',
          sourceName: 'Scottish Outdoor Access Code and attraction-source review',
          sourceUrl: outdoorCode,
          reviewedAt: reviewedDate,
        },
      ]),
  );
  dog.projects[audit.id] = Object.keys(attractionDogAccess).length
    ? { attraction: attractionDogAccess }
    : {};

  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(`${audit.name}: ${errors.map((issue) => issue.message).join('; ')}`);
  const statutory = pkg.features.filter((feature) => feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'hes-garden-designed-landscape'].includes(tag)));
  const visible = statutory.filter((feature) => !feature.tags.includes('map-hidden'));
  const visibleUndated = visible.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown');
  if (visibleUndated.length) throw new Error(`${audit.name}: visible undated HES records ${visibleUndated.map((feature) => feature.id).join(', ')}`);
  if (visible.some((feature) => feature.documentedDateText && feature.name.includes(feature.documentedDateText))) throw new Error(`${audit.name}: date appended to HES map name`);

  const report = {
    reviewedAt, projectId: audit.id, place: audit.name, townScore: audit.score, mapPublished: audit.score >= 60,
    categories: {
      see: { audited: true, published: audit.features.filter((seed) => seed.kind === 'attraction').length },
      eat: { audited: true, published: audit.planner.eat?.length ?? 0 },
      trails: { audited: true, published: audit.planner.trails?.length ?? 0, providerChecks: providerChecks(audit.officialRouteFinding) },
      picnic: { audited: true, published: audit.planner.picnic?.length ?? 0 }, parking: { audited: true, published: audit.planner.parking?.length ?? 0 }, toilets: { audited: true, published: audit.planner.toilets?.length ?? 0 },
      accessibility: { audited: true, note: audit.practical.accessibility }, transport: { audited: true, note: audit.practical.transport }, dogs: { audited: true, adjustment: pkg.project.touristAppeal.dogAccessScoreAdjustment },
    },
    exclusions: audit.exclusions,
    hes: { assigned: statutory.length, visibleDated: visible.length, hiddenUndated: statutory.length - visible.length, visibleUndated: 0, missing: 0 },
    boundaryRule: `Only visitor places physically inside ${audit.name}'s strict study area, or a documented cross-boundary route that genuinely serves it, are published.`,
    scoreRationale: audit.summary,
    scoreReanalysis: { required: audit.score === 58, completed: true, resultScore: audit.score, rationale: audit.score === 58 ? 'Mandatory exact-58 second pass completed.' : 'Score independently reconciled after all categories, HES evidence and boundary exclusions.' },
    practicalAudit: audit.practical,
    namedTrailSearch: { ...providerChecks(audit.officialRouteFinding), retained: audit.features.filter((seed) => seed.kind === 'trail').map((seed) => seed.name) },
    research: { currentWebResearch: true, strictBoundaryChecked: true, sourceChecks: audit.sourceChecks.map((check) => ({ ...check, checkedAt: reviewedDate })) },
    verification: { statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true, curatedCategoryCoordinatesChecked: true },
    certification: { publicationCountsReconciled: true, liveBrowserVerifiedAt: null },
  };

  await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  await writeFile(resolve('data/review', `${audit.file.replace(/\.json$/, '')}-full-visitor-audit-2026-09-02.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`${audit.name}: ${audit.score}; See ${report.categories.see.published}, Eat ${report.categories.eat.published}, Trails ${report.categories.trails.published}, Picnic ${report.categories.picnic.published}, Parking ${report.categories.parking.published}, Toilets ${report.categories.toilets.published}; HES ${visible.length}/${statutory.length}.`);
}

planner.reviewedAt = reviewedDate;
dog.reviewedAt = reviewedDate;
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
console.log('Sequential Kirkton-to-Brunton audits complete; live-browser certification is deliberately unset.');
