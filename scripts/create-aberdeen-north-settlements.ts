import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buffer, point } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import type { HeritageFeature, ProjectPackage, TouristAppealRating, VisitorHighlight } from '../src/domain/models';
import { defaultMethodology } from '../src/domain/scoring';
import {
  townDogAccessScoreAdjustment,
  townScoreAfterDogAccess,
  townScoreBand,
} from '../src/domain/tourism';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-27';
const createdAt = `${reviewedAt}T15:30:00.000Z`;
const osmCopyright = 'https://www.openstreetmap.org/copyright';
const aberdeenshireSettlements =
  'https://www.aberdeenshire.gov.uk/media/22988/aberdeenshire-settlements-2016.pdf';
const councilSpeedLimits = 'https://publications.aberdeenshire.gov.uk/speed-limits';
const bridgeTrail =
  'https://sites.aberdeencity.gov.uk/sites/default/files/2020-09/Bridge%20of%20Don%20Trail.pdf';
const formartineWay =
  'https://www.aberdeenshire.gov.uk/outdoor-access-and-countryside/paths/long-distance-routes/formartine-and-buchan-way';
const kintoreWalkingRoutes =
  'https://publications.aberdeenshire.gov.uk/acblobstorage/27660f59-0c7d-4ec6-9dcd-ecdb4791453a/kintore_walking_routes.pdf';
const kintorePictishTrail =
  'https://publications.aberdeenshire.gov.uk/acblobstorage/cd65f650-20f1-43ab-8dae-efbf5465c121/2022pictishstonetrail.pdf';
const kemnayRoutes =
  'https://www.aberdeenshire.gov.uk/media/26345/kemnay_web_leaflet.pdf';
const councilWalkingRoutes =
  'https://www.aberdeenshire.gov.uk/roads-and-travel/transportation/cycling/commuter-routes/';
const inverurieWalkingRoutes =
  'https://www.aberdeenshire.gov.uk/media/15820/inverurie-walking.pdf';
const portElphinstoneCanalHer = 'https://her.aberdeenshire.gov.uk/Monument/MAB18882';
const kintoreDistrict = 'https://kintore.org.uk/about-kintore';
const aquhythieGazetteer = 'https://gazetteer.org.uk/place/Aquhythie,_Aberdeenshire_1047';
const burnhervieGazetteer = 'https://gazetteer.org.uk/place/Burnhervie,_Aberdeenshire_288832';
const dalmadillyRecord = 'https://saintsplaces.gla.ac.uk/place.php?id=1348738907';
const dalmadillyPonds = 'https://kemnay.info/community/places-of-interest/1862-2/';
const cottownRecord = 'https://www.trove.scot/place/117597';
const newmacharHer =
  'https://online.aberdeenshire.gov.uk/smrpub/master/detail.aspx?refno=NJ81NE0058';
const balbithanDesignation = 'https://portal.historicenvironment.scot/designation/LB9140';
const eastAuchronieRecord =
  'https://scotlandsplaces.gov.uk/digital-volumes/ordnance-survey-name-books/aberdeenshire-os-name-books-1865-1871/aberdeenshire-volume-49?display=transcription';
const balmediePark =
  'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/country-parks/balmedie-country-park';
const parkhillTrove = 'https://www.trove.scot/place/76857';
const causeyendRecord =
  'https://www.scotlandspeople.gov.uk/virtual-volumes/volume-images/volume_data-OS1-1-8/REX01667?image_number=92';
const outdoorCode = 'https://www.outdooraccess-scotland.scot/dog-owners';
const gariochSettlementStatements =
  'https://online.aberdeenshire.gov.uk/ldpmedia/LDP2021/Appendix7dSettlementStatementsGarioch.pdf';
const oldKinnernieChurchyard =
  'https://portal.historicenvironment.scot/designation/LB16272';
const historicKirkyards =
  'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/archaeology/projects/historic-kirkyards/an-introduction-to-aberdeenshires-historic-kirkyards';
const monymuskEstate = 'https://www.monymusk.com/';
const monymuskCorePaths = 'https://www.aberdeenshire.gov.uk/media/15238/monymusk-cpp.pdf';
const monymuskChurchHer = 'https://her.aberdeenshire.gov.uk/Monument/MAB15221/';
const dunechtHouseHer = 'https://her.aberdeenshire.gov.uk/Monument/MAB17727';
const garlogieEngine = 'https://garlogie-engine.org.uk/';
const aberdeenshireBusMap =
  'https://online.aberdeenshire.gov.uk/ldpmedia/pldp2020/responses/PP0766.pdf';
const benthoulGazetteer = 'https://gazetteer.org.uk/place/Benthoul,_Aberdeenshire_3302';
const cullerlieRecord = 'https://portal.historicenvironment.scot/designation/SM90088';
const peterculterPaths =
  'https://www.cultercc.org.uk/wp-content/uploads/2021/02/202101-Revised-map-of-Culter-paths.pdf';
const deesideWay = 'https://visitabdn.com/businesses/the-deeside-way';
const peterculterBridge =
  'https://www.aberdeencity.gov.uk/News/Press-Archive/Article?title=Rob+Roy+Bridge+and+Kennerty+Road+closures';
const easterOrdRecord = 'https://www.trove.scot/place/197858';
const miltonMurtleHer = 'https://her.aberdeenshire.gov.uk/Monument/MAB21078';
const blacktopGazetteer = 'https://gazetteer.org.uk/place/Blacktop,_Aberdeenshire_4111';
const cairnieOpenNames = 'https://www.getthedata.com/cairnie-ab32/where-is-cairnie-ab32';
const aberdeenHeritageTrails =
  'https://sites.aberdeencity.gov.uk/AAGM/local-history/heritage-trails';
const oldAberdeenVisit = 'https://visitabdn.com/places/old-aberdeen';
const aberdeenCityVisit = 'https://visitabdn.com/regions/city';
const aberdeenHistoryTrail =
  'https://www.aberdeencity.gov.uk/sites/default/files/2022-10/Aberdeen%20History%20Trail_1.pdf';
const kincorthHillRoutes =
  'https://www.aberdeencity.gov.uk/sites/default/files/2019-04/Kincorth%20Hill%20Walking%20Routes.pdf';
const aberdeenCoast = 'https://visitabdn.com/businesses/category/beaches';
const durrisCommunity = 'https://www.crathesdrumoakdurriscc.org/the-durris-community.html';
const woodsideArbeadieRecord =
  'https://www.scotlandspeople.gov.uk/virtual-volumes/volume-images/volume_data-OS1-19-3/REX01681?image_number=110';
const banchoryTreasureTrail =
  'https://www.treasuretrails.co.uk/products/things-to-do-banchory-aberdeenshire';
const banchoryWalkingMap =
  'https://www.aberdeenshire.gov.uk/media/11471/banchory-webmap-sept14.pdf';
const royalDeeside = 'https://visitabdn.com/places/royal-deeside';
const drumCastle = 'https://www.nts.org.uk/visit/places/drum-castle';
const crathesCastle = 'https://www.nts.org.uk/visit/places/crathes-castle/planning-your-visit';

interface SettlementSeed {
  id: string;
  requestedName: string;
  name: string;
  region: 'Aberdeenshire' | 'Aberdeen City';
  centre: [number, number];
  radius: number;
  score: number;
  dogRating: TouristAppealRating;
  character: string;
  summary: string;
  rationale: string;
  sources: string[];
  trail?: {
    id: string;
    name: string;
    score: number;
    coordinates: [number, number];
    description: string;
    opening: string;
    admission: string;
    url: string;
  };
  standalone?: {
    id: string;
    name: string;
    score: number;
    coordinates: [number, number];
    featureType: HeritageFeature['featureType'];
    description: string;
    tagline: string;
    time: string;
    opening: string;
    admission: string;
    url: string;
    dogRating: TouristAppealRating;
    showInTownGuide?: boolean;
  };
}

