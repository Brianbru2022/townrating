import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanPointInPolygon, point as turfPoint } from '@turf/turf';
import type { Feature, Geometry, Point } from 'geojson';
import type {
  DataSourceDefinition,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';
import { localHesDatasetFiles } from './lib/reference-data';

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');
const serviceUrl =
  'https://inspire.hes.scot/arcgis/rest/services/CANMORE/Canmore_Points/MapServer/0/query';
const serviceRoot =
  'https://inspire.hes.scot/arcgis/services/CANMORE/Canmore_Points/MapServer/WFSServer';
const matchDistanceMetres = 2;

interface EsriFeature {
  attributes: {
    CANMOREID: number;
    SITENUMBER?: string;
    NMRSNAME?: string;
    ALTNAME?: string;
    BROADCLASS?: string;
    SITETYPE?: string;
    PARISH?: string;
    ACCURACY?: string;
    URL?: string;
    LICENCE?: string;
  };
  geometry: { points?: number[][] };
}
interface EsriResponse {
  features?: EsriFeature[];
  error?: { message: string };
}
type ShapeCollection = { features: Array<Feature<Geometry, Record<string, unknown>>> };

function isProjectPoint(
  feature: Feature<Geometry, Record<string, unknown>>,
  project: ProjectPackage,
): feature is Feature<Point, Record<string, unknown>> {
  return (
    feature.geometry.type === 'Point' &&
    booleanPointInPolygon(turfPoint(feature.geometry.coordinates), project.project.boundary)
  );
}

async function localNrheRecords(project: ProjectPackage): Promise<EsriFeature[] | undefined> {
  const files = await localHesDatasetFiles('canmorePoints');
  if (!files) return undefined;
  Object.assign(globalThis, { self: globalThis });
  const { default: shp } = await import('shpjs');
  // @types/shpjs only models ZIP input; the package supports this documented
  // Shapefile sidecar bundle at runtime.
  const bundle = {
    shp: await readFile(files.shp),
    dbf: await readFile(files.dbf),
    prj: await readFile(files.prj, 'utf8'),
    cpg: await readFile(files.cpg, 'utf8'),
  };
  const parsed = (await shp(bundle as unknown as Buffer)) as ShapeCollection | ShapeCollection[];
  const collections = Array.isArray(parsed) ? parsed : [parsed];
  return collections
    .flatMap((collection) => collection.features)
    .filter((feature) => isProjectPoint(feature, project))
    .map((feature) => ({
      attributes: feature.properties as EsriFeature['attributes'],
      geometry: { points: [[feature.geometry.coordinates[0], feature.geometry.coordinates[1]]] },
    }));
}

function query(params: Record<string, string>): string {
  return `${serviceUrl}?${new URLSearchParams(params).toString()}`;
}
function polygonBounds(boundary: Feature): [number, number, number, number] {
  const values: [number, number][] = [];
  const visit = (node: unknown): void => {
    if (
      Array.isArray(node) &&
      node.length === 2 &&
      node.every((value) => typeof value === 'number')
    )
      values.push(node as [number, number]);
    else if (Array.isArray(node)) node.forEach(visit);
  };
  visit((boundary.geometry as { coordinates: unknown }).coordinates);
  if (!values.length) throw new Error('Project boundary has no usable coordinates.');
  const longitudes = values.map(([longitude]) => longitude);
  const latitudes = values.map(([, latitude]) => latitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}
function distanceMetres(
  [longitudeA, latitudeA]: number[],
  [longitudeB, latitudeB]: number[],
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (latitudeB - latitudeA) * radians;
  const longitudeDelta = (longitudeB - longitudeA) * radians;
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA * radians) *
      Math.cos(latitudeB * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function slug(value?: string): string | undefined {
  const normalized = value
    ?.toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
  return normalized || undefined;
}
function locationConfidence(accuracy?: string): HeritageFeature['locationConfidence'] {
  return /within (1|5|10)m/i.test(accuracy ?? '') ? 'high' : 'medium';
}
function sourceRecord(record: EsriFeature, accessedAt: string): SourceRecord {
  const id = String(record.attributes.CANMOREID);
  return {
    sourceName: 'Historic Environment Scotland NRHE / trove.scot Points GIS',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: id,
    sourceUrl: record.attributes.URL || `https://www.trove.scot/place/${id}`,
    accessedAt,
    licence:
      record.attributes.LICENCE ||
      'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    notes: `NRHE site number: ${record.attributes.SITENUMBER ?? 'not stated'}; positional accuracy: ${record.attributes.ACCURACY ?? 'not stated'}.`,
    reliability: 'official_non_statutory',
  };
}
function candidateFor(point: number[], features: HeritageFeature[]): HeritageFeature | undefined {
  let nearest: HeritageFeature | undefined;
  let nearestDistance = Infinity;
  for (const feature of features) {
    if (feature.geometry?.type !== 'Point') continue;
    const distance = distanceMetres(point, feature.geometry.coordinates);
    if (distance < nearestDistance) {
      nearest = feature;
      nearestDistance = distance;
    }
  }
  return nearestDistance <= matchDistanceMetres ? nearest : undefined;
}

const packageJson = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const localRecords = await localNrheRecords(packageJson);
const usedLocalSource = localRecords !== undefined;
let records: EsriFeature[];
if (localRecords) {
  records = localRecords;
} else {
  const [xmin, ymin, xmax, ymax] = polygonBounds(packageJson.project.boundary);
  const response = await fetch(
    query({
      // NRHE's PARISH attribute is not a reliable key for a current NRS civil-parish study
      // boundary. Spatial containment is authoritative for project inclusion.
      where: '1=1',
      geometry: `${xmin},${ymin},${xmax},${ymax}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    }),
  );
  if (!response.ok) throw new Error(`NRHE query failed: ${response.status}`);
  const payload = (await response.json()) as EsriResponse;
  if (payload.error || !payload.features)
    throw new Error(`NRHE query failed: ${payload.error?.message ?? 'no records returned'}`);
  records = payload.features;
}

const accessedAt = new Date().toISOString();
const existingForMatching = packageJson.features.filter(
  (feature) => !feature.id.startsWith('nrhe:'),
);
let linked = 0;
let added = 0;
let outsideBoundary = 0;
for (const record of records) {
  const id = String(record.attributes.CANMOREID);
  const point = record.geometry.points?.[0];
  if (!point) throw new Error(`NRHE ${id} has no usable representative point.`);
  if (!booleanPointInPolygon(turfPoint([point[0], point[1]]), packageJson.project.boundary)) {
    outsideBoundary += 1;
    continue;
  }
  const source = sourceRecord(record, accessedAt);
  const existingNrhe = packageJson.features.find((feature) => feature.id === `nrhe:${id}`);
  if (existingNrhe) {
    existingNrhe.sourceRecords = [
      ...existingNrhe.sourceRecords.filter((item) => item.sourceRecordId !== id),
      source,
    ];
    existingNrhe.updatedAt = accessedAt;
    continue;
  }
  const match = candidateFor(point, existingForMatching);
  if (match) {
    match.sourceRecords = [
      ...match.sourceRecords.filter((item) => item.sourceRecordId !== id),
      source,
    ];
    match.tags = [...new Set([...match.tags, 'nrhe-linked'])];
    match.updatedAt = accessedAt;
    match.reviewNotes = match.reviewNotes?.includes('NRHE record linked by matching point location')
      ? match.reviewNotes
      : `${match.reviewNotes ? `${match.reviewNotes} ` : ''}NRHE record linked by matching point location; review if it represents a distinct asset.`;
    linked += 1;
    continue;
  }

  const feature: HeritageFeature = {
    id: `nrhe:${id}`,
    projectId: packageJson.project.id,
    name: record.attributes.NMRSNAME ?? `NRHE site ${id}`,
    alternativeNames: [record.attributes.ALTNAME ?? ''].filter(Boolean),
    countryCode: packageJson.project.countryCode,
    region: packageJson.project.region,
    locality: packageJson.project.locality,
    featureType: 'archaeological_site',
    designationType: 'NRHE / trove.scot record',
    significance: 'recognised',
    geometry: { type: 'Point', coordinates: [point[0], point[1]] } as Point,
    locationType: 'site_centroid',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    locationConfidence: locationConfidence(record.attributes.ACCURACY),
    survival: 'unknown',
    shortDescription: record.attributes.SITETYPE
      ? `NRHE classification: ${record.attributes.SITETYPE}`
      : 'NRHE site record; detailed classification requires review.',
    sourceRecords: [source],
    licence: source.licence,
    tags: [
      'nrhe',
      ...(slug(record.attributes.BROADCLASS)
        ? [`nrhe-class-${slug(record.attributes.BROADCLASS)}`]
        : []),
    ],
    createdAt: accessedAt,
    updatedAt: accessedAt,
    reviewed: false,
    reviewNotes:
      'Imported from the official NRHE spatial index. This GIS record does not provide a construction date; review the linked trove.scot record before adding timeline evidence.',
  };
  packageJson.features.push(feature);
  added += 1;
}

const source: DataSourceDefinition = {
  id: 'hes-nrhe-points',
  name: 'Historic Environment Scotland NRHE / trove.scot Points GIS',
  organisation: 'Historic Environment Scotland',
  coverage: `NRHE records whose representative points lie within the authoritative ${packageJson.project.locality} parish extent`,
  accessMethod: usedLocalSource
    ? 'Developer-supplied local HES Shapefile; exact parish containment'
    : 'ArcGIS REST / WFS',
  sourceUrl: serviceRoot,
  licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
  reliability: 'official_non_statutory',
  limitations:
    'The spatial index provides a representative site point, names and classifications. It does not establish construction dates; detailed source records require individual review.',
};
packageJson.sources = [source, ...packageJson.sources.filter((item) => item.id !== source.id)];
packageJson.validation = validateFeatures(packageJson.project, packageJson.features);
const errors = packageJson.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
console.log(
  `Imported NRHE records: ${added} new sites and ${linked} linked to existing point features; ${outsideBoundary} envelope candidates excluded by parish containment.`,
);
