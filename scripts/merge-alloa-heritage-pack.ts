import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Geometry } from 'geojson';
import type {
  DataSourceDefinition,
  HeritageFeature,
  ProjectPackage,
  SourceRecord,
} from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

interface PackRecord {
  id: string;
  name: string;
  alternativeNames?: string[];
  region?: string;
  locality?: string;
  featureType?: string;
  designationType?: string | null;
  designationCategory?: string | null;
  statutoryStatus?: string | null;
  designationReference?: string | null;
  geometry?: Geometry | null;
  locationType?: string;
  documentedDateText?: string | null;
  earliestPossibleYear?: number | null;
  latestPossibleYear?: number | null;
  dateBasis?: HeritageFeature['dateBasis'];
  dateConfidence?: HeritageFeature['dateConfidence'];
  locationConfidence?: HeritageFeature['locationConfidence'];
  shortDescription?: string | null;
  fullDescription?: string | null;
  sourceRecords?: SourceRecord[];
  licence?: string;
  tags?: string[];
  reviewed?: boolean;
  reviewNotes?: string | null;
  extantStatus?: 'extant' | 'ruin' | 'demolished';
}
interface Pack {
  datasetId?: string;
  title: string;
  description?: string;
  records: PackRecord[];
  historicMaps?: Array<Record<string, unknown>>;
  settlementEvidence?: Array<Record<string, unknown>>;
  methodology?: Record<string, unknown>;
  licensingAndAttribution?: Record<string, unknown>;
  sourceRegistry?: {
    sources?: Array<{
      id: string;
      organisation: string;
      dataset?: string;
      accessMethod: string;
      sourceUrl?: string | null;
      layerUrl?: string | null;
      licence?: string;
      reliability?: string;
      limitations?: string;
    }>;
  };
}

const projectPath = resolve(process.argv[2] ?? 'data/projects/alloa.json');
const packPath = resolve(
  process.argv[3] ??
    'data/imports/alloa_heritage_starter_pack/alloa_heritage_pack/alloa_heritage_records.json',
);
const project = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const pack = JSON.parse(await readFile(packPath, 'utf8')) as Pack;
const now = new Date().toISOString();