const seeds: SettlementSeed[] = [
  {
    id: 'kinmuck-scotland', requestedName: 'Kinmuck', name: 'Kinmuck', region: 'Aberdeenshire',
    centre: [-2.3036326, 57.2689107], radius: 360, score: 31, dogRating: 1,
    character: 'Compact rural village',
    summary: 'A small Garioch village with local identity but little destination-scale visitor depth.',
    rationale: 'Kinmuck is retained as a genuine village; nearby Kintore and Inverurie attractions are not transferred into its score.',
    sources: [aberdeenshireSettlements, osmCopyright],
  },
  {
    id: 'middleton-potterton-scotland', requestedName: 'Middleton', name: 'Middleton', region: 'Aberdeenshire',
    centre: [-2.114864, 57.234203], radius: 260, score: 15, dogRating: 1,
    character: 'Small roadside hamlet',
    summary: 'A mapped hamlet near Potterton without an independent public visitor offer.',
    rationale: 'The place is geographically useful but does not provide a coherent tourist stop of its own.',
    sources: [osmCopyright],
  },
  {
    id: 'balbithan-house-scotland', requestedName: 'Balbithan Ho', name: 'Balbithan House', region: 'Aberdeenshire',
    centre: [-2.3116807, 57.2596845], radius: 260, score: 18, dogRating: 1,
    character: 'Private historic estate',
    summary: 'A Category A-listed tower house and private estate, not a public visitor settlement.',
    rationale: 'Architectural importance is recorded without treating private property or its grounds as a town attraction.',
    sources: [balbithanDesignation, osmCopyright],
  },
  {
    id: 'newmachar-scotland', requestedName: 'Newmachar', name: 'Newmachar', region: 'Aberdeenshire',
    centre: [-2.1912473, 57.2666569], radius: 560, score: 56, dogRating: 2,
    character: 'Historic village on a long-distance path',
    summary: 'A well-established village with historic identity and direct access to the Formartine and Buchan Way, but limited destination depth.',
    rationale: 'The through-route and village services support a worthwhile local stop, but not a 60+ tourist-town recommendation.',
    sources: [newmacharHer, formartineWay, osmCopyright],
    trail: {
      id: 'newmachar-formartine-buchan-way', name: 'Formartine and Buchan Way at Newmachar', score: 69,
      coordinates: [-2.1912473, 57.2666569],
      description: 'The council-published long-distance path reaches Newmachar on manageable sections from Dyce and towards Udny Station.',
      opening: 'Open path; check the council page for current surface and access notices', admission: 'Free', url: formartineWay,
    },
  },
  {
    id: 'kinmundy-scotland', requestedName: 'Kinmundy', name: 'Kinmundy', region: 'Aberdeenshire',
    centre: [-2.1811439, 57.2516343], radius: 260, score: 19, dogRating: 1,
    character: 'Agricultural hamlet',
    summary: 'A dispersed rural hamlet south of Newmachar without a verified visitor experience.',
    rationale: 'Its score reflects the hamlet itself rather than nearby paths, golf or Newmachar services.',
    sources: [osmCopyright],
  },
  {
    id: 'cothal-scotland', requestedName: 'Cothall', name: 'Cothal', region: 'Aberdeenshire',
    centre: [-2.2087512, 57.2316322], radius: 260, score: 18, dogRating: 1,
    character: 'Riverside rural hamlet',
    summary: 'A small mapped hamlet near the Don with no independent destination-scale offer.',
    rationale: 'The requested spelling is normalised to Cothal; surrounding river scenery is not enough to make the settlement a tourist stop.',
    sources: [osmCopyright],
  },
  {
    id: 'hatton-of-fintray-scotland', requestedName: 'Hatton of Fintray', name: 'Hatton of Fintray', region: 'Aberdeenshire',
    centre: [-2.2648559, 57.2377179], radius: 360, score: 39, dogRating: 1,
    character: 'Former textile village by the Don',
    summary: 'A recognisable historic village with church and riverside setting, but a modest public visitor offer.',
    rationale: 'Historic character is credited while inaccessible cropmarks and neighbouring places are excluded.',
    sources: [aberdeenshireSettlements, councilSpeedLimits, osmCopyright],
  },
  {
    id: 'wester-fintrae-scotland', requestedName: 'Wester Fintray', name: 'Wester Fintrae', region: 'Aberdeenshire',
    centre: [-2.31408, 57.2381], radius: 260, score: 14, dogRating: 1,
    character: 'Estate and farm locality',
    summary: 'A historic rural locality rather than a village or public visitor destination.',
    rationale: 'The established mapped form is Wester Fintrae; private farms and archaeological cropmarks do not create a visitable town offer.',
    sources: ['https://catalogue.nrscotland.gov.uk/nrsonlinecatalogue/place.aspx?code=PL488&df=&di=y&dt=&k=edington&ko=a&r=&ro=s&st=1&tc=y&tl=n&tn=n&tp=n', osmCopyright],
  },
  {
    id: 'kintore-scotland', requestedName: 'Kintore', name: 'Kintore', region: 'Aberdeenshire',
    centre: [-2.3455269, 57.2369921], radius: 720, score: 68, dogRating: 2,
    character: 'Royal burgh with Pictish and riverside heritage',
    summary: 'A compact former royal burgh with a Pictish stone, historic centre and council-published walking routes.',
    rationale: 'Kintore clears 60 through a coherent in-town heritage and walking offer, without borrowing Hallforest Castle or wider Garioch attractions.',
    sources: [kintoreWalkingRoutes, kintorePictishTrail, aberdeenshireSettlements, osmCopyright],
    trail: {
      id: 'kintore-walking-routes', name: 'Kintore Walking and Cycling Routes', score: 72,
      coordinates: [-2.3455269, 57.2369921],
      description: 'Council-published circuits from the Town House connect the parish church, older streets and local green routes.',
      opening: 'Public streets and paths; check current notices and woodland closures', admission: 'Free', url: kintoreWalkingRoutes,
    },
  },
  {
    id: 'blackburn-aberdeenshire-scotland', requestedName: 'Blackburn', name: 'Blackburn', region: 'Aberdeenshire',
    centre: [-2.2899714, 57.208445], radius: 480, score: 37, dogRating: 1,
    character: 'Established commuter village',
    summary: 'A coherent village with local services and community identity but limited visitor interest.',
    rationale: 'Nearby woods, airport-related facilities and attractions outside the village are not used to inflate its score.',
    sources: [aberdeenshireSettlements, councilSpeedLimits, osmCopyright],
  },
  {
    id: 'overton-aberdeen-scotland', requestedName: 'Overton', name: 'Overton', region: 'Aberdeen City',
    centre: [-2.216345, 57.217426], radius: 300, score: 20, dogRating: 1,
    character: 'Airport-edge hamlet',
    summary: 'A small historic locality now dominated by airport-edge and industrial land uses.',
    rationale: 'Airport, hotels and business parks are practical context for Dyce, not an independent tourist experience for Overton.',
    sources: ['https://gazetteer.org.uk/place/Overton,_Aberdeenshire_34303', osmCopyright],
  },
  {
    id: 'dyce-scotland', requestedName: 'Dyce', name: 'Dyce', region: 'Aberdeen City',
    centre: [-2.1895292, 57.2053823], radius: 700, score: 54, dogRating: 2,
    character: 'Historic village turned transport and employment hub',
    summary: 'A practical rail and airport district with riverside access and the start of the Formartine and Buchan Way, but limited destination character.',
    rationale: 'Transport convenience and the route start are credited without treating the airport, hotels or business parks as tourist attractions.',
    sources: [formartineWay, bridgeTrail, osmCopyright],
    trail: {
      id: 'dyce-formartine-buchan-way', name: 'Formartine and Buchan Way from Dyce', score: 70,
      coordinates: [-2.1926918, 57.2057069],
      description: 'The official long-distance route begins beside Dyce station and follows the former railway towards Newmachar.',
      opening: 'Open path; check the council page for current surface and access notices', admission: 'Free', url: formartineWay,
    },
  },
  {
    id: 'haughs-of-clinterty-scotland', requestedName: 'Haughs of Clinterty', name: 'Haughs of Clinterty', region: 'Aberdeen City',
    centre: [-2.277677, 57.1893232], radius: 260, score: 17, dogRating: 1,
    character: 'Scattered outer-city hamlet',
    summary: 'A small rural locality on Aberdeen’s western edge without an independent public visitor offer.',
    rationale: 'Nearby Brimmond Hill and Tyrebagger belong to separate visitor places and are not transferred to the hamlet.',
    sources: [osmCopyright],
  },
  {
    id: 'east-auchronie-scotland', requestedName: 'East Achronie', name: 'East Auchronie', region: 'Aberdeenshire',
    centre: [-2.3019207, 57.1838935], radius: 240, score: 12, dogRating: 1,
    character: 'Historic farm locality',
    summary: 'A recorded farmstead locality, not a public visitor settlement.',
    rationale: 'The supplied spelling is normalised to East Auchronie from the historic OS name record; private land and nearby hills do not form a town visit.',
    sources: [eastAuchronieRecord, osmCopyright],
  },
  {
    id: 'causeyend-scotland', requestedName: 'Causeyend', name: 'Causeyend', region: 'Aberdeenshire',
    centre: [-2.090276, 57.26384], radius: 300, score: 16, dogRating: 1,
    character: 'Scattered rural locality',
    summary: 'A historic rural place-name and small residential-agricultural grouping rather than a visitor settlement.',
    rationale: 'The settlement itself has no verified public visitor offer; its historic name does not create a destination experience.',
    sources: [causeyendRecord, osmCopyright],
  },
  {
    id: 'whitecairns-scotland', requestedName: 'Whitecairns', name: 'Whitecairns', region: 'Aberdeenshire',
    centre: [-2.1302011, 57.2547581], radius: 380, score: 25, dogRating: 1,
    character: 'Roadside hamlet',
    summary: 'A small rural hamlet with local identity but little public visitor depth of its own.',
    rationale: 'Residential character and a mapped locality are useful for route reference, not a tourist-town recommendation.',
    sources: [councilSpeedLimits, osmCopyright],
  },
  {
    id: 'belhelvie-scotland', requestedName: 'Belhelvie', name: 'Belhelvie', region: 'Aberdeenshire',
    centre: [-2.0894982, 57.2485107], radius: 430, score: 34, dogRating: 1,
    character: 'Historic parish village',
    summary: 'A small parish village with churchyard character, but without a sufficiently broad public visitor experience.',
    rationale: 'Belhelvie has recognisable historic identity; nearby coastal attractions and facilities belong to other places and are not borrowed into its score.',
    sources: [councilSpeedLimits, osmCopyright],
  },
  {
    id: 'balmedie-scotland', requestedName: 'Balmedie', name: 'Balmedie', region: 'Aberdeenshire',
    centre: [-2.0571418, 57.246473], radius: 520, score: 48, dogRating: 2,
    character: 'Coastal commuter village',
    summary: 'A useful, well-served village beside an excellent country park, but the village fabric is not itself a 60+ destination.',
    rationale: 'Balmedie Beach and Country Park is a major separate See attraction; its visitor value is not transferred wholesale to the modern residential village.',
    sources: [aberdeenshireSettlements, balmediePark, councilSpeedLimits, osmCopyright],
    standalone: {
      id: 'balmedie-beach-country-park',
      name: 'Balmedie Beach and Country Park',
      score: 84,
      coordinates: [-2.0438159, 57.2479913],
      featureType: 'park',
      description: 'A major dune-backed beach with boardwalks, five waymarked routes, play space, picnic tables, free parking, accessible toilets and beach wheelchairs.',
      tagline: 'Long beach, dunes and accessible trails',
      time: '1–3 hours',
      opening: 'Country park and play park open dawn to dusk all year',
      admission: 'Free; free parking at the main entrance',
      url: balmediePark,
      dogRating: 3,
    },
  },
  {
    id: 'drumligair-scotland', requestedName: 'Drumligair', name: 'Drumligair', region: 'Aberdeenshire',
    centre: [-2.1630766, 57.2393979], radius: 280, score: 14, dogRating: 1,
    character: 'Agricultural hamlet',
    summary: 'A dispersed agricultural hamlet without a coherent public visitor offer.',
    rationale: 'The locality is retained for geographic completeness and scores only its publicly visitable settlement experience.',
    sources: [osmCopyright],
  },
  {
    id: 'blackdog-scotland', requestedName: 'Blackdog', name: 'Blackdog', region: 'Aberdeenshire',
    centre: [-2.068487, 57.2180827], radius: 430, score: 28, dogRating: 2,
    character: 'Coastal-edge village',
    summary: 'A small village and employment-area locality whose beach and links are separate outdoor places rather than town-centre attractions.',
    rationale: 'Blackdog has coastal access nearby, but little coherent settlement interest for a tourist stop.',
    sources: [councilSpeedLimits, 'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/aberdeenshire-tourist-and-visitor-information/beaches', osmCopyright],
    standalone: {
      id: 'blackdog-beach-links',
      name: 'Blackdog Beach and Links',
      score: 64,
      coordinates: [-2.0594393, 57.2264013],
      featureType: 'other',
      description: 'An undeveloped sandy beach and dune-edge landscape reached by track, best treated as a quiet outdoor place rather than a village attraction.',
      tagline: 'Quiet beach and dune-edge landscape',
      time: '45–90 minutes',
      opening: 'Open outdoor access; visit in daylight and follow current access and safety signs',
      admission: 'Free; no staffed visitor facilities claimed',
      url: 'https://www.aberdeenshire.gov.uk/leisure-sport-and-culture/aberdeenshire-tourist-and-visitor-information/beaches',
      dogRating: 2,
    },
  },
  {
    id: 'potterton-scotland', requestedName: 'Potterton', name: 'Potterton', region: 'Aberdeenshire',
    centre: [-2.101596, 57.2303589], radius: 480, score: 32, dogRating: 1,
    character: 'Established commuter village',
    summary: 'A coherent residential village with community identity, but little visitor interest beyond local-purpose stops.',
    rationale: 'The village is correctly retained as a settlement; Balmedie and Blackdog attractions are not used to lift its score.',
    sources: [aberdeenshireSettlements, councilSpeedLimits, osmCopyright],
  },
  {
    id: 'parkhill-house-scotland', requestedName: 'Parkihill House', name: 'Parkhill House', region: 'Aberdeenshire',
    centre: [-2.1712965, 57.2166526], radius: 280, score: 12, dogRating: 1,
    character: 'Estate place-name',
    summary: 'An estate and house place-name rather than a public visitor settlement.',
    rationale: 'The historic mansion was demolished around 1960 and the present locality has no verified general visitor experience.',
    sources: [parkhillTrove, osmCopyright],
  },
  {
    id: 'mundurno-scotland', requestedName: 'Mundurno', name: 'Mundurno', region: 'Aberdeen City',
    centre: [-2.0934363, 57.2079135], radius: 320, score: 18, dogRating: 1,
    character: 'Outer-city hamlet',
    summary: 'A small peripheral hamlet absorbed into Bridge of Don’s wider urban context.',
    rationale: 'It has no independent destination-scale visitor offer and is not allowed to duplicate Bridge of Don.',
    sources: [osmCopyright],
  },
  {
    id: 'denmore-scotland', requestedName: 'Denmore', name: 'Denmore', region: 'Aberdeen City',
    centre: [-2.1004137, 57.1966709], radius: 360, score: 20, dogRating: 1,
    character: 'Business and residential quarter',
    summary: 'A Bridge of Don quarter dominated by residential and commercial use rather than visitor character.',
    rationale: 'Denmore remains selectable as a named locality but is not treated as a separate tourist town.',
    sources: [osmCopyright],
  },
  {
    id: 'stoneywood-scotland', requestedName: 'Stoney Wood', name: 'Stoneywood', region: 'Aberdeen City',
    centre: [-2.1792594, 57.1906116], radius: 440, score: 34, dogRating: 2,
    character: 'Historic industrial suburb',
    summary: 'A suburb with industrial and estate history, but no sufficiently complete public visitor experience of its own.',
    rationale: 'Historic mills and estate associations are evidence, not automatically visitable attractions.',
    sources: [osmCopyright],
  },
  {
    id: 'bankhead-aberdeen-scotland', requestedName: 'Bankhead', name: 'Bankhead', region: 'Aberdeen City',
    centre: [-2.1797236, 57.1820053], radius: 400, score: 22, dogRating: 1,
    character: 'Residential city quarter',
    summary: 'A residential and employment quarter without an independent tourist-town offer.',
    rationale: 'It is retained as a named place while remaining separate from Bucksburn, Dyce and Stoneywood.',
    sources: [osmCopyright],
  },
  {
    id: 'bridge-of-don-aberdeen-scotland', requestedName: 'Bridge of Don', name: 'Bridge of Don', region: 'Aberdeen City',
    centre: [-2.1053713, 57.1881806], radius: 520, score: 62, dogRating: 2,
    character: 'Green suburban district with an old crossing story',
    summary: 'Aberdeen’s largest suburb supports a notable stop through its council-published community heritage trail, green lanes and historic crossing story.',
    rationale: 'The score comes from a coherent self-guided district experience rather than borrowing unrelated Aberdeen attractions.',
    sources: [bridgeTrail, osmCopyright],
    trail: {
      id: 'bridge-of-don-community-heritage-trail',
      name: 'Bridge of Don Community Heritage Trail',
      score: 72,
      coordinates: [-2.1053713, 57.1881806],
      description: 'A council-produced self-guided trail linking the district’s landscapes, former estates, green lanes, history and buildings.',
      opening: 'Public streets and paths are generally open at all times; follow current access signs and daylight conditions',
      admission: 'Free',
      url: bridgeTrail,
    },
  },
  {
    id: 'port-elphinstone-scotland', requestedName: 'Port Elphinstone', name: 'Port Elphinstone', region: 'Aberdeenshire',
    centre: [-2.3706558, 57.2716681], radius: 520, score: 58, dogRating: 2,
    character: 'Canal-end suburb beside the Don',
    summary: 'A distinct Inverurie suburb with surviving canal history and a pleasant local walking loop, but limited visitor depth beyond that story.',
    rationale: 'The canal terminus, riverside setting and council-published route are credited; Inverurie town-centre attractions are not transferred into Port Elphinstone’s score.',
    sources: [inverurieWalkingRoutes, portElphinstoneCanalHer, osmCopyright],
    trail: {
      id: 'port-elphinstone-walking-loop', name: 'Port Elphinstone Walking Loop', score: 66,
      coordinates: [-2.3706558, 57.2716681],
      description: 'The council’s Inverurie walking map includes a 2.8 km Port Elphinstone route and explains the surviving Aberdeenshire Canal story.',
      opening: 'Public streets and paths; check local notices and river conditions', admission: 'Free', url: inverurieWalkingRoutes,
    },
  },
  {
    id: 'aquhythie-scotland', requestedName: 'Aquhythie', name: 'Aquhythie', region: 'Aberdeenshire',
    centre: [-2.426951, 57.255068], radius: 280, score: 22, dogRating: 1,
    character: 'Small rural hamlet',
    summary: 'A mapped Kemnay-parish hamlet with no verified independent visitor experience.',
    rationale: 'Nearby stone circles, Fetternear and Kemnay attractions sit outside this small settlement and are not borrowed into its score.',
    sources: [aquhythieGazetteer, osmCopyright],
  },
  {
    id: 'burnhervie-scotland', requestedName: 'Burnhervie', name: 'Burnhervie', region: 'Aberdeenshire',
    centre: [-2.4457431, 57.264813], radius: 280, score: 24, dogRating: 1,
    character: 'Scattered country hamlet',
    summary: 'A recognised hamlet north-west of Kemnay without a coherent public visitor offer.',
    rationale: 'Rural setting is acknowledged, while Easter Aquhorthies and wider Inverurie attractions remain separate destinations.',
    sources: [burnhervieGazetteer, osmCopyright],
  },
  {
    id: 'grantlodge-scotland', requestedName: 'Grantlodge', name: 'Grantlodge', region: 'Aberdeenshire',
    centre: [-2.49145, 57.24463], radius: 240, score: 14, dogRating: 1,
    character: 'Private house and rural locality',
    summary: 'A named country property and locality rather than a public visitor settlement.',
    rationale: 'The dated 1827 house is recorded as heritage context, but private property is not treated as a visitable town attraction.',
    sources: ['https://www.geograph.org.uk/photo/5501859', osmCopyright],
  },
  {
    id: 'dalmadilly-scotland', requestedName: 'Dalmadily', name: 'Dalmadilly', region: 'Aberdeenshire',
    centre: [-2.4358588, 57.2458392], radius: 360, score: 43, dogRating: 2,
    character: 'Rural locality with restored wildlife ponds',
    summary: 'A small Kemnay-edge locality whose restored quarry ponds support a local walk and birdwatching stop, but not a complete town visit.',
    rationale: 'Dalmadilly Ponds are published separately as an outdoor See place; the single attraction does not make the locality a 60+ town.',
    sources: [dalmadillyRecord, kemnayRoutes, dalmadillyPonds, osmCopyright],
    standalone: {
      id: 'dalmadilly-ponds', name: 'Dalmadilly Ponds', score: 67,
      coordinates: [-2.434323, 57.248163], featureType: 'park',
      description: 'Restored former quarry ponds with paths, bird habitat and birdwatching interest, also identified on the council’s Kemnay walking map.',
      tagline: 'Wildlife ponds and quiet local paths', time: '45–75 minutes',
      opening: 'Outdoor paths are generally accessible; bird-hide access is separately controlled and should be checked locally',
      admission: 'Free; no staffed visitor facilities claimed', url: kemnayRoutes, dogRating: 2,
      showInTownGuide: true,
    },
  },
  {
    id: 'clovenstone-aberdeenshire-scotland', requestedName: 'Clovenstone', name: 'Clovenstone', region: 'Aberdeenshire',
    centre: [-2.38996, 57.25305], radius: 300, score: 18, dogRating: 1,
    character: 'Dispersed roadside locality',
    summary: 'A rural grouping between Kintore and Inverurie without an independent public visitor experience.',
    rationale: 'Accommodation and nearby active-travel proposals are practical context, not enough to turn Clovenstone into a tourist stop.',
    sources: [kintoreDistrict, osmCopyright],
  },
  {
    id: 'balbithan-scotland', requestedName: 'Balbithan', name: 'Balbithan', region: 'Aberdeenshire',
    centre: [-2.3366064, 57.2467924], radius: 300, score: 21, dogRating: 1,
    character: 'Small Kintore-district hamlet',
    summary: 'A genuine hamlet distinct from Balbithan House, but with little public visitor interest of its own.',
    rationale: 'The settlement is retained separately from the private listed house; Kintore’s heritage offer is not duplicated here.',
    sources: [kintoreDistrict, osmCopyright],
  },
  {
    id: 'cottown-kintore-scotland', requestedName: 'Cottown', name: 'Cottown', region: 'Aberdeenshire',
    centre: [-2.3834, 57.22785], radius: 300, score: 20, dogRating: 1,
    character: 'Rural Kintore locality',
    summary: 'A dispersed croft and farm locality south-west of Kintore without a destination-scale visitor offer.',
    rationale: 'This is the Kintore Cottown requested in the local sequence, not the unrelated Formartine or Rhynie places.',
    sources: [cottownRecord, kintoreDistrict, osmCopyright],
  },
  {
    id: 'kemnay-scotland', requestedName: 'Kenmay', name: 'Kemnay', region: 'Aberdeenshire',
    centre: [-2.4462028, 57.2348184], radius: 680, score: 68, dogRating: 2,
    character: 'Granite village with riverside paths and public art',
    summary: 'A coherent Garioch destination with nine council-mapped walks, quarry heritage, carved stone waymarkers and a council treasure trail.',
    rationale: 'Kemnay clears 60 through its own walkable heritage and outdoor offer; Castle Fraser and other nearby attractions are excluded from the town score.',
    sources: [kemnayRoutes, councilWalkingRoutes, osmCopyright],
    trail: {
      id: 'kemnay-walking-cycling-routes', name: 'Kemnay Walking and Cycling Routes', score: 74,
      coordinates: [-2.4462028, 57.2348184],
      description: 'Nine council-mapped routes connect the Don, Aquithie Burn, Place of Origin, quarry story, public art and village landmarks.',
      opening: 'Public streets and paths; check current access and weather conditions', admission: 'Free', url: kemnayRoutes,
    },
  },
  {
    id: 'craigearn-scotland', requestedName: 'Craigearn', name: 'Craigearn', region: 'Aberdeenshire',
    centre: [-2.4599949, 57.217773], radius: 280, score: 26, dogRating: 1,
    character: 'Small rural hamlet',
    summary: 'A recognised hamlet south of Kemnay with limited public visitor infrastructure.',
    rationale: 'The Lang Stane is heritage context but appears to stand in private residential ground, so it does not create a dependable attraction-led stop.',
    sources: ['https://www.britainexpress.com/attractions.htm?attraction=4400', osmCopyright],
  },
  {
    id: 'leylodge-scotland', requestedName: 'Leylodge', name: 'Leylodge', region: 'Aberdeenshire',
    centre: [-2.38128, 57.21465], radius: 280, score: 15, dogRating: 1,
    character: 'Dispersed farm locality',
    summary: 'A named Kintore-district locality rather than a cohesive visitor settlement.',
    rationale: 'Hallforest Castle and Kintore station are nearby but do not belong to Leylodge’s own settlement score.',
    sources: [kintoreDistrict, osmCopyright],
  },
  {
    id: 'lauchintilly-scotland', requestedName: 'Lauchintilly', name: 'Lauchintilly', region: 'Aberdeenshire',
    centre: [-2.4201, 57.2035], radius: 260, score: 16, dogRating: 1,
    character: 'Farm and woodland locality',
    summary: 'A rural property locality beside woodland, without a verified public visitor destination.',
    rationale: 'Nearby woods and Castle Fraser are not assumed to provide public access from Lauchintilly or to belong to this locality.',
    sources: ['https://docs.planning.org.uk/20250929/38/T2TS8RCF08200/wgbrwlz7nku1vy7a.pdf', osmCopyright],
  },
  {
    id: 'achath-scotland', requestedName: 'Achath', name: 'Achath', region: 'Aberdeenshire',
    centre: [-2.4469101, 57.1886809], radius: 280, score: 20, dogRating: 1,
    character: 'Small roadside hamlet',
    summary: 'A mapped hamlet north of Lyne of Skene with no verified destination-scale visitor offer.',
    rationale: 'Its countryside setting is not used as a substitute for public attractions, facilities or a coherent settlement visit.',
    sources: [osmCopyright],
  },
  {
    id: 'lyne-of-skene-scotland', requestedName: 'Lyne of Skyne', name: 'Lyne of Skene', region: 'Aberdeenshire',
    centre: [-2.3909521, 57.1851522], radius: 400, score: 38, dogRating: 1,
    character: 'Established rural village',
    summary: 'A recognisable village with local identity and countryside access, but insufficient visitor depth for a recommended tourist stop.',
    rationale: 'The spelling is normalised to Lyne of Skene; nearby estates, Loch of Skene and other regional attractions are kept outside its score.',
    sources: [councilSpeedLimits, osmCopyright],
  },
  {
    id: 'old-kinnernie-scotland', requestedName: 'Old Kinnernie', name: 'Old Kinnernie', region: 'Aberdeenshire',
    centre: [-2.45597, 57.17622], radius: 300, score: 36, dogRating: 1,
    character: 'Historic churchyard locality',
    summary: 'A tiny rural locality centred on an abandoned medieval churchyard, without a broader visitor offer.',
    rationale: 'The churchyard and surviving old buildings provide real historic interest, but one quiet heritage site does not make the locality a 60+ town.',
    sources: [oldKinnernieChurchyard, historicKirkyards, aberdeenshireBusMap, osmCopyright],
  },
  {
    id: 'sauchen-scotland', requestedName: 'Sauchen', name: 'Sauchen', region: 'Aberdeenshire',
    centre: [-2.4980169, 57.188786], radius: 480, score: 43, dogRating: 1,
    character: 'Established roadside village',
    summary: 'A coherent village with local services and rural character, but limited visitor depth within its own boundary.',
    rationale: 'Private Cluny Castle and attractions nearer Castle Fraser are not transferred into Sauchen’s settlement score.',
    sources: [gariochSettlementStatements, councilSpeedLimits, aberdeenshireBusMap, osmCopyright],
  },
  {
    id: 'monymusk-scotland', requestedName: 'Moneymosk', name: 'Monymusk', region: 'Aberdeenshire',
    centre: [-2.5239651, 57.2270003], radius: 520, score: 67, dogRating: 2,
    character: 'Planned estate village with an ancient church',
    summary: 'A handsome conservation village whose square, medieval church fabric and local paths form a coherent short heritage visit.',
    rationale: 'Monymusk clears 60 through its own planned village character, important church history and walkable core paths; private Monymusk House and wider Bennachie attractions are excluded.',
    sources: [monymuskEstate, monymuskChurchHer, monymuskCorePaths, councilSpeedLimits, osmCopyright],
    trail: {
      id: 'monymusk-core-paths', name: 'Monymusk Core Paths', score: 68,
      coordinates: [-2.5239651, 57.2270003],
      description: 'The council core-path map links the historic square and church with the village edge and surrounding rural paths.',
      opening: 'Public streets and paths; check local notices and seasonal ground conditions',
      admission: 'Free', url: monymuskCorePaths,
    },
  },
  {
    id: 'blairdaff-scotland', requestedName: 'Blairdaff', name: 'Blairdaff', region: 'Aberdeenshire',
    centre: [-2.5049263, 57.2491643], radius: 280, score: 27, dogRating: 1,
    character: 'Small rural hamlet',
    summary: 'A recognisable hamlet and historic kirkyard locality without enough public visitor infrastructure for a destination stop.',
    rationale: 'Historic identity is credited, while nearby Monymusk and Bennachie experiences remain outside Blairdaff’s score.',
    sources: [historicKirkyards, osmCopyright],
  },
  {
    id: 'bograxie-scotland', requestedName: 'Bograxie', name: 'Bograxie', region: 'Aberdeenshire',
    centre: [-2.4885, 57.2663], radius: 260, score: 14, dogRating: 1,
    character: 'Farm and croft locality',
    summary: 'A dispersed agricultural place rather than a public visitor settlement.',
    rationale: 'Bograxie is retained for geographic completeness, but farms, private land and nearby attractions do not form an independent visit.',
    sources: [aberdeenshireBusMap, osmCopyright],
  },
  {
    id: 'dunecht-scotland', requestedName: 'Dunect', name: 'Dunecht', region: 'Aberdeenshire',
    centre: [-2.4114889, 57.1724053], radius: 500, score: 57, dogRating: 2,
    character: 'Estate village on the A944',
    summary: 'A distinctive planned village with estate architecture and countryside walks, but a thin dependable public visitor offer.',
    rationale: 'Dunecht House is private and is not counted as a visitable attraction; the village therefore remains just below the 60 map threshold.',
    sources: [gariochSettlementStatements, dunechtHouseHer, councilSpeedLimits, osmCopyright],
  },
  {
    id: 'skene-house-scotland', requestedName: 'Skene Ho', name: 'Skene House', region: 'Aberdeenshire',
    centre: [-2.3857257, 57.1778994], radius: 260, score: 18, dogRating: 1,
    character: 'Private historic property locality',
    summary: 'A named historic house and estate location, not a public visitor town.',
    rationale: 'The supplied “Ho” abbreviation is resolved to Skene House; private property cannot create a settlement visit or a map-qualifying score.',
    sources: [gariochSettlementStatements, osmCopyright],
  },
  {
    id: 'marionburgh-midmar-scotland', requestedName: 'Marionburgh', name: 'Marionburgh', region: 'Aberdeenshire',
    centre: [-2.480283, 57.151431], radius: 280, score: 15, dogRating: 1,
    character: 'Midmar farm locality',
    summary: 'A small Midmar rural locality rather than a visitor settlement.',
    rationale: 'This is Marionburgh in Midmar, not the Moray cairn site; residential and farm properties do not create an independent tourist offer.',
    sources: ['https://scotlandsplaces.gov.uk/digital-volumes/ordnance-survey-name-books/aberdeenshire-os-name-books-1865-1871/aberdeenshire-volume-62/70', osmCopyright],
  },
  {
    id: 'echt-scotland', requestedName: 'Echt', name: 'Echt', region: 'Aberdeenshire',
    centre: [-2.4333327, 57.141322], radius: 470, score: 51, dogRating: 1,
    character: 'Historic parish village',
    summary: 'A settled granite village with churchyard character and access to a rich prehistoric landscape, but limited in-village visitor depth.',
    rationale: 'Cullerlie Stone Circle, Barmekin Hill and Dunecht estate are separate places and are not used to push Echt over 60.',
    sources: [gariochSettlementStatements, historicKirkyards, councilSpeedLimits, osmCopyright],
  },
  {
    id: 'garlogie-scotland', requestedName: 'Garlogiue', name: 'Garlogie', region: 'Aberdeenshire',
    centre: [-2.3521498, 57.1392721], radius: 380, score: 58, dogRating: 1,
    character: 'Former textile-mill village',
    summary: 'A small industrial-heritage village with a nationally unusual surviving beam engine, but access is event-led rather than dependable year-round.',
    rationale: 'The beam-engine site is important, but limited open days and the village’s small supporting offer keep the settlement below 60 pending a full audit.',
    sources: [gariochSettlementStatements, garlogieEngine, councilSpeedLimits, osmCopyright],
  },
  {
    id: 'redhill-skene-scotland', requestedName: 'Redhill', name: 'Redhill', region: 'Aberdeenshire',
    centre: [-2.35738, 57.12795], radius: 260, score: 17, dogRating: 1,
    character: 'Dispersed rural locality',
    summary: 'A named agricultural locality south of Garlogie without an independent public visitor offer.',
    rationale: 'Archaeological field remains and nearby Cullerlie are context, not a visitable town experience at Redhill itself.',
    sources: ['https://her.aberdeenshire.gov.uk/Monument/MAB44297', aberdeenshireBusMap, osmCopyright],
  },
  {
    id: 'south-kirkton-echt-scotland', requestedName: 'South Kirkton', name: 'South Kirkton', region: 'Aberdeenshire',
    centre: [-2.43949, 57.13963], radius: 240, score: 18, dogRating: 1,
    character: 'Small Echt-edge locality',
    summary: 'A minor residential and agricultural grouping near Echt rather than a separate visitor village.',
    rationale: 'Echt’s services and surrounding prehistoric sites are not duplicated into South Kirkton’s score.',
    sources: [aberdeenshireBusMap, osmCopyright],
  },
  {
    id: 'landerberry-scotland', requestedName: 'Landerberry', name: 'Landerberry', region: 'Aberdeenshire',
    centre: [-2.4217161, 57.1298307], radius: 240, score: 16, dogRating: 1,
    character: 'Rural hamlet',
    summary: 'A small mapped hamlet south of Echt with no verified destination-scale visitor experience.',
    rationale: 'Its countryside setting is retained as place context, without borrowing Echt or Cullerlie attractions.',
    sources: [aberdeenshireBusMap, osmCopyright],
  },
  {
    id: 'west-cullerlie-scotland', requestedName: 'West Cullery', name: 'West Cullerlie', region: 'Aberdeenshire',
    centre: [-2.387199, 57.116962], radius: 260, score: 19, dogRating: 1,
    character: 'Farm locality near Cullerlie',
    summary: 'A rural property grouping near Cullerlie rather than an independent visitor settlement.',
    rationale: 'The spelling is normalised to West Cullerlie; Cullerlie Stone Circle remains a separate attraction and does not inflate this locality.',
    sources: [cullerlieRecord, osmCopyright],
  },
  {
    id: 'benthoul-scotland', requestedName: 'Benthout', name: 'Benthoul', region: 'Aberdeen City',
    centre: [-2.3297379, 57.119916], radius: 260, score: 16, dogRating: 1,
    character: 'Outer-city rural hamlet',
    summary: 'A small historic-county hamlet now within Aberdeen City, without a public visitor offer of its own.',
    rationale: 'The requested spelling is resolved to Benthoul; nearby countryside and Cullerlie are not transferred into its score.',
    sources: [benthoulGazetteer, aberdeenshireBusMap, osmCopyright],
  },
  {
    id: 'hardgate-aberdeenshire-scotland', requestedName: 'Hardgate', name: 'Hardgate', region: 'Aberdeenshire',
    centre: [-2.34605, 57.10303], radius: 260, score: 18, dogRating: 1,
    character: 'Deeside-edge rural locality',
    summary: 'A dispersed rural locality south-west of Westhill without an independent visitor destination.',
    rationale: 'This is the AB31 Aberdeenshire locality, not Aberdeen’s urban Hardgate; nearby Deeside attractions remain outside its score.',
    sources: [aberdeenshireBusMap, osmCopyright],
  },
  {
    id: 'kirkton-of-skene-scotland', requestedName: 'Kirkton of Skene', name: 'Kirkton of Skene', region: 'Aberdeenshire',
    centre: [-2.3273188, 57.1601822], radius: 520, score: 48, dogRating: 1,
    character: 'Historic Garioch village',
    summary: 'A genuine old village with church-and-estate character, but too little public visitor depth for a destination stop.',
    rationale: 'Kirkton of Skene is retained as a distinct village; private estate land and Westhill services are not transferred into its score.',
    sources: [gariochSettlementStatements, osmCopyright],
  },
  {
    id: 'bucksburn-scotland', requestedName: 'Bucksburn', name: 'Bucksburn', region: 'Aberdeen City',
    centre: [-2.1824135, 57.1771092], radius: 820, score: 39, dogRating: 1,
    character: 'Former mill village within Aberdeen',
    summary: 'An urban district with a recognisable historic identity, but limited appeal as a self-contained visitor stop.',
    rationale: 'Bucksburn is assessed as the settlement itself; nearby airport, river and city attractions are not borrowed.',
    sources: [osmCopyright],
  },
  {
    id: 'woodside-aberdeen-scotland', requestedName: 'Woodside', name: 'Woodside', region: 'Aberdeen City',
    centre: [-2.1300516, 57.1712423], radius: 760, score: 43, dogRating: 1,
    character: 'Historic riverside city district',
    summary: 'A granite former village with local history and river access, but not a sufficiently complete tourist destination.',
    rationale: 'Woodside keeps credit for its own older streets and setting without absorbing Old Aberdeen, Seaton Park or wider Don-side sights.',
    sources: [osmCopyright],
  },
  {
    id: 'northfield-aberdeen-scotland', requestedName: 'Northfield', name: 'Northfield', region: 'Aberdeen City',
    centre: [-2.1635846, 57.1655955], radius: 820, score: 24, dogRating: 1,
    character: 'Post-war residential district',
    summary: 'A substantial residential neighbourhood serving local needs rather than a tourist visit.',
    rationale: 'Parks and services are local amenities; nearby city attractions do not create an independent Northfield destination.',
    sources: [osmCopyright],
  },
  {
    id: 'mastrick-aberdeen-scotland', requestedName: 'Mastrick', name: 'Mastrick', region: 'Aberdeen City',
    centre: [-2.1600249, 57.1568498], radius: 760, score: 23, dogRating: 1,
    character: 'Residential city neighbourhood',
    summary: 'A well-established Aberdeen neighbourhood with everyday services but little destination-scale visitor interest.',
    rationale: 'Hazlehead and central Aberdeen attractions sit outside this settlement assessment and are not transferred into its score.',
    sources: [osmCopyright],
  },
  {
    id: 'kingswells-scotland', requestedName: 'Kingswells', name: 'Kingswells', region: 'Aberdeen City',
    centre: [-2.2234447, 57.1575045], radius: 900, score: 41, dogRating: 2,
    character: 'Expanded western village',
    summary: 'A modern village with useful local paths and traces of rural heritage, but limited visitor concentration.',
    rationale: 'Kingswells is not credited with nearby commercial venues or countryside attractions beyond its own walkable settlement.',
    sources: [osmCopyright],
  },
  {
    id: 'westhill-scotland', requestedName: 'Westhill', name: 'Westhill', region: 'Aberdeenshire',
    centre: [-2.2799019, 57.1536455], radius: 1250, score: 52, dogRating: 2,
    character: 'Modern planned commuter town',
    summary: 'A practical town with shops, paths and greenspace, but modest historic character and limited destination appeal.',
    rationale: 'Westhill scores for its own amenities and green links; surrounding estates, woods and Aberdeen attractions are not borrowed.',
    sources: [gariochSettlementStatements, osmCopyright],
  },
  {
    id: 'cairnie-westhill-scotland', requestedName: 'Cairnie', name: 'Cairnie', region: 'Aberdeenshire',
    centre: [-2.32327, 57.14142], radius: 300, score: 18, dogRating: 1,
    character: 'Scattered Skene farm locality',
    summary: 'A small rural place south-west of Westhill rather than a public visitor settlement.',
    rationale: 'This resolves to the AB32 Cairnie near Westhill, not the larger Cairnie near Huntly; nearby woodland and Westhill facilities are not transferred.',
    sources: [cairnieOpenNames, osmCopyright],
  },
  {
    id: 'elrick-westhill-scotland', requestedName: 'Elrick', name: 'Elrick', region: 'Aberdeenshire',
    centre: [-2.3021876, 57.1510489], radius: 650, score: 30, dogRating: 1,
    character: 'Residential Westhill-edge village',
    summary: 'A residential community now closely joined to Westhill, with limited independent visitor identity.',
    rationale: 'Elrick remains separately selectable, but Westhill services and surrounding countryside are not duplicated into its score.',
    sources: [gariochSettlementStatements, osmCopyright],
  },
  {
    id: 'easter-ord-scotland', requestedName: 'Easter Ord', name: 'Easter Ord', region: 'Aberdeenshire',
    centre: [-2.27553, 57.13165], radius: 280, score: 16, dogRating: 1,
    character: 'Historic farm locality',
    summary: 'A named farm and croft grouping in Skene parish rather than a visitor village.',
    rationale: 'The historic farm record confirms the place, but private agricultural heritage is not treated as a public attraction.',
    sources: [easterOrdRecord, osmCopyright],
  },
  {
    id: 'blacktop-aberdeen-scotland', requestedName: 'Blacktop', name: 'Blacktop', region: 'Aberdeen City',
    centre: [-2.2316353, 57.12919], radius: 300, score: 18, dogRating: 1,
    character: 'Outer-city rural hamlet',
    summary: 'A small mapped locality between Countesswells and Bieldside without an independent public visitor offer.',
    rationale: 'Nearby hills, schools and larger settlements are excluded from Blacktop’s own settlement score.',
    sources: [blacktopGazetteer, osmCopyright],
  },
  {
    id: 'mannofield-scotland', requestedName: 'Mannofield', name: 'Mannofield', region: 'Aberdeen City',
    centre: [-2.1373983, 57.1314667], radius: 760, score: 37, dogRating: 1,
    character: 'Leafy inner suburb',
    summary: 'A pleasant granite residential district with local character, but no concentrated visitor itinerary of its own.',
    rationale: 'Nearby parks, sports grounds and city-centre attractions are not counted unless they lie within and define Mannofield itself.',
    sources: [osmCopyright],
  },
  {
    id: 'cults-scotland', requestedName: 'Cults', name: 'Cults', region: 'Aberdeen City',
    centre: [-2.1766875, 57.1179511], radius: 980, score: 56, dogRating: 2,
    character: 'Leafy Lower Deeside suburb',
    summary: 'An attractive suburban centre with cafés, local walks and Deeside Way access, but limited destination-scale heritage depth.',
    rationale: 'Cults is a useful walking and refreshment stop, yet the through-route and wider Dee landscape do not justify a 60+ town score by themselves.',
    sources: [deesideWay, osmCopyright],
  },
  {
    id: 'bieldside-scotland', requestedName: 'Bieldside', name: 'Bieldside', region: 'Aberdeen City',
    centre: [-2.2032614, 57.1147638], radius: 700, score: 39, dogRating: 2,
    character: 'Lower Deeside residential suburb',
    summary: 'A green residential district connected to the Deeside Way, but with little independent visitor concentration.',
    rationale: 'The long-distance route is useful access, not sufficient evidence that Bieldside itself is a tourist destination.',
    sources: [deesideWay, osmCopyright],
  },
  {
    id: 'milltimber-scotland', requestedName: 'Milltimber', name: 'Milltimber', region: 'Aberdeen City',
    centre: [-2.2332742, 57.1075186], radius: 760, score: 40, dogRating: 2,
    character: 'Lower Deeside suburban village',
    summary: 'A quiet residential village with railway history and route access, but limited public visitor depth.',
    rationale: 'Milltimber’s former railway identity is acknowledged without borrowing attractions across the Dee or in neighbouring settlements.',
    sources: [deesideWay, osmCopyright],
  },
  {
    id: 'peterculter-scotland', requestedName: 'Peterculter', name: 'Peterculter', region: 'Aberdeen City',
    centre: [-2.2674497, 57.0961144], radius: 1150, score: 64, dogRating: 2,
    character: 'Historic Lower Deeside village',
    summary: 'A coherent village stop combining local heritage, wooded burns, riverside character and a useful path network.',
    rationale: 'Peterculter clears 60 on its own walkable village experience: historic core, Rob Roy bridge and statue area, local woods, Culter Burn and Deeside Way access. Easter Anguston Farm and other nearby standalone attractions add no town points.',
    sources: [peterculterPaths, peterculterBridge, deesideWay, osmCopyright],
    trail: {
      id: 'peterculter-community-paths', name: 'Peterculter Community Paths', score: 72,
      coordinates: [-2.2674497, 57.0961144],
      description: 'The community map links the village core, Culter Burn, local woods, River Dee approaches and the Deeside Way in a choice of short walks.',
      opening: 'Open paths; check local notices and current Deeside Way conditions before travel', admission: 'Free', url: peterculterPaths,
    },
  },
  {
    id: 'milton-of-murtle-scotland', requestedName: 'Milton of Murtle', name: 'Milton of Murtle', region: 'Aberdeen City',
    centre: [-2.21132, 57.10911], radius: 300, score: 22, dogRating: 1,
    character: 'Historic mill and farm locality',
    summary: 'A documented post-medieval farmstead and mill locality, but not a public visitor settlement.',
    rationale: 'The dated historic record establishes the place; private buildings and neighbouring Bieldside attractions are not converted into visitor value.',
    sources: [miltonMurtleHer, osmCopyright],
  },
  {
    id: 'contlaw-scotland', requestedName: 'Contlaw', name: 'Contlaw', region: 'Aberdeen City',
    centre: [-2.2740679, 57.1131508], radius: 340, score: 17, dogRating: 1,
    character: 'Rural Peterculter locality',
    summary: 'A historic rural place-name and dispersed property grouping rather than an independent visitor village.',
    rationale: 'Peterculter paths and services are not duplicated into Contlaw’s score; modern development does not create a tourist stop.',
    sources: [peterculterPaths, osmCopyright],
  },
  {
    id: 'craigton-peterculter-scotland', requestedName: 'Craigton', name: 'Craigton', region: 'Aberdeen City',
    centre: [-2.285, 57.1067], radius: 380, score: 20, dogRating: 1,
    character: 'Peterculter-edge rural locality',
    summary: 'A small historic locality now closely associated with Peterculter, without a separate visitor offer.',
    rationale: 'This resolves to Craigton at Peterculter, not the Glasgow or Angus namesakes; Peterculter’s attractions and paths are not counted twice.',
    sources: [peterculterPaths, osmCopyright],
  },
  {
    id: 'kittybrewster-scotland', requestedName: 'Kittybrewster', name: 'Kittybrewster', region: 'Aberdeen City',
    centre: [-2.1132396, 57.1616343], radius: 650, score: 36, dogRating: 1,
    character: 'Inner-north Aberdeen neighbourhood',
    summary: 'A busy residential and transport district with limited destination-scale visitor character of its own.',
    rationale: 'Kittybrewster remains useful regional context, but Old Aberdeen, the university and central Aberdeen attractions are outside its settlement score.',
    sources: [osmCopyright],
  },
  {
    id: 'hayton-aberdeen-scotland', requestedName: 'Hayton', name: 'Hayton', region: 'Aberdeen City',
    centre: [-2.1200289, 57.1730712], radius: 430, score: 24, dogRating: 1,
    character: 'Small Don-side neighbourhood',
    summary: 'A compact residential neighbourhood without an independent public visitor offer.',
    rationale: 'Nearby river, university and Tillydrone facilities are not transferred into Hayton’s score.',
    sources: [osmCopyright],
  },
  {
    id: 'old-aberdeen-scotland', requestedName: 'Old Aberdeen', name: 'Old Aberdeen', region: 'Aberdeen City',
    centre: [-2.1022937, 57.1669196], radius: 1250, score: 86, dogRating: 2,
    character: 'Medieval cathedral and university burgh',
    summary: 'A remarkably complete historic district of cobbled streets, medieval and collegiate architecture, museums, gardens and river walks.',
    rationale: 'Old Aberdeen clears the threshold decisively on its own concentrated visitor offer: St Machar’s Cathedral, King’s College, university museums, Cruickshank Garden, Seaton Park and an official self-guided trail.',
    sources: [oldAberdeenVisit, aberdeenHeritageTrails, osmCopyright],
    trail: {
      id: 'old-aberdeen-heritage-trail', name: 'Old Aberdeen Heritage Trail', score: 72,
      coordinates: [-2.1022937, 57.1669196],
      description: 'The council’s self-guided route explores the Chanonry, merchant burgh and university precinct through Old Aberdeen’s principal historic streets and landmarks.',
      opening: 'Public streets and paths; individual interiors and gardens keep their own opening hours', admission: 'Free trail', url: aberdeenHeritageTrails,
    },
  },
  {
    id: 'ferryhill-aberdeen-scotland', requestedName: 'Ferryhill', name: 'Ferryhill', region: 'Aberdeen City',
    centre: [-2.1031648, 57.1365688], radius: 800, score: 58, dogRating: 2,
    character: 'Victorian residential district beside Duthie Park',
    summary: 'An attractive granite neighbourhood with useful access to Duthie Park, but limited independent visitor depth beyond its setting.',
    rationale: 'Duthie Park supports a pleasant district visit, but the park and wider city offer do not justify presenting Ferryhill itself as a separate 60+ destination without a full audit.',
    sources: [aberdeenCityVisit, osmCopyright],
  },
  {
    id: 'ruthrieston-aberdeen-scotland', requestedName: 'Ruthrileston', name: 'Ruthrieston', region: 'Aberdeen City',
    centre: [-2.1200537, 57.1283089], radius: 650, score: 43, dogRating: 2,
    character: 'Lower-Dee residential neighbourhood',
    summary: 'A settled granite neighbourhood with river and park access but little concentrated visitor offer of its own.',
    rationale: 'The supplied spelling is normalised to Ruthrieston; Duthie Park, Garthdee and wider Aberdeen attractions are not counted twice.',
    sources: [osmCopyright],
  },
  {
    id: 'kincorth-aberdeen-scotland', requestedName: 'Kincorth', name: 'Kincorth', region: 'Aberdeen City',
    centre: [-2.1070353, 57.1204652], radius: 1050, score: 62, dogRating: 2,
    character: 'Hill-edge district and local nature reserve',
    summary: 'A modest outdoor stop anchored by Kincorth Hill’s signed walking routes, viewpoints, heathland and picnic provision.',
    rationale: 'Kincorth just clears 60 because the named hill and official route network create a coherent experience reached directly from the district; Torry and city-centre attractions remain separate.',
    sources: [kincorthHillRoutes, aberdeenHeritageTrails, osmCopyright],
    trail: {
      id: 'kincorth-hill-walking-routes', name: 'Kincorth Hill Walking Routes', score: 69,
      coordinates: [-2.1112, 57.1156],
      description: 'The council map sets out several signed circuits across Kincorth Hill Local Nature Reserve, with viewpoints, tactile maps and picnic sites.',
      opening: 'Open outdoor paths; daylight recommended and temporary land-management notices apply', admission: 'Free', url: kincorthHillRoutes,
    },
  },
  {
    id: 'torry-aberdeen-scotland', requestedName: 'Torry', name: 'Torry', region: 'Aberdeen City',
    centre: [-2.0824696, 57.1351976], radius: 1650, score: 76, dogRating: 2,
    character: 'Independent-feeling maritime burgh and headland',
    summary: 'A strong coastal district with fishing and industrial heritage, several official trails, Torry Battery, Greyhope Bay and exceptional harbour wildlife watching.',
    rationale: 'Torry earns its score from its own maritime streets, headland, battery, coastal paths and four council trail themes rather than from central Aberdeen.',
    sources: [aberdeenHeritageTrails, aberdeenCityVisit, osmCopyright],
    trail: {
      id: 'torry-coastal-heritage-trail', name: 'Torry Coastal Heritage Trail', score: 72,
      coordinates: [-2.0638, 57.1422],
      description: 'One of four council Torry trails, linking the district’s maritime story, wartime coast, Torry Battery and harbour-edge viewpoints.',
      opening: 'Outdoor route; daylight and coastal weather conditions recommended', admission: 'Free', url: aberdeenHeritageTrails,
    },
  },
  {
    id: 'nigg-aberdeen-scotland', requestedName: 'Nigg', name: 'Nigg', region: 'Aberdeen City',
    centre: [-2.115934, 57.1106568], radius: 850, score: 38, dogRating: 2,
    character: 'Historic parish absorbed into south Aberdeen',
    summary: 'A dispersed modern district with historic parish identity and green links, but no concentrated independent visitor centre.',
    rationale: 'Kincorth Hill, Cove coast, Torry and the new harbour are assessed with their own places rather than being aggregated into Nigg.',
    sources: [osmCopyright],
  },
  {
    id: 'garthdee-aberdeen-scotland', requestedName: 'Garthdee', name: 'Garthdee', region: 'Aberdeen City',
    centre: [-2.1382314, 57.1215606], radius: 900, score: 49, dogRating: 2,
    character: 'River Dee university and residential district',
    summary: 'A green riverside district with university, arts and active-travel connections, but limited stand-alone destination coherence.',
    rationale: 'The River Dee paths are useful and Robert Gordon University adds activity, while Duthie Park, Bridge of Dee and city attractions remain separately scored.',
    sources: [osmCopyright],
  },
  {
    id: 'banchory-devenick-scotland', requestedName: 'Banchory-Devenick', name: 'Banchory-Devenick', region: 'Aberdeenshire',
    centre: [-2.1429609, 57.1106999], radius: 600, score: 42, dogRating: 2,
    character: 'Dee-side historic hamlet',
    summary: 'A small rural hamlet with church and river-valley character but little dependable public visitor infrastructure.',
    rationale: 'Nearby Garthdee, Kincorth and Lower Deeside experiences do not make the hamlet an independent tourist destination.',
    sources: [osmCopyright],
  },
  {
    id: 'charlestown-nigg-scotland', requestedName: 'Charlestown', name: 'Charlestown', region: 'Aberdeen City',
    centre: [-2.1106993, 57.0986854], radius: 430, score: 28, dogRating: 1,
    character: 'Small Nigg-edge hamlet',
    summary: 'A compact residential locality without an independent public visitor offer.',
    rationale: 'This resolves to Charlestown at Nigg; Cove Bay, Loirston and coastal attractions are not transferred into its score.',
    sources: [osmCopyright],
  },
  {
    id: 'cove-bay-scotland', requestedName: 'Cove Bay', name: 'Cove Bay', region: 'Aberdeen City',
    centre: [-2.0840447, 57.1031807], radius: 1200, score: 64, dogRating: 2,
    character: 'Clifftop suburb with an old fishing-village core',
    summary: 'A notable coastal stop combining the old harbour quarter, conservation-area character and a rugged south-Aberdeen coastal route.',
    rationale: 'Cove Bay clears 60 on its own old village and coast, but Torry Battery, Nigg Bay and Portlethen are kept outside its settlement score.',
    sources: [aberdeenCoast, osmCopyright],
    trail: {
      id: 'cove-bay-coastal-route', name: 'Cove Bay Coastal Route', score: 66,
      coordinates: [-2.0784, 57.0997],
      description: 'The south-Aberdeen coastal route links Cove’s old fishing-village edge, harbour views and rugged clifftop scenery.',
      opening: 'Outdoor coast path; check weather, cliff-edge conditions and any harbour works', admission: 'Free', url: aberdeenCoast,
    },
  },
  {
    id: 'aberdeen-scotland', requestedName: 'Aberdeen', name: 'Aberdeen', region: 'Aberdeen City',
    centre: [-2.0928095, 57.1482429], radius: 3900, score: 94, dogRating: 2,
    character: 'Granite city, historic port and cultural centre',
    summary: 'A major Scottish city destination with nationally significant architecture, museums, maritime heritage, beach, parks, cultural venues and a deep trail network.',
    rationale: 'Aberdeen’s score reflects the city-wide destination in its own right. Separate district projects remain useful for detailed exploration but do not duplicate or reduce the city’s broad visitor offer.',
    sources: [aberdeenCityVisit, aberdeenHistoryTrail, aberdeenHeritageTrails, osmCopyright],
    trail: {
      id: 'aberdeen-history-trail', name: 'Aberdeen History Trail', score: 72,
      coordinates: [-2.0978, 57.1475],
      description: 'The council trail introduces the city’s royal burghs, granite expansion, harbour, civic buildings and principal historic quarters.',
      opening: 'Public streets and spaces; individual attractions keep their own hours', admission: 'Free trail', url: aberdeenHistoryTrail,
    },
  },
  {
    id: 'mains-of-drum-scotland', requestedName: 'Mains of Drum', name: 'Mains of Drum', region: 'Aberdeenshire',
    centre: [-2.3250955, 57.0884113], radius: 260, score: 22, dogRating: 1,
    character: 'Small Deeside farming hamlet',
    summary: 'A small mapped hamlet near Drumoak without an independent public visitor offer.',
    rationale: 'The settlement is retained for regional completeness; Drum Castle and wider Deeside attractions are separate places and do not support its score.',
    sources: [osmCopyright],
  },
  {
    id: 'kirkton-of-maryculter-scotland', requestedName: 'Kirknewton of Maryculter', name: 'Kirkton of Maryculter', region: 'Aberdeenshire',
    centre: [-2.2372277, 57.0829681], radius: 380, score: 44, dogRating: 1,
    character: 'Historic Dee-side kirkton',
    summary: 'A recognisable historic locality beside the Dee, but not a sufficiently broad visitor destination in its own right.',
    rationale: 'The requested name is normalised to Kirkton of Maryculter. Maryculter House and surrounding countryside are not treated as a town-scale visitor offer.',
    sources: [osmCopyright],
  },
  {
    id: 'auchlee-scotland', requestedName: 'Auchlee', name: 'Auchlee', region: 'Aberdeenshire',
    centre: [-2.1795795, 57.0619439], radius: 220, score: 12, dogRating: 1,
    character: 'Dispersed rural locality',
    summary: 'An isolated dwelling and farm locality rather than a visitor settlement.',
    rationale: 'Nearby Newtonhill and coastal experiences are excluded from the score.',
    sources: [osmCopyright],
  },
  {
    id: 'cammachmore-scotland', requestedName: 'Cammachmore', name: 'Cammachmore', region: 'Aberdeenshire',
    centre: [-2.1548384, 57.0442085], radius: 360, score: 32, dogRating: 1,
    character: 'Compact roadside village',
    summary: 'A coherent small village with local identity but little destination-scale visitor depth.',
    rationale: 'Muchalls, Newtonhill and nearby coastal viewpoints remain separate visitor places.',
    sources: [aberdeenshireSettlements, osmCopyright],
  },
  {
    id: 'chapelton-of-elsick-scotland', requestedName: 'Chapelston of Elsick', name: 'Chapelton of Elsick', region: 'Aberdeenshire',
    centre: [-2.1772184, 57.0333643], radius: 620, score: 55, dogRating: 2,
    character: 'Walkable contemporary planned village',
    summary: 'A distinctive modern planned settlement with attractive public space and useful local amenities, but limited heritage and sightseeing depth.',
    rationale: 'Chapelton is credited for its own coherent design and services without borrowing Elsick House, Newtonhill or coastal attractions.',
    sources: [aberdeenshireSettlements, osmCopyright],
  },
  {
    id: 'bridge-of-muchalls-scotland', requestedName: 'Bridge of Muchalls', name: 'Bridge of Muchalls', region: 'Aberdeenshire',
    centre: [-2.1779369, 57.0117545], radius: 250, score: 20, dogRating: 1,
    character: 'Small roadside hamlet',
    summary: 'A mapped hamlet on the Muchalls corridor without an independent visitor experience.',
    rationale: 'Muchalls cliffs and the historic village belong to Muchalls and are not transferred to this hamlet.',
    sources: [osmCopyright],
  },
  {
    id: 'cookney-scotland', requestedName: 'Cookney', name: 'Cookney', region: 'Aberdeenshire',
    centre: [-2.2138064, 57.0305012], radius: 340, score: 35, dogRating: 1,
    character: 'Historic rural village',
    summary: 'A small established village with rural character but a limited public visitor offer.',
    rationale: 'The village is retained on its own merits; nearby estates, monuments and coast destinations do not inflate its score.',
    sources: [aberdeenshireSettlements, osmCopyright],
  },
  {
    id: 'muirskie-scotland', requestedName: 'M\\<uirskie', name: 'Muirskie', region: 'Aberdeenshire',
    centre: [-2.2838150, 57.0544418], radius: 280, score: 18, dogRating: 1,
    character: 'Dispersed Durris locality',
    summary: 'A small rural grouping around Muirskie Grange rather than a public visitor settlement.',
    rationale: 'The supplied spelling is normalised to Muirskie; private properties and surrounding countryside do not create a destination offer.',
    sources: [osmCopyright],
  },
  {
    id: 'upper-burnhaugh-scotland', requestedName: 'Upper Burnhaugh', name: 'Upper Burnhaugh', region: 'Aberdeenshire',
    centre: [-2.2760568, 57.0450556], radius: 220, score: 12, dogRating: 1,
    character: 'Isolated rural locality',
    summary: 'An isolated dwelling locality rather than a tourist settlement.',
    rationale: 'Netherley and wider Durris countryside remain separate and do not contribute to this score.',
    sources: [osmCopyright],
  },
  {
    id: 'borrowfield-scotland', requestedName: 'Barrowfield', name: 'Borrowfield', region: 'Aberdeenshire',
    centre: [-2.2814328, 57.0303510], radius: 260, score: 15, dogRating: 1,
    character: 'Small agricultural hamlet',
    summary: 'A small mapped hamlet with no verified independent visitor offer.',
    rationale: 'The requested spelling is normalised to the mapped Aberdeenshire form Borrowfield, distinct from Barrowfield in Glasgow.',
    sources: [osmCopyright],
  },
  {
    id: 'netherley-scotland', requestedName: 'Netherley', name: 'Netherley', region: 'Aberdeenshire',
    centre: [-2.2440148, 57.0321107], radius: 390, score: 31, dogRating: 1,
    character: 'Established rural village',
    summary: 'A coherent rural village with local identity but little destination-scale visitor infrastructure.',
    rationale: 'Private houses, surrounding farms and attractions in neighbouring settlements are not used to lift the village score.',
    sources: [aberdeenshireSettlements, osmCopyright],
  },
  {
    id: 'union-cottage-rickarton-scotland', requestedName: 'Union Cottage', name: 'Union Cottage', region: 'Aberdeenshire',
    centre: [-2.28626, 57.00308], radius: 200, score: 10, dogRating: 1,
    character: 'Named rural property',
    summary: 'A named cottage locality near Rickarton rather than a village or public visitor destination.',
    rationale: 'The locality remains selectable for geographic completeness but has no verified town-scale visitor offer.',
    sources: ['https://www.geograph.org.uk/photo/1383088', osmCopyright],
  },
  {
    id: 'denside-of-durris-scotland', requestedName: 'Denside', name: 'Denside of Durris', region: 'Aberdeenshire',
    centre: [-2.3180185, 57.0515108], radius: 280, score: 18, dogRating: 1,
    character: 'Dispersed Durris hamlet',
    summary: 'A small rural hamlet without an independent public visitor offer.',
    rationale: 'The request is resolved to Denside of Durris, consistent with the surrounding Muirskie and Netherley localities; Deeside attractions are excluded.',
    sources: [osmCopyright],
  },
  {
    id: 'drumoak-scotland', requestedName: 'Drumoak', name: 'Drumoak', region: 'Aberdeenshire',
    centre: [-2.3450739, 57.0799001], radius: 520, score: 45, dogRating: 2,
    character: 'Deeside village beside the River Dee',
    summary: 'A pleasant, coherent village on the Deeside corridor, but with limited independent sightseeing and visitor-service depth.',
    rationale: 'Drumoak is scored only for the village itself. Drum Castle is published separately in See and contributes no points to the settlement rating.',
    sources: [aberdeenshireSettlements, durrisCommunity, osmCopyright],
    standalone: {
      id: 'drum-castle-garden-estate', name: 'Drum Castle, Garden & Estate', score: 88,
      coordinates: [-2.3378115, 57.0950282], featureType: 'castle',
      description: 'A major National Trust for Scotland castle, garden and historic woodland visit north of Drumoak.',
      tagline: 'Medieval tower and Old Wood', time: '2–4 hours',
      opening: 'Seasonal opening; check the National Trust for Scotland before travel.',
      admission: 'Paid castle admission; grounds and parking terms vary.', url: drumCastle,
      dogRating: 2, showInTownGuide: false,
    },
  },
  {
    id: 'myrebird-scotland', requestedName: 'Myrebird', name: 'Myrebird', region: 'Aberdeenshire',
    centre: [-2.4204501, 57.0827618], radius: 260, score: 12, dogRating: 1,
    character: 'Scattered rural locality',
    summary: 'A road and plantation locality rather than a coherent visitor settlement.',
    rationale: 'Myrebird remains selectable for geographic completeness; nearby Deeside attractions do not create an independent town visit here.',
    sources: [durrisCommunity, osmCopyright],
  },
  {
    id: 'the-neuk-crathes-scotland', requestedName: 'The Neuk', name: 'The Neuk', region: 'Aberdeenshire',
    centre: [-2.44001, 57.06927], radius: 220, score: 14, dogRating: 1,
    character: 'Small rural locality',
    summary: 'A named locality near Crathes rather than a public visitor destination.',
    rationale: 'Crathes Castle and Banchory are separate visitor places and are not transferred into The Neuk’s score.',
    sources: [durrisCommunity, osmCopyright],
  },
  {
    id: 'banchory-scotland', requestedName: 'Banchory', name: 'Banchory', region: 'Aberdeenshire',
    centre: [-2.5044583, 57.0513874], radius: 1450, score: 82, dogRating: 2,
    character: 'Royal Deeside riverside town',
    summary: 'A well-served Deeside town with a coherent centre, riverside character, walking links and enough independent visitor depth for a strong destination rating.',
    rationale: 'Banchory clears 60 on its own town centre, paths, Falls of Feugh edge and verified self-guided trail. Crathes Castle, Drum Castle and other outlying attractions are excluded from the settlement score.',
    sources: [royalDeeside, banchoryWalkingMap, banchoryTreasureTrail, osmCopyright],
    trail: {
      id: 'banchory-town-park-riverside-treasure-trail',
      name: 'Banchory – Town, Park & Riverside Treasure Trail', score: 75,
      coordinates: [-2.5056, 57.0510],
      description: 'A verified two-mile clue trail through the town, park and riverside, designed for about two hours and suitable for dogs.',
      opening: 'Self-guided; follow the provider’s current access advice.', admission: 'Paid trail booklet or download.',
      url: banchoryTreasureTrail,
    },
    standalone: {
      id: 'falls-of-feugh', name: 'Falls of Feugh', score: 82,
      coordinates: [-2.4929283, 57.0448827], featureType: 'natural_feature',
      description: 'The cascades on the southern edge of Banchory, best known for seasonal salmon watching from the bridge.',
      tagline: 'Salmon-leap viewpoint', time: '30–60 minutes', opening: 'Open outdoor viewpoint; daylight visit recommended.',
      admission: 'Free', url: royalDeeside, dogRating: 2, showInTownGuide: true,
    },
  },
  {
    id: 'upper-lochton-scotland', requestedName: 'Upper Lochton', name: 'Upper Lochton', region: 'Aberdeenshire',
    centre: [-2.49906, 57.06318], radius: 430, score: 28, dogRating: 1,
    character: 'Outer Banchory residential locality',
    summary: 'A residential locality on Banchory’s northern edge rather than an independent visitor destination.',
    rationale: 'Banchory’s town centre, Falls of Feugh and visitor services belong to Banchory and do not support a separate Upper Lochton rating.',
    sources: [banchoryWalkingMap, osmCopyright],
  },
  {
    id: 'woodside-of-arbeadie-scotland', requestedName: 'Woodside of Erbeadie', name: 'Woodside of Arbeadie', region: 'Aberdeenshire',
    centre: [-2.4888, 57.0551], radius: 330, score: 20, dogRating: 1,
    character: 'Historic locality absorbed into Banchory',
    summary: 'A historically recorded group of dwellings now read largely as part of Banchory’s urban fabric.',
    rationale: 'The supplied spelling is normalised to the historic record’s Woodside of Arbeadie. Banchory’s amenities and attractions are not duplicated here.',
    sources: [woodsideArbeadieRecord, osmCopyright],
  },
  {
    id: 'bridge-of-feugh-scotland', requestedName: 'Bridge of Feugh', name: 'Bridge of Feugh', region: 'Aberdeenshire',
    centre: [-2.4929200, 57.0450596], radius: 240, score: 26, dogRating: 1,
    character: 'Bridge-side locality at the Feugh',
    summary: 'A small locality defined by the bridge and falls rather than a broader settlement visit.',
    rationale: 'Falls of Feugh is separately published in See under Banchory; the attraction does not convert Bridge of Feugh into a 60+ tourist town.',
    sources: [royalDeeside, osmCopyright],
  },
  {
    id: 'crathes-scotland', requestedName: 'Crathes', name: 'Crathes', region: 'Aberdeenshire',
    centre: [-2.4144871, 57.0580342], radius: 520, score: 48, dogRating: 2,
    character: 'Small Deeside village',
    summary: 'A recognisable village with Deeside character and useful route connections, but insufficient independent depth for town-map publication.',
    rationale: 'Crathes Castle, Garden & Estate is a major separate attraction and is explicitly excluded from the village score.',
    sources: [durrisCommunity, osmCopyright],
    standalone: {
      id: 'crathes-castle-garden-estate', name: 'Crathes Castle, Garden & Estate', score: 91,
      coordinates: [-2.4397827, 57.0615127], featureType: 'castle',
      description: 'A substantial 16th-century castle, famous walled garden, café and estate trails managed by the National Trust for Scotland.',
      tagline: 'Castle, garden and estate trails', time: '3–5 hours',
      opening: 'Castle, garden, shop and Café 1702 daily 10:00–17:00 from 1 April to 31 October; grounds dawn–dusk year-round.',
      admission: 'Adult £18; concession £14; family £40.50; National Trust for Scotland members free.', url: crathesCastle,
      dogRating: 2, showInTownGuide: false,
    },
  },
  {
    id: 'kirkton-of-durris-scotland', requestedName: 'Kirkton of Durris', name: 'Kirkton of Durris', region: 'Aberdeenshire',
    centre: [-2.3756862, 57.0558627], radius: 380, score: 39, dogRating: 1,
    character: 'Historic Durris kirkton',
    summary: 'A small historic church-centred settlement with attractive rural context but limited visitor infrastructure.',
    rationale: 'The kirkton is retained on its own modest heritage character; Durris Forest and Deeside attractions are separate visitor places.',
    sources: [durrisCommunity, osmCopyright],
  },
  {
    id: 'woodlands-of-durris-scotland', requestedName: 'Woodlands', name: 'Woodlands of Durris', region: 'Aberdeenshire',
    centre: [-2.3507393, 57.0519686], radius: 320, score: 30, dogRating: 1,
    character: 'Scattered Durris settlement',
    summary: 'A small rural settlement with local identity but no verified town-scale visitor offer.',
    rationale: 'The generic request is resolved to Woodlands of Durris. Nearby forest recreation is not used to inflate the settlement score.',
    sources: [durrisCommunity, osmCopyright],
  },
  {
    id: 'crossroads-durris-scotland', requestedName: 'Crossroads', name: 'Crossroads', region: 'Aberdeenshire',
    centre: [-2.4130688, 57.0382474], radius: 280, score: 24, dogRating: 1,
    character: 'Small Durris hamlet',
    summary: 'A mapped hamlet and road junction with local services but no independent visitor experience.',
    rationale: 'The request is resolved to Crossroads in Durris, not other Scottish namesakes; surrounding countryside and attractions remain separate.',
    sources: [durrisCommunity, osmCopyright],
  },
  {
    id: 'lochton-durris-scotland', requestedName: 'Lockton', name: 'Lochton', region: 'Aberdeenshire',
    centre: [-2.4097285, 57.0212667], radius: 260, score: 18, dogRating: 1,
    character: 'Small Durris hamlet',
    summary: 'A scattered rural hamlet without a verified independent visitor offer.',
    rationale: 'The supplied spelling is normalised to Lochton, the Durris locality. It remains selectable but below the tourist-town threshold.',
    sources: [durrisCommunity, osmCopyright],
  },
];

