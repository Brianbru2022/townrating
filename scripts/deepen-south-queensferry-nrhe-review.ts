import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/south-queensferry.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/south-queensferry-deeper-nrhe-review.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const reviewedAt = new Date().toISOString();

interface ManualDate {
  id: string;
  documentedDateText: string;
  earliestPossibleYear?: number;
  latestPossibleYear?: number;
  datePrecision: string;
  dateBasis: HeritageFeature['dateBasis'];
  dateConfidence: HeritageFeature['dateConfidence'];
  notes: string;
}

const manualDates: ManualDate[] = [
  {
    id: 'nrhe:50501',
    documentedDateText: 'Early 19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1839,
    datePrecision: 'Trove place-page century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'Trove place page for South Queensferry, 20, 21, 21A and 22 High Street describes the houses as early 19th century.',
  },
  {
    id: 'nrhe:281229',
    documentedDateText: 'Ferry pier may pre-date harbour reorganisation about 1812',
    latestPossibleYear: 1812,
    datePrecision: 'Trove place-page present-by contextual date',
    dateBasis: 'present_by',
    dateConfidence: 'low',
    notes:
      'Trove place page for South Queensferry Harbour, Ferry Pier states the pier may date, at least in part, from before the harbour reorganisation effected about 1812.',
  },
];

function sourceFor(feature: HeritageFeature, notes: string): SourceRecord {
  const reference = feature.id.slice('nrhe:'.length);
  return {
    sourceName: 'Historic Environment Scotland Trove deeper NRHE review',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: reference,
    sourceUrl: `https://www.trove.scot/place/${reference}`,
    accessedAt: reviewedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    reliability: 'official_non_statutory',
    notes,
  };
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function removeTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = feature.tags.filter((tag) => !tags.includes(tag));
}

const upgraded = [];
for (const entry of manualDates) {
  const feature = pkg.features.find((candidate) => candidate.id === entry.id);
  if (!feature) throw new Error(`Missing NRHE deeper review target ${entry.id}.`);
  const source = sourceFor(feature, entry.notes);
  feature.documentedDateText = entry.documentedDateText;
  feature.earliestPossibleYear = entry.earliestPossibleYear;
  feature.latestPossibleYear = entry.latestPossibleYear;
  feature.datePrecision = entry.datePrecision;
  feature.dateBasis = entry.dateBasis;
  feature.dateConfidence = entry.dateConfidence;
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((record) => record.sourceName !== source.sourceName),
    source,
  ];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  removeTags(feature, 'reviewed-no-defensible-date', 'south-queensferry-date-reviewed-no-date');
  addTags(feature, 'date-reviewed', 'curation-date-enriched', 'south-queensferry-deeper-nrhe-date-reviewed');
  feature.reviewNotes =
    `${feature.reviewNotes ?? ''} Deeper South Queensferry NRHE review found defensible Trove date wording after the GIS classification only gave period-unassigned evidence.`.trim();
  upgraded.push({
    id: feature.id,
    name: feature.name,
    date: entry.documentedDateText,
    range: [entry.earliestPossibleYear, entry.latestPossibleYear],
  });
}

const stillWithoutDate = pkg.features
  .filter((feature) => feature.tags.includes('reviewed-no-defensible-date'))
  .filter((feature) => feature.id.startsWith('nrhe:'))
  .map((feature) => ({
    id: feature.id,
    name: feature.name,
    classification: feature.shortDescription,
    decision:
      'Retain reviewed-without-date status: the available official classification or source wording does not publish a defensible construction, use-period or historic event date for this record.',
    sourceUrl: feature.sourceRecords.find((source) => source.sourceUrl)?.sourceUrl,
  }));

for (const record of stillWithoutDate) {
  const feature = pkg.features.find((candidate) => candidate.id === record.id);
  if (!feature) continue;
  addTags(feature, 'south-queensferry-deeper-nrhe-reviewed');
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);

await mkdir(dirname(reviewPath), { recursive: true });
await writeFile(
  reviewPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      policy:
        'Deeper NRHE review only upgrades records where official Trove/HES wording supports a defensible date. Period-unassigned, period-unknown and event records remain marked reviewed without date.',
      upgraded,
      stillWithoutDate,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(
  `Deepened South Queensferry NRHE review: ${upgraded.length} upgraded date(s), ${stillWithoutDate.length} NRHE record(s) still without defensible date.`,
);
