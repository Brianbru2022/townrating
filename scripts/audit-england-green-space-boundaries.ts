import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  bbox,
  booleanPointInPolygon,
  buffer,
  point,
  pointToPolygonDistance,
} from '@turf/turf';
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';

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

interface GreenSpaceCandidate {
  osmId: string;
  osmUrl: string;
  name: string;
  kind: string;
  coordinates: [number, number];
  officialBoundary: boolean;
  visitorBoundary: boolean;
  distanceFromVisitorBoundaryMetres: number;
  decision: 'included' | 'near-boundary-review' | 'outside-context' | 'excluded';
  reason: string;
  tags: Record<string, string>;
}

const reviewedDate = '2026-08-09';
const projectsDirectory = resolve('data/projects');
const cacheDirectory = resolve(`tmp/osm-green-space-boundary-audit-${reviewedDate}`);
const broadCacheDirectory = resolve('tmp/northamptonshire-settlement-batch-v2');
const jsonPath = resolve(`data/review/england-green-space-boundary-audit-${reviewedDate}.json`);
const markdownPath = resolve(`data/review/england-green-space-boundary-audit-${reviewedDate}.md`);
const overpassUrls = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const reviewedBoundaryExclusions = new Map([
  ['way/295759250', 'landscaped crematorium grounds are not a public visitor green space'],
  ['way/1502728958', 'the regional Nene Wetlands reserve is too extensive to define Irthlingborough town'],
]);

async function loadBroadGreenSpaceCache(): Promise<OsmElement[] | undefined> {
  try {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        readFile(resolve(broadCacheDirectory, `green-spaces-${index}.json`), 'utf8').then(
          (contents) => JSON.parse(contents) as OverpassResponse,
        ),
      ),
    );
    const elements = new Map<string, OsmElement>();
    for (const response of responses) {
      for (const element of response.elements ?? []) {
        elements.set(`${element.type}/${element.id}`, element);
      }
    }
    return [...elements.values()];
  } catch {
    return undefined;
  }
}

const broadGreenSpacesPromise = loadBroadGreenSpaceCache();

function coordinates(element: OsmElement): [number, number] | undefined {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? [longitude as number, latitude as number]
    : undefined;
}

function query(south: number, west: number, north: number, east: number): string {
  const area = `(${south},${west},${north},${east})`;
  return `[out:json][timeout:60];(
    way["leisure"~"^(park|recreation_ground|garden|nature_reserve)$"]${area};
    way["landuse"="village_green"]${area};
  );out center tags qt;`;
}

async function fetchOverpass(queryText: string): Promise<OverpassResponse> {
  const failures: string[] = [];
  for (const endpoint of overpassUrls) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'user-agent': 'Townscape Guides local boundary audit/1.0 (read-only OSM comparison)',
          },
          body: new URLSearchParams({ data: queryText }),
          signal: controller.signal,
        });
        if (response.ok) return (await response.json()) as OverpassResponse;
        failures.push(`${endpoint}: ${response.status}`);
        if (response.status === 429 && attempt === 1) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 20_000));
          continue;
        }
      } catch (error) {
        failures.push(`${endpoint}: ${error instanceof Error ? error.name : 'request failed'}`);
      } finally {
        clearTimeout(timeout);
      }
      break;
    }
  }
  throw new Error(`All Overpass endpoints failed (${failures.join(', ')}).`);
}

function greenSpaceKind(tags: Record<string, string>): string {
  return tags.leisure ?? tags.landuse ?? 'green_space';
}

function isPublicCandidate(tags: Record<string, string>): boolean {
  return !['private', 'no', 'customers', 'permit'].includes((tags.access ?? '').toLowerCase());
}

function candidateName(element: OsmElement): string {
  const tags = element.tags ?? {};
  return tags.name ?? tags['loc_name'] ?? tags['official_name'] ?? `${greenSpaceKind(tags)} ${element.id}`;
}

