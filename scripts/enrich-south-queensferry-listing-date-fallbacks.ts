import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/south-queensferry.json');
const reviewPath = resolve(
  process.argv[3] ?? 'data/review/south-queensferry-listing-date-fallbacks.json',
);
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

interface ListingDateFallback {
  id: string;
  documentedDateText: string;
  earliestPossibleYear?: number;
  latestPossibleYear?: number;
  datePrecision: string;
  dateBasis: HeritageFeature['dateBasis'];
  dateConfidence: HeritageFeature['dateConfidence'];
  notes: string;
}

const fallbacks: ListingDateFallback[] = [
  {
    id: 'hes-listed-building:LB5522',
    documentedDateText: 'Probably 18th century in origin; wall-mounted panel dated 1764',
    earliestPossibleYear: 1700,
    latestPossibleYear: 1764,
    datePrecision: 'HES contextual date range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'low',
    notes:
      'HES statement says Newgardens house is probably 18th century in origin and has a wall-mounted panel dated 1764; the bee-bole wall is attached to the house, so the date is contextual.',
  },
  {
    id: 'hes-listed-building:LB40405',
    documentedDateText: 'Later 17th-century boundary wall; 18th-century gatepiers; 17th-19th-century tombstones',
    earliestPossibleYear: 1650,
    latestPossibleYear: 1899,
    datePrecision: 'multi-component HES listing-description range',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES description dates the churchyard wall to the later 17th century, the gatepiers to the 18th century and monuments to the 17th, 18th and 19th centuries.',
  },
  {
    id: 'hes-listed-building:LB40410',
    documentedDateText: 'Dated 1890 above door; Serlian window dated 1893',
    earliestPossibleYear: 1890,
    latestPossibleYear: 1893,
    datePrecision: 'inscribed HES listing-description dates',
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    notes: 'HES description records 1890 above the door and a Serlian window dated 1893.',
  },
  {
    id: 'hes-listed-building:LB47793',
    documentedDateText: 'Rennie and Stevenson, 1809-1818',
    earliestPossibleYear: 1809,
    latestPossibleYear: 1818,
    datePrecision: 'HES listing-description construction range',
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    notes: 'HES description dates Hawes Pier to Rennie and Stevenson, 1809-1818.',
  },
  {
    id: 'hes-listed-building:LB47794',
    documentedDateText: 'Provost lamp present before 1975 local-government reform',
    latestPossibleYear: 1975,
    datePrecision: 'HES statement present-by date',
    dateBasis: 'present_by',
    dateConfidence: 'low',
    notes:
      'HES statement explains that before the 1975 Local Government (Scotland) Act, Lord Provosts and Baillies were entitled to official standard lamps outside their residences. The source does not publish a precise manufacture date.',
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

const enriched: Array<{
  id: string;
  name: string;
  date: string;
  range: [number | undefined, number | undefined];
}> = [];
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
  addTags(feature, 'date-reviewed', 'hes-date-reviewed', 'south-queensferry-listing-date-reviewed');
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

console.log(`Applied ${enriched.length} South Queensferry HES listing fallback date(s).`);
