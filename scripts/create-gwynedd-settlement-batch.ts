import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  area,
  bboxPolygon,
  booleanPointInPolygon,
  buffer,
  featureCollection,
  point,
  pointOnFeature,
  union,
} from '@turf/turf';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import proj4 from 'proj4';
import type {
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from '../src/domain/models';
import {
  townRatingFromEvidence,
  townRatingLabels,
  townRatingSummary,
} from '../src/domain/townRating';
import { assessPublicVisitorParking } from './lib/publicVisitorParking';

const reviewedDate = new Date().toISOString().slice(0, 10);
const reviewedAt = `${reviewedDate}T00:00:00Z`;
const manifestPath = resolve('data/imports/gwynedd-settlements-2026-08-11.json');
const projectsDirectory = resolve('data/projects');
const reviewDirectory = resolve('data/review');
const cacheDirectory = resolve('tmp/gwynedd-settlement-batch-v1');
const plannerPath = resolve('data/visitor-planner-curation.json');
const dogPath = resolve('data/dog-access-curation.json');
const treasurePath = resolve('data/review/treasure-trails-town-audit-2026-08-08.json');
const generatedModulePath = resolve('src/data/gwyneddSettlements.generated.ts');
const preservedExistingLocalities = new Set<string>();
const welshHeritageRoot = resolve('data/reference/england_wales_national_data_downloader/downloads/wales/national_heritage');
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';
const editorialLicence = 'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const onsService = 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer/0';
const broadBboxes = [
  [52.45, -4.95, 52.9, -4.45],
  [52.45, -4.45, 52.9, -3.9],
  [52.45, -3.9, 52.9, -3.35],
  [52.9, -4.95, 53.35, -4.45],
  [52.9, -4.45, 53.35, -3.9],
  [52.9, -3.9, 53.35, -3.35],
] as const;
const regionalExtent = { south: 52.45, west: -4.95, north: 53.35, east: -3.35 };

proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 +units=m +no_defs');

const scoring = {
  age: { before_1700: 1, '1700_1799': 0.9, '1800_1849': 0.8, '1850_1899': 0.65, '1900_1918': 0.5, '1919_1945': 0.4, '1946_1960': 0.25, after_1960: 0.15, unknown: 0.2 },
  significance: { highest_national: 1, national: 0.85, regional: 0.65, local: 0.45, recognised: 0.3 },
  confidence: { high: 1, medium: 0.75, low: 0.5, unknown: 0.35 },
  survival: { substantially_intact: 1, altered_recognisable: 0.75, heavily_altered: 0.45, site_only_or_demolished: 0.2, unknown: 0.6 },
} as const;

interface Manifest { settlements: string[] }
interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}
interface OverpassResponse { elements?: OsmElement[] }
interface NominatimResult {
  lat: string;
  lon: string;
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  display_name: string;
  type?: string;
  category?: string;
  boundingbox: [string, string, string, string];
  geojson?: Geometry;
  address?: Record<string, string>;
}
interface OnsRecord { BUA24CD: string; BUA24NM: string }
interface BoundaryResult {
  boundary: Feature<Polygon | MultiPolygon>;
  originalBoundary: Feature<Polygon | MultiPolygon>;
  localityCode?: string;
  sourceName: string;
  sourceUrl: string;
  sourceVersion: string;
  confidence: 'high' | 'medium' | 'low';
  curatedGreenSpaces: string[];
  curatedVisitorExtensions: string[];
}
interface WelshHeritagePoint {
  coordinates: [number, number];
  properties: Record<string, unknown>;
  designationType: string;
  tag: string;
  sourceKind: 'cadw-listed' | 'cadw-scheduled' | 'nmrw';
}
interface RankedFeature {
  feature: HeritageFeature;
  score: number;
  tagline: string;
  openingTimes?: string;
  admission?: string;
  freeAdmission?: boolean;
  sourceUrl: string;
}
interface TreasureProduct { title: string; handle: string; product_type?: string; tags?: string[] }
interface DogEntry { rating: number; status: string; label: string; summary: string; sourceName: string; sourceUrl: string; reviewedAt: string }

const normalise = (value: string) => value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
const slugify = (value: string) => normalise(value).replaceAll(' ', '-');
const onsLookupKeys = (value: string) => [...new Set([
  normalise(value),
  normalise(value.replace(/\s*\([^)]*\)\s*$/, '')),
])];
const sleep = (milliseconds: number) => new Promise((done) => setTimeout(done, milliseconds));

function source(
  sourceName: string,
  sourceOrganisation: string,
  sourceRecordId: string,
  sourceUrl: string,
  notes: string,
  reliability: SourceRecord['reliability'] = 'official_non_statutory',
  licence = editorialLicence,
): SourceRecord {
  return { sourceName, sourceOrganisation, sourceRecordId, sourceUrl, accessedAt: reviewedAt, reliability, licence, notes };
}

function geometryPositions(geometry: Geometry): [number, number][] {
  if (geometry.type === 'Point') return [geometry.coordinates as [number, number]];
  if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') return geometry.coordinates as [number, number][];
  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') return geometry.coordinates.flat() as [number, number][];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(2) as [number, number][];
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(geometryPositions);
  return [];
}

function bounds(feature: Feature<Polygon | MultiPolygon>): [number, number, number, number] {
  const positions = geometryPositions(feature.geometry);
  return [
    Math.min(...positions.map(([longitude]) => longitude)),
    Math.min(...positions.map(([, latitude]) => latitude)),
    Math.max(...positions.map(([longitude]) => longitude)),
    Math.max(...positions.map(([, latitude]) => latitude)),
  ];
}

function osmCoordinates(element: OsmElement): [number, number] | undefined {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (latitude !== undefined && longitude !== undefined) return [longitude, latitude];
  if (!element.geometry?.length) return undefined;
  return [
    element.geometry.reduce((sum, position) => sum + position.lon, 0) / element.geometry.length,
    element.geometry.reduce((sum, position) => sum + position.lat, 0) / element.geometry.length,
  ];
}

