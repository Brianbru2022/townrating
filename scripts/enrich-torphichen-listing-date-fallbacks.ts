import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/torphichen.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/torphichen-listing-date-fallbacks.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

interface ListingDateFallback {
  id: string;
  documentedDateText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  datePrecision: string;
  dateBasis: HeritageFeature['dateBasis'];
  dateConfidence: HeritageFeature['dateConfidence'];
  notes: string;
}

const fallbacks: ListingDateFallback[] = [
  {
    id: 'hes-listed-building:LB14536',
    documentedDateText: 'Earlier 19th (?) century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1839,
    datePrecision: 'uncertain early-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes: 'HES description dates the north-side cottages in The Square as earlier 19th century with uncertainty.',
  },
  {
    id: 'hes-listed-building:LB14539',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Hill House to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB14549',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates the Wallhouse dovecot to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB14550',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates the Broomparkwell cottages to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB18189',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Ivy Cottage to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB19704',
    documentedDateText: 'Earlier 19th century central block; 1855 end wings and rear tower',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1855,
    datePrecision: 'multi-phase HES listing-description range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates the Wallhouse central block to the earlier 19th century and the end wings and rear tower to 1855.',
  },
];

function sourceFor(feature: HeritageFeature, notes: string): SourceRecord {
  const reference = feature.id.split(':').at(-1)!;
  return {
    sourceName: 'Historic Environment Scotland listing description fallback review',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: reference,
    sourceUrl: `https://portal.historicenvironment.scot/designation/${reference}`,
    accessedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    reliability: 'official_statutory',
    notes,
  };
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

const enriched: Array<{ id: string; name: string; date: string; range: [number, number] }> = [];
for (const fallback of fallbacks) {
  const feature = pkg.features.find((candidate) => candidate.id === fallback.id);
  if (!feature) throw new Error(`Missing fallback target ${fallback.id}.`);
  const source = sourceFor(feature, fallback.notes);
  Object.assign(feature, {
    documentedDateText: fallback.documentedDateText,
    earliestPossibleYear: fallback.earliestPossibleYear,
    latestPossibleYear: fallback.latestPossibleYear,
    datePrecision: fallback.datePrecision,
    dateBasis: fallback.dateBasis,
    dateConfidence: fallback.dateConfidence,
    sourceRecords: [
      ...feature.sourceRecords.filter((record) => record.sourceName !== source.sourceName),
      source,
    ],
    reviewed: true,
    updatedAt: accessedAt,
    reviewNotes:
      `${feature.reviewNotes ?? ''} Date reviewed manually from the official HES listing description after automatic parsing could not normalise the wording.`.trim(),
  });
  addTags(feature, 'date-reviewed', 'hes-date-reviewed', 'torphichen-listing-date-reviewed');
  enriched.push({
    id: feature.id,
    name: feature.name,
    date: fallback.documentedDateText,
    range: [fallback.earliestPossibleYear, fallback.latestPossibleYear],
  });
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);

await mkdir(dirname(reviewPath), { recursive: true });
await writeFile(
  reviewPath,
  `${JSON.stringify({ projectId: pkg.project.id, reviewedAt: accessedAt, enriched }, null, 2)}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(`Applied ${enriched.length} Torphichen HES listing fallback date(s).`);
