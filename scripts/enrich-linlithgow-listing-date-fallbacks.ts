import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/linlithgow.json');
const reviewPath = resolve(
  process.argv[3] ?? 'data/review/linlithgow-listing-date-fallbacks.json',
);
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
    id: 'hes-listed-building:LB7475',
    documentedDateText: 'Farm steading complex dating from the late 18th to early 19th century',
    earliestPossibleYear: 1760,
    latestPossibleYear: 1839,
    datePrecision: 'broad HES listing-description period',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates the steading complex to the late 18th to early 19th century; the later farmhouse is a separate later-19th-century phase.',
  },
  {
    id: 'hes-listed-building:LB15326',
    documentedDateText: 'Opened 1842',
    earliestPossibleYear: 1842,
    latestPossibleYear: 1842,
    datePrecision: 'opening year',
    dateBasis: 'documented_construction',
    dateConfidence: 'high',
    notes: 'HES description records that the Avon Viaduct opened in 1842.',
  },
  {
    id: 'hes-listed-building:LB37378',
    documentedDateText: 'Coach house shown by the 1st edition Ordnance Survey map, 1856',
    earliestPossibleYear: 1856,
    latestPossibleYear: 1856,
    datePrecision: 'first mapped year',
    dateBasis: 'present_by',
    dateConfidence: 'medium',
    notes:
      'HES references the 1st edition OS map of 1856; conversion in 1978 was not used as the construction date.',
  },
  {
    id: 'hes-listed-building:LB37458',
    documentedDateText: 'Former schoolhouse dated by HES description to 1863',
    earliestPossibleYear: 1863,
    latestPossibleYear: 1863,
    datePrecision: 'HES listing-description year',
    dateBasis: 'documented_construction',
    dateConfidence: 'medium',
    notes:
      'HES opening description attributes the former schoolhouse to Brown and Wardrop and gives 1863; parser fallback used because the typography was not normalised automatically.',
  },
  {
    id: 'hes-listed-building:LB37471',
    documentedDateText: 'Mid 19th century',
    earliestPossibleYear: 1830,
    latestPossibleYear: 1869,
    datePrecision: 'mid-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES opening description dates the Linlithgow Palace lodge to the mid 19th century.',
  },
  {
    id: 'hes-listed-building:LB37479',
    documentedDateText: 'Circa 1820; probably built just after 1820',
    earliestPossibleYear: 1820,
    latestPossibleYear: 1832,
    datePrecision: 'circa date and present-by plan evidence',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description gives circa 1820 and states the building is clearly shown on the 1832 Reform Act plan.',
  },
  {
    id: 'hes-listed-building:LB37506',
    documentedDateText: 'No. 12 early 19th century; No. 14 earlier 19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1839,
    datePrecision: 'early 19th-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description gives early/earlier 19th-century periods for the two houses.',
  },
  {
    id: 'hes-listed-building:LB50804',
    documentedDateText: 'Dated 1886',
    earliestPossibleYear: 1886,
    latestPossibleYear: 1886,
    datePrecision: 'dated building year',
    dateBasis: 'documented_construction',
    dateConfidence: 'high',
    notes: 'HES opening description dates Glenavon House to 1886.',
  },
];

const reviewedWithoutDate = [
  'hes-listed-building:LB37467',
  'hes-listed-building:LB37486',
] as const;

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
  addTags(feature, 'date-reviewed', 'hes-date-reviewed', 'linlithgow-listing-date-reviewed');
  enriched.push({
    id: feature.id,
    name: feature.name,
    date: fallback.documentedDateText,
    range: [fallback.earliestPossibleYear, fallback.latestPossibleYear],
  });
}

const noDate: Array<{ id: string; name: string; reason: string }> = [];
for (const id of reviewedWithoutDate) {
  const feature = pkg.features.find((candidate) => candidate.id === id);
  if (!feature) throw new Error(`Missing no-date review target ${id}.`);
  feature.reviewed = true;
  feature.updatedAt = accessedAt;
  feature.reviewNotes =
    `${feature.reviewNotes ?? ''} HES listing page reviewed; no defensible construction date or historic-period range is published in the description.`.trim();
  addTags(feature, 'date-reviewed', 'reviewed-no-defensible-date', 'linlithgow-date-reviewed-no-date');
  noDate.push({
    id: feature.id,
    name: feature.name,
    reason: 'Official HES listing description does not publish a defensible construction date.',
  });
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
      reviewedAt: accessedAt,
      enriched,
      reviewedWithoutDate: noDate,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  `Applied ${enriched.length} Linlithgow HES listing fallback date(s); ${noDate.length} reviewed without date.`,
);
