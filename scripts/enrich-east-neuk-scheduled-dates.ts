import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = new Date().toISOString();

type MutableFeature = HeritageFeature & Record<string, unknown>;
type MutablePackage = ProjectPackage & { features: MutableFeature[] };

const dates = [
  {
    stem: 'pitcorthie-kilrenny',
    reference: 'SM10439',
    evidenceText: 'About 2000–1500 BC',
    earliestPossibleYear: -2000,
    latestPossibleYear: -1500,
    datePrecision: 'archaeological date range',
    dateConfidence: 'high' as const,
    sourceName: 'West Pitcorthie standing stone designation',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/SM10439',
    notes: 'The HES designation describes the monument as a prehistoric standing stone and states that monuments of this type normally date to about 2000–1500 BC. The 2002 scheduling date was excluded.',
  },
  {
    stem: 'ardross-fife',
    reference: 'SM841',
    evidenceText: '15th-century tower and possible 16th-century adjoining building',
    earliestPossibleYear: 1400,
    latestPossibleYear: 1599,
    datePrecision: 'multi-period documented range',
    dateConfidence: 'high' as const,
    sourceName: 'Ardross Castle designation',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/SM841',
    notes: 'The official HES description dates the rectangular tower probably to the 15th century and the larger south-west building possibly to the 16th century. The 1937 scheduling and 2014 amendment dates were excluded.',
  },
  {
    stem: 'abercrombie-fife',
    reference: 'SM818',
    evidenceText: 'Late medieval church; substantially rebuilt in the 16th century',
    earliestPossibleYear: 1250,
    latestPossibleYear: 1599,
    datePrecision: 'multi-period documented range',
    dateConfidence: 'high' as const,
    sourceName: 'Abercrombie Church HES description',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/LB15552',
    notes: 'The linked HES building description identifies a late-medieval church with substantial 16th-century rebuilding and 16th-century memorials. The 1924 scheduling, 1984 listing and 2016 removal dates were excluded.',
  },
];

for (const item of dates) {
  const path = resolve(`data/projects/${item.stem}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as MutablePackage;
  const feature = pkg.features.find((candidate) => candidate.id === `hes-scheduled-monument:${item.reference}`);
  if (!feature) throw new Error(`${item.stem}: missing ${item.reference}`);

  const source: SourceRecord = {
    sourceName: item.sourceName,
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: item.reference,
    sourceUrl: item.sourceUrl,
    accessedAt: reviewedAt,
    reliability: 'official_statutory',
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    quotedDateText: item.evidenceText,
    notes: item.notes,
  };
  Object.assign(feature, {
    documentedDateText: item.evidenceText,
    earliestPossibleYear: item.earliestPossibleYear,
    latestPossibleYear: item.latestPossibleYear,
    datePrecision: item.datePrecision,
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: item.dateConfidence,
    sourceRecords: [
      ...feature.sourceRecords.filter((candidate) => candidate.sourceRecordId !== item.reference || candidate.quotedDateText),
      source,
    ],
    tags: [...new Set([
      ...feature.tags.filter((tag) => tag !== 'map-hidden'),
      'hes-scheduled-monument',
      'hes-scheduled-date-reviewed',
      'date-reviewed',
      'heritage-record-retained',
    ])],
    reviewed: true,
    updatedAt: reviewedAt,
  });

  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(`${item.stem}: ${errors.map((issue) => issue.message).join('; ')}`);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(`${item.stem}: dated ${item.reference} as ${item.evidenceText}.`);
}