function studyBoundary(centre: [number, number], radius: number): Feature<Polygon> {
  return buffer(point(centre), radius, { units: 'metres', steps: 48 }) as Feature<Polygon>;
}

function trailFeature(seed: SettlementSeed): HeritageFeature | undefined {
  if (!seed.trail) return undefined;
  const trail = seed.trail;
  const values = {
    experienceDepth: 22,
    distinctiveness: 13,
    presentation: 14,
    journeyWorth: 9,
    accessAndReliability: 9,
    evidenceConfidence: trail.score - 67,
    visitability: 'full_visitor_experience' as const,
  };
  return {
    id: `curated-trails:${trail.id}`,
    projectId: seed.id,
    name: trail.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: seed.region,
    locality: seed.name,
    featureType: 'walking_route',
    significance: 'local',
    geometry: { type: 'Point', coordinates: trail.coordinates },
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'unknown',
    shortDescription: trail.description,
    sourceRecords: [{
      sourceName: trail.name,
      sourceOrganisation: seed.region === 'Aberdeen City' ? 'Aberdeen City Council' : 'Aberdeenshire Council',
      sourceUrl: trail.url,
      accessedAt: createdAt,
      reliability: 'local_authority',
      notes: `Current-place curation: visitor_place_type=Walking route; route=foot; trail_score=${trail.score}; opening_hours:description=${trail.opening}; entrance_fee=${trail.admission}; description=${trail.description}`,
    }],
    tags: ['curated-visitor', 'visitor-context-trail', 'current-context'],
    createdAt,
    updatedAt: createdAt,
    reviewed: true,
    evidenceScope: 'parish_evidence',
    visitorWebsiteUrl: trail.url,
    editorialReview: {
      status: 'editorially_researched',
      category: 'trail',
      methodVersion: '2026-08-13-researched-visitor-value-v1',
      reviewedAt,
      scoreRationale: trail.description,
      evidenceUrls: [trail.url],
      attractionAssessment: values,
    },
  };
}