function significance(category?: string | null): HeritageFeature['significance'] {
  return category === 'A' ? 'highest_national' : category ? 'national' : 'recognised';
}
function survival(status?: PackRecord['extantStatus']): HeritageFeature['survival'] {
  return status === 'demolished'
    ? 'site_only_or_demolished'
    : status === 'ruin'
      ? 'heavily_altered'
      : 'unknown';
}
function sourceKey(record: SourceRecord): string {
  return record.sourceRecordId ?? record.sourceUrl ?? record.sourceName;
}
function mergeSources(existing: SourceRecord[], incoming: SourceRecord[]): SourceRecord[] {
  const result = new Map(existing.map((record) => [sourceKey(record), record]));
  incoming.forEach((record) => result.set(sourceKey(record), record));
  return [...result.values()];
}
function reliability(value?: string): DataSourceDefinition['reliability'] {
  const accepted: DataSourceDefinition['reliability'][] = [
    'official_statutory',
    'official_non_statutory',
    'academic',
    'local_authority',
    'archival',
    'secondary',
    'discovery_only',
  ];
  return accepted.includes(value as DataSourceDefinition['reliability'])
    ? (value as DataSourceDefinition['reliability'])
    : 'archival';
}
function sourceId(id: string): string {
  if (id === 'hes-listed-buildings') return 'hes';
  if (id === 'hes-conservation-areas' || id === 'hes-scheduled-monuments')
    return 'hes-designations-polygons';
  return id;
}
// Historic Environment Scotland transferred this church from listing to scheduling.
// Keep one feature with the current scheduled-monument polygon while retaining the
// former listing's architectural date evidence and source trail.
const relatedDesignationTargets = new Map([['LB20952', 'hes-scheduled-monument:SM625']]);
function featureQuality(feature: HeritageFeature): number {
  return (
    (feature.reviewed ? 8 : 0) +
    (feature.fullDescription ? 4 : 0) +
    (feature.documentedDateText || feature.earliestPossibleYear !== undefined ? 2 : 0) +
    feature.sourceRecords.length +
    feature.tags.length / 10
  );
}
function consolidateDuplicateIds(features: HeritageFeature[]): {
  features: HeritageFeature[];
  removed: number;
} {
  const groups = new Map<string, HeritageFeature[]>();
  features.forEach((feature) =>
    groups.set(feature.id, [...(groups.get(feature.id) ?? []), feature]),
  );
  let removed = 0;
  const consolidated: HeritageFeature[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      consolidated.push(group[0]);
      continue;
    }
    const [canonical, ...duplicates] = [...group].sort(
      (left, right) => featureQuality(right) - featureQuality(left),
    );
    duplicates.forEach((duplicate) => {
      canonical.alternativeNames = [
        ...new Set([
          ...canonical.alternativeNames,
          ...duplicate.alternativeNames,
          ...(duplicate.name === canonical.name ? [] : [duplicate.name]),
        ]),
      ];
      canonical.sourceRecords = mergeSources(canonical.sourceRecords, duplicate.sourceRecords);
      canonical.tags = [...new Set([...canonical.tags, ...duplicate.tags])];
      canonical.geometry ??= duplicate.geometry;
      canonical.shortDescription ??= duplicate.shortDescription;
      canonical.fullDescription ??= duplicate.fullDescription;
      canonical.documentedDateText ??= duplicate.documentedDateText;
      canonical.earliestPossibleYear ??= duplicate.earliestPossibleYear;
      canonical.latestPossibleYear ??= duplicate.latestPossibleYear;
      canonical.reviewed ||= duplicate.reviewed;
    });
    canonical.updatedAt = now;
    canonical.reviewNotes = canonical.reviewNotes?.includes(
      'Duplicate designation components consolidated',
    )
      ? canonical.reviewNotes
      : `${canonical.reviewNotes ? `${canonical.reviewNotes} ` : ''}Duplicate designation components consolidated into one project record.`;
    consolidated.push(canonical);
    removed += duplicates.length;
  }
  return { features: consolidated, removed };
}
function fromPack(record: PackRecord): HeritageFeature {
  const designation = record.designationReference;
  return {
    id: designation ? `hes-listed-building:${designation}` : `curated:${record.id}`,
    projectId: project.project.id,
    name: record.name,
    alternativeNames: record.alternativeNames ?? [],
    countryCode: project.project.countryCode,
    region: record.region ?? project.project.region,
    locality: record.locality ?? project.project.locality,
    featureType: record.featureType ?? 'other',
    designationType: record.designationType ?? undefined,
    designationCategory: record.designationCategory
      ? `Category ${record.designationCategory}`
      : undefined,
    significance: significance(record.designationCategory),
    statutoryStatus: record.statutoryStatus ?? undefined,
    geometry: record.geometry ?? null,
    locationType: record.locationType ?? 'unknown',
    documentedDateText: record.documentedDateText ?? undefined,
    earliestPossibleYear: record.earliestPossibleYear ?? undefined,
    latestPossibleYear: record.latestPossibleYear ?? undefined,
    dateBasis: record.dateBasis ?? 'unknown',
    dateConfidence: record.dateConfidence ?? 'unknown',
    locationConfidence: record.locationConfidence ?? 'unknown',
    survival: survival(record.extantStatus),
    shortDescription: record.shortDescription ?? undefined,
    fullDescription: record.fullDescription ?? undefined,
    sourceRecords: record.sourceRecords ?? [],
    licence: record.licence,
    tags: record.tags ?? [],
    createdAt: now,
    updatedAt: now,
    reviewed: record.reviewed ?? false,
    reviewNotes: record.reviewNotes ?? undefined,
  };
}