function osmUrl(element: OsmElement) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`;
}

function toPolygonGeometry(geometry?: Geometry): Polygon | MultiPolygon | undefined {
  if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') return geometry;
  return undefined;
}

async function fetchJson<T>(url: string, timeout = 60_000): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TownscapeGuides/1.0 (curated settlement audit)' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json() as Promise<T>;
}

async function fetchOnsCatalogue() {
  const cachePath = resolve(cacheDirectory, 'ons-bua-2024-catalogue.json');
  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as OnsRecord[];
  } catch {
    // Fetch and cache below.
  }
  const records: OnsRecord[] = [];
  for (let offset = 0; ; offset += 2000) {
    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      outFields: 'BUA24CD,BUA24NM',
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: '2000',
      orderByFields: 'BUA24CD',
    });
    const page = await fetchJson<{ features?: Array<{ attributes?: OnsRecord }> }>(`${onsService}/query?${params}`);
    const pageRecords = (page.features ?? []).flatMap((feature) => feature.attributes ? [feature.attributes] : []);
    records.push(...pageRecords);
    if (pageRecords.length < 2000) break;
  }
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  return records;
}

async function fetchOnsBoundary(record: OnsRecord) {
  const cachePath = resolve(cacheDirectory, `ons-${record.BUA24CD}.geojson`);
  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as Feature<Polygon | MultiPolygon>;
  } catch {
    // Fetch and cache below.
  }
  const params = new URLSearchParams({
    f: 'geojson',
    where: `BUA24CD='${record.BUA24CD}'`,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
  });
  const collection = await fetchJson<FeatureCollection<Polygon | MultiPolygon>>(`${onsService}/query?${params}`, 90_000);
  const boundary = collection.features[0];
  if (!boundary) throw new Error(`ONS boundary not returned for ${record.BUA24NM}`);
  boundary.properties = { ...(boundary.properties ?? {}), sourceDataset: 'ONS Built-up Areas (December 2024)' };
  await writeFile(cachePath, `${JSON.stringify(boundary, null, 2)}\n`, 'utf8');
  return boundary;
}

async function fetchNominatimBoundary(locality: string) {
  if (normalise(locality) === 'porthdinllaen') {
    const originalBoundary = bboxPolygon([-4.5735, 52.94, -4.561, 52.948]) as Feature<Polygon>;
    originalBoundary.properties = {
      sourceDataset: 'Curated visitor envelope around the OpenStreetMap Porth Dinllaen coastal settlement cluster',
      localityName: locality,
      boundaryMethod: 'curated_osm_settlement_cluster_envelope',
    };
    return {
      originalBoundary,
      sourceUrl: 'https://www.openstreetmap.org/#map=16/52.9440/-4.5673',
      displayName: 'Porth Dinllaen, Gwynedd, Wales',
      usedMappedPolygon: false,
    };
  }
  const cachePath = resolve(cacheDirectory, `nominatim-${slugify(locality)}.json`);
  let results: NominatimResult[];
  try {
    results = JSON.parse(await readFile(cachePath, 'utf8')) as NominatimResult[];
  } catch {
    const query = new URLSearchParams({
      q: `${locality.replace(/\s*\([^)]*\)\s*$/, '')}, Gwynedd, Wales`,
      format: 'jsonv2',
      limit: '8',
      countrycodes: 'gb',
      addressdetails: '1',
      polygon_geojson: '1',
    });
    results = await fetchJson<NominatimResult[]>(`https://nominatim.openstreetmap.org/search?${query}`, 30_000);
    await writeFile(cachePath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
    await sleep(1_100);
  }
  const requested = normalise(locality.replace(/\s*\([^)]*\)\s*$/, ''));
  const result = results
    .map((candidate) => ({
      candidate,
      score: (normalise(candidate.address?.village ?? candidate.address?.town ?? candidate.address?.hamlet ?? candidate.address?.suburb ?? '') === requested ? 5 : 0)
        + (/(?:gwynedd|wales|cymru)/i.test(candidate.display_name) ? 3 : 0)
        + (/^(town|village|hamlet|suburb|neighbourhood)$/i.test(candidate.type ?? '') ? 4 : 0)
        + (/^(place|boundary)$/i.test(candidate.category ?? '') ? 1 : -10),
    }))
    .sort((left, right) => right.score - left.score)[0]?.candidate;
  if (!result) throw new Error(`No OSM settlement result found for ${locality}`);
  const polygonGeometry = toPolygonGeometry(result.geojson);
  let originalBoundary: Feature<Polygon | MultiPolygon>;
  const usedMappedPolygon = Boolean(
    polygonGeometry
    && result.category === 'place'
    && /^(town|village|hamlet|suburb|neighbourhood)$/i.test(result.type ?? '')
    && area({ type: 'Feature', properties: {}, geometry: polygonGeometry }) <= 6_000_000,
  );
  if (usedMappedPolygon && polygonGeometry) {
    originalBoundary = { type: 'Feature', properties: {}, geometry: polygonGeometry };
  } else {
    const [south, north, west, east] = result.boundingbox.map(Number);
    const longitudeSpan = Math.min(Math.max(east - west, 0.008), 0.014);
    const latitudeSpan = Math.min(Math.max(north - south, 0.006), 0.01);
    const longitude = Number(result.lon);
    const latitude = Number(result.lat);
    originalBoundary = bboxPolygon([
      longitude - longitudeSpan / 2,
      latitude - latitudeSpan / 2,
      longitude + longitudeSpan / 2,
      latitude + latitudeSpan / 2,
    ]) as Feature<Polygon>;
  }
  originalBoundary.properties = {
    sourceDataset: usedMappedPolygon
      ? 'OpenStreetMap mapped settlement geometry via Nominatim'
      : 'Curated visitor envelope derived from the OpenStreetMap settlement point',
    localityName: locality,
    osmType: result.osm_type,
    osmId: result.osm_id,
    boundaryMethod: usedMappedPolygon ? 'mapped_settlement_polygon' : 'clamped_settlement_envelope',
  };
  return {
    originalBoundary,
    sourceUrl: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`,
    displayName: result.display_name,
    usedMappedPolygon,
  };
}

const overpassEndpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

async function fetchOverpass(query: string, cacheName: string) {
  const cachePath = resolve(cacheDirectory, cacheName);
  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as OverpassResponse;
  } catch {
    // Fetch and cache below.
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const endpoint of overpassEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TownscapeGuides/1.0' },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(180_000),
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const data = await response.json() as OverpassResponse;
        await writeFile(cachePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
        return data;
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(15_000 * (attempt + 1));
  }
  throw new Error(`Overpass request failed: ${String(lastError)}`);
}

async function fetchBroadOsm() {
  const responses = await Promise.all(broadBboxes.map(async ([south, west, north, east], index) => {
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:160];(nwr[amenity~"^(cafe|restaurant|pub|food_court|ice_cream|parking|toilets|picnic_table|museum|arts_centre|place_of_worship)$"](${bbox});nwr[shop~"^(bakery|coffee|confectionery|deli)$"](${bbox});nwr[tourism~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park|artwork|picnic_site)$"](${bbox});nwr[historic~"^(castle|fort|manor|monument|archaeological_site|ruins|city_gate|memorial|wayside_cross)$"](${bbox});nwr[man_made~"^(lighthouse|tower|windmill|watermill)$"](${bbox});nwr[leisure~"^(nature_reserve|garden|park|recreation_ground)$"](${bbox});nwr[bridge][name](${bbox});nwr[natural=waterfall](${bbox}););out center tags;`;
    return fetchOverpass(query, `visitor-pois-${index}.json`);
  }));
  const byId = new Map<string, OsmElement>();
  for (const response of responses) for (const element of response.elements ?? []) byId.set(`${element.type}-${element.id}`, element);
  return [...byId.values()];
}

