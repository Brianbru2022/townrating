import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { publishedProjectPackages } from '../src/data/publishedProjects';

type SettlementKind = 'city' | 'town' | 'village';

interface RegionConfig {
  name: string;
  osmAreaName: string;
  projectRegions: string[];
}

interface OverpassElement {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    place?: SettlementKind;
  };
}

const reviewedAt = '2026-08-12';
const outputPath = resolve(`data/review/english-settlement-coverage-candidates-${reviewedAt}.json`);
const overpassEndpoints = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const regions: RegionConfig[] = [
  {
    name: 'Northamptonshire',
    osmAreaName: 'Northamptonshire',
    projectRegions: ['Northamptonshire', 'North Northamptonshire'],
  },
  {
    name: 'Cambridgeshire',
    osmAreaName: 'Cambridgeshire',
    projectRegions: ['Cambridgeshire'],
  },
  {
    name: 'Lincolnshire',
    osmAreaName: 'Lincolnshire',
    projectRegions: ['Lincolnshire', 'North Lincolnshire', 'North East Lincolnshire'],
  },
  {
    name: 'Leicestershire',
    osmAreaName: 'Leicestershire',
    projectRegions: ['Leicestershire', 'City of Leicester'],
  },
  {
    name: 'Buckinghamshire',
    osmAreaName: 'Buckinghamshire',
    projectRegions: ['Buckinghamshire'],
  },
  {
    name: 'Rutland',
    osmAreaName: 'Rutland',
    projectRegions: ['Rutland'],
  },
];

function normaliseName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

async function fetchSettlements(areaName: string) {
  const query = `[out:json][timeout:120];
area["boundary"="ceremonial"]["name"="${areaName}"]->.searchArea;
nwr["place"~"^(city|town|village)$"](area.searchArea);
out center tags;`;
  let lastError: unknown;
  let payload: { elements: OverpassElement[] } | undefined;
  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Townscape-Guides/0.1 settlement coverage audit',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
      payload = await response.json() as { elements: OverpassElement[] };
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!payload) throw new Error(`All Overpass endpoints failed for ${areaName}: ${String(lastError)}`);
  const byName = new Map<string, OverpassElement>();
  for (const element of payload.elements) {
    const name = element.tags?.name?.trim();
    const place = element.tags?.place;
    if (!name || !place) continue;
    const key = normaliseName(name);
    const current = byName.get(key);
    const priority = { city: 3, town: 2, village: 1 } as const;
    if (!current || priority[place] > priority[current.tags?.place ?? 'village']) {
      byName.set(key, element);
    }
  }
  return [...byName.values()]
    .map((element) => ({
      name: element.tags!.name!,
      place: element.tags!.place!,
      osmType: element.type,
      osmId: element.id,
      centre: element.center
        ? [element.center.lon, element.center.lat]
        : element.lon !== undefined && element.lat !== undefined
          ? [element.lon, element.lat]
          : undefined,
    }))
    .sort((a, b) => a.place.localeCompare(b.place) || a.name.localeCompare(b.name));
}

async function main() {
  const output = {
    reviewedAt,
    methodology: 'Live OSM place=city/town/village comparison. Candidates are not publication recommendations and require editorial visitor-interest review.',
    regions: [] as unknown[],
  };

  for (const region of regions) {
    const projects = publishedProjectPackages
      .map((projectPackage) => projectPackage.project)
      .filter((project) => project.region !== undefined && region.projectRegions.includes(project.region));
    const publishedNames = new Set(projects.map((project) => normaliseName(project.locality)));
    const mappedSettlements = await fetchSettlements(region.osmAreaName);
    const missing = mappedSettlements.filter((settlement) => !publishedNames.has(normaliseName(settlement.name)));
    output.regions.push({
      region: region.name,
      projectRegions: region.projectRegions,
      publishedCount: projects.length,
      mappedCount: mappedSettlements.length,
      missingCount: missing.length,
      missingByKind: {
        city: missing.filter((settlement) => settlement.place === 'city'),
        town: missing.filter((settlement) => settlement.place === 'town'),
        village: missing.filter((settlement) => settlement.place === 'village'),
      },
    });
  }

  await mkdir(resolve('data/review'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
