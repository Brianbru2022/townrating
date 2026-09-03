import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/kirknewton.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/kirknewton-listing-date-fallbacks.json');
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
    id: 'hes-listed-building:LB7348',
    documentedDateText: '19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1899,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates the Kirknewton House gate lodges to the 19th century.',
  },
  {
    id: 'hes-listed-building:LB7352',
    documentedDateText: 'Later 18th century',
    earliestPossibleYear: 1750,
    latestPossibleYear: 1799,
    datePrecision: 'late-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Hill House to the later 18th century.',
  },
  {
    id: 'hes-listed-building:LB7353',
    documentedDateText: '17th (?) century',
    earliestPossibleYear: 1600,
    latestPossibleYear: 1699,
    datePrecision: 'uncertain HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes: 'HES description dates Easter Newton farmhouse to the 17th century with uncertainty.',
  },
  {
    id: 'hes-listed-building:LB7357',
    documentedDateText: 'Later 18th century',
    earliestPossibleYear: 1750,
    latestPossibleYear: 1799,
    datePrecision: 'late-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Milrig to the later 18th century.',
  },
  {
    id: 'hes-listed-building:LB7362',
    documentedDateText: 'c.1690, altered c.1835 and c.1870',
    earliestPossibleYear: 1690,
    latestPossibleYear: 1870,
    datePrecision: 'multi-phase HES listing-description range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates Kirknewton House to around 1690, with major alteration phases around 1835 and 1870.',
  },
  {
    id: 'hes-listed-building:LB7381',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Sawmill House to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB7382',
    documentedDateText: '18th and 19th centuries',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1899,
    datePrecision: 'multi-century HES listing-description range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates the Main Street cottage row to the 18th and 19th centuries.',
  },
  {
    id: 'hes-listed-building:LB7383',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates 2-4 Smithy Brae to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB7384',
    documentedDateText: '17th or 18th century',
    earliestPossibleYear: 1600,
    latestPossibleYear: 1799,
    datePrecision: 'alternative-century HES listing-description range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates the Maconochies of Meadowbank burial enclosure to the 17th or 18th century.',
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
  addTags(feature, 'date-reviewed', 'hes-date-reviewed', 'kirknewton-listing-date-reviewed');
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

console.log(`Applied ${enriched.length} Kirknewton HES listing fallback date(s).`);
