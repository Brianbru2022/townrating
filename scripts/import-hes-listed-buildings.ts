import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson';
import type {
  DataSourceDefinition,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
  TownStudyArea,
} from '../src/domain/models';
import {
  bufferedTownBoundary,
  classifyTownPoint,
  type TownSelection,
} from '../src/domain/townStudy';
import { validateFeatures } from '../src/domain/validation';
import {
  localHesListedBuildingFiles,
  readReferenceData,
  referenceDatasets,
} from './lib/reference-data';

type AreaGeometry = Polygon | MultiPolygon;

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');
const BUFFER_METRES = 500;
const LOCALITY_BY_PROJECT: Record<string, string> = {
  'alloa-scotland': 'Alloa',
  'alva-scotland': 'Alva',
  // NRS combines Culross with the neighbouring Valleyfield localities. The
  // project parish boundary clips the resulting town register to Culross.
  'culross-scotland': 'High Valleyfield, Low Valleyfield and Culross',
  'kincardine-on-forth-scotland': 'Kincardine',
  'tillicoultry-scotland': 'Tillicoultry',
  'quarriers-village-scotland': "Quarrier's Village",
  'biggar-scotland': 'Biggar',
  'killin-scotland': 'Killin',
};

type SpatialFeature = Feature<AreaGeometry, Record<string, unknown>>;
interface HESAttributes {
  ENT_REF?: number | string;
  ENT_TITLE?: string;
  DES_REF?: string;
  DES_TITLE?: string;
  DES_TYPE?: string;
  CATEGORY?: string;
  LINK?: string;
  PRECISION?: string;
  ACCURACY?: string;
  DESIGNATED?: string | Date | null;
  UPDATED?: string | Date | null;
}
type HESPoint = Feature<Point, HESAttributes>;
type ShapeCollection = { features: Array<Feature> };

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}
function dateText(value: string | Date | null | undefined): string | undefined {
  if (!value || Number.isNaN(new Date(value).valueOf())) return undefined;
  return new Date(value).toISOString().slice(0, 10);
}
function designationReference(record: HESPoint): string {
  const reference = record.properties.DES_REF ?? record.properties.ENT_REF;
  if (!reference) throw new Error('HES listed-building point has no designation reference.');
  return String(reference);
}
function sourceRecord(record: HESPoint, accessedAt: string): SourceRecord {
  const attributes = record.properties;
  const designated = dateText(attributes.DESIGNATED);
  return {
    sourceName: 'Historic Environment Scotland Listed Buildings spatial data',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: designationReference(record),
    sourceUrl: attributes.LINK,
    accessedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    notes: [
      `Location precision: ${attributes.PRECISION ?? 'not stated'}.`,
      attributes.ACCURACY ?? 'Accuracy not stated.',
      designated ? `Designation date: ${designated}.` : undefined,
    ]
      .filter(Boolean)
      .join(' '),
    reliability: 'official_statutory',
  };
}
function mergeSourceRecords(existing: SourceRecord[], incoming: SourceRecord): SourceRecord[] {
  return [
    ...existing.filter(
      (source) =>
        !(
          source.sourceOrganisation === incoming.sourceOrganisation &&
          source.sourceRecordId === incoming.sourceRecordId
        ),
    ),
    incoming,
  ];
}
function mergeAllSourceRecords(existing: SourceRecord[], incoming: SourceRecord[]): SourceRecord[] {
  return incoming.reduce((merged, source) => mergeSourceRecords(merged, source), existing);
}
function selectionTag(selection: TownSelection): string {
  return `town-selection-${selection.replaceAll('_', '-')}`;
}
function applySelectionTags(tags: string[], selection: TownSelection): string[] {
  return [
    ...new Set([
      ...tags.filter((tag) => !tag.startsWith('town-selection-')),
      'hes-listed-building',
      selectionTag(selection),
    ]),
  ];
}
function candidateSelection(
  record: HESPoint,
  pkg: ProjectPackage,
  locality: Feature<AreaGeometry>,
  bufferedLocality: Feature<AreaGeometry>,
): TownSelection {
  return classifyTownPoint(record.geometry, locality, bufferedLocality);
}
async function spatialCollections(key: 'hesListedBuildings' | 'nrsLocalities2022') {
  Object.assign(globalThis, { self: globalThis });
  const { default: shp } = await import('shpjs');
  if (key === 'hesListedBuildings') {
    const localFiles = await localHesListedBuildingFiles();
    if (localFiles) {
      // @types/shpjs exposes ZIP input only, although shpjs also supports the
      // documented multi-file Shapefile bundle used here.
      const localBundle = {
        shp: await readFile(localFiles.shp),
        dbf: await readFile(localFiles.dbf),
        prj: await readFile(localFiles.prj, 'utf8'),
        cpg: await readFile(localFiles.cpg, 'utf8'),
      };
      const parsed = (await shp(localBundle as unknown as Buffer)) as
        ShapeCollection | ShapeCollection[];
      return Array.isArray(parsed) ? parsed : [parsed];
    }
  }
  const parsed = (await shp(await readReferenceData(key))) as ShapeCollection | ShapeCollection[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const localityName = LOCALITY_BY_PROJECT[pkg.project.id];
if (!localityName)
  throw new Error(`No NRS locality configuration is registered for ${pkg.project.id}.`);

const localityCollections = await spatialCollections('nrsLocalities2022');
const locality = localityCollections
  .flatMap((collection) => collection.features)
  .find(
    (feature): feature is SpatialFeature =>
      (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') &&
      normalise(String(feature.properties?.name ?? '')) === normalise(localityName),
  );
if (!locality) throw new Error(`NRS 2022 locality '${localityName}' was not found.`);
const localityBoundary: Feature<AreaGeometry> = {
  type: 'Feature',
  properties: locality.properties ?? {},
  geometry: locality.geometry,
};
const bufferedBoundary = bufferedTownBoundary(localityBoundary, BUFFER_METRES);
const studyArea: TownStudyArea = {
  localityName,
  localityCode: String(locality.properties?.code ?? ''),
  sourceName: 'National Records of Scotland 2022 Census Locality Boundaries',
  sourceUrl: referenceDatasets.nrsLocalities2022.sourceUrl,
  sourceVersion: '2022 Census Geography Products',
  bufferMetres: BUFFER_METRES,
  localityBoundary,
  bufferedBoundary,
  notes:
    pkg.project.id === 'culross-scotland'
      ? 'NRS publishes Culross in a combined locality with High Valleyfield and Low Valleyfield. The Culross civil-parish project boundary clips the town listed-building extract.'
      : 'Modern statistical locality used only for the town listed-building register; it is not a historic boundary or a replacement for the project study boundary.',
};

const hesCollections = await spatialCollections('hesListedBuildings');
const hesPoints = hesCollections
  .flatMap((collection) => collection.features)
  .filter(
    (feature): feature is HESPoint =>
      feature.geometry.type === 'Point' && Boolean((feature.properties as HESAttributes).DES_REF),
  );
const selectedByReference = new Map<string, { selection: TownSelection; points: HESPoint[] }>();
for (const record of hesPoints) {
  const selection = candidateSelection(record, pkg, localityBoundary, bufferedBoundary);
  if (selection === 'excluded') continue;
  const reference = designationReference(record);
  const current = selectedByReference.get(reference);
  const strongest =
    current?.selection === 'inside_locality' || selection === 'inside_locality'
      ? 'inside_locality'
      : 'heritage_buffer';
  selectedByReference.set(reference, {
    selection: strongest,
    points: [...(current?.points ?? []), record],
  });
}

const accessedAt = new Date().toISOString();
let added = 0;
let refreshed = 0;
let bufferCandidates = 0;
const redundantDirectFeatureIds = new Set<string>();
for (const [reference, selected] of selectedByReference) {
  const record = selected.points[0];
  const attributes = record.properties;
  const additionalPointLocations = selected.points
    .slice(1)
    .map((item) => item.geometry)
    .filter(
      (location, index, locations) =>
        !locations
          .slice(0, index)
          .some(
            (candidate) =>
              candidate.coordinates[0] === location.coordinates[0] &&
              candidate.coordinates[1] === location.coordinates[1],
          ),
    );
  const matches = pkg.features.filter(
    (feature) =>
      feature.id === `hes-listed-building:${reference}` ||
      feature.sourceRecords.some(
        (source) =>
          source.sourceOrganisation === 'Historic Environment Scotland' &&
          source.sourceRecordId === reference,
      ),
  );
  // Prefer a curated counterpart because that is where reviewed dates and
  // descriptions live. Only the direct, generated HES feature may be removed;
  // two curated records can legitimately cite the same historic reference.
  const current =
    matches.find((feature) => feature.id.startsWith('curated:')) ??
    matches.find((feature) => feature.id === `hes-listed-building:${reference}`) ??
    matches[0];
  const source = sourceRecord(record, accessedAt);
  const common = {
    designationType: attributes.DES_TYPE ?? 'Listed Building',
    designationCategory: attributes.CATEGORY ? `Category ${attributes.CATEGORY}` : undefined,
    statutoryStatus: 'Listed Building',
    geometry: record.geometry,
    additionalPointLocations: additionalPointLocations.length
      ? additionalPointLocations
      : undefined,
    locationType: 'representative_point',
    locationConfidence:
      attributes.PRECISION === 'Within 10m' ? ('high' as const) : ('medium' as const),
    sourceRecords: mergeSourceRecords(current?.sourceRecords ?? [], source),
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    tags: applySelectionTags(current?.tags ?? [], selected.selection),
    updatedAt: accessedAt,
  };
  if (current) {
    Object.assign(current, common, {
      name: current.name || attributes.ENT_TITLE || attributes.DES_TITLE || reference,
      alternativeNames: [
        ...new Set([
          ...current.alternativeNames,
          ...selected.points
            .map((point) => point.properties.ENT_TITLE || point.properties.DES_TITLE)
            .filter((name): name is string => Boolean(name) && name !== current.name),
        ]),
      ],
      evidenceScope:
        selected.selection === 'heritage_buffer' &&
        !current.tags.includes('town-selection-manual-included')
          ? 'related_context'
          : current.evidenceScope,
      reviewNotes:
        selected.selection === 'heritage_buffer'
          ? `${current.reviewNotes ? `${current.reviewNotes} ` : ''}Within the 500m town heritage buffer; review before treating it as a town listed-building record.`
          : current.reviewNotes,
    });
    for (const duplicate of matches) {
      if (duplicate.id === current.id || !duplicate.id.startsWith('hes-listed-building:')) continue;
      current.sourceRecords = mergeAllSourceRecords(current.sourceRecords, duplicate.sourceRecords);
      current.tags = [...new Set([...current.tags, ...duplicate.tags])];
      redundantDirectFeatureIds.add(duplicate.id);
    }
    refreshed += 1;
  } else {
    const feature: HeritageFeature = {
      id: `hes-listed-building:${reference}`,
      projectId: pkg.project.id,
      name: attributes.ENT_TITLE || attributes.DES_TITLE || `HES record ${reference}`,
      alternativeNames: [
        ...new Set(
          selected.points
            .map((point) => point.properties.ENT_TITLE || point.properties.DES_TITLE)
            .filter((name): name is string => Boolean(name) && name !== attributes.ENT_TITLE),
        ),
      ],
      countryCode: pkg.project.countryCode,
      region: pkg.project.region,
      locality: pkg.project.locality,
      featureType: 'other',
      significance: attributes.CATEGORY === 'A' ? 'highest_national' : 'national',
      ...common,
      dateBasis: 'unknown',
      dateConfidence: 'unknown',
      survival: 'unknown',
      shortDescription: attributes.DES_TITLE,
      createdAt: accessedAt,
      reviewed: false,
      reviewNotes:
        selected.selection === 'heritage_buffer'
          ? 'Within the 500m town heritage buffer; review before treating it as a town listed-building record.'
          : 'Imported from the HES national Listed Buildings spatial data. Statutory listing and location are authoritative; construction-date review remains separate.',
      evidenceScope:
        selected.selection === 'heritage_buffer' ? 'related_context' : 'parish_evidence',
    };
    pkg.features.push(feature);
    added += 1;
  }
  if (selected.selection === 'heritage_buffer') bufferCandidates += 1;
}
if (redundantDirectFeatureIds.size)
  pkg.features = pkg.features.filter((feature) => !redundantDirectFeatureIds.has(feature.id));

const source: DataSourceDefinition = {
  id: 'hes-listed-buildings',
  name: 'Historic Environment Scotland Listed Buildings spatial data',
  organisation: 'Historic Environment Scotland',
  coverage: `${pkg.project.locality} NRS locality plus ${BUFFER_METRES}m heritage buffer; buffer records are retained as related context`,
  accessMethod: (await localHesListedBuildingFiles())
    ? 'Developer-supplied local HES Shapefile; exact polygon selection'
    : 'National spatial download; exact polygon selection',
  sourceUrl: referenceDatasets.hesListedBuildings.sourceUrl,
  licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
  reliability: 'official_statutory',
  limitations:
    'The NRS locality is a modern statistical geography, not a historic town boundary. Buffer records remain review candidates. The source supplies statutory designation and location metadata, not construction dates.',
};
pkg.project.townStudyArea = studyArea;
pkg.sources = [source, ...pkg.sources.filter((item) => item.id !== source.id)];
pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  `Imported HES listed buildings for ${pkg.project.locality}: ${added} added, ${refreshed} refreshed, ${bufferCandidates} buffer candidate(s).`,
);
