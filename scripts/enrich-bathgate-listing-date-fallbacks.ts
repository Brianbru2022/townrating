import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/bathgate.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/bathgate-listing-date-fallbacks.json');
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
    id: 'hes-listed-building:LB22126',
    documentedDateText:
      'Early/mid 19th-century cottage appearance with 18th-century walling and mainly 19th-century outbuildings',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1869,
    datePrecision: 'broad HES listing-description period',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description says the cottage is early/mid 19th century in appearance but contains 18th-century walling; outbuildings are mainly 19th century with an 18th-century byre.',
  },
  {
    id: 'hes-listed-building:LB22127',
    documentedDateText:
      'Cottage row with earliest phase probably late 18th century and latest probably built by mid 19th century',
    earliestPossibleYear: 1760,
    latestPossibleYear: 1869,
    datePrecision: 'broad HES listing-description period',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description identifies three principal building phases from probably late 18th century to probably mid 19th century.',
  },
  {
    id: 'hes-listed-building:LB52605',
    documentedDateText: 'Built between 1963 and 1965',
    earliestPossibleYear: 1963,
    latestPossibleYear: 1965,
    datePrecision: 'documented construction range',
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    notes:
      'HES description dates Boghall Parish Church to 1963-65 and attributes the design to Wheeler & Sproson.',
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
    tags: [...new Set([...feature.tags, 'date-reviewed', 'hes-date-reviewed', 'bathgate-listing-date-reviewed'])],
    reviewed: true,
    updatedAt: accessedAt,
    reviewNotes:
      `${feature.reviewNotes ?? ''} Date reviewed manually from the official HES listing description after automatic parsing could not normalise the wording.`.trim(),
  });
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
console.log(`Applied ${enriched.length} Bathgate HES listing fallback date(s).`);
