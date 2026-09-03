import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson';
import type {
  DataSourceDefinition,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
  TownStudyArea,
} from '../src/domain/models';
import {
  bufferedTownBoundary,
  classifyTownPoint,
  type TownSelection,
} from '../src/domain/townStudy';
import { validateFeatures } from '../src/domain/validation';
import {
  localHesListedBuildingFiles,
  readReferenceData,
  referenceDatasets,
} from './lib/reference-data';

type AreaGeometry = Polygon | MultiPolygon;

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');
const BUFFER_METRES = 500;
const LOCALITY_BY_PROJECT: Record<string, string> = {
  'alloa-scotland': 'Alloa',
  'alva-scotland': 'Alva',
  'bathgate-scotland': 'Bathgate',
  'arbroath-scotland': 'Arbroath',
  'banchory-scotland': 'Banchory',
  'brechin-scotland': 'Brechin',
  'broxburn-and-uphall-scotland': 'Broxburn',
  'bridge-of-earn-scotland': 'Bridge of Earn',
  // NRS combines Culross with the neighbouring Valleyfield localities. The
  // project parish boundary clips the resulting town register to Culross.
  'culross-scotland': 'High Valleyfield, Low Valleyfield and Culross',
  'carnoustie-scotland': 'Carnoustie',
  'dunning-scotland': 'Dunning',
  'findon-aberdeenshire-scotland': 'Findon',
  'forfar-scotland': 'Forfar',
  'kincardine-on-forth-scotland': 'Kincardine',
  'gourock-scotland': 'Gourock',
  'kirknewton-scotland': 'Kirknewton',
  'kirriemuir-scotland': 'Kirriemuir',
  'linlithgow-scotland': 'Linlithgow',
  'livingston-scotland': 'Livingston',
  'monymusk-scotland': 'Monymusk',
  'monifieth-scotland': 'Monifieth',
  'montrose-scotland': 'Montrose',
  'muchalls-scotland': 'Muchalls',
  'south-queensferry-scotland': 'South Queensferry',
  'stonehaven-scotland': 'Stonehaven',
  'torphichen-scotland': 'Torphichen',
  'tillicoultry-scotland': 'Tillicoultry',
  'whitburn-scotland': 'Whitburn',
  'quarriers-village-scotland': "Quarrier's Village",
  'biggar-scotland': 'Biggar',
  'killin-scotland': 'Killin',
};

