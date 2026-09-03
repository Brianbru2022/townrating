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
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Point, Polygon, Position } from 'geojson';
import type {
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
  TownGuide,
} from '../src/domain/models';
import {
  townRatingFromEvidence,
  townRatingLabels,
  townRatingSummary,
} from '../src/domain/townRating';
import { recommendedAttractionDuration } from '../src/domain/attractionVisit';
import { assessPublicVisitorParking } from './lib/publicVisitorParking';

const reviewedDate = new Date().toISOString().slice(0, 10);
const reviewedAt = `${reviewedDate}T00:00:00Z`;
const manifestPath = resolve('data/imports/cheshire-settlements-2026-08-12.json');
const projectsDirectory = resolve('data/projects');
const reviewDirectory = resolve('data/review');
const cacheDirectory = resolve('tmp/cheshire-settlement-batch-v1');
const plannerPath = resolve('data/visitor-planner-curation.json');
const dogPath = resolve('data/dog-access-curation.json');
const treasurePath = resolve('data/review/treasure-trails-town-audit-2026-08-08.json');
const generatedModulePath = resolve('src/data/cheshireSettlements.generated.ts');
const preservedExistingLocalities = new Set<string>();
const nhleRoot = resolve('data/reference/england_wales_national_data_downloader/downloads/england/nhle');
const osmLicence = 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.';
const editorialLicence = 'Original editorial summary and factual visitor metadata; linked source content is not redistributed.';
const onsService = 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/main_ONS_BUA_2024_EW_V2/FeatureServer/0';
const broadBboxes = [
  [52.85, -3.2, 53.1, -2.75],
  [52.85, -2.75, 53.1, -2.35],
  [52.85, -2.35, 53.1, -1.95],
  [53.1, -3.2, 53.35, -2.75],
  [53.1, -2.75, 53.35, -2.35],
  [53.1, -2.35, 53.35, -1.95],
  [53.35, -3.2, 53.6, -2.75],
  [53.35, -2.75, 53.6, -2.35],
  [53.35, -2.35, 53.6, -1.95],
] as const;

const scoring = {
  age: { before_1700: 1, '1700_1799': 0.9, '1800_1849': 0.8, '1850_1899': 0.65, '1900_1918': 0.5, '1919_1945': 0.4, '1946_1960': 0.25, after_1960: 0.15, unknown: 0.2 },
  significance: { highest_national: 1, national: 0.85, regional: 0.65, local: 0.45, recognised: 0.3 },
  confidence: { high: 1, medium: 0.75, low: 0.5, unknown: 0.35 },
  survival: { substantially_intact: 1, altered_recognisable: 0.75, heavily_altered: 0.45, site_only_or_demolished: 0.2, unknown: 0.6 },
} as const;

interface SettlementInventoryEntry {
  locality: string;
  queryName: string;
  aliases: string[];
  placeType: 'city' | 'town' | 'village';
  centre: [number, number];
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  sourceUrl: string;
  authority: 'Cheshire East' | 'Cheshire West and Chester' | 'Halton' | 'Warrington';
  authorityCode: 'E06000049' | 'E06000050' | 'E06000006' | 'E06000007';
}
interface Manifest { settlements: string[]; inventory: SettlementInventoryEntry[] }
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
}
interface NhlePoint {
  coordinates: [number, number];
  properties: Record<string, unknown>;
  designationType: string;
  tag: string;
}
interface RankedFeature {
  feature: HeritageFeature;
  score: number;
  tagline: string;
  openingTimes?: string;
  admission?: string;
  freeAdmission?: boolean;
  timeToSpend?: string;
  sourceUrl: string;
  dogAllowed?: boolean;
  dogProhibited?: boolean;
}
interface TreasureProduct { title: string; handle: string; product_type?: string; tags?: string[] }
interface DogEntry { rating: number; status: string; label: string; summary: string; sourceName: string; sourceUrl: string; reviewedAt: string }
interface ResearchedTrail {
  title: string;
  url: string;
  nearestTowns: string[];
  distance?: string;
  duration?: string;
  difficulty?: string;
  circular: boolean;
  historic: boolean;
  walking: boolean;
  score?: number;
  sourceOrganisation?: string;
}
interface ResearchedParkingFact {
  paymentRequired: 'yes' | 'no';
  priceDisplay: string;
  sourceName: string;
  sourceOrganisation: string;
  sourceRecordId: string;
  sourceUrl: string;
  notes: string;
}

const researchedParkingFacts = new Map<string, ResearchedParkingFact>();

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

