import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Polygon } from 'geojson';
import type {
  DataSourceDefinition,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');
const serviceRoot = 'https://inspire.hes.scot/arcgis/rest/services/HES/HES_Designations/MapServer';
const wfsUrl = 'https://inspire.hes.scot/arcgis/services/HES/HES_Designations/MapServer/WFSServer';

type Dataset = 'conservation-area' | 'scheduled-monument';

interface EsriFeature {
  attributes: {
    DES_REF: string;
    DES_TITLE?: string;
    DES_TYPE?: string;
    CATEGORY?: string;
    LINK?: string;
    PRECISION?: string;
    ACCURACY?: string;
    DESIGNATED?: number | null;
  };
  geometry: { rings?: number[][][] };
}

interface EsriResponse {
  features?: EsriFeature[];
  error?: { message: string };
}

interface ImportDefinition {
  dataset: Dataset;
  layer: number;
  reference: string;
  existingId?: string;
}

// These are deliberate, reviewed Alloa selections.  The wider setup extent also
// intersects Clackmannan and outlying scheduled monuments, which are not imported.
const selections: ImportDefinition[] = [
  {
    dataset: 'conservation-area',
    layer: 2,
    reference: 'CA506',
    existingId: 'curated:area-alloa-glebe-conservation',
  },
  {
    dataset: 'conservation-area',
    layer: 2,
    reference: 'CA507',
    existingId: 'curated:area-old-alloa-conservation',
  },
  { dataset: 'scheduled-monument', layer: 5, reference: 'SM3746' },
  { dataset: 'scheduled-monument', layer: 5, reference: 'SM625' },
];

function queryUrl(layer: number, reference: string): string {
  return `${serviceRoot}/${layer}/query?${new URLSearchParams({
    where: `DES_REF = '${reference}'`,
    // HES rejects field subsets for these two layers. Retrieve service fields
    // and retain only the attributes this importer uses below.
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'json',
  }).toString()}`;
}

function geometry(record: EsriFeature, reference: string): Polygon {
  const rings = record.geometry.rings;
  if (!rings?.length) throw new Error(`${reference} has no polygon geometry.`);
  // HES supplies one reviewed outer ring for each selected record.  Refuse an
  // ambiguous multi-ring shape rather than guessing holes or multipart topology.
  if (rings.length !== 1)
    throw new Error(`${reference} has ${rings.length} rings; review topology before import.`);
  const coordinates = rings[0].map(
    ([longitude, latitude]) => [longitude, latitude] as [number, number],
  );
  if (coordinates.length < 4) throw new Error(`${reference} has an invalid polygon ring.`);
  return { type: 'Polygon', coordinates: [coordinates] };
}

function sourceRecord(record: EsriFeature, accessedAt: string): SourceRecord {
  const { DES_REF, LINK, PRECISION, ACCURACY } = record.attributes;
  return {
    sourceName: 'Historic Environment Scotland Designations GIS',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: DES_REF,
    sourceUrl: LINK,
    accessedAt,
    licence:
      'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    notes: `Location precision: ${PRECISION ?? 'not stated'}; ${ACCURACY ?? 'accuracy not stated'}.`,
    reliability: 'official_statutory',
  };
}

function recordTags(dataset: Dataset, category?: string): string[] {
  return [
    'hes-designation',
    dataset,
    ...(category ? [category.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')] : []),
  ];
}

function mergeSourceRecords(existing: SourceRecord[], incoming: SourceRecord): SourceRecord[] {
  const key = (source: SourceRecord) =>
    source.sourceRecordId ?? source.sourceUrl ?? source.sourceName;
  return [...existing.filter((source) => key(source) !== key(incoming)), incoming];
}

async function getRecord(definition: ImportDefinition): Promise<EsriFeature> {
  const response = await fetch(queryUrl(definition.layer, definition.reference));
  if (!response.ok)
    throw new Error(`HES query for ${definition.reference} failed: ${response.status}`);
  const data = (await response.json()) as EsriResponse;
  if (data.error)
    throw new Error(`HES query for ${definition.reference} failed: ${data.error.message}`);
  if (data.features?.length !== 1)
    throw new Error(
      `Expected one HES record for ${definition.reference}, received ${data.features?.length ?? 0}.`,
    );
  return data.features[0];
}

const packageJson = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();
let enriched = 0;
let added = 0;

for (const definition of selections) {
  const record = await getRecord(definition);
  const source = sourceRecord(record, accessedAt);
  const { DES_REF, DES_TITLE, DES_TYPE, CATEGORY } = record.attributes;
  const existing = packageJson.features.find(
    (feature) =>
      feature.id === definition.existingId ||
      feature.sourceRecords.some((item) => item.sourceRecordId === DES_REF),
  );
  const common = {
    designationType: DES_TYPE,
    statutoryStatus: DES_TYPE,
    geometry: geometry(record, DES_REF),
    locationType: 'exact',
    locationConfidence: 'high' as const,
    sourceRecords: mergeSourceRecords(existing?.sourceRecords ?? [], source),
    licence:
      'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    tags: [...new Set([...(existing?.tags ?? []), ...recordTags(definition.dataset, CATEGORY)])],
    updatedAt: accessedAt,
  };

  if (existing) {
    const importNote = 'Official HES designation polygon imported';
    Object.assign(existing, common, {
      designationCategory: CATEGORY ?? existing.designationCategory,
      significance: definition.dataset === 'scheduled-monument' ? 'national' : 'regional',
      reviewNotes: existing.reviewNotes?.includes(importNote)
        ? existing.reviewNotes
        : existing.reviewNotes
          ? `${existing.reviewNotes} ${importNote}.`
          : `${importNote}.`,
    });
    enriched += 1;
    continue;
  }

  const feature: HeritageFeature = {
    id: `hes-${definition.dataset}:${DES_REF}`,
    projectId: packageJson.project.id,
    name: DES_TITLE ?? DES_REF,
    alternativeNames: [],
    countryCode: packageJson.project.countryCode,
    region: packageJson.project.region,
    locality: packageJson.project.locality,
    featureType: definition.dataset,
    designationType: DES_TYPE,
    designationCategory: CATEGORY,
    significance: 'national',
    statutoryStatus: DES_TYPE,
    geometry: common.geometry,
    locationType: common.locationType,
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    locationConfidence: common.locationConfidence,
    survival: 'unknown',
    shortDescription: DES_TYPE,
    sourceRecords: common.sourceRecords,
    licence: common.licence,
    tags: common.tags,
    createdAt: accessedAt,
    updatedAt: accessedAt,
    reviewed: false,
    reviewNotes:
      'Statutory designation geometry is current; it does not establish construction dates.',
  };
  packageJson.features.push(feature);
  added += 1;
}

const source: DataSourceDefinition = {
  id: 'hes-designations-polygons',
  name: 'Historic Environment Scotland Designations GIS — selected Alloa polygons',
  organisation: 'Historic Environment Scotland',
  coverage: 'Selected statutory designations in Alloa, Scotland',
  accessMethod: 'ArcGIS REST / WFS',
  sourceUrl: wfsUrl,
  licence:
    'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
  reliability: 'official_statutory',
  limitations:
    'Imports only explicitly reviewed Alloa conservation-area and scheduled-monument references. Designation dates and boundaries are not construction dates or a town-boundary definition.',
};
packageJson.sources = [source, ...packageJson.sources.filter((item) => item.id !== source.id)];
packageJson.project.researchNotes =
  'The project boundary remains a low-confidence developer setup extent. HES conservation-area polygons are evidence layers only and are not used as the Alloa study boundary.';
packageJson.validation = validateFeatures(packageJson.project, packageJson.features);
const errors = packageJson.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
console.log(`Imported HES polygons: ${enriched} enriched, ${added} added.`);
