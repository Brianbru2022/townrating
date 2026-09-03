import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';

const reviewedDate = new Date().toISOString().slice(0, 10);
const outputPath = resolve(`data/imports/cheshire-settlements-${reviewedDate}.json`);
const snapshotPath = resolve(`data/imports/cheshire-osm-settlement-source-${reviewedDate}.json`);
const authorities = [
  { name: 'Cheshire East', gssCode: 'E06000049', osmRelationId: 153487, osmAreaId: 3600153487 },
  { name: 'Cheshire West and Chester', gssCode: 'E06000050', osmRelationId: 153488, osmAreaId: 3600153488 },
  { name: 'Halton', gssCode: 'E06000006', osmRelationId: 147284, osmAreaId: 3600147284 },
  { name: 'Warrington', gssCode: 'E06000007', osmRelationId: 147278, osmAreaId: 3600147278 },
] as const;
const overpassEndpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const duplicateDisplayNames: Record<number, string> = {};

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse { elements?: OsmElement[] }

interface NominatimBoundary {
  boundingbox?: [string, string, string, string];
  geojson?: Geometry;
}

interface SettlementInventoryEntry {
  locality: string;
  queryName: string;
  aliases: string[];
  placeType: 'city' | 'town' | 'village';
  centre: [number, number];
  osmType: OsmElement['type'];
  osmId: number;
  sourceUrl: string;
  authority: string;
  authorityCode: string;
}

function coordinates(element: OsmElement): [number, number] | undefined {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return latitude === undefined || longitude === undefined ? undefined : [longitude, latitude];
}