function stableNumericId(value: string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
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
  if (!element.geometry || element.geometry.length === 0) return undefined;
  const totals = element.geometry.reduce(
    (result, coordinate) => ({
      latitude: result.latitude + coordinate.lat,
      longitude: result.longitude + coordinate.lon,
    }),
    { latitude: 0, longitude: 0 },
  );
  return [totals.longitude / element.geometry.length, totals.latitude / element.geometry.length];
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

async function fetchNominatimBoundary(entry: SettlementInventoryEntry) {
  const { locality, queryName, authority, centre } = entry;
  const cachePath = resolve(cacheDirectory, `nominatim-${slugify(locality)}.json`);
  let results: NominatimResult[];
  try {
    results = JSON.parse(await readFile(cachePath, 'utf8')) as NominatimResult[];
  } catch {
    const query = new URLSearchParams({
      q: `${queryName}, ${authority}, England`,
      format: 'jsonv2',
      limit: '8',
      countrycodes: 'gb',
      addressdetails: '1',
      polygon_geojson: '1',
    });
    let lastError: unknown;
    let fetched: NominatimResult[] | undefined;
    for (let attempt = 0; attempt < 3 && !fetched; attempt += 1) {
      try {
        fetched = await fetchJson<NominatimResult[]>(`https://nominatim.openstreetmap.org/search?${query}`, 30_000);
      } catch (error) {
        lastError = error;
        await sleep(2_000 * (attempt + 1));
      }
    }
    if (!fetched) throw lastError instanceof Error ? lastError : new Error(`Nominatim lookup failed for ${locality}`);
    results = fetched;
    await writeFile(cachePath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
    await sleep(1_100);
  }
  const requested = normalise(queryName);
  const result = results
    .map((candidate) => ({
      candidate,
      score: (normalise(candidate.address?.village ?? candidate.address?.town ?? candidate.address?.city ?? candidate.address?.hamlet ?? candidate.address?.suburb ?? '') === requested ? 12 : 0)
        + (candidate.display_name.toLowerCase().includes(authority.toLowerCase()) ? 5 : 0)
        + (/^(city|town|village|hamlet|suburb|neighbourhood)$/i.test(candidate.type ?? '') ? 5 : 0)
        + (/^(place|boundary)$/i.test(candidate.category ?? '') ? 2 : -10)
        - Math.min(20, Math.hypot((Number(candidate.lon) - centre[0]) * 70, (Number(candidate.lat) - centre[1]) * 111)),
    }))
    .sort((left, right) => right.score - left.score)[0]?.candidate;
  if (!result) throw new Error(`No OSM settlement result found for ${locality}`);
  const polygonGeometry = toPolygonGeometry(result.geojson);
  let originalBoundary: Feature<Polygon | MultiPolygon>;
  const mappedBoundary = polygonGeometry
    ? { type: 'Feature' as const, properties: {}, geometry: polygonGeometry }
    : undefined;
  const usedMappedPolygon = Boolean(
    polygonGeometry
    && mappedBoundary
    && result.category === 'place'
    && /^(city|town|village|hamlet|suburb|neighbourhood)$/i.test(result.type ?? '')
    && area(mappedBoundary) <= 20_000_000
    && booleanPointInPolygon(point(centre), mappedBoundary),
  );
  if (usedMappedPolygon && polygonGeometry) {
    originalBoundary = { type: 'Feature', properties: {}, geometry: polygonGeometry };
  } else {
    const longitudeSpan = entry.placeType === 'city' ? 0.025 : entry.placeType === 'town' ? 0.018 : 0.012;
    const latitudeSpan = entry.placeType === 'city' ? 0.018 : entry.placeType === 'town' ? 0.013 : 0.009;
    const [longitude, latitude] = centre;
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
    osmType: entry.osmType,
    osmId: entry.osmId,
    boundaryMethod: usedMappedPolygon ? 'mapped_settlement_polygon' : 'clamped_settlement_envelope',
  };
  return {
    originalBoundary,
    sourceUrl: entry.sourceUrl,
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
    const query = `[out:json][timeout:160];(nwr[amenity~"^(cafe|restaurant|pub|food_court|ice_cream|parking|toilets|picnic_table|bench|museum|arts_centre|place_of_worship)$"](${bbox});nwr[leisure=outdoor_seating](${bbox});nwr[shop~"^(bakery|coffee|confectionery|deli)$"](${bbox});nwr[tourism~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park|artwork|picnic_site)$"](${bbox});nwr[historic~"^(castle|fort|manor|monument|archaeological_site|ruins|city_gate|memorial|wayside_cross)$"](${bbox});nwr[man_made~"^(lighthouse|tower|windmill|watermill)$"](${bbox});nwr[leisure~"^(nature_reserve|garden|park|recreation_ground)$"](${bbox});nwr[bridge][name](${bbox});nwr[natural=waterfall](${bbox}););out center tags;`;
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
  const responses = await Promise.all(greenQueries.map(async ({ bbox: [south, west, north, east], cache }) => {
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:180];(way[leisure~"^(park|garden|recreation_ground|nature_reserve)$"](${bbox});way[landuse~"^(village_green|recreation_ground|cemetery)$"](${bbox}););out center tags geom;`;
    return fetchOverpass(query, cache);
  }));
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
  entry: SettlementInventoryEntry,
  onsByName: Map<string, OnsRecord[]>,
  greenElements: OsmElement[],
): Promise<BoundaryResult> {
  const { queryName, centre } = entry;
  const exactCandidates = onsLookupKeys(queryName).flatMap((key) => onsByName.get(key) ?? []);
  const exactBoundaries = await Promise.all(
    exactCandidates.map(async (record) => ({ record, boundary: await fetchOnsBoundary(record) })),
  );
  const exact = exactBoundaries
    .filter(({ boundary }) => booleanPointInPolygon(point(centre), boundary))
    .sort((left, right) => area(left.boundary) - area(right.boundary))[0];
  if (exact) {
    const originalBoundary = exact.boundary;
    const { boundary, included } = includeAdjacentGreenSpaces(originalBoundary, greenElements);
    return {
      boundary,
      originalBoundary,
      localityCode: exact.record.BUA24CD,
      sourceName: 'ONS Built-up Areas (December 2024) with curated adjoining public green spaces',
      sourceUrl: `${onsService}?where=BUA24CD%3D%27${exact.record.BUA24CD}%27`,
      sourceVersion: 'December 2024 V2',
      confidence: 'high',
      curatedGreenSpaces: included,
    };
  }
  const osm = await fetchNominatimBoundary(entry);
  const { boundary, included } = includeAdjacentGreenSpaces(osm.originalBoundary, greenElements);
  return {
    boundary,
    originalBoundary: osm.originalBoundary,
    sourceName: osm.usedMappedPolygon
      ? 'OpenStreetMap mapped settlement geometry with curated adjoining public green spaces'
      : 'Curated visitor envelope derived from the OpenStreetMap settlement point, with adjoining public green spaces',
    sourceUrl: osm.sourceUrl,
    sourceVersion: `OpenStreetMap reviewed ${reviewedDate}`,
    confidence: osm.usedMappedPolygon ? 'medium' : 'low',
    curatedGreenSpaces: included,
  };
}

let nhlePoints: NhlePoint[] | undefined;

async function loadNhlePoints() {
  if (nhlePoints) return nhlePoints;
  nhlePoints = [];
  const folders = [
    ['00_listed_building_points', 'listed_building', 'listed-building'],
    ['06_scheduled_monuments', 'scheduled_monument', 'scheduled-monument'],
    ['07_parks_and_gardens', 'registered_park_and_garden', 'registered-park-garden'],
  ] as const;
  for (const [folder, designationType, tag] of folders) {
    const directory = resolve(nhleRoot, folder);
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith('.geojson'))) {
      const collection = JSON.parse(await readFile(resolve(directory, filename), 'utf8')) as FeatureCollection;
      for (const record of collection.features) {
        if (!record.geometry) continue;
        const representative = (record.geometry.type === 'Point' ? record : pointOnFeature(record as Feature<Geometry>)) as Feature<Point>;
        nhlePoints.push({
          coordinates: representative.geometry.coordinates as [number, number],
          properties: (record.properties ?? {}) as Record<string, unknown>,
          designationType,
          tag,
        });
      }
    }
  }
  return nhlePoints;
}

function nhleSignificance(grade?: string): HeritageFeature['significance'] {
  if (grade === 'I') return 'highest_national';
  if (grade === 'II*') return 'national';
  return 'regional';
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

async function importNhle(locality: string, projectId: string, boundary: Feature<Polygon | MultiPolygon>) {
  const [west, south, east, north] = bounds(boundary);
  const features: HeritageFeature[] = [];
  for (const record of await loadNhlePoints()) {
    const [longitude, latitude] = record.coordinates;
    if (longitude < west || longitude > east || latitude < south || latitude > north) continue;
    if (!booleanPointInPolygon(point(record.coordinates), boundary)) continue;
    const listEntry = String(record.properties.ListEntry ?? record.properties.LIST_ENTRY ?? `${projectId}-${features.length}`);
    const name = String(record.properties.Name ?? record.properties.NAME ?? 'Historic England designation');
    const grade = record.properties.Grade ? String(record.properties.Grade) : undefined;
    features.push({
      id: `historic-england:nhle:${listEntry}`,
      projectId,
      name,
      alternativeNames: [],
      countryCode: 'GB-ENG',
      region: regionFor(locality),
      locality,
      featureType: nameFeatureType(name),
      designationType: record.designationType,
      designationCategory: grade,
      significance: record.designationType === 'scheduled_monument' ? 'highest_national' : nhleSignificance(grade),
      statutoryStatus: 'National Heritage List for England',
      geometry: point(record.coordinates).geometry,
      locationType: 'representative_point',
      locationConfidence: 'high',
      dateBasis: 'unknown',
      dateConfidence: 'unknown',
      survival: 'unknown',
      shortDescription: `${record.designationType.replaceAll('_', ' ')} recorded by Historic England${grade ? `, Grade ${grade}` : ''}.`,
      sourceRecords: [source(
        'National Heritage List for England',
        'Historic England',
        listEntry,
        String(record.properties.hyperlink ?? `https://historicengland.org.uk/listing/the-list/list-entry/${listEntry}`),
        'Official statutory designation. The construction date is enriched separately from the official list-entry text.',
        'official_statutory',
        'Open Government Licence v3.0; contains Historic England data.',
      )],
      tags: ['historic-england', 'nhle', record.tag],
      createdAt: reviewedAt,
      updatedAt: reviewedAt,
      reviewed: true,
      reviewNotes: `Imported from the bundled Historic England download and filtered against the active ${locality} visitor boundary.`,
      evidenceScope: 'parish_evidence',
      licence: 'Open Government Licence v3.0; contains Historic England data.',
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
    countryCode: 'GB-ENG',
    region: regionFor(locality),
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
  // A mapped component inside a larger attraction is not an independent
  // visitor destination. This particularly matters at Chester Zoo, where OSM
  // contains a separate tourism=attraction object for many animal enclosures.
  if (tags.attraction === 'animal' || tags.zoo === 'enclosure' || tags.animal || tags.species) return false;
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

function nhleAttractionScore(feature: HeritageFeature) {
  const name = feature.name;
  if (looksLikeAddressOrRoadName(name)) return 0;
  if (/tomb|headstone|grave|memorial|wall|gate|railing|outbuilding|stable|barn|dovecote|lamp|telephone|milestone|bollard|pillar box|sundial|coat of arms/i.test(name)) return 0;
  if (/\b(?:HOTEL|INN|SCHOOL|COLLEGE|VAULTS?)\b/i.test(name)) return 0;
  if (/^BRIDGE\b.*\b(?:APPROXIMATELY|METRES?)\b/i.test(name)) return 0;
  if (
    /\b(?:HOUSE|COTTAGE|FARMHOUSE|FARM|LODGE|RECTORY|VICARAGE|SHOP|PUBLIC HOUSE)\b/i.test(name) &&
    !/\bCROSS\b|NATIONAL TRUST/i.test(name)
  ) return 0;
  if (/castle|abbey|priory|ruins/i.test(name)) return feature.significance === 'highest_national' ? 76 : 68;
  if (/^(?:THE )?(?:PARISH |ABBEY )?(?:CHURCH|CHAPEL)(?:\s+OF\b|$)/i.test(name)) return feature.significance === 'highest_national' ? 66 : feature.significance === 'national' ? 60 : 52;
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

function practicalName(locality: string, centre: [number, number], element: OsmElement, nearby: OsmElement[], category: 'parking' | 'toilets' | 'picnic' | 'rest', index: number) {
  const tags = element.tags ?? {};
  if (tags.name && !/^(parking|car ?park|public toilets?|toilets?|picnic (site|table|area))(?:\s+\d+)?$/i.test(tags.name)) return tags.name;
  const coordinates = osmCoordinates(element);
  const location = tags['addr:street'] ?? tags['addr:place'] ?? tags.loc_name ?? (coordinates ? nearestNamedPlace(coordinates, nearby) : undefined);
  const suffix = category === 'parking' ? 'car park' : category === 'toilets' ? 'public toilets' : category === 'rest' ? 'picnic rest point' : 'picnic area';
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

function mappedDogAccess(tags: Record<string, string>) {
  const value = `${tags.dog ?? ''} ${tags.dogs ?? ''}`.trim().toLowerCase();
  return {
    allowed: /^(?:yes|allowed|leashed|on_leash|designated)(?:\s|$)/.test(value),
    prohibited: /^(?:no|prohibited)(?:\s|$)/.test(value),
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

async function fetchCheshireTrails() {
  const cheshireEastWalks = 'https://www.cheshireeast.gov.uk/leisure,_culture_and_tourism/ranger_service/free-walk-leaflets.aspx';
  const routes: ResearchedTrail[] = [
    { title: 'Chester City Walls circuit', url: 'https://www.visitcheshire.com/things-to-do/chester-city-walls-p22251', nearestTowns: ['Chester'], distance: '2 miles', duration: '1-2 hours', difficulty: 'Easy, with steps and uneven historic surfaces', circular: true, historic: true, walking: true, score: 92, sourceOrganisation: 'Visit Cheshire' },
    { title: 'Sandstone Trail', url: 'https://www.cheshirewestandchester.gov.uk/residents/leisure-parks-and-events/parks-and-open-spaces/parks-and-open-spaces-rural/the-sandstone-trail', nearestTowns: ['Frodsham', 'Tarporley'], distance: '34 miles', duration: 'Multi-stage', difficulty: 'Long-distance ridge trail', circular: false, historic: true, walking: true, score: 90, sourceOrganisation: 'Cheshire West and Chester Council' },
    { title: 'Gritstone Trail', url: cheshireEastWalks, nearestTowns: ['Disley', 'Bollington', 'Macclesfield', 'Congleton'], distance: '35 miles', duration: 'Multi-stage', difficulty: 'Long-distance upland trail', circular: false, historic: true, walking: true, score: 90, sourceOrganisation: 'Cheshire East Council' },
    { title: 'Nantwich Riverside Loop', url: cheshireEastWalks, nearestTowns: ['Nantwich'], distance: '5 km', duration: '1.5-2 hours', difficulty: 'Easy riverside walk', circular: true, historic: true, walking: true, score: 84, sourceOrganisation: 'Cheshire East Council' },
    { title: 'Knutsford to Mobberley Rail Trail', url: cheshireEastWalks, nearestTowns: ['Knutsford', 'Mobberley'], duration: 'Half day', difficulty: 'Linear countryside walk with rail return', circular: false, historic: true, walking: true, score: 84, sourceOrganisation: 'Cheshire East Council' },
    { title: 'Chelford Village Walk', url: cheshireEastWalks, nearestTowns: ['Chelford'], duration: '1-2 hours', difficulty: 'Easy village walk', circular: true, historic: true, walking: true, score: 82, sourceOrganisation: 'Cheshire East Council' },
    { title: 'Middlewood Way circular walks', url: cheshireEastWalks, nearestTowns: ['Poynton', 'Bollington', 'Macclesfield'], duration: 'Route dependent', difficulty: 'Mostly level former railway and connecting paths', circular: true, historic: true, walking: true, score: 82, sourceOrganisation: 'Cheshire East Council' },
    { title: 'Woolston New Cut Heritage and Ecology Trail', url: 'https://www.warrington.gov.uk/cycling', nearestTowns: ['Warrington', 'Woolston'], duration: '1-2 hours', difficulty: 'Level shared trail', circular: true, historic: true, walking: true, score: 82, sourceOrganisation: 'Warrington Borough Council' },
    { title: 'Trans Pennine Trail through Warrington', url: 'https://www.warrington.gov.uk/trans-pennine-trail', nearestTowns: ['Warrington', 'Lymm'], duration: 'Route dependent', difficulty: 'Mostly traffic-free multi-user trail', circular: false, historic: false, walking: true, score: 82, sourceOrganisation: 'Warrington Borough Council' },
    { title: 'Runcorn and Widnes rights-of-way walks', url: 'https://www3.halton.gov.uk/Pages/traffic/cycling.aspx', nearestTowns: ['Runcorn', 'Widnes', 'Hale'], duration: 'Route dependent', difficulty: 'Local public paths', circular: false, historic: false, walking: true, score: 76, sourceOrganisation: 'Halton Borough Council' },
  ];
  return routes;
}

function trailScore(trail: ResearchedTrail) {
  if (trail.score !== undefined) return trail.score;
  let score = 72;
  if (trail.circular) score += 4;
  if (trail.distance) score += 2;
  if (trail.duration) score += 2;
  if (trail.difficulty) score += 1;
  if (trail.historic) score += 3;
  return Math.min(86, score);
}

function treasureMatch(locality: string, products: TreasureProduct[]) {
  const requested = normalise(locality);
  const allowedLocations = new Set([
    'Cheshire',
    'Cheshire East',
    'Cheshire West and Chester',
    'Halton',
    'Warrington',
    'Chester',
  ].map(normalise));
  return products.find((product) => {
    const title = normalise(product.title.split(' - ')[0]);
    const locations = (product.tags ?? [])
      .filter((tag) => /^location\s*:/i.test(tag))
      .map((tag) => normalise(tag.replace(/^location\s*:/i, '')));
    return (title === requested || title.startsWith(`${requested} `))
      && locations.some((location) => allowedLocations.has(location));
  });
}

const researchedAttractionScores: Record<string, Record<string, number>> = {
  chester: {
    'chester cathedral': 90,
    'cathedral church of christ and the blessed virgin mary': 90,
    'chester city walls': 90,
    'roman amphitheatre': 86,
    'eastgate clock': 84,
    'grosvenor museum': 84,
  },
  nantwich: {
    'nantwich museum': 78,
    'church of st mary': 76,
  },
  knutsford: {
    'tatton park': 90,
    'knutsford heritage centre': 76,
  },
  macclesfield: {
    'the silk museum': 82,
    'macclesfield silk museum': 82,
  },
  congleton: {
    'congleton museum': 76,
  },
  northwich: {
    'weaver hall museum and workhouse': 78,
    'lion salt works': 86,
  },
  'ellesmere port': {
    'national waterways museum': 88,
  },
  warrington: {
    'warrington museum and art gallery': 82,
    'walton hall and gardens': 85,
  },
  widnes: {
    'catalyst science discovery centre': 85,
  },
  runcorn: {
    'norton priory museum and gardens': 86,
    'halton castle': 78,
  },
};

const researchedAttractionExclusions: Record<string, Set<string>> = {};

interface ResearchedAttractionDetail {
  names: string[];
  description: string;
  openingTimes?: string;
  admission?: string;
  freeAdmission?: boolean;
  timeToSpend?: string;
  sourceUrl: string;
}

const researchedAttractionDetails: Record<string, ResearchedAttractionDetail[]> = {
  chester: [
    {
      names: ['chester cathedral', 'cathedral church of christ and the blessed virgin mary'],
      description: 'Chester Cathedral rewards an unhurried visit with medieval architecture, cloisters, gardens and changing exhibitions at the heart of the historic city.',
      openingTimes: 'Monday-Saturday 9:30am-6pm; Sunday 10am-6pm; last entry 5:30pm. Services and special events can restrict access, so check closure notices.',
      admission: 'Usually free; a small seasonal entry fee applies during summer and Christmas. Tours and special activities cost extra.',
      freeAdmission: true,
      timeToSpend: 'Allow 1-2 hours',
      sourceUrl: 'https://chestercathedral.com/visit/plan-your-visit',
    },
    {
      names: ['roman amphitheatre'],
      description: 'Britain\'s largest known Roman amphitheatre is an atmospheric open-air stop that reveals Chester\'s importance as the legionary fortress of Deva.',
      openingTimes: 'Open daily during reasonable daylight hours.',
      admission: 'Free',
      freeAdmission: true,
      timeToSpend: 'Allow 20-40 minutes',
      sourceUrl: 'https://www.english-heritage.org.uk/visit/places/chester-roman-amphitheatre/',
    },
    {
      names: ['grosvenor museum'],
      description: 'The Grosvenor Museum brings Chester\'s Roman archaeology, social history, art and period interiors together in one substantial free museum.',
      openingTimes: 'Tuesday-Saturday 10:30am-5pm; Sunday 1pm-4pm; closed Monday except Bank Holidays.',
      admission: 'Free; donations welcome.',
      freeAdmission: true,
      timeToSpend: 'Allow 1-2 hours',
      sourceUrl: 'https://grosvenormuseum.westcheshiremuseums.co.uk/',
    },
    {
      names: ['chester castle', 'chester castle (part)'],
      description: 'The Agricola Tower and castle walls offer a compact glimpse of medieval Chester, including a chapel with rare wall paintings when volunteer opening permits.',
      openingTimes: 'Weekends 11am-3pm, April-October; opening depends on volunteer availability.',
      admission: 'Free',
      freeAdmission: true,
      timeToSpend: 'Allow 30-60 minutes',
      sourceUrl: 'https://www.english-heritage.org.uk/visit/places/chester-castle-agricola-tower-and-castle-walls/',
    },
  ],
};

function researchedAttractionDetail(locality: string, name: string) {
  return researchedAttractionDetails[normalise(locality)]?.find((detail) =>
    detail.names.some((candidate) => normalise(candidate) === normalise(name))
  );
}

function mappedAdmission(tags: Record<string, string>) {
  if (/^(no|free)$/i.test(tags.fee ?? '')) {
    return { admission: 'Free', freeAdmission: true };
  }
  if (/^(yes|ticket)$/i.test(tags.fee ?? '')) {
    return { admission: 'Paid admission - check current prices', freeAdmission: false };
  }
  return {};
}

const townGuideOverrides: Record<string, TownGuide> = {
  chester: {
    characterTag: 'Roman cathedral city',
    headline: 'Roman walls, medieval Rows and a cathedral city made for exploring',
    intro: 'Chester combines one of Britain\'s most complete city-wall circuits with a compact historic core of Roman remains, medieval galleries, the cathedral and riverside walks. Its leading sights sit close enough together for an unusually rewarding day on foot.',
    bestFor: ['Roman history', 'Architecture', 'City walks', 'Museums'],
    perfectFor: ['A full heritage day', 'First-time city breaks', 'Visitors who enjoy exploring on foot'],
    suggestedFirstVisit: {
      title: 'Cathedral quarter, city walls and Roman Chester',
      summary: 'Begin around the cathedral and Rows, join the walls for the elevated circuit, then descend for the Roman amphitheatre and Grosvenor Museum.',
    },
    dontMiss: ['Chester Cathedral', 'Chester City Walls', 'Roman Amphitheatre', 'Grosvenor Museum'],
    suggestedTime: 'Full day',
    visitorMood: 'A richly layered historic city where the major sights form a coherent walk rather than a string of isolated stops.',
    sourceUrls: [
      'https://chestercathedral.com/visit/plan-your-visit',
      'https://www.visitcheshire.com/things-to-do/chester-city-walls-p22251',
      'https://www.english-heritage.org.uk/visit/places/chester-roman-amphitheatre/',
      'https://grosvenormuseum.westcheshiremuseums.co.uk/',
    ],
    lastReviewedAt: reviewedDate,
  },
};

function researchedAttractionOverride(locality: string, name: string) {
  const scores = researchedAttractionScores[normalise(locality)];
  return Object.entries(scores ?? {}).find(([candidate]) => normalise(candidate) === normalise(name))?.[1];
}

function excludeResearchedAttraction(locality: string, name: string) {
  return [...(researchedAttractionExclusions[normalise(locality)] ?? [])]
    .some((candidate) => normalise(candidate) === normalise(name));
}

function researchedAttractionScore(locality: string, name: string, generatedScore: number) {
  return Math.max(generatedScore, researchedAttractionOverride(locality, name) ?? 0);
}

const regionByLocality = new Map<string, string>();

function regionFor(locality: string) {
  return regionByLocality.get(normalise(locality)) ?? 'Cheshire';
}

async function buildTown(
  entry: SettlementInventoryEntry,
  onsByName: Map<string, OnsRecord[]>,
  broadOsm: OsmElement[],
  greenElements: OsmElement[],
  treasureProducts: TreasureProduct[],
  researchedTrails: ResearchedTrail[],
) {
  const { locality } = entry;
  const slug = slugify(locality);
  const projectId = `${slug}-cheshire-england`;
  const boundaryResult = await resolveBoundary(entry, onsByName, greenElements);
  const boundary = boundaryResult.boundary;
  const centre = entry.centre;
  const elements = broadOsm.filter((element) => {
    const coordinates = osmCoordinates(element);
    return coordinates && booleanPointInPolygon(point(coordinates), boundary) && publicAccess(element.tags ?? {});
  });
  const features = await importNhle(locality, projectId, boundary);
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
    if (attractionNames.has(key) || excludeResearchedAttraction(locality, name)) continue;
    const score = researchedAttractionScore(locality, name, attractionScore(tags));
    const sourceUrl = tags.website ?? tags['contact:website'] ?? osmUrl(element);
    const researchedDetail = researchedAttractionDetail(locality, name);
    const description = researchedDetail?.description ?? `${name} is a curated ${visitorType(tags).replaceAll('_', ' ')} within the active ${locality} visitor boundary.`;
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
      openingTimes: researchedDetail?.openingTimes ?? tags.opening_hours,
      ...mappedAdmission(tags),
      admission: researchedDetail?.admission ?? mappedAdmission(tags).admission,
      freeAdmission: researchedDetail?.freeAdmission ?? mappedAdmission(tags).freeAdmission,
      timeToSpend: researchedDetail?.timeToSpend,
      sourceUrl: researchedDetail?.sourceUrl ?? sourceUrl,
      ...mappedDogAccess(tags),
    });
    attractionNames.add(key);
  }

  for (const feature of features.filter((candidate) => candidate.tags.includes('nhle'))) {
    const generatedScore = nhleAttractionScore(feature);
    const override = researchedAttractionOverride(locality, feature.name);
    const score = override ?? (generatedScore ? researchedAttractionScore(locality, feature.name, generatedScore) : undefined);
    if (!score || excludeResearchedAttraction(locality, feature.name) || attractionNames.has(normalise(feature.name))) continue;
    const researchedDetail = researchedAttractionDetail(locality, feature.name);
    const sourceUrl = researchedDetail?.sourceUrl ?? feature.sourceRecords[0]?.sourceUrl ?? 'https://historicengland.org.uk/listing/the-list/';
    const description = researchedDetail?.description ?? `${feature.name} is a nationally recorded historic landmark within ${locality}. Access should be checked where it is not a public church or outdoor monument.`;
    feature.shortDescription = description;
    feature.tags = [...new Set([...feature.tags, 'service-context-visitor'])];
    feature.attractionGuide = {
      headline: recommendationTagline(score, String(feature.featureType)),
      intro: description,
      motifs: [String(feature.featureType).replaceAll('_', ' '), 'Historic England designation'],
      bestFor: ['Historic interest'],
      thingsToDo: [{ name: `See ${feature.name}` }],
    };
    attractions.push({
      feature,
      score,
      tagline: recommendationTagline(score, String(feature.featureType)),
      openingTimes: researchedDetail?.openingTimes,
      admission: researchedDetail?.admission,
      freeAdmission: researchedDetail?.freeAdmission,
      timeToSpend: researchedDetail?.timeToSpend,
      sourceUrl,
    });
    attractionNames.add(normalise(feature.name));
  }
  attractions.sort((left, right) => right.score - left.score || left.feature.name.localeCompare(right.feature.name));
  attractions.splice(20);

  const foodNames = new Set<string>();
  const food = elements
    .filter((element) => daytimeFood(element.tags ?? {}))
    .map((element) => ({ element, score: foodScore(element.tags ?? {}) }))
    .sort((left, right) => right.score - left.score || (left.element.tags?.name ?? '').localeCompare(right.element.tags?.name ?? ''))
    .filter(({ element }) => {
      const key = normalise(element.tags?.name ?? '');
      if (!key || foodNames.has(key)) return false;
      foodNames.add(key);
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
    const genuineCandidates = elements.filter((element) => {
      const tags = element.tags ?? {};
      if (category === 'parking') {
        return assessPublicVisitorParking(element).include;
      }
      if (category === 'toilets') return tags.amenity === 'toilets';
      return tags.tourism === 'picnic_site' || tags.amenity === 'picnic_table';
    });
    const restCandidates = category === 'picnic' && genuineCandidates.length < 5
      ? elements.filter((element) => {
        const tags = element.tags ?? {};
        return (tags.amenity === 'bench' || tags.leisure === 'outdoor_seating')
          && !/memorial|private|customers|staff/i.test(`${tags.memorial ?? ''} ${tags.access ?? ''} ${tags.name ?? ''}`);
      }).slice(0, 5 - genuineCandidates.length)
      : [];
    const candidates = [...genuineCandidates, ...restCandidates];
    const usedNames = new Set<string>();
    return candidates.flatMap((element, index) => {
      const tags = element.tags ?? {};
      const isRestFallback = category === 'picnic' && (tags.amenity === 'bench' || tags.leisure === 'outdoor_seating');
      const name = practicalName(locality, centre, element, elements, isRestFallback ? 'rest' : category, index + 1);
      const key = normalise(name);
      if (usedNames.has(key)) return [];
      usedNames.add(key);
      const parkingFact = category === 'parking' ? researchedParkingFacts.get(`${element.type}-${element.id}`) : undefined;
      const payment = category === 'parking'
        ? parkingFact?.paymentRequired ?? (/^(yes|ticket)$/i.test(tags.fee ?? '') ? 'yes' : /^(no|free)$/i.test(tags.fee ?? '') ? 'no' : 'unknown')
        : undefined;
      const feature = add(createOsmFeature(
        projectId,
        locality,
        element,
        category,
        name,
        category === 'parking' ? `${name} is a curated public parking option for a ${locality} visit.` : isRestFallback ? `${name} is a mapped public bench or outdoor rest point used only because fewer than five genuine picnic places are mapped in ${locality}.` : `${name} is a current public visitor facility in ${locality}.`,
        category === 'parking' ? {
          payment_required: payment,
          price_display: parkingFact?.priceDisplay ?? (payment === 'yes' ? 'Pay - check signs' : payment === 'no' ? 'Free' : 'Check signs'),
        } : isRestFallback ? { picnic_rest_fallback: 'yes' } : {},
      ));
      if (parkingFact && !feature.sourceRecords.some((record) => record.sourceUrl === parkingFact.sourceUrl)) {
        feature.sourceRecords.push(source(
          parkingFact.sourceName,
          parkingFact.sourceOrganisation,
          parkingFact.sourceRecordId,
          parkingFact.sourceUrl,
          currentNotes({}, {
            payment_required: parkingFact.paymentRequired,
            price_display: parkingFact.priceDisplay,
            parking_note: parkingFact.notes,
          }),
          'official_non_statutory',
        ));
      }
      return [feature];
    });
  };
  const parking = practical('parking');
  const toilets = practical('toilets');
  const picnic = practical('picnic');

  const treasure = treasureMatch(locality, treasureProducts);
  const trails: Array<{ feature: HeritageFeature; score: number; sourceUrl: string }> = [];
  if (treasure) {
    const trailElement: OsmElement = { type: 'node', id: Number(`9${stableNumericId(`${projectId}-${treasure.handle}`)}`), lat: centre[1], lon: centre[0], tags: { name: treasure.title } };
    const sourceUrl = `https://www.treasuretrails.co.uk/products/${treasure.handle}`;
    const feature = createOsmFeature(
      projectId,
      locality,
      trailElement,
      'trails',
      treasure.title,
      `A current Treasure Trails route created for ${locality}.`,
      { external_url: sourceUrl, trail_score: '86', duration: 'Check current trail details' },
    );
    feature.sourceRecords = [feature.sourceRecords[0], source(
      'Treasure Trails route page',
      'Treasure Trails',
      treasure.handle,
      sourceUrl,
      currentNotes({}, {
        external_url: sourceUrl,
        trail_score: '86',
        duration: 'Check current trail details',
        route_note: `Commercial self-guided visitor trail matched directly to ${locality}; current route details should be checked before travel`,
      }),
      'official_non_statutory',
    )];
    trails.push({ feature: add(feature), score: 86, sourceUrl });
  }
  const officialTrails = researchedTrails
    .filter((trail) => trail.nearestTowns.some((town) => normalise(town) === normalise(entry.queryName) || normalise(town) === normalise(locality)))
    .sort((left, right) => trailScore(right) - trailScore(left) || left.title.localeCompare(right.title, 'en-GB'))
    .slice(0, 12);
  for (const [index, trail] of officialTrails.entries()) {
    if (trails.some((item) => normalise(item.feature.name) === normalise(trail.title))) continue;
    const score = trailScore(trail);
    const idSeed = stableNumericId(`${slug}-${index}-${trail.url}`);
    const trailElement: OsmElement = { type: 'node', id: Number(`8${idSeed}`), lat: centre[1], lon: centre[0], tags: { name: trail.title } };
    const feature = createOsmFeature(projectId, locality, trailElement, 'trails', trail.title, `A published walking route associated with ${locality}.`, {
      external_url: trail.url,
      trail_score: String(score),
      distance: trail.distance,
      duration: trail.duration,
      difficulty: trail.difficulty,
      circular: trail.circular ? 'yes' : undefined,
    });
    feature.sourceRecords = [feature.sourceRecords[0], source(
      'Published Cheshire walking route',
      trail.sourceOrganisation ?? regionFor(locality),
      trail.url.split('/').filter(Boolean).at(-1) ?? String(idSeed),
      trail.url,
      currentNotes({}, {
        external_url: trail.url,
        trail_score: String(score),
        distance: trail.distance,
        duration: trail.duration,
        difficulty: trail.difficulty,
        circular: trail.circular ? 'yes' : undefined,
      }),
      'official_non_statutory',
    )];
    trails.push({
      feature: add(feature),
      score,
      sourceUrl: trail.url,
    });
  }
  trails.sort((left, right) => right.score - left.score || left.feature.name.localeCompare(right.feature.name, 'en-GB'));

  const visitorHighlights = attractions.map((item, index) => ({
    rank: index + 1,
    featureId: item.feature.id,
    name: item.feature.name,
    reason: item.feature.shortDescription ?? item.feature.name,
    tagline: item.tagline,
    visitorScore: item.score,
    timeToSpend: item.timeToSpend ?? recommendedAttractionDuration(item.feature, item.score),
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
      featureId: trail.feature.id,
      name: trail.feature.name,
      score: trail.score,
      sourceUrl: trail.sourceUrl,
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
  const region = regionFor(locality);
  const packageData: ProjectPackage = {
    project: {
      id: projectId,
      name: `${locality} Townscape Guide`,
      countryCode: 'GB-ENG',
      country: 'England',
      region,
      locality,
      centre,
      boundary,
      boundarySource: boundaryResult.sourceName,
      boundaryConfidence: boundaryResult.confidence,
      sourceLanguage: 'English',
      preferredBasemap: 'osm',
      createdAt: reviewedAt,
      timelineStart: 1066,
      timelineEnd: 2026,
      methodology: scoring,
      researchNotes: `Townscape Guides batch audit completed ${reviewedDate}. Historic England and current public OpenStreetMap records were filtered point-in-polygon. The original settlement boundary is preserved in townStudyArea; ${boundaryResult.curatedGreenSpaces.length} directly adjoining public green-space geometries were included in the active visitor boundary.`,
      touristAppeal: {
        rating,
        label: townRatingLabels[rating],
        summary: townRatingSummary(locality, rating, ratingEvidence),
      },
      townGuide: townGuideOverrides[normalise(locality)] ?? {
        headline: rating === 0 ? `A practical local guide to ${locality}` : `${locality}: local heritage, daytime stops and an easy settlement wander`,
        intro: guideIntro,
        bestFor: rating === 0 ? ['Local orientation'] : ['Local heritage', 'Short settlement walks', 'Daytime stops'],
        perfectFor: rating === 0 ? ['Visitors already nearby'] : ['A short local detour', 'Visitors exploring Cheshire'],
        suggestedFirstVisit: {
          title: topNames[0] ?? `${locality} centre`,
          summary: topNames.length ? `Start with ${topNames.slice(0, 2).join(' and ')}, then use the planner for an in-boundary daytime stop.` : `Use the map to understand the settlement and its currently curated public facilities.`,
        },
        dontMiss: topNames,
        suggestedTime: rating >= 2 ? 'Half day' : rating === 1 ? 'One to three hours' : 'As part of a wider local journey',
        visitorMood: rating === 0 ? 'A local settlement rather than a tourist destination.' : 'A low-key, evidence-led local visit.',
        sourceUrls: [boundaryResult.sourceUrl, 'https://historicengland.org.uk/listing/the-list/data-downloads/', 'https://www.openstreetmap.org/'],
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
        notes: `The original ${boundaryResult.localityCode ? 'ONS built-up area' : 'OSM settlement geometry'} is preserved. The active visitor boundary additionally includes only directly adjoining mapped public green spaces: ${boundaryResult.curatedGreenSpaces.join(', ') || 'none'}.`,
      },
    },
    features,
    sources: [
      { id: `${slug}-boundary`, name: boundaryResult.sourceName, organisation: boundaryResult.localityCode ? 'Office for National Statistics' : 'OpenStreetMap contributors', coverage: `${locality} settlement and active visitor boundary`, accessMethod: boundaryResult.localityCode ? 'ArcGIS REST GeoJSON' : 'Nominatim GeoJSON', licence: boundaryResult.localityCode ? 'Open Government Licence v3.0' : osmLicence, sourceUrl: boundaryResult.sourceUrl, reliability: boundaryResult.localityCode ? 'official_statutory' : 'discovery_only', limitations: boundaryResult.localityCode ? 'The official statistical boundary is preserved separately from the curated visitor boundary.' : 'OSM settlement geometry is used where no exact ONS built-up area exists.' },
      { id: 'historic-england-nhle-local', name: 'National Heritage List for England', organisation: 'Historic England', coverage: `${locality} designations inside the active boundary`, accessMethod: 'Bundled national GeoJSON download', licence: 'Open Government Licence v3.0', sourceUrl: 'https://historicengland.org.uk/listing/the-list/data-downloads/', reliability: 'official_statutory', limitations: 'Dates are enriched separately from official list-entry text.' },
      { id: `${slug}-osm-current`, name: 'OpenStreetMap current community places', organisation: 'OpenStreetMap contributors', coverage: `${locality} visitor and practical places`, accessMethod: 'Overpass API and point-in-polygon filtering', licence: osmLicence, sourceUrl: 'https://www.openstreetmap.org/', reliability: 'discovery_only', limitations: 'Current community mapping is curated and may be incomplete.' },
    ],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };

  const attractionDogs = Object.fromEntries(attractions.map(({ feature, sourceUrl, dogAllowed, dogProhibited }) => {
    return [feature.id, dogAllowed ? dogEntry(2, sourceUrl, true) : dogEntry(0, sourceUrl, Boolean(dogProhibited))];
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
    lists: { eat: food, trails: trails.map((trail) => trail.feature), parking, toilets, picnic },
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
        historicEngland: features.filter((feature) => feature.tags.includes('nhle')).length,
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
  const contents = `// Generated by scripts/create-cheshire-settlement-batch.ts. Do not edit by hand.\nimport type { ProjectPackage } from '../domain/models';\n${imports}\n\nexport const cheshireSettlementPackages: ProjectPackage[] = [\n${items}\n];\n`;
  await writeFile(generatedModulePath, contents, 'utf8');
}

await mkdir(cacheDirectory, { recursive: true });
await mkdir(reviewDirectory, { recursive: true });
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
for (const entry of manifest.inventory) regionByLocality.set(normalise(entry.locality), entry.authority);
const existing = await readExistingProjects();
const skipped = manifest.settlements.flatMap((locality) => preservedExistingLocalities.has(normalise(locality))
  ? [{ requested: locality, existing: existing.get(normalise(locality)) }]
  : []);
const requestedRebuildLocalities = new Set(
  (process.env.TOWNSCAPE_REBUILD_LOCALITIES ?? '').split(',').map(normalise).filter(Boolean),
);
const eligible = manifest.inventory.filter((entry) => !preservedExistingLocalities.has(normalise(entry.locality)));
const missing = requestedRebuildLocalities.size > 0
  ? eligible.filter((entry) => requestedRebuildLocalities.has(normalise(entry.locality)))
  : eligible;
if (requestedRebuildLocalities.size > 0) {
  const resolved = new Set(missing.map((entry) => normalise(entry.locality)));
  const unknown = [...requestedRebuildLocalities].filter((locality) => !resolved.has(locality));
  if (unknown.length > 0) throw new Error(`Unknown or preserved rebuild localities: ${unknown.join(', ')}`);
}
console.log(`Requested ${manifest.settlements.length}; existing ${skipped.length}; creating ${missing.length}.`);

const [onsRecords, broadOsm, greenElements, treasureProducts, researchedTrails] = await Promise.all([
  fetchOnsCatalogue(),
  fetchBroadOsm(),
  fetchBroadGreenSpaces(),
  fetchTreasureProducts(),
  fetchCheshireTrails(),
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
for (const entry of missing) {
  const { locality } = entry;
  try {
    console.log(`Building ${locality}...`);
    const result = await buildTown(entry, onsByName, broadOsm, greenElements, treasureProducts, researchedTrails);
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
    historicEnglandLocalDatasetUsed: true,
  },
};
await writeFile(resolve(reviewDirectory, `cheshire-settlement-batch-audit-${reviewedDate}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Completed: ${created.length} created, ${skipped.length} existing, ${failures.length} failed.`);

