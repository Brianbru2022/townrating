import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { booleanPointInPolygon } from '@turf/turf';
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';
import type { PlannerCurationLibrary } from '../src/domain/plannerCuration';
import { publishedProjectPackages } from '../src/data/publishedProjects';
import { assessPublicVisitorParking } from './lib/publicVisitorParking';

type AuditCategory = 'see' | 'eat' | 'picnic' | 'parking' | 'toilets';

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

interface Candidate {
  osmId: string;
  name: string;
  coordinates: [number, number];
  category: AuditCategory;
  eligible: boolean;
  exclusionReason?: string;
  existingFeatureId?: string;
  curated: boolean;
  tags: Record<string, string>;
  osmUrl: string;
}

interface AuditTown {
  projectId: string;
  locality: string;
  projectFile: string;
  counts: Record<AuditCategory, { osm: number; eligible: number; curated: number; uncurated: number }>;
  candidates: Record<AuditCategory, Candidate[]>;
}

interface PlannerFile {
  projects: PlannerCurationLibrary;
}

const overpassUrls = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const auditDate = '2026-08-09';
const requestedScope = process.argv[2];
const requestedCountryCode = requestedScope?.startsWith('GB-') ? requestedScope : undefined;
const requestedProjectId = requestedCountryCode ? undefined : requestedScope;
const scopeLabel = requestedCountryCode?.toLowerCase() ?? requestedProjectId ?? 'all-town';
const outputPath = resolve(`data/review/${scopeLabel}-osm-visitor-sweep-${auditDate}.json`);
const cacheDirectory = resolve(`tmp/osm-visitor-sweep-${auditDate}-green-space-boundaries`);
const planner = JSON.parse(
  await readFile(resolve('data/visitor-planner-curation.json'), 'utf8'),
) as PlannerFile;

function coordinates(element: OsmElement): [number, number] | undefined {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? [longitude as number, latitude as number]
    : undefined;
}

function positions(value: unknown, result: Array<[number, number]> = []): Array<[number, number]> {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === 'number')
  ) {
    result.push(value as [number, number]);
  } else if (Array.isArray(value)) {
    value.forEach((item) => positions(item, result));
  }
  return result;
}

function bounds(polygon: Feature<Polygon | MultiPolygon>): [number, number, number, number] {
  const points = positions(polygon.geometry.coordinates);
  return [
    Math.min(...points.map(([longitude]) => longitude)),
    Math.min(...points.map(([, latitude]) => latitude)),
    Math.max(...points.map(([longitude]) => longitude)),
    Math.max(...points.map(([, latitude]) => latitude)),
  ];
}

function query(
  group: 'food' | 'practical' | 'see',
  south: number,
  west: number,
  north: number,
  east: number,
): string {
  const area = `(${south},${west},${north},${east})`;
  const selectors = {
    food: `
    nwr["amenity"~"^(cafe|restaurant|fast_food|pub|bar|biergarten|food_court|ice_cream)$"]${area};
    nwr["shop"~"^(bakery|coffee|confectionery|deli)$"]${area};`,
    practical: `
    nwr["amenity"="parking"]${area};
    nwr["amenity"="toilets"]${area};
    nwr["tourism"="picnic_site"]${area};
    nwr["leisure"="picnic_table"]${area};
    nwr["amenity"="bbq"]${area};`,
    see: `
    nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park)$"]${area};
    nwr["historic"~"^(castle|fort|manor|monument|archaeological_site|ruins|city_gate)$"]${area};
    nwr["man_made"~"^(lighthouse|tower|windmill|watermill)$"]${area};
    nwr["waterway"="waterfall"]${area};
    nwr["natural"="cave_entrance"]${area};
    nwr["leisure"~"^(nature_reserve|garden)$"]${area};`,
  }[group];
  return `[out:json][timeout:45];(${selectors}
  );out center tags qt;`;
}

async function fetchOverpass(queryText: string): Promise<OverpassResponse> {
  const failures: string[] = [];
  for (const endpoint of overpassUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'user-agent': 'Townscape Guides local visitor audit/1.0 (read-only OSM comparison)',
        },
        body: new URLSearchParams({ data: queryText }),
        signal: controller.signal,
      });
      if (response.ok) return (await response.json()) as OverpassResponse;
      failures.push(`${endpoint}: ${response.status}`);
    } catch (error) {
      failures.push(`${endpoint}: ${error instanceof Error ? error.name : 'request failed'}`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`All Overpass endpoints failed (${failures.join(', ')}).`);
}