// Some visitor-guide places are recognisable districts rather than separate
// NRS statistical localities. For those projects the transparent editorial
// boundary is the strict publication area, with the same 500 m heritage buffer
// used by locality-backed projects. Do not substitute the much larger parent
// city locality, which would incorrectly attribute city-centre heritage.
const PROJECT_BOUNDARY_STUDY_AREAS = new Set([
  'crail-scotland',
  'kilrenny-scotland',
  'anstruther-scotland',
  'pittenweem-scotland',
  'st-monans-scotland',
  'elie-scotland',
  'earlsferry-scotland',
  'kilconquhar-scotland',
  'pitcorthie-kilrenny-scotland',
  'pitkierie-scotland',
  'ardross-fife-scotland',
  'balchrystie-scotland',
  'abercrombie-fife-scotland',
  'arncroach-scotland',
  'carnbee-scotland',
  'kingsmuir-fife-scotland',
  'lochty-fife-scotland',
  'radernie-scotland',
  'lathones-scotland',
  'largoward-scotland',
  'colinsburgh-scotland',
  'kincaple-scotland',
  'peat-inn-scotland',
  'newpark-st-andrews-scotland',
  'balone-scotland',
  'denhead-st-andrews-scotland',
  'st-andrews-scotland',
  'prior-muir-scotland',
  'brownhills-st-andrews-scotland',
  'boarhills-scotland',
  'kingsbarns-scotland',
  'balcomie-scotland',
  'craighead-crail-scotland',
  'dunino-scotland',
  'stravithie-scotland',
  'scotscraig-scotland',
  'tayport-scotland',
  'rhynd-fife-scotland',
  'carrick-leuchars-scotland',
  'leuchars-scotland',
  'guardbridge-scotland',
  'lundin-links-scotland',
  'leven-fife-scotland',
  'kingskettle-scotland',
  'balmalcolm-scotland',
  'kettlebridge-scotland',
  'kettlehill-scotland',
  'montrave-scotland',
  'rameldry-mill-bank-scotland',
  'langdyke-fife-scotland',
  'muirhead-freuchie-scotland',
  'kennoway-scotland',
  'bonnybank-scotland',
  'scoonie-scotland',
  'balcurvie-scotland',
  'windygates-scotland',
  'milton-of-balgonie-scotland',
  'markinch-scotland',
  'auchenblae-scotland',
  'monboddo-house-scotland',
  'mondynes-scotland',
  'brownmuir-fordoun-scotland',
  'fordoun-scotland',
  'parkneuk-arbuthnott-scotland',
  'arbuthnott-scotland',
  'scotston-laurencekirk-scotland',
  'garvock-laurencekirk-scotland',
  'redford-garvock-scotland',
  'tulloch-garvock-scotland',
  'pitforthie-fordoun-scotland',
  'roadside-of-catterline-scotland',
  'kinneff-scotland',
  'mains-of-allardice-scotland',
  'inverbervie-scotland',
  'gourdon-aberdeenshire-scotland',
  'sauchieburn-scotland',
  'luthermuir-scotland',
  'north-water-bridge-scotland',
  'edzell-scotland',
  'pert-angus-scotland',
  'marykirk-scotland',
  'craigo-angus-scotland',
  'logie-craigo-scotland',
  'hillside-montrose-scotland',
  'kirkhill-montrose-scotland',
  'dun-angus-scotland',
  'brechin-scotland',
  'keithock-scotland',
  'logie-pert-scotland',
  'muirton-of-ballochy-scotland',
  'dykelands-scotland',
  'benholm-scotland',
  'johnshaven-scotland',
  'st-cyrus-scotland',
  'ecclesgreig-scotland',
  'lochside-st-cyrus-scotland',
  'morphie-scotland',
  'pathhead-st-cyrus-scotland',
  'montrose-scotland',
  'inchbraoch-scotland',
  'ferryden-scotland',
  'kirkton-of-craig-scotland',
  'dunninald-scotland',
  'fishtown-of-usan-scotland',
  'braehead-of-lunan-scotland',
  'bridge-of-dun-scotland',
  'barnhead-angus-scotland',
  'bonnyton-barnhead-scotland',
  'carcary-scotland',
  'westerton-of-rossie-scotland',
  'lunan-scotland',
  'redcastle-angus-scotland',
  'bolshan-scotland',
  'friockheim-scotland',
  'boysack-scotland',
  'inverkeilor-scotland',
  'ethie-mains-scotland',
  'ethie-castle-scotland',
  'drunkendub-scotland',
  'auchmithie-scotland',
  'marywell-arbroath-scotland',
  'hayshead-arbroath-scotland',
  'cliffburn-arbroath-scotland',
  'arbroath-scotland',
  'elliot-arbroath-scotland',
  'st-vigeans-scotland',
  'letham-grange-scotland',
  'cauldcots-scotland',
  'leysmill-scotland',
  'chapeltown-inverkeilor-scotland',
  'salmonds-muir-scotland',
  'craigton-of-monikie-scotland',
  'muirdrum-scotland',
  'east-haven-scotland',
  'panbride-scotland',
  'carnoustie-scotland',
  'newbigging-monifieth-scotland',
  'barry-angus-scotland',
  'mains-of-ardestie-scotland',
  'monifieth-scotland',
  'wellbank-scotland',
  'drumsturdy-scotland',
  'kellas-angus-scotland',
  'baldovie-dundee-scotland',
  'barnhill-dundee-scotland',
  'west-ferry-dundee-scotland',
  'broughty-ferry-scotland',
  'bucklerheads-scotland',
  'east-march-angus-scotland',
  'tealing-scotland',
  'kirkton-dundee-scotland',
  'muir-of-pert-tealing-scotland',
  'inveraldie-scotland',
  'burnside-of-duntrune-scotland',
  'fintry-dundee-scotland',
  'douglas-and-angus-dundee-scotland',
  'craigie-dundee-scotland',
  'stannergate-dundee-scotland',
  'dundee-scotland',
  'coldstream-tealing-scotland',
  'bonnyton-auchterhouse-scotland',
  'kirkton-of-auchterhouse-scotland',
  'leoch-auchterhouse-scotland',
  'bridgefoot-angus-scotland',
  'downfield-dundee-scotland',
  'birkhill-angus-scotland',
  'muirhead-angus-scotland',
  'dronley-angus-scotland',
  'fowlis-easter-scotland',
  'liff-scotland',
  'denhead-of-gray-scotland',
  'benvie-scotland',
  'longforgan-scotland',
  'castle-huntly-scotland',
  'invergowrie-scotland',
  'kingoodie-scotland',
  'woodhaven-fife-scotland',
  'glenduckie-scotland',
  'luthrie-scotland',
  'moonzie-scotland',
  'kilmaron-castle-scotland',
  'lindifferon-scotland',
  'fernie-castle-scotland',
  'letham-fife-scotland',
  'bow-of-fife-scotland',
  'cupar-muir-scotland',
  'cupar-scotland',
  'craigrothie-scotland',
  'pitlessie-scotland',
  'springfield-fife-scotland',
  'ladybank-scotland',
  'east-cairnbeg-scotland',
  'thainston-scotland',
  'mains-of-balnakettle-scotland',
  'bent-laurencekirk-scotland',
  'laurencekirk-scotland',
  'mains-of-thornton-laurencekirk-scotland',
  'meikle-strath-scotland',
  'inch-of-arnhall-scotland',
  'dunnichen-scotland',
  'letham-angus-scotland',
  'pitmuies-scotland',
  'idvies-scotland',
  'tulloes-scotland',
  'mosston-angus-scotland',
  'redford-carmyllie-scotland',
  'greystone-angus-scotland',
  'hayhillock-scotland',
  'carmyllie-scotland',
  'denhead-of-arbirlot-scotland',
  'balmirmer-scotland',
  'monikie-scotland',
  'kirkton-of-monikie-scotland',
  'caldhame-scotland',
  'kingsmuir-scotland',
  'muir-of-lownie-scotland',
  'craichie-scotland',
  'whigstreet-scotland',
  'kirkbuddo-scotland',
  'gallowfauld-scotland',
  'inverarity-scotland',
  'gateside-inverarity-scotland',
  'wester-foffarty-scotland',
  'kirkton-glamis-scotland',
  'thornton-glamis-scotland',
  'douglastown-angus-scotland',
  'ruthven-house-angus-scotland',
  'leys-of-cossans-scotland',
  'glamis-scotland',
  'charleston-glamis-scotland',
  'castleton-of-eassie-scotland',
  'balkeerie-scotland',
  'kirkinch-scotland',
  'eassie-scotland',
  'wester-denoon-scotland',
  'nether-handwick-scotland',
  'newtyle-scotland',
  'careston-castle-scotland',
  'aldbar-castle-scotland',
  'netherton-melgund-scotland',
  'mains-of-melgund-scotland',
  'aberlemno-scotland',
  'pitkennedy-scotland',
  'turin-angus-scotland',
  'rescobie-scotland',
  'reswallie-scotland',
  'burnside-rescobie-scotland',
  'balgavies-scotland',
  'milldens-scotland',
  'middle-drums-scotland',
  'dubton-guthrie-scotland',
  'glasterlaw-scotland',
  'guthrie-angus-scotland',
  'kinnell-angus-scotland',
  'bridge-of-don-aberdeen-scotland',
  'findon-aberdeenshire-scotland',
  'monymusk-scotland',
  'muchalls-scotland',
  'peterculter-scotland',
  'rickarton-scotland',
  'cowie-stonehaven-scotland',
  'fiddes-scotland',
  'carmont-scotland',
  'tewel-scotland',
  'mergie-scotland',
  'tannachie-scotland',
  'newmill-carmont-scotland',
  'mains-of-dellavaird-scotland',
  'glenbervie-scotland',
  'drumlithie-scotland',
  'glenfarquhar-lodge-scotland',
  'keig-scotland',
  'castle-forbes-scotland',
  'upper-woodend-scotland',
  'rorandle-scotland',
  'pitfichie-scotland',
  'gateside-keig-scotland',
  'pitmunie-scotland',
  'todlachie-scotland',
  'ordhead-scotland',
  'tillyfourie-scotland',
  'kirkton-of-tough-scotland',
  'whitehouse-tough-scotland',
  'tullynessle-scotland',
  'montgarrie-scotland',
  'bridge-of-alford-scotland',
  'auchintoul-alford-scotland',
  'alford-aberdeenshire-scotland',
  'asloun-scotland',
  'hillockhead-glenkindie-scotland',
  'ley-glenkindie-scotland',
  'little-lynturk-scotland',
  'bridgend-muir-of-fowlis-scotland',
  'tillyfour-tough-scotland',
  'muir-of-fowlis-scotland',
  'leochel-cushnie-scotland',
  'milton-of-cushnie-scotland',
  'mossat-scotland',
  'rinmore-glenkindie-scotland',
  'kildrummy-scotland',
  'sinnahard-scotland',
  'milltown-of-towie-scotland',
  'towie-scotland',
  'glenkindie-scotland',
  'boultenstone-scotland',
  'migvie-scotland',
  'easter-davoch-scotland',
  'douneside-scotland',
  'tarland-scotland',
  'coynach-scotland',
  'logie-coldstone-scotland',
  'milton-of-logie-scotland',
  'glendavan-house-scotland',
  'ordie-scotland',
  'kintocher-scotland',
  'findrack-house-scotland',
  'lumphanan-scotland',
  'craskins-scotland',
  'milton-of-auchinhove-scotland',
  'auchlossan-scotland',
  'milton-of-corsindae-scotland',
  'bankhead-midmar-scotland',
  'corsindae-scotland',
  'comers-midmar-scotland',
  'drumlasie-scotland',
  'tillybirloch-scotland',
  'milton-of-campfield-scotland',
  'torphins-scotland',
  'mid-beltie-scotland',
  'midmar-scotland',
  'dinnet-scotland',
  'glen-tanar-house-scotland',
  'aboyne-scotland',
  'birsemore-scotland',
  'birse-scotland',
  'kincardine-oneil-scotland',
  'marywell-birse-scotland',
  'finzean-scotland',
  'percie-scotland',
  'ballochan-scotland',
  'tillydrine-scotland',
  'brathens-scotland',
  'backhill-of-trustach-scotland',
  'bridge-of-canny-scotland',
  'east-mains-banchory-scotland',
  'arbeadie-scotland',
  'auchattie-scotland',
  'belts-of-collonach-scotland',
  'tillygarmond-scotland',
  'invermark-lodge-scotland',
  'auchronie-glenesk-scotland',
  'cairncross-glenesk-scotland',
  'drumtochty-castle-scotland',
  'clova-angus-scotland',
  'wheen-angus-scotland',
  'inchgrundle-scotland',
  'tarfside-scotland',
  'huntlyhill-scotland',
  'millden-lodge-scotland',
  'auchmull-scotland',
  'dalbog-scotland',
  'gannochy-angus-scotland',
  'witton-angus-scotland',
  'glenprosen-lodge-scotland',
  'kilburn-angus-scotland',
  'balnaboth-scotland',
  'prosen-village-scotland',
  'easter-lednathie-scotland',
  'rottal-scotland',
  'clachnabrain-scotland',
  'horniehaugh-scotland',
  'dykehead-glen-prosen-scotland',
  'glenmoy-angus-scotland',
  'glenquiech-scotland',
  'glenogil-scotland',
  'auchnacree-scotland',
  'ogil-angus-scotland',
  'fern-angus-scotland',
  'newmill-of-inshewan-scotland',
  'bridgend-menmuir-scotland',
  'balfield-angus-scotland',
  'dunlappie-scotland',
  'tillyarblet-scotland',
  'kirkton-of-menmuir-scotland',
  'tigerton-scotland',
  'mains-of-balhall-scotland',
  'lochty-menmuir-scotland',
  'belliehill-scotland',
  'little-brechin-scotland',
  'west-muir-little-brechin-scotland',
  'newtonmill-inchbare-scotland',
  'inchbare-scotland',
  'pearsie-scotland',
  'cortachy-scotland',
  'balloch-rottal-scotland',
  'kirkton-of-kingoldrum-scotland',
  'kinnordy-scotland',
  'northmuir-scotland',
  'mains-of-ballindarg-scotland',
  'westmuir-kirriemuir-scotland',
  'kirkton-of-airlie-scotland',
  'memus-scotland',
  'tannadice-scotland',
  'inverquharity-scotland',
  'murthill-scotland',
  'finavon-scotland',
  'oathlaw-scotland',
  'shielhill-memus-scotland',
  'carse-gray-scotland',
  'mosside-ballinshoe-scotland',
  'lunanhead-scotland',
  'forfar-scotland',
  'padanaram-scotland',
  'drumgley-scotland',
]);