async function fetchAuthoritySettlements(authority: typeof authorities[number]) {
  const cachePath = resolve(`data/imports/cheshire-${authority.gssCode.toLowerCase()}-osm-settlements-${reviewedDate}.json`);
  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as OverpassResponse;
  } catch {
    // Fetch and cache below.
  }
  let authorityBoundary: Feature<Polygon | MultiPolygon> | undefined;
  let query: string;
  if (authority.gssCode === 'E06000050') {
    const raw = JSON.parse(await readFile(resolve('data/imports/cheshire-west-and-chester-boundary-2026-08-12.json'), 'utf8')) as NominatimBoundary[];
    const record = raw[0];
    if (!record?.geojson || (record.geojson.type !== 'Polygon' && record.geojson.type !== 'MultiPolygon') || !record.boundingbox) {
      throw new Error('Cheshire West and Chester boundary fallback is unavailable.');
    }
    authorityBoundary = { type: 'Feature', properties: {}, geometry: record.geojson };
    const [south, north, west, east] = record.boundingbox;
    const bbox = `(${south},${west},${north},${east})`;
    query = `[out:json][timeout:180];(`
      + `node["place"~"^(city|town|village)$"]${bbox};`
      + `way["place"~"^(city|town|village)$"]${bbox};`
      + `relation["place"~"^(city|town|village)$"]${bbox};`
      + `);out center tags;`;
  } else {
    query = `[out:json][timeout:180];area(${authority.osmAreaId})->.authority;(`
      + `node["place"~"^(city|town|village)$"](area.authority);`
      + `way["place"~"^(city|town|village)$"](area.authority);`
      + `relation["place"~"^(city|town|village)$"](area.authority);`
      + `);out center tags;`;
  }
  let lastError: unknown;
  let result: OverpassResponse | undefined;
  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TownscapeGuides/1.0 (Cheshire settlement inventory)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(210_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      result = await response.json() as OverpassResponse;
      if (authorityBoundary) {
        result.elements = (result.elements ?? []).filter((element) => {
          const centre = coordinates(element);
          return centre && booleanPointInPolygon(point(centre), authorityBoundary!);
        });
      }
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!result) throw lastError instanceof Error ? lastError : new Error(`Overpass query failed for ${authority.name}.`);
  await writeFile(cachePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

const authorityResponses = await Promise.all(authorities.map(async (authority) => ({
  authority,
  response: await fetchAuthoritySettlements(authority),
})));
const rawInventory: SettlementInventoryEntry[] = [];
const seenObjects = new Set<string>();
for (const { authority, response } of authorityResponses) {
  for (const element of response.elements ?? []) {
    const name = element.tags?.name?.trim();
    const placeType = element.tags?.place as SettlementInventoryEntry['placeType'] | undefined;
    const centre = coordinates(element);
    const key = `${element.type}-${element.id}`;
    if (!name || !centre || !placeType || seenObjects.has(key)) continue;
    seenObjects.add(key);
    const displayName = element.tags?.['name:en']?.trim() || name;
    const aliases = [name]
      .filter((alias, index, values) => alias !== displayName && values.indexOf(alias) === index);
    rawInventory.push({
      locality: displayName,
      queryName: name,
      aliases,
      placeType,
      centre,
      osmType: element.type,
      osmId: element.id,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      authority: authority.name,
      authorityCode: authority.gssCode,
    });
  }
}

const deduplicatedByAuthorityAndName = new Map<string, SettlementInventoryEntry>();
for (const entry of rawInventory) {
  const key = `${entry.locality.toLocaleLowerCase('en-GB')}|${entry.authorityCode}`;
  const existing = deduplicatedByAuthorityAndName.get(key);
  const preference = { node: 3, way: 2, relation: 1 } as const;
  if (!existing || preference[entry.osmType] > preference[existing.osmType]) {
    deduplicatedByAuthorityAndName.set(key, entry);
  }
}
const uniqueInventory = [...deduplicatedByAuthorityAndName.values()];
const duplicateNames = new Set(uniqueInventory
  .map((entry) => entry.locality)
  .filter((name, index, names) => names.indexOf(name) !== index));
const inventory = uniqueInventory
  .sort((left, right) => left.locality.localeCompare(right.locality, 'en-GB') || left.centre[1] - right.centre[1] || left.centre[0] - right.centre[0])
  .map((entry) => {
    if (!duplicateNames.has(entry.locality)) return entry;
    const curatedName = duplicateDisplayNames[entry.osmId];
    if (curatedName) return { ...entry, locality: curatedName };
    return {
      ...entry,
      locality: `${entry.locality} (${entry.authority})`,
    };
  })
  .sort((left, right) => left.locality.localeCompare(right.locality, 'en-GB'));

const unresolvedDuplicates = inventory
  .map((entry) => entry.locality)
  .filter((name, index, names) => names.indexOf(name) !== index);
if (unresolvedDuplicates.length > 0) {
  throw new Error(`Unresolved duplicate Cheshire locality names: ${[...new Set(unresolvedDuplicates)].join(', ')}`);
}

const counts = inventory.reduce((totals, entry) => {
  totals[entry.placeType] += 1;
  return totals;
}, { city: 0, town: 0, village: 0 });

const snapshot = authorityResponses.flatMap(({ authority, response }) =>
  (response.elements ?? []).map((element) => ({
    authority: authority.name,
    authorityCode: authority.gssCode,
    ...element,
  })),
);
const manifest = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  reviewedDate,
  region: 'Cheshire',
  country: 'England',
  source: {
    name: 'OpenStreetMap Cheshire ceremonial-county unitary authority areas and settlement places',
    administrativeAuthorities: authorities,
    sourceUrls: authorities.map((authority) => `https://www.openstreetmap.org/relation/${authority.osmRelationId}`),
    queryPolicy: 'All mapped place=city, place=town and place=village objects inside Cheshire East, Cheshire West and Chester, Halton and Warrington. Hamlets, suburbs and neighbourhoods are not silently promoted.',
    licence: 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.',
    snapshotPath: `data/imports/cheshire-osm-settlement-source-${reviewedDate}.json`,
  },
  counts,
  duplicateBaseNames: [...duplicateNames].sort((left, right) => left.localeCompare(right, 'en-GB')),
  settlements: inventory.map((entry) => entry.locality),
  inventory,
};

await mkdir(resolve('data/imports'), { recursive: true });
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Cheshire manifest: ${inventory.length} settlements (${counts.city} cities, ${counts.town} towns, ${counts.village} villages).`);
console.log(`Duplicate base names disambiguated: ${[...duplicateNames].join(', ') || 'none'}.`);
console.log(outputPath);
