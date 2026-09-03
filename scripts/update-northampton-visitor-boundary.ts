import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  area,
  booleanPointInPolygon,
  buffer,
  point,
  simplify,
} from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { ProjectPackage } from '../src/domain/models';

const projectPath = resolve(
  process.argv[2] ?? 'data/projects/northampton-england.json',
);
const reviewPath = resolve(
  process.argv[3] ??
    'data/review/northampton-england-visitor-boundary-2026-08-09.json',
);
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const studyArea = pkg.project.townStudyArea;

if (!studyArea?.localityBoundary) {
  throw new Error('Northampton is missing its official ONS locality boundary.');
}

const officialBoundary = structuredClone(
  studyArea.localityBoundary,
) as Feature<Polygon | MultiPolygon>;
const simplified = simplify(officialBoundary, {
  tolerance: 0.00008,
  highQuality: true,
  mutate: false,
});
const expanded = buffer(simplified, 0.5, { units: 'kilometers', steps: 2 });
if (!expanded) throw new Error('Could not expand the Northampton boundary.');
const closed = buffer(expanded, -0.5, { units: 'kilometers', steps: 2 });
if (!closed) throw new Error('Could not close the Northampton boundary.');

const visitorBoundary = closed as Feature<Polygon | MultiPolygon>;
visitorBoundary.properties = {
  name: 'Northampton curated visitor boundary',
  sourceDataset: 'Curated Northampton visitor boundary',
  originalSourceDataset: studyArea.sourceName,
  originalLocalityCode: studyArea.localityCode,
  methodology:
    'Morphological closing of the official ONS 2024 built-up-area geometry using a 500 metre outward and inward buffer. This retains the outer urban envelope while filling internal omissions for parks, river corridors and other connected visitor green spaces.',
  notAdministrativeBoundary: true,
  reviewedAt: '2026-08-09',
};

const visitorChecks = [
  { name: 'Abington Park', coordinates: [-0.8478, 52.2428] },
  { name: 'The Racecourse', coordinates: [-0.8928, 52.2497] },
  { name: 'Delapre Park', coordinates: [-0.889, 52.2252] },
  { name: "Becket's Park", coordinates: [-0.8901, 52.2332] },
  { name: 'Hunsbury Hill Country Park', coordinates: [-0.9195, 52.2133] },
  { name: 'Kingsthorpe Recreation Ground', coordinates: [-0.8976, 52.2687] },
];

const failedChecks = visitorChecks.filter(
  ({ coordinates }) =>
    !booleanPointInPolygon(point(coordinates), visitorBoundary),
);
if (failedChecks.length > 0) {
  throw new Error(
    `Curated boundary missed expected visitor green spaces: ${failedChecks
      .map(({ name }) => name)
      .join(', ')}`,
  );
}

studyArea.bufferMetres = 500;
studyArea.bufferedBoundary = visitorBoundary;
studyArea.visitorBoundary = visitorBoundary;
studyArea.notes =
  'The official ONS 2024 Northampton built-up area is preserved unchanged as the locality boundary. The active public visitor boundary uses a transparent 500 metre morphological closing of that geometry so connected urban parks, river corridors and green spaces are not cut out by statistical built-up-area gaps. It is a curated visitor extent, not an administrative or statistical replacement.';

pkg.project.boundary = visitorBoundary;
pkg.project.boundarySource =
  'Curated Northampton visitor boundary derived from ONS Built-up Areas (December 2024)';
pkg.project.boundaryConfidence = 'high';
pkg.project.researchNotes = (pkg.project.researchNotes ?? '')
  .replace(
    'The unchanged ONS 2024 built-up area is the active inclusion boundary.',
    'The original ONS 2024 built-up area is preserved for provenance; the active visitor boundary closes its internal park and river-corridor gaps without extending beyond Northampton’s outer urban envelope.',
  )
  .trim();

const officialParts =
  officialBoundary.geometry.type === 'MultiPolygon'
    ? officialBoundary.geometry.coordinates.length
    : 1;
const visitorParts =
  visitorBoundary.geometry.type === 'MultiPolygon'
    ? visitorBoundary.geometry.coordinates.length
    : 1;
const review = {
  projectId: pkg.project.id,
  reviewedAt: '2026-08-09',
  purpose:
    'Correct Northampton’s visitor map extent while preserving the official ONS statistical geometry.',
  officialBoundary: {
    source: studyArea.sourceName,
    localityCode: studyArea.localityCode,
    geometryType: officialBoundary.geometry.type,
    parts: officialParts,
    areaHectares: Number((area(officialBoundary) / 10_000).toFixed(2)),
    preservedUnchanged: true,
  },
  activeVisitorBoundary: {
    source: visitorBoundary.properties?.sourceDataset,
    geometryType: visitorBoundary.geometry.type,
    parts: visitorParts,
    areaHectares: Number((area(visitorBoundary) / 10_000).toFixed(2)),
    method: visitorBoundary.properties?.methodology,
    notAdministrativeBoundary: true,
  },
  visitorGreenSpaceChecks: visitorChecks.map(({ name, coordinates }) => ({
    name,
    coordinates,
    inside: booleanPointInPolygon(point(coordinates), visitorBoundary),
  })),
};

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
console.log(
  `Updated Northampton visitor boundary: ${officialParts} official part(s) -> ${visitorParts} visitor part(s); ` +
    `${review.officialBoundary.areaHectares} ha -> ${review.activeVisitorBoundary.areaHectares} ha.`,
);