async function auditTown(file: string): Promise<{
  projectId: string;
  locality: string;
  file: string;
  counts: Record<string, number>;
  candidates: GreenSpaceCandidate[];
  fromCache: boolean;
}> {
  const pkg = JSON.parse(await readFile(resolve(projectsDirectory, file), 'utf8')) as ProjectPackage;
  const visitorBoundary = pkg.project.boundary as Feature<Polygon | MultiPolygon>;
  const officialBoundary =
    pkg.project.townStudyArea?.localityBoundary ?? visitorBoundary;
  const reviewedExtensionIds = new Set(
    ((visitorBoundary.properties?.greenSpaceExtensionOsmIds as string[] | undefined) ?? []),
  );
  const searchArea = buffer(visitorBoundary, 0.5, { units: 'kilometers' });
  if (!searchArea) {
    throw new Error(`Could not buffer the visitor boundary for ${pkg.project.id}.`);
  }
  const [west, south, east, north] = bbox(searchArea);
  const cachePath = resolve(cacheDirectory, `${pkg.project.id}.json`);
  let response: OverpassResponse;
  let fromCache = true;
  try {
    response = JSON.parse(await readFile(cachePath, 'utf8')) as OverpassResponse;
  } catch {
    const broadGreenSpaces = await broadGreenSpacesPromise;
    if (broadGreenSpaces) {
      response = {
        elements: broadGreenSpaces.filter((element) => {
          const coordinate = coordinates(element);
          return Boolean(
            coordinate &&
              coordinate[0] >= west &&
              coordinate[0] <= east &&
              coordinate[1] >= south &&
              coordinate[1] <= north,
          );
        }),
      };
    } else {
      fromCache = false;
      response = await fetchOverpass(query(south, west, north, east));
    }
    await writeFile(cachePath, `${JSON.stringify(response)}\n`, 'utf8');
  }

  const candidates = (response.elements ?? [])
    .map((element): GreenSpaceCandidate | undefined => {
      const coordinate = coordinates(element);
      if (!coordinate) return undefined;
      const tags = element.tags ?? {};
      const marker = point(coordinate) as Feature<Point>;
      const officialInside = booleanPointInPolygon(marker, officialBoundary);
      const visitorInside = booleanPointInPolygon(marker, visitorBoundary);
      const distanceMetres = visitorInside
        ? 0
        : Math.round(
            Math.max(
              0,
              pointToPolygonDistance(marker, visitorBoundary, { units: 'kilometers' }) * 1000,
            ),
          );
      const publicCandidate = isPublicCandidate(tags);
      const hasUsefulIdentity = Boolean(tags.name || tags['loc_name'] || tags['official_name']);
      const kind = greenSpaceKind(tags);
      const osmId = `${element.type}/${element.id}`;
      let decision: GreenSpaceCandidate['decision'];
      let reason: string;
      if (reviewedBoundaryExclusions.has(osmId)) {
        decision = 'excluded';
        reason = reviewedBoundaryExclusions.get(osmId) as string;
      } else if (!publicCandidate) {
        decision = 'excluded';
        reason = `access=${tags.access}`;
      } else if (visitorInside || reviewedExtensionIds.has(osmId)) {
        decision = 'included';
        reason = reviewedExtensionIds.has(osmId)
          ? 'reviewed OSM geometry is included by the curated visitor boundary'
          : officialInside
            ? 'centre is inside both the official and visitor boundaries'
            : 'centre is included by the curated visitor boundary';
      } else if (distanceMetres <= 250 && (hasUsefulIdentity || kind === 'village_green')) {
        decision = 'near-boundary-review';
        reason = `${distanceMetres} metres outside the active visitor boundary`;
      } else {
        decision = 'outside-context';
        reason = `${distanceMetres} metres outside the active visitor boundary`;
      }
      return {
        osmId,
        osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        name: candidateName(element),
        kind,
        coordinates: coordinate,
        officialBoundary: officialInside,
        visitorBoundary: visitorInside,
        distanceFromVisitorBoundaryMetres: distanceMetres,
        decision,
        reason,
        tags,
      };
    })
    .filter((candidate): candidate is GreenSpaceCandidate => Boolean(candidate))
    .sort(
      (left, right) =>
        left.distanceFromVisitorBoundaryMetres - right.distanceFromVisitorBoundaryMetres ||
        left.name.localeCompare(right.name),
    );

  const counts = candidates.reduce<Record<string, number>>((result, candidate) => {
    result[candidate.decision] = (result[candidate.decision] ?? 0) + 1;
    return result;
  }, {});
  return {
    projectId: pkg.project.id,
    locality: pkg.project.locality,
    file,
    counts,
    candidates,
    fromCache,
  };
}

await mkdir(cacheDirectory, { recursive: true });
const files: string[] = [];
for (const file of (await readdir(projectsDirectory)).filter((name) => name.endsWith('.json'))) {
  try {
    const pkg = JSON.parse(await readFile(resolve(projectsDirectory, file), 'utf8')) as ProjectPackage;
    if (pkg.project.countryCode === 'GB-ENG') files.push(file);
  } catch {
    // Non-project JSON is outside this sweep.
  }
}

const towns = [];
for (let index = 0; index < files.length; index += 1) {
  towns.push(await auditTown(files[index]));
  console.log(`Audited ${index + 1}/${files.length} town boundaries`);
  if (index + 1 < files.length && !towns.at(-1)?.fromCache) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 3_500));
  }
}
towns.sort((left, right) => left.locality.localeCompare(right.locality));
const nearBoundary = towns.flatMap((town) =>
  town.candidates
    .filter((candidate) => candidate.decision === 'near-boundary-review')
    .map((candidate) => ({ projectId: town.projectId, locality: town.locality, ...candidate })),
);
const report = {
  reviewedAt: `${reviewedDate}T00:00:00Z`,
  scope: 'All bundled GB-ENG town projects',
  methodology:
    'OSM park, recreation-ground, garden, nature-reserve and village-green centres were checked against both the preserved official boundary and the active visitor boundary. Named public green spaces within 250 metres of the active extent are held for manual review rather than automatically absorbed.',
  townCount: towns.length,
  nearBoundaryReviewCount: nearBoundary.length,
  nearBoundary,
  towns,
};
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const lines = [
  '# England green-space boundary audit',
  '',
  `Reviewed: ${reviewedDate}`,
  `Towns: ${towns.length}`,
  `Near-boundary green spaces requiring a manual decision: ${nearBoundary.length}`,
  '',
  '| Town | Included | Near-boundary review | Outside context | Excluded |',
  '| --- | ---: | ---: | ---: | ---: |',
  ...towns.map(
    (town) =>
      `| ${town.locality} | ${town.counts.included ?? 0} | ${town.counts['near-boundary-review'] ?? 0} | ${town.counts['outside-context'] ?? 0} | ${town.counts.excluded ?? 0} |`,
  ),
  '',
  '## Manual review queue',
  '',
  ...(nearBoundary.length > 0
    ? nearBoundary.map(
        (candidate) =>
          `- **${candidate.locality}: ${candidate.name}** (${candidate.kind}) — ${candidate.reason}; ${candidate.osmUrl}`,
      )
    : ['No named public green spaces were left just outside an active visitor boundary.']),
  '',
];
await writeFile(markdownPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Audited ${towns.length} English town boundaries; ${nearBoundary.length} manual review item(s).`);
console.log(jsonPath);
console.log(markdownPath);
