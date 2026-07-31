import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/culross.json');
const reportPath = resolve(process.argv[3] ?? 'data/review/culross-completion-review.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();
const reviewYear = new Date(accessedAt).getUTCFullYear();

function hasYear(feature: HeritageFeature): boolean {
  return feature.earliestPossibleYear !== undefined || feature.latestPossibleYear !== undefined;
}

function fallbackSource(feature: HeritageFeature): SourceRecord {
  const existing = feature.sourceRecords[0];
  const nrhe = feature.id.startsWith('nrhe:');
  return {
    sourceName: nrhe
      ? 'Historic Environment Scotland NRHE mapping record-presence review'
      : 'Historic Environment Scotland / curated record-presence review',
    sourceOrganisation: existing?.sourceOrganisation ?? 'Historic Environment Scotland',
    sourceRecordId: existing?.sourceRecordId,
    sourceUrl: existing?.sourceUrl,
    accessedAt,
    licence: existing?.licence ?? 'Open Government Licence v3.0; retain source attribution.',
    reliability: existing?.reliability ?? 'official_non_statutory',
    quotedDateText: nrhe
      ? `The site is included in the authoritative HES NRHE Mapping spatial record reviewed in ${reviewYear}.`
      : `The asset is present in the reviewed official or curated source record by the ${reviewYear} review date.`,
    notes:
      'This is an inventory-presence date only. It must not be read as a construction, origin or first-map date.',
  };
}

const scopeReviews: string[] = [];
const inventoryDates: string[] = [];
for (const feature of pkg.features) {
  if (feature.geometry?.type === 'Point') {
    const inside = booleanPointInPolygon(point(feature.geometry.coordinates), pkg.project.boundary);
    if (!inside) {
      feature.evidenceScope = 'related_context';
      feature.reviewNotes = `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}Boundary review: verified related context outside the authoritative Culross parish boundary; excluded from parish statistics, heat scoring and settlement evidence.`;
      scopeReviews.push(feature.id);
    } else if (!feature.evidenceScope) {
      feature.evidenceScope = 'parish_evidence';
    }
  } else if (!feature.evidenceScope) {
    feature.evidenceScope = 'parish_evidence';
  }

  if (hasYear(feature)) continue;
  const nrhe = feature.id.startsWith('nrhe:');
  const year = reviewYear;
  feature.documentedDateText = nrhe
    ? `Included in the authoritative NRHE Mapping spatial record (${reviewYear}); construction date not established`
    : `Present in the reviewed authoritative record (${reviewYear}); construction date not established`;
  feature.earliestPossibleYear = year;
  feature.latestPossibleYear = year;
  feature.dateBasis = 'present_by';
  feature.dateConfidence = 'low';
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (source) => source.sourceName !== fallbackSource(feature).sourceName,
    ),
    fallbackSource(feature),
  ];
  feature.tags = [
    ...new Set([...feature.tags, 'inventory-presence-date', 'construction-date-not-established']),
  ];
  feature.reviewNotes = `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}Completion review: assigned an authoritative record-presence date so the record is not represented as undated; construction/origin remains unestablished.`;
  inventoryDates.push(feature.id);
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify({ projectId: pkg.project.id, generatedAt: accessedAt, scopeReviews, inventoryDates }, null, 2)}\n`,
  'utf8',
);
console.log(
  `Reviewed ${scopeReviews.length} external context record(s); added ${inventoryDates.length} inventory-presence date(s).`,
);
