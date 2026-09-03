import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { area, featureCollection, union } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';

interface BoundaryAuditCandidate {
  projectId: string;
  locality: string;
  osmId: string;
  osmUrl: string;
  name: string;
  kind: string;
  decision: string;
}

interface BoundaryAudit {
  nearBoundary: BoundaryAuditCandidate[];
  towns: Array<{ projectId: string; file: string }>;
}

interface NominatimFeature extends Feature {
  properties: {
    osm_id?: number;
    osm_type?: string;
    display_name?: string;
  };
}

interface NominatimLookup {
  type: 'FeatureCollection';
  features: NominatimFeature[];
}

const reviewedDate = '2026-08-09';
const auditPath = resolve(`data/review/england-green-space-boundary-audit-${reviewedDate}.json`);
const reportPath = resolve(`data/review/england-green-space-boundary-extensions-${reviewedDate}.json`);
const cacheDirectory = resolve(`tmp/osm-green-space-boundary-geometries-${reviewedDate}`);

// These are genuine mapped landscapes, but they are not appropriate town-boundary additions.
// The crematorium is non-visitor context; Nene Wetlands is a large regional reserve whose
// polygon would almost double Irthlingborough's visitor area.
const excludedOsmIds = new Set(['way/295759250', 'way/1502728958']);

function nominatimId(osmId: string): string {
  const [type, id] = osmId.split('/');
  return `${type === 'relation' ? 'R' : type === 'way' ? 'W' : 'N'}${id}`;
}

function featureOsmId(feature: NominatimFeature): string | undefined {
  const type = feature.properties.osm_type;
  const id = feature.properties.osm_id;
  return type && id ? `${type}/${id}` : undefined;
}

async function lookupGeometries(
  projectId: string,
  candidates: BoundaryAuditCandidate[],
): Promise<NominatimLookup> {
  const cachePath = resolve(cacheDirectory, `${projectId}.geojson`);
  let features: NominatimFeature[] = [];
  try {
    features = (JSON.parse(await readFile(cachePath, 'utf8')) as NominatimLookup).features;
  } catch {
    // The cache is populated below.
  }
  const cachedIds = new Set(features.map(featureOsmId).filter(Boolean));
  const missingCandidates = candidates.filter((candidate) => !cachedIds.has(candidate.osmId));
  if (missingCandidates.length > 0) {
    for (let index = 0; index < missingCandidates.length; index += 40) {
      const batch = missingCandidates.slice(index, index + 40);
      const ids = batch.map((candidate) => nominatimId(candidate.osmId)).join(',');
      const url = new URL('https://nominatim.openstreetmap.org/lookup');
      url.searchParams.set('format', 'geojson');
      url.searchParams.set('polygon_geojson', '1');
      url.searchParams.set('osm_ids', ids);
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Townscape Guides local boundary audit/1.0 (read-only OSM lookup)',
        },
      });
      if (!response.ok) throw new Error(`Nominatim lookup failed for ${projectId}: ${response.status}`);
      const lookup = (await response.json()) as NominatimLookup;
      features.push(...lookup.features);
      if (index + 40 < missingCandidates.length) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_200));
      }
    }
    await writeFile(
      cachePath,
      `${JSON.stringify({ type: 'FeatureCollection', features } satisfies NominatimLookup)}\n`,
      'utf8',
    );
  }
  return { type: 'FeatureCollection', features };
}

function hectares(boundary: Feature<Polygon | MultiPolygon>): number {
  return area(boundary) / 10_000;
}

await mkdir(cacheDirectory, { recursive: true });
const audit = JSON.parse(await readFile(auditPath, 'utf8')) as BoundaryAudit;
const projectFileById = new Map(audit.towns.map((town) => [town.projectId, town.file]));
const accepted = audit.nearBoundary.filter(
  (candidate) =>
    candidate.decision === 'near-boundary-review' && !excludedOsmIds.has(candidate.osmId),
);
const grouped = new Map<string, BoundaryAuditCandidate[]>();
for (const candidate of accepted) {
  const candidates = grouped.get(candidate.projectId) ?? [];
  candidates.push(candidate);
  grouped.set(candidate.projectId, candidates);
}
for (const cacheFile of (await readdir(cacheDirectory)).filter((file) => file.endsWith('.geojson'))) {
  const projectId = cacheFile.replace(/\.geojson$/, '');
  if (projectFileById.has(projectId) && !grouped.has(projectId)) grouped.set(projectId, []);
}
const results: Array<Record<string, unknown>> = [];

