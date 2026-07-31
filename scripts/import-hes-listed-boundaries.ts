import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanIntersects } from '@turf/turf';
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { DataSourceDefinition, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';
import { localHesDatasetFiles } from './lib/reference-data';

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');
const serviceUrl =
  'https://inspire.hes.scot/arcgis/rest/services/HES/HES_Designations/MapServer/7/query';
const wfsUrl = 'https://inspire.hes.scot/arcgis/services/HES/HES_Designations/MapServer/WFSServer';

interface EsriFeature {
  attributes: {
    DES_REF: string;
    DES_TITLE?: string;
    DES_TYPE?: string;
    CATEGORY?: string;
    LINK?: string;
    PRECISION?: string;
    ACCURACY?: string;
  };
  geometry: { rings?: number[][][] };
}
interface EsriResponse {
  objectIds?: number[];
  features?: EsriFeature[];
  error?: { message: string };
}
type ShapeCollection = { features: Array<Feature<Geometry, Record<string, unknown>>> };

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
function signedArea(ring: number[][]): number {
  return ring
    .slice(0, -1)
    .reduce(
      (area, point, index) => area + point[0] * ring[index + 1][1] - ring[index + 1][0] * point[1],
      0,
    );
}
function boundaryGeometry(record: EsriFeature): Polygon | MultiPolygon {
  const rings = record.geometry.rings;
  if (!rings?.length) throw new Error(`${record.attributes.DES_REF} has no boundary geometry.`);
  if (rings.some((ring) => ring.length < 4))
    throw new Error(`${record.attributes.DES_REF} has an invalid ring.`);
  const direction = Math.sign(signedArea(rings[0]));
  // This importer deliberately supports only single rings or multiple exterior
  // rings. A mix of orientations could contain holes and needs human review.
  if (rings.some((ring) => Math.sign(signedArea(ring)) !== direction))
    throw new Error(`${record.attributes.DES_REF} has holes; review its topology before import.`);
  const coordinates = rings.map((ring) =>
    ring.map(([longitude, latitude]) => [longitude, latitude] as [number, number]),
  );
  return coordinates.length === 1
    ? { type: 'Polygon', coordinates: [coordinates[0]] }
    : { type: 'MultiPolygon', coordinates: coordinates.map((ring) => [ring]) };
}
function sourceRecord(record: EsriFeature, accessedAt: string): SourceRecord {
  const { DES_REF, LINK, PRECISION, ACCURACY } = record.attributes;
  return {
    sourceName: 'Historic Environment Scotland Listed Buildings Boundaries GIS',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: DES_REF,
    sourceUrl: LINK,
    accessedAt,
    licence:
      'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    notes: `Boundary precision: ${PRECISION ?? 'not stated'}; ${ACCURACY ?? 'accuracy not stated'}.`,
    reliability: 'official_statutory',
  };
}

async function localBoundaryRecords(project: ProjectPackage): Promise<EsriFeature[] | undefined> {
  const files = await localHesDatasetFiles('listedBuildingBoundaries');
  if (!files) return undefined;
  Object.assign(globalThis, { self: globalThis });
  const { default: shp } = await import('shpjs');
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
    .filter(
      (feature): feature is Feature<Polygon | MultiPolygon, Record<string, unknown>> =>
        (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
        booleanIntersects(feature, project.project.boundary),
    )
    .map((feature) => ({
      attributes: feature.properties as EsriFeature['attributes'],
      geometry: {
        rings:
          feature.geometry.type === 'Polygon'
            ? feature.geometry.coordinates
            : feature.geometry.coordinates.flat(),
      },
    }));
}

const packageJson = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const local = await localBoundaryRecords(packageJson);
let records: EsriFeature[];
let usedLocalSource = false;
if (local) {
  records = local;
  usedLocalSource = true;
} else {
  const [xmin, ymin, xmax, ymax] = polygonBounds(packageJson.project.boundary);
  const idsResponse = await fetch(
    query({
      where: '1=1',
      geometry: `${xmin},${ymin},${xmax},${ymax}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      returnIdsOnly: 'true',
      f: 'json',
    }),
  );
  if (!idsResponse.ok) throw new Error(`HES boundary ID query failed: ${idsResponse.status}`);
  const ids = (await idsResponse.json()) as EsriResponse;
  if (ids.error) throw new Error(`HES boundary ID query failed: ${ids.error.message}`);
  const objectIds = ids.objectIds ?? [];
  if (!objectIds.length)
    throw new Error('HES returned no listed-building boundaries in the project extent.');
  const recordsResponse = await fetch(
    query({
      objectIds: objectIds.join(','),
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    }),
  );
  if (!recordsResponse.ok) throw new Error(`HES boundary query failed: ${recordsResponse.status}`);
  const remote = (await recordsResponse.json()) as EsriResponse;
  if (remote.error || !remote.features)
    throw new Error(`HES boundary query failed: ${remote.error?.message ?? 'no records returned'}`);
  records = remote.features;
}

const accessedAt = new Date().toISOString();
let imported = 0;
for (const record of records) {
  const reference = record.attributes.DES_REF;
  const feature = packageJson.features.find((item) =>
    item.sourceRecords.some((source) => source.sourceRecordId === reference),
  );
  if (!feature) {
    throw new Error(
      `${reference} has an HES boundary but no matching curated listed-building record; review before adding a new feature.`,
    );
  }
  const source = sourceRecord(record, accessedAt);
  feature.geometry = boundaryGeometry(record);
  feature.locationType = 'exact';
  feature.locationConfidence = 'high';
  feature.alternativeNames = [
    ...new Set([...(feature.alternativeNames ?? []), record.attributes.DES_TITLE ?? '']),
  ].filter(Boolean);
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((item) => item.sourceName !== source.sourceName),
    source,
  ];
  feature.tags = [...new Set([...feature.tags, 'hes-listed-building-boundary'])];
  feature.updatedAt = accessedAt;
  feature.reviewNotes = feature.reviewNotes?.includes(
    'Official HES listed-building boundary imported',
  )
    ? feature.reviewNotes
    : `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}Official HES listed-building boundary imported.`;
  imported += 1;
}

const source: DataSourceDefinition = {
  id: 'hes-listed-building-boundaries',
  name: 'Historic Environment Scotland Listed Buildings Boundaries GIS',
  organisation: 'Historic Environment Scotland',
  coverage: `Official listed-building boundaries intersecting the ${packageJson.project.locality} project extent`,
  accessMethod: usedLocalSource
    ? 'Developer-supplied local HES Shapefile; exact project-boundary intersection'
    : 'ArcGIS REST / WFS',
  sourceUrl: wfsUrl,
  licence:
    'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
  reliability: 'official_statutory',
  limitations:
    'Only matching pre-existing listed-building records are updated. Boundary geometry is a designation boundary, not a construction date or a complete property boundary.',
};
packageJson.sources = [source, ...packageJson.sources.filter((item) => item.id !== source.id)];
packageJson.validation = validateFeatures(packageJson.project, packageJson.features);
const errors = packageJson.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
console.log(`Updated ${imported} listed-building feature(s) with official HES boundary geometry.`);