type SpatialFeature = Feature<AreaGeometry, Record<string, unknown>>;
interface HESAttributes {
  ENT_REF?: number | string;
  ENT_TITLE?: string;
  DES_REF?: string;
  DES_TITLE?: string;
  DES_TYPE?: string;
  CATEGORY?: string;
  LINK?: string;
  PRECISION?: string;
  ACCURACY?: string;
  DESIGNATED?: string | Date | null;
  UPDATED?: string | Date | null;
}
type HESPoint = Feature<Point, HESAttributes>;
type ShapeCollection = { features: Array<Feature> };

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}
function dateText(value: string | Date | null | undefined): string | undefined {
  if (!value || Number.isNaN(new Date(value).valueOf())) return undefined;
  return new Date(value).toISOString().slice(0, 10);
}
function designationReference(record: HESPoint): string {
  const reference = record.properties.DES_REF ?? record.properties.ENT_REF;
  if (!reference) throw new Error('HES listed-building point has no designation reference.');
  return String(reference);
}
function sourceRecord(record: HESPoint, accessedAt: string): SourceRecord {
  const attributes = record.properties;
  const designated = dateText(attributes.DESIGNATED);
  return {
    sourceName: 'Historic Environment Scotland Listed Buildings spatial data',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: designationReference(record),
    sourceUrl: attributes.LINK,
    accessedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    notes: [
      `Location precision: ${attributes.PRECISION ?? 'not stated'}.`,
      attributes.ACCURACY ?? 'Accuracy not stated.',
      designated ? `Designation date: ${designated}.` : undefined,
    ]
      .filter(Boolean)
      .join(' '),
    reliability: 'official_statutory',
  };
}
function mergeSourceRecords(existing: SourceRecord[], incoming: SourceRecord): SourceRecord[] {
  return [
    ...existing.filter(
      (source) =>
        !(
          source.sourceOrganisation === incoming.sourceOrganisation &&
          source.sourceRecordId === incoming.sourceRecordId
        ),
    ),
    incoming,
  ];
}
function mergeAllSourceRecords(existing: SourceRecord[], incoming: SourceRecord[]): SourceRecord[] {
  return incoming.reduce((merged, source) => mergeSourceRecords(merged, source), existing);
}
function selectionTag(selection: TownSelection): string {
  return `town-selection-${selection.replaceAll('_', '-')}`;
}
function applySelectionTags(tags: string[], selection: TownSelection): string[] {
  return [
    ...new Set([
      ...tags.filter((tag) => !tag.startsWith('town-selection-')),
      'hes-listed-building',
      selectionTag(selection),
    ]),
  ];
}
function candidateSelection(
  record: HESPoint,
  pkg: ProjectPackage,
  locality: Feature<AreaGeometry>,
  bufferedLocality: Feature<AreaGeometry>,
): TownSelection {
  return classifyTownPoint(record.geometry, locality, bufferedLocality);
}
async function spatialCollections(key: 'hesListedBuildings' | 'nrsLocalities2022') {
  Object.assign(globalThis, { self: globalThis });
  const { default: shp } = await import('shpjs');
  if (key === 'hesListedBuildings') {
    const localFiles = await localHesListedBuildingFiles();
    if (localFiles) {
      // @types/shpjs exposes ZIP input only, although shpjs also supports the
      // documented multi-file Shapefile bundle used here.
      const localBundle = {
        shp: await readFile(localFiles.shp),
        dbf: await readFile(localFiles.dbf),
        prj: await readFile(localFiles.prj, 'utf8'),
        cpg: await readFile(localFiles.cpg, 'utf8'),
      };
      const parsed = (await shp(localBundle as unknown as Buffer)) as
        ShapeCollection | ShapeCollection[];
      return Array.isArray(parsed) ? parsed : [parsed];
    }
  }
  const parsed = (await shp(await readReferenceData(key))) as ShapeCollection | ShapeCollection[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const localityName = LOCALITY_BY_PROJECT[pkg.project.id];
const usesProjectBoundary = PROJECT_BOUNDARY_STUDY_AREAS.has(pkg.project.id) && !localityName;
if (!localityName && !usesProjectBoundary)
  throw new Error(`No NRS locality configuration is registered for ${pkg.project.id}.`);

const locality = usesProjectBoundary
  ? ({
      type: 'Feature',
      properties: { name: pkg.project.locality, code: 'editorial-district-boundary' },
      geometry: pkg.project.boundary.geometry,
    } satisfies SpatialFeature)
  : (await spatialCollections('nrsLocalities2022'))
      .flatMap((collection) => collection.features)
      .find(
        (feature): feature is SpatialFeature =>
          (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
          normalise(String(feature.properties?.name ?? '')) === normalise(localityName!),
      );
if (!locality) throw new Error(`NRS 2022 locality '${localityName}' was not found.`);
const localityBoundary: Feature<AreaGeometry> = {
  type: 'Feature',
  properties: locality.properties ?? {},
  geometry: locality.geometry,
};
const bufferedBoundary = bufferedTownBoundary(localityBoundary, BUFFER_METRES);
const studyArea: TownStudyArea = {
  localityName: localityName ?? pkg.project.locality,
  localityCode: String(locality.properties?.code ?? ''),
  sourceName: usesProjectBoundary
    ? pkg.project.boundarySource
    : 'National Records of Scotland 2022 Census Locality Boundaries',
  sourceUrl: usesProjectBoundary
    ? pkg.sources.find((item) => item.id === 'bridge-of-don-council-trail')?.sourceUrl ??
      pkg.project.touristAppeal?.sourceUrls?.[0] ??
      'https://www.openstreetmap.org/copyright'
    : referenceDatasets.nrsLocalities2022.sourceUrl,
  sourceVersion: usesProjectBoundary ? 'Visitor-guide editorial boundary, reviewed 2026-08-27' : '2022 Census Geography Products',
  bufferMetres: BUFFER_METRES,
  localityBoundary,
  bufferedBoundary,
  visitorBoundary: pkg.project.townStudyArea?.visitorBoundary,
  notes:
    usesProjectBoundary
      ? `${pkg.project.locality} has no separate NRS locality polygon in the reference dataset. The published editorial boundary is therefore the strict heritage study area; the 500 m ring is context only.`
      : pkg.project.id === 'culross-scotland'
      ? 'NRS publishes Culross in a combined locality with High Valleyfield and Low Valleyfield. The Culross civil-parish project boundary clips the town listed-building extract.'
      : 'Modern statistical locality used only for the town listed-building register; it is not a historic boundary or a replacement for the project study boundary.',
};

const hesCollections = await spatialCollections('hesListedBuildings');
const hesPoints = hesCollections
  .flatMap((collection) => collection.features)
  .filter(
    (feature): feature is HESPoint =>
      feature.geometry.type === 'Point' && Boolean((feature.properties as HESAttributes).DES_REF),
  );
const selectedByReference = new Map<string, { selection: TownSelection; points: HESPoint[] }>();
for (const record of hesPoints) {
  const selection = candidateSelection(record, pkg, localityBoundary, bufferedBoundary);
  if (selection === 'excluded') continue;
  const reference = designationReference(record);
  const current = selectedByReference.get(reference);
  const strongest =
    current?.selection === 'inside_locality' || selection === 'inside_locality'
      ? 'inside_locality'
      : 'heritage_buffer';
  selectedByReference.set(reference, {
    selection: strongest,
    points: [...(current?.points ?? []), record],
  });
}

const accessedAt = new Date().toISOString();
let added = 0;
let refreshed = 0;
let bufferCandidates = 0;
const redundantDirectFeatureIds = new Set<string>();
for (const [reference, selected] of selectedByReference) {
  const record = selected.points[0];
  const attributes = record.properties;
  const additionalPointLocations = selected.points
    .slice(1)
    .map((item) => item.geometry)
    .filter(
      (location, index, locations) =>
        !locations
          .slice(0, index)
          .some(
            (candidate) =>
              candidate.coordinates[0] === location.coordinates[0] &&
              candidate.coordinates[1] === location.coordinates[1],
          ),
    );
  const matches = pkg.features.filter(
    (feature) =>
      feature.id === `hes-listed-building:${reference}` ||
      feature.sourceRecords.some(
        (source) =>
          source.sourceOrganisation === 'Historic Environment Scotland' &&
          source.sourceRecordId === reference,
      ),
  );
  // Prefer a curated counterpart because that is where reviewed dates and
  // descriptions live. Only the direct, generated HES feature may be removed;
  // two curated records can legitimately cite the same historic reference.
  const current =
    matches.find((feature) => feature.id.startsWith('curated:')) ??
    matches.find((feature) => feature.id === `hes-listed-building:${reference}`) ??
    matches[0];
  const source = sourceRecord(record, accessedAt);
  const common = {
    designationType: attributes.DES_TYPE ?? 'Listed Building',
    designationCategory: attributes.CATEGORY ? `Category ${attributes.CATEGORY}` : undefined,
    statutoryStatus: 'Listed Building',
    geometry: record.geometry,
    additionalPointLocations: additionalPointLocations.length
      ? additionalPointLocations
      : undefined,
    locationType: 'representative_point',
    locationConfidence:
      attributes.PRECISION === 'Within 10m' ? ('high' as const) : ('medium' as const),
    sourceRecords: mergeSourceRecords(current?.sourceRecords ?? [], source),
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    tags: applySelectionTags(current?.tags ?? [], selected.selection),
    updatedAt: accessedAt,
  };
  if (current) {
    Object.assign(current, common, {
      name: current.name || attributes.ENT_TITLE || attributes.DES_TITLE || reference,
      alternativeNames: [
        ...new Set([
          ...current.alternativeNames,
          ...selected.points
            .map((point) => point.properties.ENT_TITLE || point.properties.DES_TITLE)
            .filter((name): name is string => Boolean(name) && name !== current.name),
        ]),
      ],
      evidenceScope:
        selected.selection === 'heritage_buffer' &&
        !current.tags.includes('town-selection-manual-included')
          ? 'related_context'
          : current.evidenceScope,
      reviewNotes:
        selected.selection === 'heritage_buffer'
          ? `${current.reviewNotes ? `${current.reviewNotes} ` : ''}Within the 500m town heritage buffer; review before treating it as a town listed-building record.`
          : current.reviewNotes,
    });
    for (const duplicate of matches) {
      if (duplicate.id === current.id || !duplicate.id.startsWith('hes-listed-building:')) continue;
      current.sourceRecords = mergeAllSourceRecords(current.sourceRecords, duplicate.sourceRecords);
      current.tags = [...new Set([...current.tags, ...duplicate.tags])];
      redundantDirectFeatureIds.add(duplicate.id);
    }
    refreshed += 1;
  } else {
    const feature: HeritageFeature = {
      id: `hes-listed-building:${reference}`,
      projectId: pkg.project.id,
      name: attributes.ENT_TITLE || attributes.DES_TITLE || `HES record ${reference}`,
      alternativeNames: [
        ...new Set(
          selected.points
            .map((point) => point.properties.ENT_TITLE || point.properties.DES_TITLE)
            .filter((name): name is string => Boolean(name) && name !== attributes.ENT_TITLE),
        ),
      ],
      countryCode: pkg.project.countryCode,
      region: pkg.project.region,
      locality: pkg.project.locality,
      featureType: 'other',
      significance: attributes.CATEGORY === 'A' ? 'highest_national' : 'national',
      ...common,
      dateBasis: 'unknown',
      dateConfidence: 'unknown',
      survival: 'unknown',
      shortDescription: attributes.DES_TITLE,
      createdAt: accessedAt,
      reviewed: false,
      reviewNotes:
        selected.selection === 'heritage_buffer'
          ? 'Within the 500m town heritage buffer; review before treating it as a town listed-building record.'
          : 'Imported from the HES national Listed Buildings spatial data. Statutory listing and location are authoritative; construction-date review remains separate.',
      evidenceScope:
        selected.selection === 'heritage_buffer' ? 'related_context' : 'parish_evidence',
    };
    pkg.features.push(feature);
    added += 1;
  }
  if (selected.selection === 'heritage_buffer') bufferCandidates += 1;
}
if (redundantDirectFeatureIds.size)
  pkg.features = pkg.features.filter((feature) => !redundantDirectFeatureIds.has(feature.id));

const source: DataSourceDefinition = {
  id: 'hes-listed-buildings',
  name: 'Historic Environment Scotland Listed Buildings spatial data',
  organisation: 'Historic Environment Scotland',
  coverage: `${pkg.project.locality} ${usesProjectBoundary ? 'editorial district' : 'NRS locality'} plus ${BUFFER_METRES}m heritage buffer; buffer records are retained as related context`,
  accessMethod: (await localHesListedBuildingFiles())
    ? 'Developer-supplied local HES Shapefile; exact polygon selection'
    : 'National spatial download; exact polygon selection',
  sourceUrl: referenceDatasets.hesListedBuildings.sourceUrl,
  licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
  reliability: 'official_statutory',
  limitations: usesProjectBoundary
    ? `${pkg.project.locality} has no separate NRS locality boundary. The transparent visitor-guide editorial boundary is used and buffer records remain context only. The source supplies statutory designation and location metadata, not construction dates.`
    : 'The NRS locality is a modern statistical geography, not a historic town boundary. Buffer records remain review candidates. The source supplies statutory designation and location metadata, not construction dates.',
};
pkg.project.townStudyArea = studyArea;
pkg.sources = [source, ...pkg.sources.filter((item) => item.id !== source.id)];
pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  `Imported HES listed buildings for ${pkg.project.locality}: ${added} added, ${refreshed} refreshed, ${bufferCandidates} buffer candidate(s).`,
);
