import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/broxburn-and-uphall.json');
const reviewPath = resolve(
  process.argv[3] ?? 'data/review/broxburn-and-uphall-listing-date-fallbacks.json',
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
    id: 'hes-listed-building:LB7435',
    documentedDateText: '18th (?) century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'uncertain HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes:
      'HES description dates Kilpunt Dovecot to the 18th century with uncertainty and notes it was moved to the present site around 1900.',
  },
  {
    id: 'hes-listed-building:LB14226',
    documentedDateText: '17th century',
    earliestPossibleYear: 1600,
    latestPossibleYear: 1699,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Houstoun Dovecot to the 17th century.',
  },
  {
    id: 'hes-listed-building:LB14230',
    documentedDateText: 'c.1820; Hugh Baird, engineer',
    earliestPossibleYear: 1815,
    latestPossibleYear: 1825,
    datePrecision: 'circa HES listing-description date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Union Canal Bridge 24 to circa 1820 and names Hugh Baird as engineer.',
  },
  {
    id: 'hes-listed-building:LB14231',
    documentedDateText: 'c.1820; Hugh Baird, engineer',
    earliestPossibleYear: 1815,
    latestPossibleYear: 1825,
    datePrecision: 'circa HES listing-description date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Union Canal Bridge 25 to circa 1820 and names Hugh Baird as engineer.',
  },
  {
    id: 'hes-listed-building:LB14233',
    documentedDateText: 'c.1820; Hugh Baird, engineer',
    earliestPossibleYear: 1815,
    latestPossibleYear: 1825,
    datePrecision: 'circa HES listing-description date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Union Canal Bridge 28 to circa 1820 and names Hugh Baird as engineer.',
  },
  {
    id: 'hes-listed-building:LB14234',
    documentedDateText: 'c.1820; Hugh Baird, engineer',
    earliestPossibleYear: 1815,
    latestPossibleYear: 1825,
    datePrecision: 'circa HES listing-description date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates Union Canal Bridge 29 to circa 1820 and names Hugh Baird as engineer.',
  },
  {
    id: 'hes-listed-building:LB14235',
    documentedDateText: 'Later 12th century, with later 15th, 1644 and 1878 phases',
    earliestPossibleYear: 1170,
    latestPossibleYear: 1199,
    datePrecision: 'late 12th-century earliest fabric',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates the church core to the later 12th century and lists later phases; the earliest fabric is used for the timeline.',
  },
  {
    id: 'hes-listed-building:LB14236',
    documentedDateText: 'c.1695',
    earliestPossibleYear: 1690,
    latestPossibleYear: 1700,
    datePrecision: 'circa HES listing-description date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates the Old Manse, originally Uphall House, to circa 1695; later additions are not substituted for the original phase.',
  },
  {
    id: 'hes-listed-building:LB14237',
    documentedDateText: 'Nos 27 and 29: 18th century; No 25: 19th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1899,
    datePrecision: 'multi-building HES listing-description century range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates the listed group with separate 18th- and 19th-century components, so the combined range is retained.',
  },
  {
    id: 'hes-listed-building:LB14241',
    documentedDateText: '18th century',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1799,
    datePrecision: 'HES listing-description century',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES description dates the Oatridge Hotel to the 18th century.',
  },
  {
    id: 'hes-listed-building:LB14242',
    documentedDateText: 'Built c.1700(?), largely reconstructed c.1900(?)',
    earliestPossibleYear: 1690,
    latestPossibleYear: 1710,
    datePrecision: 'uncertain circa HES listing-description core date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes:
      'HES description gives an uncertain circa 1700 original build and an uncertain circa 1900 reconstruction; the original core date is used for the timeline.',
  },
  {
    id: 'hes-listed-building:LB19678',
    documentedDateText: 'Built c.1590, remodelled 1770-1',
    earliestPossibleYear: 1585,
    latestPossibleYear: 1595,
    datePrecision: 'circa HES listing-description construction date',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates Kirkhill House to circa 1590 and separately records 1770-1 remodelling; the original build is used for the timeline.',
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
  addTags(feature, 'date-reviewed', 'hes-date-reviewed', 'broxburn-uphall-listing-date-reviewed');
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
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt: accessedAt,
      enriched,
      reviewedWithoutDate: [],
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(`Applied ${enriched.length} Broxburn and Uphall HES listing fallback date(s).`);