for (const [projectId, candidates] of grouped) {
  const projectFile = projectFileById.get(projectId);
  if (!projectFile) throw new Error(`No project file found for ${projectId}.`);
  const projectPath = resolve('data/projects', projectFile);
  const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
  const lookup = await lookupGeometries(projectId, candidates);
  const requestedIds = new Set([
    ...candidates.map((candidate) => candidate.osmId),
    ...lookup.features
      .map(featureOsmId)
      .filter((id): id is string => id !== undefined && !excludedOsmIds.has(id)),
  ]);
  const polygons = lookup.features.filter((feature): feature is NominatimFeature & {
    geometry: Polygon | MultiPolygon;
  } => {
    const id = featureOsmId(feature);
    return (
      Boolean(id && requestedIds.has(id)) &&
      (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')
    );
  });
  const foundIds = new Set(polygons.map(featureOsmId).filter(Boolean));
  const missing = candidates.filter((candidate) => !foundIds.has(candidate.osmId));
  if (polygons.length === 0) {
    results.push({
      projectId,
      locality: pkg.project.locality,
      accepted: [],
      missing: missing.map((candidate) => ({ osmId: candidate.osmId, name: candidate.name })),
      skipped: 'No accepted public green-space geometries',
    });
    continue;
  }
  const before = pkg.project.boundary as Feature<Polygon | MultiPolygon>;
  const merged = union(
    featureCollection([
      before,
      ...polygons.map(
        (feature) =>
          ({
            type: 'Feature',
            properties: {},
            geometry: feature.geometry,
          }) as Feature<Polygon | MultiPolygon>,
      ),
    ]),
  ) as Feature<Polygon | MultiPolygon> | null;
  if (!merged) throw new Error(`Could not merge green-space geometry for ${projectId}.`);

  const beforeHectares = hectares(before);
  const afterHectares = hectares(merged);
  const increasePercent = ((afterHectares - beforeHectares) / beforeHectares) * 100;
  if (increasePercent > 35) {
    throw new Error(
      `${projectId} green-space extensions would add ${increasePercent.toFixed(1)}%; manual geometry review is required.`,
    );
  }

  merged.properties = {
    ...(before.properties ?? {}),
    name: `${pkg.project.locality} curated visitor boundary`,
    greenSpaceExtensionSource: 'OpenStreetMap named public green-space geometries',
    greenSpaceExtensionReviewDate: reviewedDate,
    greenSpaceExtensionOsmIds: [
      ...new Set([
        ...((before.properties?.greenSpaceExtensionOsmIds as string[] | undefined) ?? []),
        ...polygons.map(featureOsmId).filter((id): id is string => Boolean(id)),
      ]),
    ],
    notAdministrativeBoundary: true,
  };
  pkg.project.boundary = merged;
  pkg.project.boundarySource =
    `Curated ${pkg.project.locality} visitor boundary with reviewed OSM public green-space extensions`;
  if (pkg.project.townStudyArea) {
    pkg.project.townStudyArea.visitorBoundary = merged;
    pkg.project.townStudyArea.bufferedBoundary = merged;
    pkg.project.townStudyArea.notes =
      'The official locality geometry is preserved unchanged. The active visitor boundary includes reviewed named public parks, recreation grounds, reserves and village greens immediately adjoining the settlement. These OSM geometries are visitor extensions, not administrative replacements.';
  }
  await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  results.push({
    projectId,
    locality: pkg.project.locality,
    accepted: polygons.map((feature) => ({
      osmId: featureOsmId(feature),
      displayName: feature.properties.display_name,
    })),
    missing: missing.map((candidate) => ({ osmId: candidate.osmId, name: candidate.name })),
    beforeHectares,
    afterHectares,
    increasePercent,
  });
  console.log(
    `${pkg.project.locality}: merged ${polygons.length}/${candidates.length} green spaces (+${increasePercent.toFixed(2)}%)`,
  );
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_100));
}

await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      reviewedAt: `${reviewedDate}T00:00:00Z`,
      methodology:
        'Named public green spaces within 250 metres of an active visitor boundary were reviewed and merged using their OSM polygon geometries. Peterborough crematorium was excluded as non-visitor context and the extensive Nene Wetlands polygon was retained as a regional reserve rather than used to define Irthlingborough town.',
      acceptedCount: accepted.length,
      excluded: audit.nearBoundary.filter((candidate) => excludedOsmIds.has(candidate.osmId)),
      results,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(reportPath);