function standaloneFeature(seed: SettlementSeed): HeritageFeature | undefined {
  if (!seed.standalone) return undefined;
  const item = seed.standalone;
  const experienceDepth = Math.round(item.score * 0.3);
  const distinctiveness = Math.round(item.score * 0.2);
  const presentation = Math.round(item.score * 0.2);
  const journeyWorth = Math.round(item.score * 0.15);
  const accessAndReliability = Math.round(item.score * 0.1);
  return {
    id: `curated-attraction:${item.id}`,
    projectId: seed.id,
    name: item.name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    region: seed.region,
    locality: seed.name,
    featureType: item.featureType,
    significance: item.score >= 80 ? 'regional' : 'local',
    geometry: { type: 'Point', coordinates: item.coordinates },
    locationType: 'exact',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: item.description,
    sourceRecords: [{
      sourceName: item.name,
      sourceOrganisation: item.url.includes('nts.org.uk') ? 'National Trust for Scotland' : 'Aberdeenshire Council',
      sourceUrl: item.url,
      accessedAt: createdAt,
      reliability: item.url.includes('nts.org.uk') ? 'official_non_statutory' : 'local_authority',
      notes: `Current-place curation: visitor_place_type=Attraction; visit_score=${item.score}; time_to_spend=${item.time}; opening_hours:description=${item.opening}; entrance_fee=${item.admission}; description=${item.tagline}: ${item.description}`,
    }],
    tags: ['curated-visitor', 'home-standalone-place', 'current-context'],
    homeMapEligible: true,
    createdAt,
    updatedAt: createdAt,
    reviewed: true,
    evidenceScope: 'related_context',
    visitorWebsiteUrl: item.url,
    editorialReview: {
      status: 'editorially_researched',
      category: 'attraction',
      methodVersion: '2026-08-13-researched-visitor-value-v1',
      reviewedAt,
      scoreRationale: `${item.name} is separately published and contributes no points to ${seed.name}'s settlement score.`,
      evidenceUrls: [item.url],
      attractionAssessment: {
        experienceDepth,
        distinctiveness,
        presentation,
        journeyWorth,
        accessAndReliability,
        evidenceConfidence: item.score - experienceDepth - distinctiveness - presentation - journeyWorth - accessAndReliability,
        visitability: 'full_visitor_experience',
      },
    },
  };
}