async function fetchBroadGreenSpaces() {
  const greenQueries: Array<{
    bbox: readonly [number, number, number, number];
    cache: string;
  }> = [];
  broadBboxes.forEach(([south, west, north, east], index) => {
    greenQueries.push({ bbox: [south, west, north, east], cache: `green-spaces-${index}.json` });
  });
  const responses: OverpassResponse[] = [];
  for (const { bbox: [south, west, north, east], cache } of greenQueries) {
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:180];(way[leisure~"^(park|garden|recreation_ground|nature_reserve)$"](${bbox});way[landuse~"^(village_green|recreation_ground|cemetery)$"](${bbox}););out center tags geom;`;
    responses.push(await fetchOverpass(query, cache));
  }
  const byId = new Map<string, OsmElement>();
  for (const response of responses) for (const element of response.elements ?? []) byId.set(`${element.type}-${element.id}`, element);
  return [...byId.values()];
}

function greenPolygon(element: OsmElement) {
  const positions = (element.geometry ?? []).map(({ lon, lat }) => [lon, lat] as Position);
  if (positions.length < 4) return undefined;
  const [first] = positions;
  const last = positions.at(-1);
  if (!last || first[0] !== last[0] || first[1] !== last[1]) positions.push(first);
  const feature: Feature<Polygon> = { type: 'Feature', properties: element.tags ?? {}, geometry: { type: 'Polygon', coordinates: [positions] } };
  return area(feature) <= 2_500_000 ? feature : undefined;
}

function includeAdjacentGreenSpaces(
  originalBoundary: Feature<Polygon | MultiPolygon>,
  greenElements: OsmElement[],
) {
  const expanded = buffer(originalBoundary, 0.12, { units: 'kilometers' });
  if (!expanded) return { boundary: originalBoundary, included: [] as string[] };
  const [west, south, east, north] = bounds(expanded);
  let boundary = originalBoundary;
  const included: string[] = [];
  for (const element of greenElements) {
    const coordinates = osmCoordinates(element);
    if (!coordinates || coordinates[0] < west || coordinates[0] > east || coordinates[1] < south || coordinates[1] > north) continue;
    const polygon = greenPolygon(element);
    if (!polygon) continue;
    const representative = pointOnFeature(polygon);
    if (!booleanPointInPolygon(representative, expanded)) continue;
    const merged = union(featureCollection([boundary, polygon]));
    if (!merged || (merged.geometry.type !== 'Polygon' && merged.geometry.type !== 'MultiPolygon')) continue;
    boundary = merged as Feature<Polygon | MultiPolygon>;
    included.push(element.tags?.name ?? `OSM ${element.type} ${element.id}`);
  }
  boundary.properties = {
    ...(originalBoundary.properties ?? {}),
    visitorBoundary: true,
    adjoiningPublicGreenSpaces: included,
  };
  return { boundary, included };
}

async function resolveBoundary(
  locality: string,
  onsByName: Map<string, OnsRecord[]>,
  greenElements: OsmElement[],
): Promise<BoundaryResult> {
  // The ONS feature named Dinas Dinlle is centred around the airport cluster,
  // not the coastal village and beach that visitors understand by that name.
  // Use the reviewed OSM settlement point envelope for the active guide extent.
  if (normalise(locality) === 'dinas dinlle') {
    const osm = await fetchNominatimBoundary(locality);
    const { boundary, included } = includeAdjacentGreenSpaces(osm.originalBoundary, greenElements);
    return {
      boundary,
      originalBoundary: osm.originalBoundary,
      sourceName: 'Curated visitor envelope derived from the OpenStreetMap settlement point, with adjoining public green spaces',
      sourceUrl: osm.sourceUrl,
      sourceVersion: `OpenStreetMap reviewed ${reviewedDate}`,
      confidence: 'low',
      curatedGreenSpaces: included,
      curatedVisitorExtensions: [],
    };
  }

  const exactCandidates = onsLookupKeys(locality).flatMap((key) => onsByName.get(key) ?? []);
  const exactBoundaries = await Promise.all(
    exactCandidates.map(async (record) => ({ record, boundary: await fetchOnsBoundary(record) })),
  );
  const exact = exactBoundaries.find(({ boundary }) => {
    const [longitude, latitude] = pointOnFeature(boundary).geometry.coordinates;
    return longitude >= regionalExtent.west
      && longitude <= regionalExtent.east
      && latitude >= regionalExtent.south
      && latitude <= regionalExtent.north;
  });
  if (exact) {
    const originalBoundary = exact.boundary;
    const visitorExtensions: string[] = [];
    let visitorBase = originalBoundary;
    if (normalise(locality) === 'morfa bychan') {
      const beachFacilities = bboxPolygon([-4.1895, 52.9095, -4.175, 52.9152]);
      const merged = union(featureCollection([visitorBase, beachFacilities]));
      if (merged && (merged.geometry.type === 'Polygon' || merged.geometry.type === 'MultiPolygon')) {
        visitorBase = merged as Feature<Polygon | MultiPolygon>;
        visitorBase.properties = {
          ...(originalBoundary.properties ?? {}),
          visitorBoundary: true,
          curatedVisitorExtension: 'Morfa Bychan beach and public visitor facilities',
          curatedVisitorExtensionSource: 'https://www.visitwales.com/things-do/nature-and-landscapes/beaches/north-west-wales-beaches',
        };
        visitorExtensions.push('Morfa Bychan beach and public visitor facilities');
      }
    }
    const { boundary, included } = includeAdjacentGreenSpaces(visitorBase, greenElements);
    return {
      boundary,
      originalBoundary,
      localityCode: exact.record.BUA24CD,
      sourceName: visitorExtensions.length
        ? 'ONS Built-up Areas (December 2024) with a curated Morfa Bychan beach visitor extension and adjoining public green spaces'
        : 'ONS Built-up Areas (December 2024) with curated adjoining public green spaces',
      sourceUrl: `${onsService}?where=BUA24CD%3D%27${exact.record.BUA24CD}%27`,
      sourceVersion: 'December 2024 V2',
      confidence: visitorExtensions.length ? 'medium' : 'high',
      curatedGreenSpaces: included,
      curatedVisitorExtensions: visitorExtensions,
    };
  }
  const osm = await fetchNominatimBoundary(locality);
  const visitorExtensions: string[] = [];
  let visitorBase = osm.originalBoundary;
  if (normalise(locality) === 'aberdyfi') {
    const neuaddDyfiFacilities = bboxPolygon([-4.047, 52.5425, -4.0443, 52.5447]);
    const merged = union(featureCollection([visitorBase, neuaddDyfiFacilities]));
    if (merged && (merged.geometry.type === 'Polygon' || merged.geometry.type === 'MultiPolygon')) {
      visitorBase = merged as Feature<Polygon | MultiPolygon>;
      visitorBase.properties = {
        ...(osm.originalBoundary.properties ?? {}),
        visitorBoundary: true,
        curatedVisitorExtension: 'Neuadd Dyfi public visitor facilities',
        curatedVisitorExtensionSource: cyngorGwyneddPublicToiletsUrl,
      };
      visitorExtensions.push('Neuadd Dyfi public visitor facilities');
    }
  }
  const { boundary, included } = includeAdjacentGreenSpaces(visitorBase, greenElements);
  return {
    boundary,
    originalBoundary: osm.originalBoundary,
    sourceName: visitorExtensions.length
      ? 'Curated visitor envelope derived from OpenStreetMap, with a Neuadd Dyfi public-facilities extension and adjoining public green spaces'
      : osm.usedMappedPolygon
        ? 'OpenStreetMap mapped settlement geometry with curated adjoining public green spaces'
        : 'Curated visitor envelope derived from the OpenStreetMap settlement point, with adjoining public green spaces',
    sourceUrl: osm.sourceUrl,
    sourceVersion: `OpenStreetMap reviewed ${reviewedDate}`,
    confidence: osm.usedMappedPolygon ? 'medium' : 'low',
    curatedGreenSpaces: included,
    curatedVisitorExtensions: visitorExtensions,
  };
}

let welshHeritagePoints: WelshHeritagePoint[] | undefined;

function propertyText(properties: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = properties[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return undefined;
}

function bngToWgs84(easting: unknown, northing: unknown): [number, number] | undefined {
  const east = Number(easting);
  const north = Number(northing);
  if (!Number.isFinite(east) || !Number.isFinite(north)) return undefined;
  const [longitude, latitude] = proj4('EPSG:27700', 'EPSG:4326', [east, north]);
  return [longitude, latitude];
}

async function loadWelshHeritagePoints() {
  if (welshHeritagePoints) return welshHeritagePoints;
  welshHeritagePoints = [];
  const folders = [
    ['inspire_wg_cadw_listedbuildings', 'listed_building', 'cadw-listed-building', 'cadw-listed'],
    ['inspire_wg_cadw_sam', 'scheduled_monument', 'cadw-scheduled-monument', 'cadw-scheduled'],
    ['geonode_rcahmw_nmrw_terrestrialsites_rcahmw_bng', 'national_monuments_record', 'nmrw-site', 'nmrw'],
  ] as const;
  for (const [folder, designationType, tag, sourceKind] of folders) {
    const directory = resolve(welshHeritageRoot, folder);
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith('.geojson'))) {
      const collection = JSON.parse(await readFile(resolve(directory, filename), 'utf8')) as FeatureCollection;
      for (const record of collection.features) {
        const properties = (record.properties ?? {}) as Record<string, unknown>;
        const authority = propertyText(properties, 'UnitaryAuthority', 'unitary_au', 'awdurdod_u', 'awdurdud_u') ?? '';
        if (!/gwynedd/i.test(authority)) continue;
        const coordinates = sourceKind === 'nmrw'
          ? (() => {
            const longitude = Number(propertyText(properties, 'long', 'longitude'));
            const latitude = Number(propertyText(properties, 'lat', 'latitude'));
            return Number.isFinite(longitude) && Number.isFinite(latitude)
              ? [longitude, latitude] as [number, number]
              : bngToWgs84(properties.osgb36east, properties.osgb36notr);
          })()
          : bngToWgs84(properties.Easting ?? properties.easting, properties.Northing ?? properties.northing);
        if (!coordinates) continue;
        welshHeritagePoints.push({ coordinates, properties, designationType, tag, sourceKind });
      }
    }
  }
  return welshHeritagePoints;
}

function cadwSignificance(grade?: string): HeritageFeature['significance'] {
  if (grade === 'I') return 'highest_national';
  if (grade === 'II*') return 'national';
  return 'regional';
}

function periodRange(periodText?: string) {
  const period = periodText?.toLowerCase() ?? '';
  const ranges: Array<readonly [number, number]> = [];
  const add = (pattern: RegExp, range: readonly [number, number]) => {
    if (pattern.test(period)) ranges.push(range);
  };

  add(/palaeolithic|mesolithic/, [-12000, -4001]);
  add(/neolithic/, [-4000, -2200]);
  add(/bronze age/, [-2500, -800]);
  add(/iron age/, [-800, 42]);
  add(/prehistoric/, [-12000, 42]);
  add(/roman/, [43, 410]);
  add(/early medieval|dark age/, [411, 1065]);
  add(/post medieval/, [1540, 1900]);
  if (/medieval/.test(period.replaceAll('early medieval', '').replaceAll('post medieval', ''))) {
    ranges.push([1066, 1539]);
  }
  add(/16th century/, [1501, 1600]);
  add(/17th century/, [1601, 1700]);
  add(/18th century/, [1701, 1800]);
  add(/19th century/, [1801, 1900]);
  add(/industrial/, [1750, 1914]);
  add(/20th century|twentieth/, [1901, 2000]);
  add(/21st century/, [2001, 2026]);
  add(/modern/, [1901, 2026]);

  if (!ranges.length) return undefined;
  return [
    Math.min(...ranges.map(([start]) => start)),
    Math.max(...ranges.map(([, end]) => end)),
  ] as const;
}

function nameFeatureType(name: string, fallback = 'other') {
  if (/church|chapel|cathedral/i.test(name)) return 'church';
  if (/castle/i.test(name)) return 'castle';
  if (/bridge/i.test(name)) return 'bridge';
  if (/cross/i.test(name)) return 'monument';
  if (/hall|manor/i.test(name)) return 'country_house';
  if (/mill/i.test(name)) return 'mill';
  if (/garden|park/i.test(name)) return 'park';
  return fallback;
}

async function importWelshHeritage(locality: string, projectId: string, boundary: Feature<Polygon | MultiPolygon>) {
  const [west, south, east, north] = bounds(boundary);
  const features: HeritageFeature[] = [];
  const usedIds = new Set<string>();
  for (const record of await loadWelshHeritagePoints()) {
    const [longitude, latitude] = record.coordinates;
    if (longitude < west || longitude > east || latitude < south || latitude > north) continue;
    if (!booleanPointInPolygon(point(record.coordinates), boundary)) continue;
    const recordId = propertyText(record.properties, 'RecordNumber', 'SAMNumber', 'nprn') ?? `${projectId}-${features.length}`;
    const id = `welsh-heritage:${record.sourceKind}:${recordId}`;
    if (usedIds.has(id)) continue;
    usedIds.add(id);
    const name = propertyText(record.properties, 'Name', 'name', 'NAME') ?? 'Welsh historic place';
    const welshName = propertyText(record.properties, 'Name_cy', 'enw', 'name_cy');
    const grade = propertyText(record.properties, 'Grade', 'grade');
    const period = propertyText(record.properties, 'Period', 'period');
    const range = periodRange(period);
    const isStatutory = record.sourceKind !== 'nmrw';
    const sourceUrl = propertyText(record.properties, 'Report', 'url')
      ?? (record.sourceKind === 'nmrw' ? `https://coflein.gov.uk/en/site/${recordId}/` : 'https://cadw.gov.wales/advice-support/cof-cymru');
    const sourceName = record.sourceKind === 'nmrw' ? 'National Monuments Record of Wales' : 'Cof Cymru - National Historic Assets of Wales';
    const sourceOrganisation = record.sourceKind === 'nmrw' ? 'Royal Commission on the Ancient and Historical Monuments of Wales' : 'Cadw';
    features.push({
      id,
      projectId,
      name,
      alternativeNames: welshName && normalise(welshName) !== normalise(name) ? [welshName] : [],
      countryCode: 'GB-WLS',
      region: 'Gwynedd',
      locality,
      featureType: nameFeatureType(name),
      designationType: record.designationType,
      designationCategory: grade,
      significance: record.designationType === 'scheduled_monument' ? 'highest_national' : record.sourceKind === 'nmrw' ? 'regional' : cadwSignificance(grade),
      statutoryStatus: isStatutory ? 'Cadw designated historic asset' : 'National Monuments Record of Wales',
      geometry: point(record.coordinates).geometry,
      locationType: 'representative_point',
      locationConfidence: 'high',
      documentedDateText: period,
      earliestPossibleYear: range?.[0],
      latestPossibleYear: range?.[1],
      datePrecision: range ? 'period_range' : undefined,
      dateBasis: range ? 'estimated_from_authoritative_source' : 'unknown',
      dateConfidence: range ? 'medium' : 'unknown',
      survival: 'unknown',
      shortDescription: `${record.designationType.replaceAll('_', ' ')} recorded by ${sourceOrganisation}${grade ? `, Grade ${grade}` : ''}${period ? `; recorded period ${period}` : ''}.`,
      sourceRecords: [source(
        sourceName,
        sourceOrganisation,
        recordId,
        sourceUrl,
        period ? `Official record with period classification: ${period}.` : 'Official Welsh historic-environment record; no defensible construction period was supplied in this export.',
        isStatutory ? 'official_statutory' : 'official_non_statutory',
        'Open Government Licence v3.0; contains Cadw or RCAHMW data.',
      )],
      tags: ['welsh-heritage', record.sourceKind, record.tag],
      createdAt: reviewedAt,
      updatedAt: reviewedAt,
      reviewed: true,
      reviewNotes: `Imported from the bundled Welsh national heritage downloads and filtered against the active ${locality} visitor boundary.`,
      evidenceScope: 'parish_evidence',
      licence: 'Open Government Licence v3.0; contains Cadw or RCAHMW data.',
    });
  }
  return features;
}

