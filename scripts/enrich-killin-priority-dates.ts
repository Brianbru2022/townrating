import { readFile, writeFile } from 'node:fs/promises';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = process.argv[2] ?? 'data/projects/killin.json';
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();
const evidence: Record<
  string,
  [string, number, number, HeritageFeature['dateBasis'], HeritageFeature['dateConfidence']]
> = {
  LB8248: ['Signed and dated 1744', 1744, 1744, 'documented_construction', 'high'],
  LB8274: ['Constructed circa 1840', 1840, 1840, 'estimated_from_authoritative_source', 'medium'],
  LB8275: [
    'Bridge dated 1760, rebuilt after flood damage in 1831',
    1760,
    1760,
    'documented_construction',
    'high',
  ],
  LB8277: [
    'Probably dating largely from the late 18th century',
    1760,
    1799,
    'estimated_from_authoritative_source',
    'medium',
  ],
  LB50326: ['Unveiled 29 October 1920', 1920, 1920, 'documented_construction', 'high'],
  LB50327: [
    'Memorial erected circa 1888',
    1888,
    1888,
    'estimated_from_authoritative_source',
    'medium',
  ],
  LB50332: ['Constructed circa 1843', 1843, 1843, 'estimated_from_authoritative_source', 'medium'],
  LB8261: [
    '18th-century bridge over the River Lochay',
    1700,
    1799,
    'estimated_from_authoritative_source',
    'medium',
  ],
  LB8268: [
    'Largely built in 1806; possible earlier fabric is not dated as construction',
    1806,
    1806,
    'documented_construction',
    'high',
  ],
  LB8270: [
    'Probably dating from the later 18th century',
    1760,
    1799,
    'estimated_from_authoritative_source',
    'medium',
  ],
  LB8271: [
    'Probably dating from the later 18th century',
    1760,
    1799,
    'estimated_from_authoritative_source',
    'medium',
  ],
  LB8272: [
    'Probably dating from the later 18th century',
    1760,
    1799,
    'estimated_from_authoritative_source',
    'medium',
  ],
  LB8273: [
    'Originally dating to circa 1845',
    1845,
    1845,
    'estimated_from_authoritative_source',
    'medium',
  ],
  LB8281: ['Constructed 1885–1886', 1885, 1886, 'documented_construction', 'high'],
  LB46364: [
    'Built in 1876; extended to the east in the early 20th century',
    1876,
    1876,
    'documented_construction',
    'high',
  ],
  LB50330: ['Constructed circa 1898', 1898, 1898, 'estimated_from_authoritative_source', 'medium'],
  LB50331: [
    'Constructed in the late 19th century',
    1860,
    1899,
    'estimated_from_authoritative_source',
    'medium',
  ],
};
let updated = 0;
for (const feature of pkg.features) {
  const reference = feature.sourceRecords.find((source) =>
    /^LB\d+$/i.test(source.sourceRecordId ?? ''),
  )?.sourceRecordId;
  const item = reference ? evidence[reference] : undefined;
  if (!item) continue;
  const [documentedDateText, earliestPossibleYear, latestPossibleYear, dateBasis, dateConfidence] =
    item;
  const source: SourceRecord = {
    sourceName: 'Historic Environment Scotland listing description date review',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: reference!,
    sourceUrl: `https://portal.historicenvironment.scot/designation/${reference}`,
    accessedAt,
    licence:
      'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    notes:
      'Date transcribed conservatively from the official listing description; later alterations are not substituted for the original date.',
    reliability: 'official_statutory',
  };
  Object.assign(feature, {
    documentedDateText,
    earliestPossibleYear,
    latestPossibleYear,
    dateBasis,
    dateConfidence,
    reviewed: true,
    updatedAt: accessedAt,
  });
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((record) => record.sourceName !== source.sourceName),
    source,
  ];
  feature.tags = [...new Set([...feature.tags, 'date-reviewed', 'killin-priority-date-reviewed'])];
  updated += 1;
}
pkg.validation = validateFeatures(pkg.project, pkg.features);
if (pkg.validation.some((item) => item.severity === 'error'))
  throw new Error('Killin date enrichment produced validation errors.');
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`Applied ${updated} reviewed Killin HES date record(s).`);
