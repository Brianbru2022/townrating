import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanIntersects } from '@turf/turf';
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { DataSourceDefinition, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';
import { localHesDatasetFiles, type LocalHesDataset } from './lib/reference-data';

const projectPath = resolve(process.argv[2] ?? 'data/projects/culross.json');
const serviceRoot = 'https://inspire.hes.scot/arcgis/rest/services/HES/HES_Designations/MapServer';
const wfsUrl = 'https://inspire.hes.scot/arcgis/services/HES/HES_Designations/MapServer/WFSServer';

const datasets = [
  {
    layer: 2,
    idPrefix: 'hes-conservation-area',
    featureType: 'conservation_area',
    significance: 'regional' as const,
  },
  {
    layer: 4,
    idPrefix: 'hes-designed-landscape',
    featureType: 'designed_landscape',
    significance: 'national' as const,
  },
  {
    layer: 5,
    idPrefix: 'hes-scheduled-monument',
    featureType: 'scheduled_monument',
    significance: 'national' as const,
  },
];

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
  features?: EsriFeature[];
  error?: { message: string };
}

type ShapeCollection = { features: Array<Feature<Geometry, Record<string, unknown>>> };

function isProjectPolygon(
  feature: Feature<Geometry, Record<string, unknown>>,
  project: ProjectPackage,
): feature is Feature<Polygon | MultiPolygon, Record<string, unknown>> {
  return (
    (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
    booleanIntersects(feature, project.project.boundary)
  );
}

async function localRecords(
  dataset: LocalHesDataset,
  project: ProjectPackage,
): Promise<EsriFeature[] | undefined> {
  const files = await localHesDatasetFiles(dataset);
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
    .filter((feature) => isProjectPolygon(feature, project))
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

function bounds(project: ProjectPackage): [number, number, number, number] {
  const positions: [number, number][] = [];
  const visit = (node: unknown): void => {
    if (
      Array.isArray(node) &&
      node.length === 2 &&
      node.every((value) => typeof value === 'number')
    )
      positions.push(node as [number, number]);
    else if (Array.isArray(node)) node.forEach(visit);
  };
  visit(project.project.boundary.geometry.coordinates);
  return [
    Math.min(...positions.map((item) => item[0])),
    Math.min(...positions.map((item) => item[1])),
    Math.max(...positions.map((item) => item[0])),
    Math.max(...positions.map((item) => item[1])),
  ];
}

function polygonGeometry(record: EsriFeature, reference: string): Geometry {
  const rings = record.geometry.rings;
  if (!rings?.length) throw new Error(`${reference} has no polygon geometry.`);
  const coordinates = rings.map((ring) => ring.map(([x, y]) => [x, y] as [number, number]));
  if (coordinates.some((ring) => ring.length < 4))
    throw new Error(`${reference} has an invalid polygon ring.`);
  // HES records selected for Culross have single outer rings. For any future multipart record,
  // preserve each ring as a separate polygon rather than silently discarding its geometry.
  return coordinates.length === 1
    ? ({ type: 'Polygon', coordinates } as Polygon)
    : ({ type: 'MultiPolygon', coordinates: coordinates.map((ring) => [ring]) } as MultiPolygon);
}

function sourceRecord(record: EsriFeature, accessedAt: string): SourceRecord {
  return {
    sourceName: 'Historic Environment Scotland Designations GIS',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: record.attributes.DES_REF,
    sourceUrl: record.attributes.LINK,
    accessedAt,
    licence:
      'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    notes: `Location precision: ${record.attributes.PRECISION ?? 'not stated'}; ${record.attributes.ACCURACY ?? 'accuracy not stated'}.`,
    reliability: 'official_statutory',
  };
}

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const [xmin, ymin, xmax, ymax] = bounds(pkg);
const accessedAt = new Date().toISOString();
let imported = 0;
let usedLocalSource = false;

for (const dataset of datasets) {
  const localDataset: Record<number, LocalHesDataset> = {
    2: 'conservationAreas',
    4: 'designedLandscapes',
    5: 'scheduledMonuments',
  };
  const local = await localRecords(localDataset[dataset.layer], pkg);
  let records: EsriFeature[];
  if (local) {
    records = local;
    usedLocalSource = true;
  } else {
    const url = new URL(`${serviceRoot}/${dataset.layer}/query`);
    url.search = new URLSearchParams({
      where: '1=1',
      geometry: `${xmin},${ymin},${xmax},${ymax}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    }).toString();
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`HES polygon query failed for layer ${dataset.layer}: ${response.status}`);
    const payload = (await response.json()) as EsriResponse;
    if (payload.error) throw new Error(`HES polygon query failed: ${payload.error.message}`);
    records = payload.features ?? [];
  }
  for (const record of records) {
    const source = sourceRecord(record, accessedAt);
    const id = `${dataset.idPrefix}:${record.attributes.DES_REF}`;
    const existing = pkg.features.find(
      (feature) =>
        feature.id === id ||
        feature.sourceRecords.some((item) => item.sourceRecordId === source.sourceRecordId),
    );
    const common = {
      geometry: polygonGeometry(record, record.attributes.DES_REF),
      locationType: 'exact',
      locationConfidence: 'high' as const,
      sourceRecords: existing
        ? [
            ...existing.sourceRecords.filter(
              (item) => item.sourceRecordId !== source.sourceRecordId,
            ),
            source,
          ]
        : [source],
      licence: source.licence,
      updatedAt: accessedAt,
    };
    if (existing)
      Object.assign(existing, common, {
        tags: [...new Set([...existing.tags, 'hes-designation', dataset.featureType])],
      });
    else {
      pkg.features.push({
        id,
        projectId: pkg.project.id,
        name: record.attributes.DES_TITLE ?? record.attributes.DES_REF,
        alternativeNames: [],
        countryCode: pkg.project.countryCode,
        region: pkg.project.region,
        locality: pkg.project.locality,
        featureType: dataset.featureType,
        designationType: record.attributes.DES_TYPE,
        designationCategory: record.attributes.CATEGORY,
        significance: dataset.significance,
        statutoryStatus: record.attributes.DES_TYPE,
        ...common,
        dateBasis: 'unknown',
        dateConfidence: 'unknown',
        survival: 'unknown',
        shortDescription: record.attributes.DES_TYPE,
        tags: ['hes-designation', dataset.featureType],
        createdAt: accessedAt,
        reviewed: false,
        reviewNotes:
          'Current statutory designation geometry. This designation does not establish the construction date of every asset within it.',
      });
    }
    imported += 1;
  }
}

const source: DataSourceDefinition = {
  id: 'hes-designations-polygons',
  name: usedLocalSource
    ? 'Historic Environment Scotland local designation Shapefiles'
    : 'Historic Environment Scotland Designations GIS',
  organisation: 'Historic Environment Scotland',
  coverage: `${pkg.project.locality} parish, Scotland`,
  accessMethod: usedLocalSource
    ? 'Developer-supplied local HES Shapefiles; exact project-boundary intersection'
    : 'ArcGIS REST / WFS',
  sourceUrl: wfsUrl,
  licence:
    'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
  reliability: 'official_statutory',
  limitations:
    'Includes statutory conservation-area, scheduled-monument and garden/designed-landscape polygons intersecting the NRS parish boundary. These are evidence layers, not construction dates or historic settlement footprints.',
};
pkg.sources = [source, ...pkg.sources.filter((item) => item.id !== source.id)];
pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`Imported ${imported} HES statutory polygons into ${projectPath}.`);
