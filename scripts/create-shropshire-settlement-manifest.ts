import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';

const reviewedDate = new Date().toISOString().slice(0, 10);
const outputPath = resolve(`data/imports/shropshire-settlements-${reviewedDate}.json`);
const snapshotPath = resolve(`data/imports/shropshire-osm-settlement-source-${reviewedDate}.json`);
const authorities = [
  { name: 'Shropshire', gssCode: 'E06000051', osmRelationId: 167060, osmAreaId: 3600167060 },
  { name: 'Telford and Wrekin', gssCode: 'E06000020', osmRelationId: 167058, osmAreaId: 3600167058 },
] as const;
const overpassEndpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const duplicateDisplayNames: Record<number, string> = {
  95056021: 'Albrighton (near Wolverhampton)',
  611862867: 'Albrighton (near Shrewsbury)',
  29724447: 'Brockton (Lydbury North)',
  335527457: 'Brockton (Stanton Long)',
  907348072: 'Brockton (Worthen)',
  256220971: 'Leaton (near Shrewsbury)',
  611862920: 'Leaton (Wrockwardine)',
};

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
  osm_id: number;
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
  const cachePath = resolve(`data/imports/shropshire-${authority.gssCode.toLowerCase()}-osm-settlements-${reviewedDate}.json`);
  try {
    return JSON.parse(await readFile(cachePath, 'utf8')) as OverpassResponse;
  } catch {
    // Fetch and cache below.
  }
  const elements: OsmElement[] = [];
  for (const objectType of ['node', 'way', 'relation'] as const) {
    const objectCachePath = resolve(`data/imports/shropshire-${authority.gssCode.toLowerCase()}-osm-${objectType}-settlements-${reviewedDate}.json`);
    try {
      const cached = JSON.parse(await readFile(objectCachePath, 'utf8')) as OverpassResponse;
      if (Array.isArray(cached.elements)) {
        elements.push(...cached.elements);
        continue;
      }
    } catch {
      // Fetch this object type below.
    }
    const telfordBoundaryPath = resolve('data/imports/telford-and-wrekin-boundary-2026-08-12.json');
    let telfordBoundary: Feature<Polygon | MultiPolygon> | undefined;
    let bbox = '';
    if (authority.gssCode === 'E06000020') {
      const rawNominatim = JSON.parse(await readFile(telfordBoundaryPath, 'utf8')) as NominatimBoundary | NominatimBoundary[];
      const nominatim = Array.isArray(rawNominatim) ? rawNominatim : [rawNominatim];
      const geometry = nominatim.find((entry) => entry.osm_id === authority.osmRelationId)?.geojson;
      if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
        throw new Error('Telford and Wrekin authority polygon is unavailable.');
      }
      telfordBoundary = { type: 'Feature', properties: {}, geometry };
      bbox = '(52.6145,-2.6674,52.8284,-2.3122)';
    }
    const query = telfordBoundary
      ? `[out:json][timeout:300];${objectType}["place"~"^(city|town|village)$"]${bbox};out center tags;`
      : `[out:json][timeout:300];area(${authority.osmAreaId})->.authority;${objectType}["place"~"^(city|town|village)$"](area.authority);out center tags;`;
    let lastError: unknown;
    let result: OverpassResponse | undefined;
    for (const endpoint of overpassEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'TownscapeGuides/1.0 (Shropshire settlement inventory)',
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(360_000),
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        result = await response.json() as OverpassResponse;
        if (telfordBoundary) {
          result.elements = (result.elements ?? []).filter((element) => {
            const centre = coordinates(element);
            return centre && booleanPointInPolygon(point(centre), telfordBoundary!);
          });
        }
        await writeFile(objectCachePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!result) throw lastError instanceof Error ? lastError : new Error(`Overpass query failed for ${authority.name} ${objectType}s.`);
    elements.push(...result.elements ?? []);
  }
  const result = { elements };
  await writeFile(cachePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

const authorityResponses: Array<{ authority: typeof authorities[number]; response: OverpassResponse }> = [];
for (const authority of authorities) {
  authorityResponses.push({ authority, response: await fetchAuthoritySettlements(authority) });
}
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

const duplicateNames = new Set(rawInventory
  .map((entry) => entry.locality)
  .filter((name, index, names) => names.indexOf(name) !== index));
const duplicateOrdinals = new Map<string, number>();
const inventory = rawInventory
  .sort((left, right) => left.locality.localeCompare(right.locality, 'en-GB') || left.centre[1] - right.centre[1] || left.centre[0] - right.centre[0])
  .map((entry) => {
    if (!duplicateNames.has(entry.locality)) return entry;
    const curatedName = duplicateDisplayNames[entry.osmId];
    if (curatedName) return { ...entry, locality: curatedName };
    const duplicateKey = `${entry.locality} (${entry.authority})`;
    const ordinal = (duplicateOrdinals.get(duplicateKey) ?? 0) + 1;
    duplicateOrdinals.set(duplicateKey, ordinal);
    return {
      ...entry,
      locality: `${duplicateKey} ${ordinal}`,
    };
  })
  .sort((left, right) => left.locality.localeCompare(right.locality, 'en-GB'));

const unresolvedDuplicates = inventory
  .map((entry) => entry.locality)
  .filter((name, index, names) => names.indexOf(name) !== index);
if (unresolvedDuplicates.length > 0) {
  throw new Error(`Unresolved duplicate Shropshire locality names: ${[...new Set(unresolvedDuplicates)].join(', ')}`);
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
  region: 'Shropshire',
  country: 'England',
  source: {
    name: 'OpenStreetMap Shropshire and Telford and Wrekin administrative areas and settlement places',
    administrativeAuthorities: authorities,
    sourceUrls: authorities.map((authority) => `https://www.openstreetmap.org/relation/${authority.osmRelationId}`),
    queryPolicy: 'All mapped place=city, place=town and place=village objects inside Shropshire and Telford and Wrekin. Hamlets, suburbs and neighbourhoods are not silently promoted.',
    licence: 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.',
    snapshotPath: `data/imports/shropshire-osm-settlement-source-${reviewedDate}.json`,
  },
  counts,
  duplicateBaseNames: [...duplicateNames].sort((left, right) => left.localeCompare(right, 'en-GB')),
  settlements: inventory.map((entry) => entry.locality),
  inventory,
};

await mkdir(resolve('data/imports'), { recursive: true });
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Shropshire manifest: ${inventory.length} settlements (${counts.city} cities, ${counts.town} towns, ${counts.village} villages).`);
console.log(`Duplicate base names disambiguated: ${[...duplicateNames].join(', ') || 'none'}.`);
console.log(outputPath);