function packageFor(seed: SettlementSeed): ProjectPackage {
  const boundary = studyBoundary(seed.centre, seed.radius);
  const band = townScoreBand(seed.score);
  const features = [trailFeature(seed), standaloneFeature(seed)].filter(
    (feature): feature is HeritageFeature => Boolean(feature),
  );
  const standalone = seed.standalone?.showInTownGuide
    ? features.find((feature) => feature.id === `curated-attraction:${seed.standalone!.id}`)
    : undefined;
  const visitorHighlights: VisitorHighlight[] = standalone && seed.standalone ? [{
    rank: 1,
    featureId: standalone.id,
    name: seed.standalone.name,
    reason: seed.standalone.description,
    tagline: seed.standalone.tagline,
    visitorScore: seed.standalone.score,
    timeToSpend: seed.standalone.time,
    openingTimes: seed.standalone.opening,
    admission: seed.standalone.admission,
    freeAdmission: /^free\b/i.test(seed.standalone.admission),
    visitorWebsiteUrl: seed.standalone.url,
    editorialReview: standalone.editorialReview,
    sourceName: seed.standalone.name,
    sourceUrl: seed.standalone.url,
    verifiedInBoundaryAt: reviewedAt,
  }] : [];
  const adjustment = townDogAccessScoreAdjustment(seed.dogRating);
  const pkg: ProjectPackage = {
    project: {
      id: seed.id,
      name: seed.name,
      countryCode: 'GB-SCT',
      country: 'Scotland',
      region: seed.region,
      locality: seed.name,
      centre: seed.centre,
      boundary,
      boundarySource: `OpenStreetMap locality position with a conservative ${seed.radius}m editorial study buffer`,
      boundaryConfidence: 'low',
      sourceLanguage: 'English',
      preferredBasemap: 'maplibre-streets',
      createdAt,
      methodology: defaultMethodology,
      researchNotes: 'Retained in the regional catalogue. The score measures the settlement itself and does not transfer points from nearby standalone attractions.',
      touristAppeal: {
        score: seed.score,
        dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
        dogAccessScoreAdjustment: adjustment,
        rating: band.rating,
        label: band.label,
        summary: seed.summary,
        dogAccessRating: seed.dogRating,
        dogAccessSummary: seed.dogRating >= 2
          ? 'Public outdoor routes can form part of a dog visit, with ordinary close-control restrictions around roads, wildlife and shared spaces.'
          : 'No destination-scale dog visit or dedicated dog facilities are verified; use public routes responsibly.',
        methodVersion: '2026-08-27-strict-settlement-visitor-gate-v1',
        reviewedAt,
        sourceUrls: [...seed.sources, outdoorCode],
      },
      visitorHighlights,
      townGuide: {
        characterTag: seed.character,
        headline: seed.score >= 60
          ? 'A modest but coherent community heritage stop'
          : 'A recorded locality rather than a tourist destination',
        intro: seed.rationale,
        bestFor: seed.score >= 60 ? ['Local heritage trail', 'Green suburban walking'] : ['Regional reference'],
        perfectFor: seed.score >= 60
          ? ['A short self-guided local-history stop']
          : ['Identifying the locality while planning a wider route'],
        suggestedFirstVisit: seed.trail ? {
          title: `Follow the ${seed.trail.name}`,
          summary: seed.trail.description,
        } : undefined,
        dontMiss: seed.trail ? [seed.trail.name] : [],
        suggestedTime: seed.score >= 60 ? '1–2 hours' : 'Pass-through or local-purpose visit',
        visitorMood: seed.score >= 60
          ? 'Published at 60+ because the district itself supports a coherent trail-led visit.'
          : 'Kept in the selector for completeness, but deliberately absent from the tourist-town map below 60.',
        sourceUrls: seed.sources,
        lastReviewedAt: reviewedAt,
      },
      townStudyArea: {
        localityName: seed.name,
        sourceName: 'OpenStreetMap locality position with editorial buffer',
        sourceUrl: osmCopyright,
        sourceVersion: reviewedAt,
        bufferMetres: seed.radius,
        localityBoundary: boundary,
        bufferedBoundary: boundary,
        notes: 'Reference study area only; not an administrative boundary.',
      },
    },
    features,
    sources: [{
      id: `${seed.id}-locality`,
      name: `${seed.name} settlement review`,
      organisation: seed.region === 'Aberdeen City' ? 'Aberdeen City Council / OpenStreetMap contributors' : 'Aberdeenshire Council / OpenStreetMap contributors',
      coverage: seed.name,
      accessMethod: 'Mapped locality identification and source-backed editorial review',
      sourceUrl: seed.sources[0] ?? osmCopyright,
      licence: 'Source-linked editorial evidence; OpenStreetMap data under ODbL where used.',
      reliability: seed.sources[0]?.includes('council') ? 'local_authority' : 'secondary',
      limitations: 'The transparent study buffer is not an administrative boundary and does not imply public access.',
    }],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${seed.name} generated ${errors.length} validation errors.`);
  return pkg;
}

const packages = seeds.map(packageFor);
const protectedProjectIds = new Set([
  'bridge-of-don-aberdeen-scotland',
  'kintore-scotland',
  'kemnay-scotland',
  'monymusk-scotland',
  'peterculter-scotland',
  'fettercairn-scotland',
  'strachan-scotland',
  'potarch-scotland',
  'catterline-scotland',
  'stonehaven-scotland',
  'aberdeen-scotland',
  'old-aberdeen-scotland',
  'torry-aberdeen-scotland',
  'cove-bay-scotland',
  'kincorth-aberdeen-scotland',
  'findon-aberdeenshire-scotland',
  'muchalls-scotland',
  'banchory-scotland',
]);
for (const pkg of packages) {
  if (protectedProjectIds.has(pkg.project.id)) continue;
  await writeFile(
    resolve('data/projects', `${pkg.project.id.replace(/-scotland$/, '')}.json`),
    `${JSON.stringify(pkg, null, 2)}\n`,
    'utf8',
  );
}

const existingPlanner = JSON.parse(
  await readFile('data/aberdeen-north-visitor-planner-curation.json', 'utf8'),
) as { schemaVersion: number; projects: Record<string, Record<string, string[]>> };
const plannerProjects = {
  ...existingPlanner.projects,
  ...Object.fromEntries(seeds.filter((seed) => !protectedProjectIds.has(seed.id)).map((seed) => [
  seed.id,
  seed.trail ? { trails: [`curated-trails:${seed.trail.id}`] } : {},
  ])),
};
await writeFile(
  'data/aberdeen-north-visitor-planner-curation.json',
  `${JSON.stringify({ schemaVersion: 1, projects: plannerProjects }, null, 2)}\n`,
  'utf8',
);

const existingDog = JSON.parse(
  await readFile('data/aberdeen-north-dog-access-curation.json', 'utf8'),
) as { schemaVersion: number; reviewedAt: string; projects: Record<string, unknown> };
const dogProjects = {
  ...existingDog.projects,
  ...Object.fromEntries(seeds.filter((seed) => !protectedProjectIds.has(seed.id)).map((seed) => [
  seed.id,
  seed.trail || seed.standalone ? {
    attraction: {
      ...(seed.trail ? {
      [`curated-trails:${seed.trail.id}`]: {
        rating: 2,
        status: 'restricted',
        label: 'Public trail with urban close-control sections',
        summary: 'Dogs can accompany the public route, but use a short lead beside roads, wildlife, historic structures and busy shared spaces.',
        sourceName: 'Aberdeen City Council trail and Scottish Outdoor Access Code',
        sourceUrl: outdoorCode,
        reviewedAt,
      },
      } : {}),
      ...(seed.standalone ? {
        [`curated-attraction:${seed.standalone.id}`]: {
          rating: seed.standalone.dogRating,
          status: seed.standalone.dogRating === 3 ? 'welcoming' : 'restricted',
          label: seed.standalone.dogRating === 3 ? 'Strong outdoor dog visit' : 'Outdoor access with close control',
          summary: seed.standalone.dogRating === 3
            ? 'The council explicitly identifies dog owners among the park users; maintain responsible control around wildlife, horses, children and other visitors.'
            : 'Dogs can use responsible outdoor access, but keep close control around dunes, wildlife, tracks and other visitors.',
          sourceName: seed.standalone.name,
          sourceUrl: seed.standalone.dogRating === 3 ? seed.standalone.url : outdoorCode,
          reviewedAt,
        },
      } : {}),
    },
  } : {},
  ])),
};
await writeFile(
  'data/aberdeen-north-dog-access-curation.json',
  `${JSON.stringify({ schemaVersion: 1, reviewedAt, projects: dogProjects }, null, 2)}\n`,
  'utf8',
);

const assessments = [
  ...seeds.map((seed) => ({
    requestedName: seed.requestedName,
    resolvedName: seed.name,
    projectId: seed.id,
    score: seed.score,
    dogOwnerScore: townScoreAfterDogAccess(seed.score, seed.dogRating),
    publishOnTownMap: seed.score >= 60,
    rationale: seed.rationale,
    sourceUrls: seed.sources,
  })),
  {
    requestedName: 'Pottorton',
    resolvedName: 'Potterton (confirmed spelling correction)',
    projectId: 'potterton-scotland',
    score: 32,
    dogOwnerScore: townScoreAfterDogAccess(32, 1),
    publishOnTownMap: false,
    rationale: 'The supplied map confirms that Pottorton referred to Potterton, west of the A90 between Balmedie and Blackdog. Potterton is retained once at the verified settlement location.',
    sourceUrls: [aberdeenshireSettlements, osmCopyright],
  },
];
await writeFile(
  'data/review/aberdeen-north-settlement-gate-audit-2026-08-27.json',
  `${JSON.stringify({
    schemaVersion: 1,
    reviewedAt,
    requestedCount: 121,
    createdProjectCount: packages.length,
    townMapCount: packages.filter((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60).length,
    rule: 'Every resolved place remains selectable with its score; only settlements scoring 60 or more publish as town markers. Nearby attractions do not inflate settlement scores.',
    assessments,
    notes: [
      'Parkihill House was resolved to Parkhill House.',
      'Stoney Wood was resolved to Stoneywood.',
      'Pottorton was confirmed by the supplied map as a spelling correction to Potterton; one Potterton project is retained.',
      'Balbithan Ho was resolved to the private historic property Balbithan House.',
      'Cothall was resolved to Cothal, Wester Fintray to Wester Fintrae, and East Achronie to East Auchronie.',
      'Stoneywood and Bankhead were requested again and remain single existing catalogue entries.',
      'The completed Bridge of Don and Kintore projects, including their detailed planner and dog-access curation, are protected from this batch generator.',
      'Balmedie Country Park and Blackdog beach are treated as separate visitor places and do not make their settlements 60+ towns.',
      'Kenmay was resolved to Kemnay and Lyne of Skyne to Lyne of Skene.',
      'Dalmadily was resolved to the current mapped form Dalmadilly.',
      'Balbithan is retained as a hamlet distinct from the previously catalogued private Balbithan House.',
      'Cottown was resolved to the Kintore-district locality rather than other Aberdeenshire places of the same name.',
      'Dalmadilly Ponds are published separately in See and do not inflate the Dalmadilly settlement score.',
      'Moneymosk, Dunect, Garlogiue, Skene Ho and West Cullery were resolved to Monymusk, Dunecht, Garlogie, Skene House and West Cullerlie.',
      'Marionburgh was resolved to the Midmar locality, not the similarly named scheduled cairn in Moray.',
      'Benthout was resolved to Benthoul, which the current gazetteer places within Aberdeen City.',
      'Monymusk was the only settlement in the preceding west Aberdeenshire batch to clear 60 on its own town character and walkable heritage; private estates and nearby standalone monuments were not transferred into settlement scores.',
      'East Auchronie was already retained under the corrected spelling from the earlier East Achronie request and was not duplicated.',
      'Cairnie resolves to the AB32 locality south-west of Westhill, not the separate Cairnie near Huntly.',
      'Craigton resolves to the Peterculter locality, not the Glasgow or Angus namesakes.',
      'Peterculter clears 60 on its own coherent village heritage and path network; nearby standalone attractions do not contribute to its town score.',
      'Lockton was resolved to Lochton, Woodlands to Woodlands of Durris, and Woodside of Erbeadie to the historic Woodside of Arbeadie spelling.',
      'Only Banchory clears 60 in this batch. Drum Castle, Crathes Castle and Falls of Feugh are separately published attractions and do not inflate neighbouring settlement scores.',
      'Woodside, Bridge of Don and Mannofield were requested again and remain single existing records.',
      'Ruthrileston was normalised to the mapped Aberdeen district Ruthrieston.',
      'Charlestown resolves to the Nigg locality rather than other Scottish places of the same name.',
      'Aberdeen, Old Aberdeen, Torry, Cove Bay and Kincorth clear 60 on their own city, historic-quarter, maritime, coastal and hill-route visitor offers respectively.',
      'Kirknewton of Maryculter was resolved to Kirkton of Maryculter, Chapelston of Elsick to Chapelton of Elsick, Barrowfield to the mapped Aberdeenshire hamlet Borrowfield, and Denside to Denside of Durris.',
      'The malformed M\\<uirskie input was normalised to Muirskie; Mains of Drum resolves to the Drumoak-area hamlet and Union Cottage to the named property near Rickarton.',
      'All thirteen additions remain below 60 because none currently supports an independently verified destination-scale settlement visit. They remain available in the regional selector but do not publish as town markers.',
    ],
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Reviewed ${packages.length} settlement packages; ${packages.filter((pkg) => (pkg.project.touristAppeal?.score ?? 0) >= 60).length} qualify for the town map.`);
