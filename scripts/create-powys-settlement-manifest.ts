import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const reviewedDate = new Date().toISOString().slice(0, 10);
const outputPath = resolve(`data/imports/powys-settlements-${reviewedDate}.json`);
const snapshotPath = resolve('data/imports/powys-osm-settlement-source-2026-08-12.json');
const powysGssCode = 'W06000023';
const powysOsmRelationId = 134324;
const overpassEndpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OsmElement[];
}

interface SnapshotEntry {
  name: string;
  name_en?: string;
  name_cy?: string;
  place: 'city' | 'town' | 'village';
  lat: number;
  lon: number;
  osm_type: OsmElement['type'];
  osm_id: number;
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
}

function coordinates(element: OsmElement): [number, number] | undefined {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return latitude === undefined || longitude === undefined ? undefined : [longitude, latitude];
}

function disambiguatedName(name: string, latitude: number) {
  if (name === 'Felindre') return latitude < 52.2 ? 'Felindre (Gwernyfed)' : 'Felindre (Beguildy)';
  if (name === 'Llangynog') return latitude < 52.4 ? 'Llangynog (Duhonw)' : 'Llangynog (Tanat Valley)';
  return name;
}

async function fetchPowysSettlements(): Promise<{ response: OverpassResponse; sourceMode: 'live' | 'snapshot' }> {
  const query = `[out:json][timeout:240];relation["ref:gss"="${powysGssCode}"]["boundary"="administrative"];map_to_area->.powys;nwr["place"~"^(city|town|village)$"](area.powys);out center tags;`;
  let lastError: unknown;
  for (const endpoint of process.env.POWYS_MANIFEST_OFFLINE === '1' ? [] : overpassEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TownscapeGuides/1.0 (Powys settlement inventory)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { response: await response.json() as OverpassResponse, sourceMode: 'live' };
    } catch (error) {
      lastError = error;
    }
  }
  try {
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as SnapshotEntry[];
    return {
      response: {
        elements: snapshot.map((entry) => ({
          type: entry.osm_type,
          id: entry.osm_id,
          lat: entry.lat,
          lon: entry.lon,
          tags: {
            name: entry.name,
            place: entry.place,
            ...(entry.name_en ? { 'name:en': entry.name_en } : {}),
            ...(entry.name_cy ? { 'name:cy': entry.name_cy } : {}),
          },
        })),
      },
      sourceMode: 'snapshot',
    };
  } catch {
    throw lastError instanceof Error ? lastError : new Error('Powys Overpass query failed.');
  }
}

const { response, sourceMode } = await fetchPowysSettlements();
const seen = new Set<string>();
const inventory = (response.elements ?? []).flatMap((element): SettlementInventoryEntry[] => {
  const name = element.tags?.name?.trim();
  const placeType = element.tags?.place as SettlementInventoryEntry['placeType'] | undefined;
  const centre = coordinates(element);
  const key = `${element.type}-${element.id}`;
  if (!name || !centre || !placeType || seen.has(key)) return [];
  seen.add(key);
  const displayName = element.tags?.['name:en']?.trim() || name;
  const aliases = [name, element.tags?.['name:cy']]
    .flatMap((alias) => alias?.trim() ? [alias.trim()] : [])
    .filter((alias, index, values) => alias !== displayName && values.indexOf(alias) === index);
  return [{
    locality: disambiguatedName(displayName, centre[1]),
    queryName: name,
    aliases,
    placeType,
    centre,
    osmType: element.type,
    osmId: element.id,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  }];
}).sort((left, right) => left.locality.localeCompare(right.locality));

const duplicateLocalities = inventory
  .map((entry) => entry.locality)
  .filter((name, index, names) => names.indexOf(name) !== index);
if (duplicateLocalities.length > 0) {
  throw new Error(`Unresolved duplicate Powys locality names: ${[...new Set(duplicateLocalities)].join(', ')}`);
}

const counts = inventory.reduce((totals, entry) => {
  totals[entry.placeType] += 1;
  return totals;
}, { city: 0, town: 0, village: 0 });

const manifest = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  reviewedDate,
  region: 'Powys',
  country: 'Wales',
  source: {
    name: 'OpenStreetMap Powys administrative area and settlement places',
    administrativeRelation: powysGssCode,
    sourceUrl: `https://www.openstreetmap.org/relation/${powysOsmRelationId}`,
    queryPolicy: 'All mapped place=city, place=town and place=village objects whose representative point lies in the Powys administrative area. Hamlets, suburbs and neighbourhoods are not silently promoted.',
    licence: 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.',
    sourceMode,
    snapshotPath: sourceMode === 'snapshot' ? 'data/imports/powys-osm-settlement-source-2026-08-12.json' : undefined,
  },
  counts,
  settlements: inventory.map((entry) => entry.locality),
  inventory,
};

await mkdir(resolve('data/imports'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Powys manifest: ${inventory.length} settlements (${counts.city} cities, ${counts.town} towns, ${counts.village} villages).`);
console.log(outputPath);
