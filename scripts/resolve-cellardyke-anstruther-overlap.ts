import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import buffer from '@turf/buffer';
import intersect from '@turf/intersect';
import { featureCollection, point } from '@turf/helpers';
import union from '@turf/union';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-08-26T12:30:00.000Z';
const reviewedDate = '2026-08-26';
const cellardykePath = resolve('data/projects/cellardyke.json');
const anstrutherPath = resolve('data/projects/anstruther.json');
const cellardyke = JSON.parse(await readFile(cellardykePath, 'utf8')) as ProjectPackage;
const anstruther = JSON.parse(await readFile(anstrutherPath, 'utf8')) as ProjectPackage;

function localityBoundary(pkg: ProjectPackage): Feature<Polygon | MultiPolygon> {
  const boundary = pkg.project.townStudyArea?.localityBoundary;
  if (!boundary) throw new Error(`${pkg.project.id} has no official locality boundary.`);
  return boundary;
}

function extendedVisitorBoundary(
  pkg: ProjectPackage,
  extensionPoints: Array<[number, number]>,
  extensionName: string,
): Feature<Polygon | MultiPolygon> {
  const locality = localityBoundary(pkg);
  const extensions = extensionPoints.map((coordinates) => {
    const extension = buffer(point(coordinates), 0.175, { units: 'kilometers' });
    if (!extension) throw new Error(`Could not build ${pkg.project.id} visitor extension.`);
    return extension;
  });
  const merged = union(featureCollection([locality, ...extensions]));
  if (!merged) throw new Error(`Could not merge ${pkg.project.id} visitor boundary.`);
  return {
    ...merged,
    properties: {
      ...locality.properties,
      visitorBoundary: true,
      sourceDataset: `${pkg.project.name} official locality with targeted visitor extension`,
      extensionName,
      extensionRadiusMetres: 175,
      reviewedAt: reviewedDate,
    },
  };
}

const cellardykeLocality = localityBoundary(cellardyke);
const anstrutherLocality = localityBoundary(anstruther);
const wronglyAssigned = cellardyke.features.filter(
  (feature) =>
    feature.geometry?.type === 'Point' &&
    booleanPointInPolygon(point(feature.geometry.coordinates), anstrutherLocality),
);

for (const feature of wronglyAssigned) {
  feature.evidenceScope = 'out_of_scope';
  feature.tags = [
    ...new Set([
      ...feature.tags.filter((tag) => tag !== 'town-selection-inside-locality'),
      'town-selection-outside-locality',
      'map-hidden',
      'anstruther-locality-overlap-excluded',
    ]),
  ];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.reviewNotes = `Excluded from Cellardyke publication because its point falls inside Anstruther's official locality boundary. ${feature.reviewNotes ?? ''}`.trim();
}

const cellardykeVisitorBoundary = extendedVisitorBoundary(
  cellardyke,
  [
    [-2.6801792, 56.2276853],
    [-2.688596, 56.2245767],
    [-2.69196, 56.22431],
  ],
  'Cellardyke tidal pool and east-shore visitor hub',
);
const anstrutherVisitorBoundary = extendedVisitorBoundary(
  anstruther,
  [
    [-2.70128, 56.22094],
    [-2.7044236, 56.2241043],
    [-2.6978, 56.22535],
  ],
  'Anstruther waterfront, St Andrews Road car park and Bankie Park',
);

cellardyke.project.townStudyArea!.visitorBoundary = cellardykeVisitorBoundary;
anstruther.project.townStudyArea!.visitorBoundary = anstrutherVisitorBoundary;

const overlap = intersect(featureCollection([cellardykeVisitorBoundary, anstrutherVisitorBoundary]));
const overlapSquareMetres = overlap ? area(overlap) : 0;
if (overlapSquareMetres > 0.5) {
  throw new Error(`Cellardyke and Anstruther visitor boundaries still overlap by ${overlapSquareMetres.toFixed(1)}m².`);
}

for (const pkg of [cellardyke, anstruther]) {
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${pkg.project.id} has ${errors.length} validation errors after overlap resolution.`);
}

await writeFile(cellardykePath, `${JSON.stringify(cellardyke, null, 2)}\n`, 'utf8');
await writeFile(anstrutherPath, `${JSON.stringify(anstruther, null, 2)}\n`, 'utf8');
await writeFile(
  resolve('data/review/cellardyke-anstruther-overlap-resolution-2026-08-26.json'),
  `${JSON.stringify(
    {
      reviewedAt,
      previousBoundaryOverlapSquareMetres: 292377,
      resolvedBoundaryOverlapSquareMetres: overlapSquareMetres,
      excludedFromCellardyke: wronglyAssigned.length,
      excludedIds: wronglyAssigned.map((feature) => feature.id),
      method: 'Official non-overlapping locality boundaries plus targeted 175m extensions around each town’s valid outlying visitor assets.',
      cellardykeExtension: 'Tidal pool and east-shore visitor hub',
      anstrutherExtension: 'Waterfront, St Andrews Road car park and Bankie Park',
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Resolved Cellardyke–Anstruther overlap: ${wronglyAssigned.length} Cellardyke records suppressed; ${overlapSquareMetres.toFixed(1)}m² boundary overlap remains.`);
