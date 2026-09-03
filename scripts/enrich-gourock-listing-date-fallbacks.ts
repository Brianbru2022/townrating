import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/gourock.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

interface ReviewedDate {
  reference: string;
  documentedDateText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  dateBasis: HeritageFeature['dateBasis'];
  dateConfidence: HeritageFeature['dateConfidence'];
  notes: string;
}

const dates: ReviewedDate[] = [
  {
    reference: 'LB12478',
    documentedDateText: 'Probably 14th-15th century with early 16th-century south-east block',
    earliestPossibleYear: 1300,
    latestPossibleYear: 1539,
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes:
      'HES describes the north-west block as probably XIV-XV century and the south-east block as early XVI. The range dates the listed ensemble, not one construction event.',
  },
  {
    reference: 'LB12477',
    documentedDateText: 'Early 19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1839,
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES describes the building as early XIX century.',
  },
  {
    reference: 'LB13820',
    documentedDateText: '1796-1797',
    earliestPossibleYear: 1796,
    latestPossibleYear: 1797,
    dateBasis: 'documented_construction',
    dateConfidence: 'high',
    notes: 'HES describes Cloch Lighthouse as 1796-7 by Robert Stevenson.',
  },
  {
    reference: 'LB33977',
    documentedDateText: 'Earlier 19th century, likely built in or around the 1830s',
    earliestPossibleYear: 1830,
    latestPossibleYear: 1839,
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES describes the villa as earlier 19th century and likely built in or around the 1830s.',
  },
  {
    reference: 'LB34105',
    documentedDateText: 'Early 19th century',
    earliestPossibleYear: 1800,
    latestPossibleYear: 1839,
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    notes: 'HES describes the old toll house as early 19th century.',
  },
  {
    reference: 'LB34024',
    documentedDateText: 'Municipal buildings dated 1923; adjacent building dated 1924',
    earliestPossibleYear: 1923,
    latestPossibleYear: 1924,
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    notes:
      'HES describes the former municipal buildings as dated 1923 and the adjacent building as dated 1924. The range dates the listed complex.',
  },
];

let enriched = 0;
for (const date of dates) {
  const feature = pkg.features.find((item) => item.id === `hes-listed-building:${date.reference}`);
  if (!feature) throw new Error(`No Gourock listed-building feature found for ${date.reference}.`);
  const source: SourceRecord = {
    sourceName: 'Historic Environment Scotland listing description date fallback review',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: date.reference,
    sourceUrl: `https://portal.historicenvironment.scot/designation/${date.reference}`,
    accessedAt,
    licence:
      'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    notes: date.notes,
    reliability: 'official_statutory',
  };
  Object.assign(feature, {
    documentedDateText: date.documentedDateText,
    earliestPossibleYear: date.earliestPossibleYear,
    latestPossibleYear: date.latestPossibleYear,
    dateBasis: date.dateBasis,
    dateConfidence: date.dateConfidence,
    sourceRecords: [
      ...feature.sourceRecords.filter((record) => record.sourceName !== source.sourceName),
      source,
    ],
    tags: [...new Set([...feature.tags, 'hes-date-reviewed', 'date-reviewed'])],
    reviewed: true,
    updatedAt: accessedAt,
    reviewNotes:
      `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}Date reviewed from the HES listing description after the automatic parser could not normalise the wording.`.trim(),
  });
  enriched += 1;
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`Applied Gourock HES fallback dates to ${enriched} listed-building record(s).`);
