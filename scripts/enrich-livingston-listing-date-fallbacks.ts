import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/livingston.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/livingston-listing-date-fallbacks.json');
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
    id: 'hes-listed-building:LB7405',
    documentedDateText: 'Probably 19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1899,
    datePrecision: 'probable HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes: 'HES description dates the Livingston Village dwellings as probably 19th century.',
  },
  {
    id: 'hes-listed-building:LB7406',
    documentedDateText: 'Probably 19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1899,
    datePrecision: 'probable HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes: 'HES description dates the Main Street cottage as probably 19th century.',
  },
  {
    id: 'hes-listed-building:LB7407',
    documentedDateText: 'Probably 19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1899,
    datePrecision: 'probable HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes: 'HES description dates Bezu, 11 Main Street, as probably 19th century.',
  },
  {
    id: 'hes-listed-building:LB7417',
    documentedDateText: '18th (?) century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'uncertain HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes: 'HES description dates Moss Houses as 18th century with uncertainty.',
  },
  {
    id: 'hes-listed-building:LB7418',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Newyearfield farmhouse and steading to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB7421',
    documentedDateText: '18th and 19th centuries; corn mill built c.1770',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1899,
    datePrecision: 'multi-component HES listing-description century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates the group to the 18th and 19th centuries and states the main corn mill was built circa 1770.',
  },
  {
    id: 'hes-listed-building:LB7422',
    documentedDateText: 'Probably earlier 19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1839,
    datePrecision: 'probable early-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes: 'HES description dates the Livingston Village cottage row as probably earlier 19th century.',
  },
  {
    id: 'hes-listed-building:LB14134',
    documentedDateText: 'c.1800',
    earliestPossibleYear: 1795,
    latestPossibleYear: 1805,
    datePrecision: 'circa HES listing-description date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Murieston House to circa 1800.',
  },
  {
    id: 'hes-listed-building:LB14135',
    documentedDateText: 'Later 18th century',
    earliestPossibleYear: 1760,
    latestPossibleYear: 1799,
    datePrecision: 'late-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Skivo Farm to the later 18th century.',
  },
  {
    id: 'hes-listed-building:LB14144',
    documentedDateText: 'c.1530-c.1550, rebuilt from 1541',
    earliestPossibleYear: 1530,
    latestPossibleYear: 1550,
    datePrecision: 'circa HES listing-description date range',
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    notes:
      'HES description dates Mid Calder Parish Church to circa 1530-circa 1550 and the statement records rebuilding from 1541.',
  },
  {
    id: 'hes-listed-building:LB14146',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates 68 Main Street, Mid Calder, to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB14147',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates 29 Bank Street, Mid Calder, to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB14148',
    documentedDateText: 'Late 18th century',
    earliestPossibleYear: 1760,
    latestPossibleYear: 1799,
    datePrecision: 'late-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates 35 Bank Street, Mid Calder, to the late 18th century.',
  },
  {
    id: 'hes-listed-building:LB14149',
    documentedDateText: 'Later 18th century',
    earliestPossibleYear: 1760,
    latestPossibleYear: 1799,
    datePrecision: 'late-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates 41, 43 and 47 Bank Street, Mid Calder, to the later 18th century.',
  },
  {
    id: 'hes-listed-building:LB14150',
    documentedDateText: 'Later 18th century',
    earliestPossibleYear: 1760,
    latestPossibleYear: 1799,
    datePrecision: 'late-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates the Torphichen Arms Hotel to the later 18th century.',
  },
  {
    id: 'hes-listed-building:LB14152',
    documentedDateText: 'Mid (?) 19th century',
    earliestPossibleYear: 1830,
    latestPossibleYear: 1869,
    datePrecision: 'uncertain mid-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes: 'HES description dates the Calder Estate gate lodge and gateway to the mid 19th century with uncertainty.',
  },
  {
    id: 'hes-listed-building:LB14153',
    documentedDateText: '16th-17th century mansion incorporating walls of earlier fortalice',
    earliestPossibleYear: 1500,
    latestPossibleYear: 1699,
    datePrecision: 'broad HES listing-description century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates Calder House as a 16th-17th century mansion and notes later additions circa 1780 and in 1880.',
  },
  {
    id: 'hes-listed-building:LB14161',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Livingston Bridge to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB14162',
    documentedDateText: 'Later 18th century',
    earliestPossibleYear: 1760,
    latestPossibleYear: 1799,
    datePrecision: 'late-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Howden House to the later 18th century.',
  },
  {
    id: 'hes-listed-building:LB14223',
    documentedDateText: '19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1899,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Limefield Bridge to the 19th century.',
  },
  {
    id: 'hes-listed-building:LB18442',
    documentedDateText: 'c.1760',
    earliestPossibleYear: 1755,
    latestPossibleYear: 1765,
    datePrecision: 'circa HES listing-description date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Westfield House to circa 1760.',
  },
  {
    id: 'hes-listed-building:LB18443',
    documentedDateText: '17th-18th centuries, main block dated 1626',
    earliestPossibleYear: 1626,
    latestPossibleYear: 1799,
    datePrecision: 'dated main block and broad later phase range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description gives a 17th-18th century range and dates the main block to 1626; the range includes later 18th-century rear wing and offices.',
  },
  {
    id: 'hes-listed-building:LB18444',
    documentedDateText: 'Later 17th century',
    earliestPossibleYear: 1660,
    latestPossibleYear: 1699,
    datePrecision: 'late-century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Alderston Park Dovecot to the later 17th century.',
  },
  {
    id: 'hes-listed-building:LB51912',
    documentedDateText: 'Begun 1898, completed 1906',
    earliestPossibleYear: 1898,
    latestPossibleYear: 1906,
    datePrecision: 'documented construction range',
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    notes: 'HES description dates the Bangour dormitory block as begun in 1898 and completed in 1906.',
  },
  {
    id: 'hes-listed-building:LB52626',
    documentedDateText: 'Completed 1980 and opened 1981',
    earliestPossibleYear: 1980,
    latestPossibleYear: 1981,
    datePrecision: 'documented completion and opening range',
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    notes: 'HES description dates Livingston Skatepark as completed in 1980 and opened in 1981.',
  },
];

const reviewedWithoutDate = ['hes-listed-building:LB7408'] as const;

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
  addTags(feature, 'date-reviewed', 'hes-date-reviewed', 'livingston-listing-date-reviewed');
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
  addTags(feature, 'date-reviewed', 'reviewed-no-defensible-date', 'livingston-date-reviewed-no-date');
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
  `Applied ${enriched.length} Livingston HES listing fallback date(s); ${noDate.length} reviewed without date.`,
);