const beforeMerge = consolidateDuplicateIds(project.features);
project.features = beforeMerge.features;
const existingByDesignation = new Map<string, HeritageFeature>();
project.features.forEach((feature) =>
  feature.sourceRecords.forEach((source) => {
    if (source.sourceRecordId) existingByDesignation.set(source.sourceRecordId, feature);
  }),
);
const existingById = new Map(project.features.map((feature) => [feature.id, feature]));
let enriched = 0;
let addedMapped = 0;
let addedResearch = 0;
for (const record of pack.records) {
  const relatedTarget = record.designationReference
    ? relatedDesignationTargets.get(record.designationReference)
    : undefined;
  const existing = record.designationReference
    ? ((relatedTarget ? existingById.get(relatedTarget) : undefined) ??
      existingByDesignation.get(record.designationReference))
    : existingById.get(`curated:${record.id}`);
  if (existing) {
    const enrichment = fromPack(record);
    Object.assign(existing, {
      ...enrichment,
      id: existing.id,
      projectId: existing.projectId,
      geometry: existing.geometry ?? enrichment.geometry,
      sourceRecords: mergeSources(existing.sourceRecords, enrichment.sourceRecords),
      alternativeNames: [
        ...new Set([...existing.alternativeNames, ...enrichment.alternativeNames]),
      ],
      tags: [...new Set([...existing.tags, ...enrichment.tags])],
      createdAt: existing.createdAt,
      updatedAt: now,
    });
    if (relatedTarget) {
      Object.assign(existing, {
        designationType: 'Scheduled Monument; former Listed Building',
        designationCategory: undefined,
        statutoryStatus: 'Scheduled Monument; listed building designation removed in 2018',
        significance: 'national',
        reviewNotes:
          'The current scheduled-monument polygon (SM625) is combined with the former listed-building record (LB20952). The 1680–1683 date describes remodelling of earlier fabric, not the original foundation of the church.',
      });
    }
    enriched += 1;
  } else {
    const imported = fromPack(record);
    project.features.push(imported);
    existingById.set(imported.id, imported);
    if (imported.geometry) addedMapped += 1;
    else addedResearch += 1;
  }
}
let relatedDesignationsRemoved = 0;
for (const [formerReference, targetId] of relatedDesignationTargets) {
  const formerId = `hes-listed-building:${formerReference}`;
  if (project.features.some((feature) => feature.id === targetId)) {
    const before = project.features.length;
    project.features = project.features.filter((feature) => feature.id !== formerId);
    relatedDesignationsRemoved += before - project.features.length;
  }
}
const packSource: DataSourceDefinition = {
  id: pack.datasetId ?? 'alloa-heritage-pack',
  name: pack.title,
  organisation: 'Curated Alloa heritage pack',
  coverage: 'Alloa / Clackmannanshire',
  accessMethod: 'Curated JSON import',
  licence: 'See individual source records; HES attribution retained.',
  reliability: 'academic',
  limitations: pack.description ?? 'Curated records require ongoing source review.',
};
project.sources = [packSource, ...project.sources.filter((source) => source.id !== packSource.id)];
for (const source of pack.sourceRegistry?.sources ?? []) {
  const importedSource: DataSourceDefinition = {
    id: sourceId(source.id),
    name: source.dataset ?? source.id,
    organisation: source.organisation,
    coverage: 'Alloa / Scotland',
    accessMethod: source.accessMethod,
    sourceUrl: source.sourceUrl ?? source.layerUrl ?? undefined,
    licence: source.licence,
    reliability: reliability(source.reliability),
    limitations: source.limitations,
  };
  project.sources = [
    importedSource,
    ...project.sources.filter((existing) => existing.id !== importedSource.id),
  ];
}
if (pack.historicMaps?.length) {
  const mapCatalogue: DataSourceDefinition = {
    id: `${pack.datasetId ?? 'alloa-heritage-pack'}-historic-map-catalogue`,
    name: `${pack.title} historic-map catalogue`,
    organisation: 'Project owner',
    coverage: 'Alloa',
    accessMethod: 'User-supplied metadata import',
    reliability: 'archival',
    limitations: `${pack.historicMaps.length} map records are retained in the supplied pack but are not published as map layers until their original source, licence and georeferencing are confirmed.`,
  };
  project.sources = [
    mapCatalogue,
    ...project.sources.filter((source) => source.id !== mapCatalogue.id),
  ];
}
const packId = pack.datasetId ?? 'alloa-heritage-pack';
project.curationMetadata ??= { importedPacks: [] };
project.curationMetadata.importedPacks = [
  {
    datasetId: packId,
    title: pack.title,
    importedAt: now,
    historicMapCatalogue: pack.historicMaps,
    settlementEvidence: pack.settlementEvidence,
    methodology: pack.methodology,
    licensingAndAttribution: pack.licensingAndAttribution,
  },
  ...project.curationMetadata.importedPacks.filter((item) => item.datasetId !== packId),
];
project.features.forEach((feature) => {
  feature.sourceRecords = mergeSources([], feature.sourceRecords);
});
project.validation = validateFeatures(project.project, project.features);
if (project.validation.some((result) => result.severity === 'error'))
  throw new Error(
    `Refusing to write ${project.validation.filter((result) => result.severity === 'error').length} validation error(s).`,
  );
await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
console.log(
  `Merged ${pack.records.length} pack records: ${enriched} enriched, ${addedMapped} new mapped, ${addedResearch} geometry-pending research records, ${beforeMerge.removed} duplicate IDs consolidated, ${relatedDesignationsRemoved} related designation record(s) merged.`,
);
