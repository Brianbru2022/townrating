import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/biggar.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/biggar-nrhe-period-enrichment.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

function classification(feature: HeritageFeature): string | undefined {
  return feature.shortDescription?.replace(/^NRHE classification:\s*/i, '').trim();
}

function centuryRange(century: number): [number, number] {
  return [(century - 1) * 100, century === 21 ? 2026 : century * 100 - 1];
}

function dateFromClassification(
  value: string,
): { text: string; earliest: number; latest: number } | undefined {
  const centuries = [...value.matchAll(/\b(1[1-9]|20|21)(?:th|st|nd|rd)\s+century\b/gi)].map(
    (match) => Number(match[1]),
  );
  if (centuries.length) {
    const ranges = centuries.map(centuryRange);
    return {
      text: `NRHE classification period: ${value}`,
      earliest: Math.min(...ranges.map(([earliest]) => earliest)),
      latest: Math.max(...ranges.map(([, latest]) => latest)),
    };
  }
  if (/\bmedieval\b/i.test(value))
    return { text: `NRHE classification period: ${value}`, earliest: 1100, latest: 1599 };
  if (/\broman\b/i.test(value))
    return { text: `NRHE classification period: ${value}`, earliest: 43, latest: 409 };
  return undefined;
}

const enriched: Array<{ id: string; name: string; range: [number, number] }> = [];
const stillUndated: Array<{ id: string; name: string; classification?: string }> = [];
for (const feature of pkg.features) {
  if (!feature.id.startsWith('nrhe:') || feature.earliestPossibleYear || feature.latestPossibleYear)
    continue;
  const value = classification(feature);
  const date = value ? dateFromClassification(value) : undefined;
  if (!date) {
    stillUndated.push({ id: feature.id, name: feature.name, classification: value });
    continue;
  }
  const sourceId = feature.id.slice('nrhe:'.length);
  const source: SourceRecord = {
    sourceName: 'Historic Environment Scotland NRHE period classification',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: sourceId,
    sourceUrl: `https://www.trove.scot/place/${sourceId}`,
    accessedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    notes:
      'A broad historic-period range normalised from the official NRHE classification. It identifies the classified component, not a precise construction date.',
    reliability: 'official_non_statutory',
  };
  Object.assign(feature, {
    documentedDateText: date.text,
    earliestPossibleYear: date.earliest,
    latestPossibleYear: date.latest,
    datePrecision: 'NRHE classification period',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    sourceRecords: [
      ...feature.sourceRecords.filter((record) => record.sourceName !== source.sourceName),
      source,
    ],
    tags: [...new Set([...feature.tags, 'biggar-nrhe-period-enriched', 'curation-date-enriched'])],
    reviewNotes:
      `${feature.reviewNotes ?? ''} Broad date range normalised from the explicit NRHE classification period; it is not a single-year construction assertion.`.trim(),
    updatedAt: accessedAt,
  });
  enriched.push({ id: feature.id, name: feature.name, range: [date.earliest, date.latest] });
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await mkdir(dirname(reviewPath), { recursive: true });
await writeFile(
  reviewPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      generatedAt: accessedAt,
      policy:
        'Only explicit NRHE Roman, medieval or numbered-century classifications were normalised. Period-unassigned, general-view and event records remain undated rather than being guessed.',
      enriched,
      stillUndated,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  `Enriched ${enriched.length} Biggar NRHE record(s); ${stillUndated.length} remain without explicit period evidence.`,
);