async function fetchTownElements(
  projectId: string,
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<OsmElement[]> {
  const elements = new Map<string, OsmElement>();
  await mkdir(cacheDirectory, { recursive: true });
  const responses = await Promise.all((['food', 'practical', 'see'] as const).map(async (group) => {
    const cachePath = resolve(cacheDirectory, `${projectId}-${group}.json`);
    let response: OverpassResponse;
    try {
      response = JSON.parse(await readFile(cachePath, 'utf8')) as OverpassResponse;
    } catch {
      response = await fetchOverpass(query(group, south, west, north, east));
      await writeFile(cachePath, `${JSON.stringify(response)}\n`, 'utf8');
    }
    return response;
  }));
  for (const response of responses) {
    for (const element of response.elements ?? []) {
      elements.set(`${element.type}/${element.id}`, element);
    }
  }
  return [...elements.values()];
}

function category(tags: Record<string, string>): AuditCategory | undefined {
  if (
    ['cafe', 'restaurant', 'fast_food', 'pub', 'bar', 'biergarten', 'food_court', 'ice_cream'].includes(
      tags.amenity ?? '',
    ) ||
    ['bakery', 'coffee', 'confectionery', 'deli'].includes(tags.shop ?? '')
  ) {
    return 'eat';
  }
  if (tags.amenity === 'parking') return 'parking';
  if (tags.amenity === 'toilets') return 'toilets';
  if (tags.tourism === 'picnic_site' || tags.leisure === 'picnic_table' || tags.amenity === 'bbq') {
    return 'picnic';
  }
  if (
    ['attraction', 'museum', 'gallery', 'viewpoint', 'zoo', 'aquarium', 'theme_park'].includes(
      tags.tourism ?? '',
    ) ||
    ['castle', 'fort', 'manor', 'monument', 'archaeological_site', 'ruins', 'city_gate'].includes(
      tags.historic ?? '',
    ) ||
    ['lighthouse', 'tower', 'windmill', 'watermill'].includes(tags.man_made ?? '') ||
    tags.waterway === 'waterfall' ||
    tags.natural === 'cave_entrance' ||
    ['nature_reserve', 'garden'].includes(tags.leisure ?? '')
  ) {
    return 'see';
  }
  return undefined;
}

function isInactive(tags: Record<string, string>): boolean {
  return Boolean(
    tags.disused ||
      tags.abandoned ||
      tags.demolished ||
      tags.closed === 'yes' ||
      tags.access === 'no',
  );
}

function exclusionReason(tags: Record<string, string>, auditCategory: AuditCategory): string | undefined {
  if (isInactive(tags)) return 'inactive-or-no-access';
  if (['private', 'permit', 'residents'].includes(tags.access ?? '')) {
    return 'private-or-permit-only';
  }
  if (tags.access === 'customers') return 'customers-only';
  if (tags['garden:type'] === 'private') return 'private-garden';
  if (auditCategory === 'parking') {
    const assessment = assessPublicVisitorParking(tags);
    if (!assessment.include) return assessment.exclusionReason ?? 'non-public-parking';
  }
  if ((auditCategory === 'see' || auditCategory === 'eat') && !tags.name) return 'unnamed';
  return undefined;
}

function fallbackName(tags: Record<string, string>, auditCategory: AuditCategory): string {
  const street = tags['addr:street'] || tags['addr:place'] || tags.loc_name;
  if (street) {
    if (auditCategory === 'parking') return `${street} car park`;
    if (auditCategory === 'toilets') return `${street} public toilets`;
    if (auditCategory === 'picnic') return `${street} picnic area`;
  }
  if (auditCategory === 'parking') return 'Unnamed car park';
  if (auditCategory === 'toilets') return 'Unnamed public toilets';
  if (auditCategory === 'picnic') return 'Unnamed picnic place';
  return 'Unnamed visitor place';
}

function sourceRecordId(element: OsmElement): string {
  return `${element.type}/${element.id}`;
}

function projectFile(pkg: ProjectPackage): string {
  const candidates = [
    resolve('data/projects', `${pkg.project.id.replace(/-(scotland|england|wales)$/, '')}.json`),
    resolve('data/projects', `${pkg.project.locality.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.json`),
  ];
  const directMatch = candidates.find((candidate) => {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8')).project.id === pkg.project.id;
    } catch {
      return false;
    }
  });
  if (directMatch) return directMatch;

  return (
    readdirSync(resolve('data/projects'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => resolve('data/projects', entry.name))
      .find((candidate) => {
        try {
          return JSON.parse(readFileSync(candidate, 'utf8')).project.id === pkg.project.id;
        } catch {
          return false;
        }
      }) ?? ''
  );
}

const towns: AuditTown[] = [];
for (const published of publishedProjectPackages.filter(
  (pkg) =>
    (!requestedProjectId || pkg.project.id === requestedProjectId) &&
    (!requestedCountryCode || pkg.project.countryCode === requestedCountryCode),
)) {
  const file = projectFile(published);
  if (!file) throw new Error(`Could not locate project JSON for ${published.project.id}.`);
  const pkg = JSON.parse(await readFile(file, 'utf8')) as ProjectPackage;
  const activeBoundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;
  const [west, south, east, north] = bounds(activeBoundary);
  let elements: OsmElement[];
  try {
    elements = await fetchTownElements(pkg.project.id, south, west, north, east);
  } catch (error) {
    console.error(`${pkg.project.locality}: ${error instanceof Error ? error.message : 'OSM query failed'}`);
    continue;
  }
  const curation = planner.projects[pkg.project.id] ?? {};
  const curatedIds = new Map<AuditCategory, Set<string>>(
    (['see', 'eat', 'picnic', 'parking', 'toilets'] as AuditCategory[]).map((need) => [
      need,
      new Set(curation[need] ?? []),
    ]),
  );
  const candidates: Record<AuditCategory, Candidate[]> = {
    see: [],
    eat: [],
    picnic: [],
    parking: [],
    toilets: [],
  };

  for (const element of elements) {
    const tags = element.tags ?? {};
    const auditCategory = category(tags);
    const location = coordinates(element);
    if (!auditCategory || !location) continue;
    const geometry: Point = { type: 'Point', coordinates: location };
    if (!booleanPointInPolygon(geometry, activeBoundary)) continue;
    const recordId = sourceRecordId(element);
    const generatedFeatureId = `osm-community:${element.type}-${element.id}`;
    const existingFeature = pkg.features.find(
      (feature) =>
        feature.id === generatedFeatureId ||
        feature.sourceRecords.some((source) => source.sourceRecordId === recordId),
    );
    const reason = exclusionReason(tags, auditCategory);
    const featureId = existingFeature?.id;
    candidates[auditCategory].push({
      osmId: recordId,
      name: tags.name?.trim() || fallbackName(tags, auditCategory),
      coordinates: location,
      category: auditCategory,
      eligible: !reason,
      exclusionReason: reason,
      existingFeatureId: featureId,
      curated: Boolean(featureId && curatedIds.get(auditCategory)?.has(featureId)),
      tags,
      osmUrl: `https://www.openstreetmap.org/${recordId}`,
    });
  }

  const counts = Object.fromEntries(
    (Object.keys(candidates) as AuditCategory[]).map((need) => {
      const entries = candidates[need];
      const eligible = entries.filter((entry) => entry.eligible);
      return [
        need,
        {
          osm: entries.length,
          eligible: eligible.length,
          curated: curation[need]?.length ?? 0,
          uncurated: eligible.filter((entry) => !entry.curated).length,
        },
      ];
    }),
  ) as AuditTown['counts'];
  for (const need of Object.keys(candidates) as AuditCategory[]) {
    candidates[need].sort(
      (left, right) => Number(right.eligible) - Number(left.eligible) || left.name.localeCompare(right.name),
    );
  }
  towns.push({
    projectId: pkg.project.id,
    locality: pkg.project.locality,
    projectFile: basename(file),
    counts,
    candidates,
  });
  console.log(`${pkg.project.locality}: ${JSON.stringify(counts)}`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
}

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      boundaryRule: 'Exact active project boundary; no nearby places are counted.',
      curationRule:
        'OSM is discovery evidence. See and Eat require names; private, permit-only, customer-only, inactive and no-access places are excluded. Publication still requires editorial review.',
      towns,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(`Wrote ${outputPath}`);