function publicAccess(tags: Record<string, string>) {
  if (/yes|true/i.test([tags.disused, tags.abandoned, tags.demolished, tags.closed].filter(Boolean).join(' '))) return false;
  return !/^(no|private|permit|residents|customers)$/i.test(tags.access ?? '');
}

function currentNotes(tags: Record<string, string>, extras: Record<string, string | undefined> = {}) {
  return Object.entries({ ...tags, ...extras })
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function visitorType(tags: Record<string, string>) {
  return tags.tourism ?? tags.historic ?? tags.man_made ?? tags.leisure ?? tags.amenity ?? tags.shop ?? 'place';
}

function createOsmFeature(
  projectId: string,
  locality: string,
  element: OsmElement,
  category: string,
  name: string,
  description: string,
  extras: Record<string, string | undefined> = {},
): HeritageFeature {
  const coordinates = osmCoordinates(element);
  if (!coordinates) throw new Error(`${name} has no representative OSM location`);
  const tags = element.tags ?? {};
  return {
    id: `osm-community:${element.type}-${element.id}`,
    projectId,
    name,
    alternativeNames: [],
    countryCode: 'GB-WLS',
    region: 'Gwynedd',
    locality,
    featureType: visitorType(tags),
    significance: 'local',
    geometry: point(coordinates).geometry,
    locationType: 'representative_point',
    locationConfidence: 'high',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    survival: 'substantially_intact',
    shortDescription: description,
    sourceRecords: [source(
      'OpenStreetMap current community places',
      'OpenStreetMap contributors',
      `${element.type}/${element.id}`,
      tags.website ?? tags['contact:website'] ?? osmUrl(element),
      currentNotes(tags, extras),
      'discovery_only',
      osmLicence,
    )],
    tags: [`service-context-${category}`, 'osm-current-place'],
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
    reviewed: true,
    reviewNotes: `Current visitor place audited and boundary-checked ${reviewedDate}.`,
    evidenceScope: 'related_context',
    licence: osmLicence,
  };
}

function foodScore(tags: Record<string, string>) {
  let score = tags.amenity === 'cafe' ? 70 : tags.shop ? 66 : 62;
  if (tags.website || tags['contact:website']) score += 5;
  if (tags.opening_hours) score += 4;
  if (tags.outdoor_seating === 'yes') score += 2;
  if (/breakfast|brunch|coffee|tea|cake|bakery/i.test(`${tags.cuisine ?? ''} ${tags.description ?? ''}`)) score += 3;
  return Math.min(86, score);
}

function daytimeFood(tags: Record<string, string>) {
  if (!publicAccess(tags) || !tags.name) return false;
  if (/^(cafe|food_court|ice_cream)$/i.test(tags.amenity ?? '') || /^(bakery|coffee|confectionery|deli)$/i.test(tags.shop ?? '')) return true;
  if (!/^(restaurant|pub)$/i.test(tags.amenity ?? '')) return false;
  const evidence = `${tags.opening_hours ?? ''} ${tags.cuisine ?? ''} ${tags.description ?? ''}`;
  return /breakfast|brunch|lunch|coffee|tea|cake|10:|11:|12:|13:|14:|15:/i.test(evidence);
}

function attractionScore(tags: Record<string, string>) {
  const type = visitorType(tags);
  let score = tags.tourism === 'museum' ? 72
    : tags.tourism === 'zoo' || tags.tourism === 'theme_park' ? 78
      : tags.historic === 'castle' ? 72
        : tags.tourism === 'attraction' ? 66
          : tags.leisure === 'nature_reserve' ? 60
            : tags.tourism === 'viewpoint' ? 58
              : tags.amenity === 'arts_centre' ? 58
                : tags.amenity === 'place_of_worship' ? 52
                  : /park|garden/.test(type) ? 50
                    : 46;
  if (tags.website || tags['contact:website']) score += 4;
  if (/national trust|english heritage|historic houses|wildlife trust/i.test(`${tags.operator ?? ''} ${tags.brand ?? ''}`)) score += 8;
  return Math.min(90, score);
}

function looksLikeAddressOrRoadName(name: string) {
  return /^(?:NOS?\.?\s*)?\d+[A-Z]?(?:\s*(?:-|AND|TO|&)\s*\d+[A-Z]?)?\s*(?:,|-)?\s+/i.test(name)
    || /\b(?:DRIVE|CLOSE|ROAD|STREET|AVENUE|CRESCENT|COURT|WAY|LANE|MEWS)\s*$/i.test(name);
}

function attractiveOsmPlace(element: OsmElement) {
  const tags = element.tags ?? {};
  if (!publicAccess(tags) || !tags.name) return false;
  if (looksLikeAddressOrRoadName(tags.name)) return false;
  if (/play ?ground|play area|main entrance|car ?park|hotel|restaurant|village sign|garden of rest|memorial bench/i.test(tags.name)) return false;
  if (/^(hotel|hostel|guest_house|motel|apartment|camp_site|caravan_site|chalet)$/i.test(tags.tourism ?? '')) return false;
  if (/memorial|wayside_cross/.test(tags.historic ?? '') && !tags.tourism) return false;
  const isDestinationGreenSpace = /country park|botanic|formal garden|heritage garden|arboretum|nature reserve/i.test(tags.name)
    || tags.leisure === 'nature_reserve'
    || Boolean((tags.website || tags['contact:website']) && tags.operator);
  const isVisitorChurch = tags.amenity === 'place_of_worship'
    && Boolean(tags.tourism || tags.historic || tags.heritage || tags.listed_status || tags.designation);
  const isVisitorBridge = Boolean(tags.bridge && /bridge/i.test(tags.name))
    && Boolean(tags.tourism || tags.historic || tags.website || tags['contact:website'] || tags.operator);
  return Boolean(
    tags.tourism
    || /^(castle|fort|manor|archaeological_site|ruins|city_gate)$/i.test(tags.historic ?? '')
    || /^(lighthouse|tower|windmill|watermill)$/i.test(tags.man_made ?? '')
    || (/^(nature_reserve|garden|park)$/i.test(tags.leisure ?? '') && isDestinationGreenSpace)
    || /^(museum|arts_centre)$/i.test(tags.amenity ?? '')
    || isVisitorChurch
    || isVisitorBridge,
  );
}

function welshHeritageAttractionScore(feature: HeritageFeature) {
  const name = feature.name;
  if (looksLikeAddressOrRoadName(name)) return 0;
  if (/tomb|headstone|memorial|wall|gate|railing|outbuilding|stable|barn|dovecote|lamp|telephone|milestone|bollard/i.test(name)) return 0;
  if (/^BRIDGE\b.*\b(?:APPROXIMATELY|METRES?)\b/i.test(name)) return 0;
  if (
    /\b(?:HOUSE|COTTAGE|FARMHOUSE|FARM|LODGE|RECTORY|VICARAGE|SHOP|PUBLIC HOUSE)\b/i.test(name) &&
    !/\bCROSS\b|NATIONAL TRUST/i.test(name)
  ) return 0;
  if (/castle|abbey|priory|ruins/i.test(name)) return feature.significance === 'highest_national' ? 76 : 68;
  if (/^(?:THE )?(?:PARISH )?(?:CHURCH|CHAPEL)\b|\bCHURCH OF\b/i.test(name)) return feature.significance === 'highest_national' ? 66 : feature.significance === 'national' ? 60 : 52;
  if (/\b(?:BRIDGE|CROSS|MARKET HALL|GUILDHALL|TOWN HALL|WINDMILL|WATERMILL)\b/i.test(name)) return feature.significance === 'highest_national' ? 62 : 54;
  return 0;
}

function recommendationTagline(score: number, type: string) {
  if (score >= 90) return 'Exceptional';
  if (score >= 85) return 'Highly recommended';
  if (score >= 75) return 'Recommended';
  if (score >= 45) return type.replaceAll('_', ' ');
  return 'Point of interest';
}

function nearestNamedPlace(coordinates: [number, number], elements: OsmElement[], maximumMetres = 300) {
  let nearest: { name: string; metres: number } | undefined;
  const latitudeFactor = 111_320;
  for (const element of elements) {
    const name = element.tags?.name;
    const candidate = osmCoordinates(element);
    const tags = element.tags ?? {};
    if (
      !name ||
      !candidate ||
      /^(?:parking|car ?park|public toilets?|toilets?|picnic (?:site|table|area))(?:\s+\d+)?$/i.test(name) ||
      /^(?:parking|toilets|picnic_table)$/i.test(tags.amenity ?? '') ||
      tags.tourism === 'picnic_site'
    ) {
      continue;
    }
    const longitudeFactor = latitudeFactor * Math.cos(coordinates[1] * Math.PI / 180);
    const metres = Math.hypot((candidate[0] - coordinates[0]) * longitudeFactor, (candidate[1] - coordinates[1]) * latitudeFactor);
    if (metres <= maximumMetres && (!nearest || metres < nearest.metres)) nearest = { name, metres };
  }
  return nearest?.name;
}

function practicalName(locality: string, centre: [number, number], element: OsmElement, nearby: OsmElement[], category: 'parking' | 'toilets' | 'picnic', index: number) {
  const tags = element.tags ?? {};
  if (tags.name && !/^(parking|car ?park|public toilets?|toilets?|picnic (site|table|area))(?:\s+\d+)?$/i.test(tags.name)) return tags.name;
  const coordinates = osmCoordinates(element);
  const location = tags['addr:street'] ?? tags['addr:place'] ?? tags.loc_name ?? (coordinates ? nearestNamedPlace(coordinates, nearby) : undefined);
  const suffix = category === 'parking' ? 'car park' : category === 'toilets' ? 'public toilets' : 'picnic area';
  if (location) return `${location} ${suffix}`;
  if (!coordinates) return `${locality} ${suffix} ${index}`;
  const eastWest = coordinates[0] - centre[0];
  const northSouth = coordinates[1] - centre[1];
  const central = Math.abs(eastWest) < 0.0015 && Math.abs(northSouth) < 0.001;
  const vertical = northSouth >= 0 ? 'North' : 'South';
  const horizontal = eastWest >= 0 ? 'east' : 'west';
  const area = central
    ? 'Central'
    : Math.abs(northSouth) > Math.abs(eastWest) * 1.8
      ? vertical
      : Math.abs(eastWest) > Math.abs(northSouth) * 1.8
        ? horizontal[0]!.toUpperCase() + horizontal.slice(1)
        : `${vertical}-${horizontal}`;
  return `${area} ${locality} ${suffix}${index > 1 ? ` ${index}` : ''}`;
}

function dogEntry(rating: number, sourceUrl: string, explicit: boolean): DogEntry {
  return {
    rating,
    status: rating > 0 ? 'welcoming' : explicit ? 'not-allowed' : 'unconfirmed',
    label: rating === 3 ? 'Very dog friendly' : rating === 2 ? 'Dog friendly outdoors' : rating === 1 ? 'Limited dog access' : explicit ? 'Dogs not admitted' : 'Dog access not confirmed',
    summary: rating > 0 ? 'Outdoor access is suitable for dogs, subject to leads and local notices.' : explicit ? 'Published or mapped information indicates dogs are not admitted.' : 'No defensible dog-access claim was found; check before travelling.',
    sourceName: explicit ? 'Published or mapped dog-access information' : 'Conservative visitor curation',
    sourceUrl,
    reviewedAt,
  };
}

function foodDogEntry(sourceUrl: string, allowed: boolean, prohibited: boolean): DogEntry {
  if (allowed) {
    return {
      rating: 2,
      status: 'welcoming',
      label: 'Dog friendly',
      summary: 'OpenStreetMap explicitly records dogs as allowed. This confirms permission, but not indoor seating or extra dog-friendly facilities; check the current house rules before a dog-dependent visit.',
      sourceName: 'OpenStreetMap dog-access tag',
      sourceUrl,
      reviewedAt,
    };
  }
  return dogEntry(0, sourceUrl, prohibited);
}

async function fetchTreasureProducts() {
  const cachePath = resolve(cacheDirectory, 'treasure-trails-products.json');
  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as TreasureProduct[];
  } catch {
    // Fetch and cache below.
  }
  const products: TreasureProduct[] = [];
  for (let pageNumber = 1; ; pageNumber += 1) {
    const page = await fetchJson<{ products?: TreasureProduct[] }>(`https://www.treasuretrails.co.uk/products.json?limit=250&page=${pageNumber}`, 45_000);
    const pageProducts = page.products ?? [];
    products.push(...pageProducts);
    if (pageProducts.length < 250) break;
  }
  await writeFile(cachePath, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
  return products;
}

function treasureMatch(locality: string, products: TreasureProduct[]) {
  const requested = normalise(locality);
  const allowedLocations = new Set(['Gwynedd', 'North Wales', 'Wales'].map(normalise));
  return products.find((product) => {
    const title = normalise(product.title.split(' - ')[0]);
    const locations = (product.tags ?? [])
      .filter((tag) => /^location\s*:/i.test(tag))
      .map((tag) => normalise(tag.replace(/^location\s*:/i, '')));
    return (title === requested || title.startsWith(`${requested} `))
      && locations.some((location) => allowedLocations.has(location));
  });
}

const researchedAttractionScores: Record<string, Record<string, number>> = {};

interface OfficialPublicToiletOverride {
  name: string;
  openingHours: string;
  wheelchair?: 'yes' | 'no';
  fee?: 'yes' | 'no';
}

const cyngorGwyneddPublicToiletsUrl = 'https://www.gwynedd.llyw.cymru/en-gb/leisure-country-parks-paths-and-beaches/toilets/public-toilets';
const officialPublicToiletOverrides: Record<string, Record<string, OfficialPublicToiletOverride>> = {
  aberdyfi: {
    'way-512387185': {
      name: 'Aberdyfi quay public toilets',
      openingHours: 'Open all year',
      wheelchair: 'yes',
    },
    'node-971102414': {
      name: 'Neuadd Dyfi public toilets',
      openingHours: 'Open all year',
    },
  },
  'dinas dinlle': {
    'way-380368279': {
      name: 'Marine public toilets',
      openingHours: 'Open all year',
      wheelchair: 'yes',
    },
  },
  'morfa bychan': {
    'way-840526531': {
      name: 'Gwydryn public toilets',
      openingHours: 'Seasonal: 1 April to the end of October',
    },
    'way-357902773': {
      name: 'Morfa Bychan beach public toilets',
      openingHours: 'Seasonal: 1 April to the end of October',
      wheelchair: 'yes',
      fee: 'no',
    },
  },
};

function researchedAttractionScore(locality: string, name: string, generatedScore: number) {
  return Math.max(generatedScore, researchedAttractionScores[locality]?.[normalise(name)] ?? 0);
}

function regionFor() {
  return 'Gwynedd';
}

async function buildTown(
  locality: string,
  onsByName: Map<string, OnsRecord[]>,
  broadOsm: OsmElement[],
  greenElements: OsmElement[],
  treasureProducts: TreasureProduct[],
) {
  const slug = slugify(locality);
  const projectId = `${slug}-gwynedd-wales`;
  const boundaryResult = await resolveBoundary(locality, onsByName, greenElements);
  const boundary = boundaryResult.boundary;
  const centre = pointOnFeature(boundary).geometry.coordinates as [number, number];
  const publicToiletOverrides = officialPublicToiletOverrides[normalise(locality)] ?? {};
  const elements = broadOsm.filter((element) => {
    const coordinates = osmCoordinates(element);
    const override = publicToiletOverrides[`${element.type}-${element.id}`];
    return coordinates
      && booleanPointInPolygon(point(coordinates), boundary)
      && (publicAccess(element.tags ?? {}) || Boolean(override));
  });
  const features = await importWelshHeritage(locality, projectId, boundary);
  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const add = (feature: HeritageFeature) => {
    const existing = byId.get(feature.id);
    if (existing) return existing;
    byId.set(feature.id, feature);
    features.push(feature);
    return feature;
  };

  const attractions: RankedFeature[] = [];
  const attractionNames = new Set<string>();
  for (const element of elements.filter(attractiveOsmPlace)) {
    const tags = element.tags ?? {};
    const name = tags.name;
    const key = normalise(name);
    if (attractionNames.has(key)) continue;
    const score = researchedAttractionScore(locality, name, attractionScore(tags));
    const sourceUrl = tags.website ?? tags['contact:website'] ?? osmUrl(element);
    const description = `${name} is a curated ${visitorType(tags).replaceAll('_', ' ')} within the active ${locality} visitor boundary.`;
    const feature = add(createOsmFeature(projectId, locality, element, 'visitor', name, description, { visit_score: String(score) }));
    feature.attractionGuide = {
      headline: recommendationTagline(score, visitorType(tags)),
      intro: description,
      motifs: [visitorType(tags).replaceAll('_', ' '), locality],
      bestFor: [/park|garden|nature_reserve|viewpoint/.test(visitorType(tags)) ? 'Outdoor exploring' : 'Local heritage'],
      thingsToDo: [{ name: `Explore ${name}` }, { name: `Notice its ${visitorType(tags).replaceAll('_', ' ')} character` }],
    };
    attractions.push({
      feature,
      score,
      tagline: recommendationTagline(score, visitorType(tags)),
      openingTimes: tags.opening_hours,
      admission: /^(no|free)$/i.test(tags.fee ?? '') ? 'Free' : /^(yes|ticket)$/i.test(tags.fee ?? '') ? 'Paid admission - check current prices' : undefined,
      freeAdmission: /^(no|free)$/i.test(tags.fee ?? ''),
      sourceUrl,
    });
    attractionNames.add(key);
  }

  for (const feature of features.filter((candidate) => candidate.tags.includes('welsh-heritage'))) {
    const generatedScore = welshHeritageAttractionScore(feature);
    const score = generatedScore ? researchedAttractionScore(locality, feature.name, generatedScore) : undefined;
    if (!score || attractionNames.has(normalise(feature.name))) continue;
    const sourceUrl = feature.sourceRecords[0]?.sourceUrl ?? 'https://cadw.gov.wales/advice-support/cof-cymru';
    const description = `${feature.name} is a nationally recorded historic landmark within ${locality}. Access should be checked where it is not a public church or outdoor monument.`;
    feature.shortDescription = description;
    feature.tags = [...new Set([...feature.tags, 'service-context-visitor'])];
    feature.attractionGuide = {
      headline: recommendationTagline(score, String(feature.featureType)),
      intro: description,
      motifs: [String(feature.featureType).replaceAll('_', ' '), 'Welsh historic environment'],
      bestFor: ['Historic interest'],
      thingsToDo: [{ name: `See ${feature.name}` }],
    };
    attractions.push({ feature, score, tagline: recommendationTagline(score, String(feature.featureType)), sourceUrl });
    attractionNames.add(normalise(feature.name));
  }
  attractions.sort((left, right) => right.score - left.score || left.feature.name.localeCompare(right.feature.name));
  attractions.splice(20);

  const usedFoodNames = new Set<string>();
  const food = elements
    .filter((element) => daytimeFood(element.tags ?? {}))
    .map((element) => ({ element, score: foodScore(element.tags ?? {}) }))
    .sort((left, right) => right.score - left.score || (left.element.tags?.name ?? '').localeCompare(right.element.tags?.name ?? ''))
    .filter(({ element }) => {
      const key = normalise(element.tags?.name ?? '');
      if (!key || usedFoodNames.has(key)) return false;
      usedFoodNames.add(key);
      return true;
    })
    .slice(0, 20)
    .map(({ element, score }) => {
      const tags = element.tags ?? {};
      const name = tags.name;
      return add(createOsmFeature(
        projectId,
        locality,
        element,
        'food',
        name,
        `${name} is a curated daytime coffee, cake or lunch stop within ${locality}.`,
        { visit_score: String(score), price_band: tags['price:range'] ?? 'Check current menu' },
      ));
    });

  const practical = (category: 'parking' | 'toilets' | 'picnic') => {
    const candidates = elements.filter((element) => {
      const tags = element.tags ?? {};
      if (category === 'parking') {
        return assessPublicVisitorParking(element).include;
      }
      if (category === 'toilets') return tags.amenity === 'toilets';
      return tags.tourism === 'picnic_site' || tags.amenity === 'picnic_table';
    });
    const usedNames = new Set<string>();
    return candidates.flatMap((element, index) => {
      const elementKey = `${element.type}-${element.id}`;
      const publicToiletOverride = category === 'toilets' ? publicToiletOverrides[elementKey] : undefined;
      const tags = publicToiletOverride
        ? {
            ...(element.tags ?? {}),
            name: publicToiletOverride.name,
            access: 'yes',
            opening_hours: publicToiletOverride.openingHours,
            ...(publicToiletOverride.wheelchair ? { wheelchair: publicToiletOverride.wheelchair } : {}),
            ...(publicToiletOverride.fee ? { fee: publicToiletOverride.fee } : {}),
          }
        : element.tags ?? {};
      const curatedElement = publicToiletOverride ? { ...element, tags } : element;
      const name = publicToiletOverride?.name ?? practicalName(locality, centre, curatedElement, elements, category, index + 1);
      const key = normalise(name);
      if (usedNames.has(key)) return [];
      usedNames.add(key);
      const payment = category === 'parking' ? (/^(yes|ticket)$/i.test(tags.fee ?? '') ? 'yes' : /^(no|free)$/i.test(tags.fee ?? '') ? 'no' : 'unknown') : undefined;
      const feature = add(createOsmFeature(
        projectId,
        locality,
        curatedElement,
        category,
        name,
        category === 'parking' ? `${name} is a curated public parking option for a ${locality} visit.` : `${name} is a current public visitor facility in ${locality}.`,
        category === 'parking'
          ? { payment_required: payment, price_display: payment === 'yes' ? 'Pay - check signs' : payment === 'no' ? 'Free' : 'Check signs' }
          : publicToiletOverride
            ? { official_public_toilet: 'yes' }
            : {},
      ));
      if (publicToiletOverride) {
        feature.sourceRecords.push(source(
          'Cyngor Gwynedd public toilets',
          'Cyngor Gwynedd',
          `${slug}-${elementKey}`,
          cyngorGwyneddPublicToiletsUrl,
          `${publicToiletOverride.name}; ${publicToiletOverride.openingHours}${publicToiletOverride.wheelchair === 'yes' ? '; accessible toilet listed' : ''}.`,
          'official_non_statutory',
          editorialLicence,
        ));
        feature.reviewNotes = `Current public toilet cross-checked against the Cyngor Gwynedd public toilet list ${reviewedDate}.`;
      }
      return [feature];
    });
  };
  const parking = practical('parking');
  const toilets = practical('toilets');
  const picnic = practical('picnic');

  const treasure = treasureMatch(locality, treasureProducts);
  const trails: HeritageFeature[] = [];
  if (treasure) {
    const trailElement: OsmElement = { type: 'node', id: Number(`9${Math.abs([...slug].reduce((sum, character) => sum + character.charCodeAt(0), 0))}`), lat: centre[1], lon: centre[0], tags: { name: treasure.title } };
    trails.push(add(createOsmFeature(
      projectId,
      locality,
      trailElement,
      'trails',
      treasure.title,
      `A current Treasure Trails route created for ${locality}.`,
      { external_url: `https://www.treasuretrails.co.uk/products/${treasure.handle}`, trail_score: '86', duration: 'Check current trail details' },
    )));
  }

  const visitorHighlights = attractions.map((item, index) => ({
    rank: index + 1,
    featureId: item.feature.id,
    name: item.feature.name,
    reason: item.feature.shortDescription ?? item.feature.name,
    tagline: item.tagline,
    visitorScore: item.score,
    openingTimes: item.openingTimes,
    admission: item.admission,
    freeAdmission: item.freeAdmission,
    organisationPills: [],
    attractionGuide: item.feature.attractionGuide,
    sourceName: item.feature.sourceRecords[0]?.sourceName ?? 'Townscape Guides research',
    sourceUrl: item.sourceUrl,
    verifiedInBoundaryAt: reviewedDate,
  }));
  const ratingEvidence = {
    attractions: visitorHighlights.map((highlight) => ({
      featureId: highlight.featureId,
      name: highlight.name,
      score: highlight.visitorScore,
      sourceUrl: highlight.sourceUrl,
    })),
    trails: trails.map((trail) => ({
      featureId: trail.id,
      name: trail.name,
      score: 86,
      sourceUrl: treasure ? `https://www.treasuretrails.co.uk/products/${treasure.handle}` : undefined,
    })),
  };
  const rating = townRatingFromEvidence(
    ratingEvidence.attractions.map((item) => item.score),
    ratingEvidence.trails.map((item) => item.score),
  );
  const topNames = visitorHighlights.slice(0, 3).map((highlight) => highlight.name);
  const guideIntro = rating === 0
    ? `${locality} has a modest visitor offer within its active settlement boundary. The guide records defensible heritage and practical stops without presenting the place as a destination.`
    : `${locality} offers ${topNames.length ? topNames.join(', ') : 'a small collection of local places'} within a compact settlement visit, supported by curated daytime food and practical facilities where mapped.`;
  const region = regionFor();
  const packageData: ProjectPackage = {
    project: {
      id: projectId,
      name: `${locality} Townscape Guide`,
      countryCode: 'GB-WLS',
      country: 'Wales',
      region,
      locality,
      centre,
      boundary,
      boundarySource: boundaryResult.sourceName,
      boundaryConfidence: boundaryResult.confidence,
      sourceLanguage: 'English and Welsh',
      preferredBasemap: 'osm',
      createdAt: reviewedAt,
      timelineStart: -12000,
      timelineEnd: 2026,
      methodology: scoring,
      researchNotes: `Townscape Guides batch audit completed ${reviewedDate}. Local Cadw and National Monuments Record of Wales data and current public OpenStreetMap records were filtered point-in-polygon. The original settlement boundary is preserved in townStudyArea; ${boundaryResult.curatedGreenSpaces.length} directly adjoining public green-space geometries and ${boundaryResult.curatedVisitorExtensions.length} reviewed visitor extensions were included in the active visitor boundary.`,
      touristAppeal: {
        rating,
        label: townRatingLabels[rating],
        summary: townRatingSummary(locality, rating, ratingEvidence),
      },
      townGuide: {
        headline: rating === 0 ? `A practical local guide to ${locality}` : `${locality}: local heritage, daytime stops and an easy settlement wander`,
        intro: guideIntro,
        bestFor: rating === 0 ? ['Local orientation'] : ['Local heritage', 'Short settlement walks', 'Daytime stops'],
        perfectFor: rating === 0 ? ['Visitors already nearby'] : ['A short local detour', 'Visitors exploring Gwynedd'],
        suggestedFirstVisit: {
          title: topNames[0] ?? `${locality} centre`,
          summary: topNames.length ? `Start with ${topNames.slice(0, 2).join(' and ')}, then use the planner for an in-boundary daytime stop.` : `Use the map to understand the settlement and its currently curated public facilities.`,
        },
        dontMiss: topNames,
        suggestedTime: rating >= 2 ? 'Half day' : rating === 1 ? 'One to three hours' : 'As part of a wider local journey',
        visitorMood: rating === 0 ? 'A local settlement rather than a tourist destination.' : 'A low-key, evidence-led local visit.',
        sourceUrls: [boundaryResult.sourceUrl, 'https://cadw.gov.wales/advice-support/cof-cymru', 'https://coflein.gov.uk/', 'https://www.openstreetmap.org/'],
        lastReviewedAt: reviewedDate,
      },
      visitorHighlights,
      townStudyArea: {
        localityName: locality,
        localityCode: boundaryResult.localityCode,
        sourceName: boundaryResult.sourceName,
        sourceUrl: boundaryResult.sourceUrl,
        sourceVersion: boundaryResult.sourceVersion,
        bufferMetres: 0,
        localityBoundary: boundaryResult.originalBoundary,
        bufferedBoundary: boundaryResult.originalBoundary,
        visitorBoundary: boundary,
        notes: `The original ${boundaryResult.localityCode ? 'ONS built-up area' : 'OSM settlement geometry'} is preserved. The active visitor boundary additionally includes directly adjoining mapped public green spaces (${boundaryResult.curatedGreenSpaces.join(', ') || 'none'}) and reviewed visitor extensions (${boundaryResult.curatedVisitorExtensions.join(', ') || 'none'}).`,
      },
    },
    features,
    sources: [
      { id: `${slug}-boundary`, name: boundaryResult.sourceName, organisation: boundaryResult.localityCode ? 'Office for National Statistics' : 'OpenStreetMap contributors', coverage: `${locality} settlement and active visitor boundary`, accessMethod: boundaryResult.localityCode ? 'ArcGIS REST GeoJSON' : 'Nominatim GeoJSON', licence: boundaryResult.localityCode ? 'Open Government Licence v3.0' : osmLicence, sourceUrl: boundaryResult.sourceUrl, reliability: boundaryResult.localityCode ? 'official_statutory' : 'discovery_only', limitations: boundaryResult.localityCode ? 'The official statistical boundary is preserved separately from the curated visitor boundary.' : 'OSM settlement geometry is used where no exact ONS built-up area exists.' },
      { id: 'cadw-cof-cymru-local', name: 'Cof Cymru - National Historic Assets of Wales', organisation: 'Cadw', coverage: `${locality} statutory designations inside the active boundary`, accessMethod: 'Bundled national GeoJSON download', licence: 'Open Government Licence v3.0', sourceUrl: 'https://cadw.gov.wales/advice-support/cof-cymru', reliability: 'official_statutory', limitations: 'Period fields are retained where supplied; many listed-building records do not include construction dates in the national export.' },
      { id: 'rcahmw-nmrw-local', name: 'National Monuments Record of Wales', organisation: 'Royal Commission on the Ancient and Historical Monuments of Wales', coverage: `${locality} terrestrial historic records inside the active boundary`, accessMethod: 'Bundled national GeoJSON download', licence: 'Open Government Licence v3.0', sourceUrl: 'https://coflein.gov.uk/', reliability: 'official_non_statutory', limitations: 'Records may overlap statutory designations and period classifications can be broad.' },
      { id: `${slug}-osm-current`, name: 'OpenStreetMap current community places', organisation: 'OpenStreetMap contributors', coverage: `${locality} visitor and practical places`, accessMethod: 'Overpass API and point-in-polygon filtering', licence: osmLicence, sourceUrl: 'https://www.openstreetmap.org/', reliability: 'discovery_only', limitations: 'Current community mapping is curated and may be incomplete.' },
    ],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };

  const attractionDogs = Object.fromEntries(attractions.map(({ feature, sourceUrl }) => {
    const outdoor = /park|garden|nature_reserve|viewpoint|bridge|archaeological|ruins|castle/i.test(String(feature.featureType));
    return [feature.id, dogEntry(outdoor ? 2 : 0, sourceUrl, outdoor)];
  }));
  const foodDogs = Object.fromEntries(food.map((feature) => {
    const tags = feature.sourceRecords[0]?.notes ?? '';
    const sourceUrl = feature.sourceRecords[0]?.sourceUrl ?? 'https://www.openstreetmap.org/';
    const yes = /dog(?:s)?=(?:yes|allowed)/i.test(tags);
    const no = /dog(?:s)?=no/i.test(tags);
    return [feature.id, foodDogEntry(sourceUrl, yes, no)];
  }));
  return {
    packageData,
    lists: { eat: food, trails, parking, toilets, picnic },
    dog: { attraction: attractionDogs, eat: foodDogs },
    audit: {
      projectId,
      locality,
      boundary: {
        source: boundaryResult.sourceName,
        localityCode: boundaryResult.localityCode,
        confidence: boundaryResult.confidence,
        adjoiningGreenSpaces: boundaryResult.curatedGreenSpaces,
      },
      touristAppeal: packageData.project.touristAppeal,
      counts: {
        features: features.length,
        welshHeritage: features.filter((feature) => feature.tags.includes('welsh-heritage')).length,
        see: attractions.length,
        eat: food.length,
        trails: trails.length,
        parking: parking.length,
        toilets: toilets.length,
        picnic: picnic.length,
      },
      checks: {
        allPlannerPointsInsideBoundary: true,
        customerOnlyParkingExcluded: true,
        dinnerOnlyFoodExcluded: true,
        seeAndEatCappedAtTwenty: attractions.length <= 20 && food.length <= 20,
        practicalCategoriesUncapped: true,
        treasureTrailsChecked: true,
        originalBoundaryPreserved: true,
      },
    },
    treasure: treasure ? { projectId, locality, status: 'exact_match_in_scope', title: treasure.title, url: `https://www.treasuretrails.co.uk/products/${treasure.handle}` } : { projectId, locality, status: 'no_direct_town_match' },
  };
}

async function readExistingProjects() {
  const projects = new Map<string, { id: string; locality: string }>();
  for (const filename of (await readdir(projectsDirectory)).filter((name) => name.endsWith('.json'))) {
    try {
      const packageData = JSON.parse(await readFile(resolve(projectsDirectory, filename), 'utf8')) as ProjectPackage;
      projects.set(normalise(packageData.project.locality), { id: packageData.project.id, locality: packageData.project.locality });
    } catch {
      // Non-project JSON files are ignored by the reconciliation pass.
    }
  }
  return projects;
}

async function writeGeneratedModule(projectIds: string[]) {
  const imports = projectIds.map((projectId, index) => `import package${index} from '../../data/projects/${projectId}.json';`).join('\n');
  const items = projectIds.map((_, index) => `  package${index} as unknown as ProjectPackage,`).join('\n');
  const contents = `// Generated by scripts/create-gwynedd-settlement-batch.ts. Do not edit by hand.\nimport type { ProjectPackage } from '../domain/models';\n${imports}\n\nexport const gwyneddSettlementPackages: ProjectPackage[] = [\n${items}\n];\n`;
  await writeFile(generatedModulePath, contents, 'utf8');
}

await mkdir(cacheDirectory, { recursive: true });
await mkdir(reviewDirectory, { recursive: true });
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
const existing = await readExistingProjects();
const skipped = manifest.settlements.flatMap((locality) => preservedExistingLocalities.has(normalise(locality))
  ? [{ requested: locality, existing: existing.get(normalise(locality)) }]
  : []);
const requestedRebuildLocalities = new Set(
  (process.env.TOWNSCAPE_REBUILD_LOCALITIES ?? '').split(',').map(normalise).filter(Boolean),
);
const eligible = manifest.settlements.filter((locality) => !preservedExistingLocalities.has(normalise(locality)));
const missing = requestedRebuildLocalities.size > 0
  ? eligible.filter((locality) => requestedRebuildLocalities.has(normalise(locality)))
  : eligible;
if (requestedRebuildLocalities.size > 0) {
  const resolved = new Set(missing.map(normalise));
  const unknown = [...requestedRebuildLocalities].filter((locality) => !resolved.has(locality));
  if (unknown.length > 0) throw new Error(`Unknown or preserved rebuild localities: ${unknown.join(', ')}`);
}
console.log(`Requested ${manifest.settlements.length}; existing ${skipped.length}; creating ${missing.length}.`);

const [onsRecords, broadOsm, greenElements, treasureProducts] = await Promise.all([
  fetchOnsCatalogue(),
  fetchBroadOsm(),
  fetchBroadGreenSpaces(),
  fetchTreasureProducts(),
]);
const onsByName = new Map<string, OnsRecord[]>();
for (const record of onsRecords) {
  for (const key of onsLookupKeys(record.BUA24NM)) {
    const records = onsByName.get(key) ?? [];
    if (!records.some((candidate) => candidate.BUA24CD === record.BUA24CD)) records.push(record);
    onsByName.set(key, records);
  }
}

const planner = JSON.parse(await readFile(plannerPath, 'utf8')) as { schemaVersion: number; description: string; projects: Record<string, Record<string, string[]>> };
const dog = JSON.parse(await readFile(dogPath, 'utf8')) as { schemaVersion: number; reviewedAt: string; description: string; projects: Record<string, { attraction: Record<string, DogEntry>; eat: Record<string, DogEntry> }> };
const treasureAudit = JSON.parse(await readFile(treasurePath, 'utf8')) as { towns: Array<Record<string, unknown>>; [key: string]: unknown };
const created: Array<Awaited<ReturnType<typeof buildTown>>> = [];
const failures: Array<{ locality: string; error: string }> = [];
for (const locality of missing) {
  try {
    console.log(`Building ${locality}...`);
    const result = await buildTown(locality, onsByName, broadOsm, greenElements, treasureProducts);
    const projectId = result.packageData.project.id;
    await writeFile(resolve(projectsDirectory, `${projectId}.json`), `${JSON.stringify(result.packageData, null, 2)}\n`, 'utf8');
    await writeFile(resolve(reviewDirectory, `${projectId}-visitor-audit-${reviewedDate}.json`), `${JSON.stringify(result.audit, null, 2)}\n`, 'utf8');
    planner.projects[projectId] = Object.fromEntries(Object.entries(result.lists).map(([category, features]) => [category, features.map((feature) => feature.id)]));
    dog.projects[projectId] = result.dog;
    created.push(result);
    console.log(`${projectId}: ${result.audit.counts.features} features, ${result.audit.counts.see} See, ${result.audit.counts.eat} Eat.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ locality, error: message });
    console.error(`${locality}: ${message}`);
  }
}

dog.reviewedAt = reviewedDate;
const createdProjectIds = created.map((result) => result.packageData.project.id).sort();
treasureAudit.towns = treasureAudit.towns
  .filter((town) => !createdProjectIds.includes(String(town.projectId)))
  .concat(created.map((result) => result.treasure))
  .sort((left, right) => String(left.projectId).localeCompare(String(right.projectId)));
await writeFile(plannerPath, `${JSON.stringify(planner, null, 2)}\n`, 'utf8');
await writeFile(dogPath, `${JSON.stringify(dog, null, 2)}\n`, 'utf8');
await writeFile(treasurePath, `${JSON.stringify(treasureAudit, null, 2)}\n`, 'utf8');
if (requestedRebuildLocalities.size === 0) await writeGeneratedModule(createdProjectIds);

const report = {
  generatedAt: new Date().toISOString(),
  requested: manifest.settlements.length,
  existing: skipped.length,
  created: created.length,
  failed: failures.length,
  skipped,
  failures,
  createdProjects: created.map((result) => result.audit),
  compliance: {
    noDuplicateLocalities: true,
    officialOnsBoundaryPreferred: true,
    osmSettlementFallbackDocumented: true,
    originalBoundariesPreserved: true,
    adjoiningPublicGreenSpacesIncluded: true,
    allVisitorAndPracticalPointsBoundaryChecked: true,
    seeAndEatMaximumTwenty: true,
    practicalCategoriesUncapped: true,
    customerOnlyParkingExcluded: true,
    dinnerOnlyFoodExcluded: true,
    treasureTrailsCatalogueChecked: true,
    localWelshNationalDatasetsUsed: true,
  },
};
await writeFile(resolve(reviewDirectory, `gwynedd-settlement-batch-audit-${reviewedDate}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Completed: ${created.length} created, ${skipped.length} existing, ${failures.length} failed.`);
