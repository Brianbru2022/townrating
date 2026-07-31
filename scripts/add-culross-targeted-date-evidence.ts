import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/culross.json');
const reportPath = resolve(process.argv[3] ?? 'data/review/culross-targeted-date-evidence.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

interface TargetedEvidence {
  featureId: string;
  documentedDateText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  dateBasis: HeritageFeature['dateBasis'];
  dateConfidence: HeritageFeature['dateConfidence'];
  source: SourceRecord;
  note: string;
}

const evidence: TargetedEvidence[] = [
  {
    featureId: 'nrhe:48027',
    documentedDateText: 'Royal burgh status granted 1588',
    earliestPossibleYear: 1588,
    latestPossibleYear: 1588,
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    source: {
      sourceName: 'Historic Environment Scotland NRHE / trove.scot archaeology notes',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '48027',
      sourceUrl: 'https://www.trove.scot/place/48027',
      accessedAt,
      licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
      reliability: 'official_non_statutory',
      quotedDateText: 'Culross, made into a Royal Burgh in 1588.',
      notes:
        'The date documents burgh status, not the construction date of every building or gateway represented by this NRHE point.',
    },
    note: 'Targeted source review: date documents the Royal Burgh event for this NRHE record, not a construction date for individual townscape components.',
  },
  {
    featureId: 'nrhe:48064',
    documentedDateText: 'Construction of the Moat coal shaft began in 1590',
    earliestPossibleYear: 1590,
    latestPossibleYear: 1590,
    dateBasis: 'documented_construction',
    dateConfidence: 'high',
    source: {
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM13797',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM13797',
      accessedAt,
      licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
      reliability: 'official_statutory',
      quotedDateText: 'Construction of the moat began in 1590.',
      notes:
        'Spatially checked against scheduled monument SM13797: the NRHE point falls within the designation polygon and names the same Moat coal shaft.',
    },
    note: 'Targeted source review: direct statutory designation evidence was matched by name and spatial containment; no new feature was created.',
  },
];

const applied: string[] = [];
const skipped: Array<{ featureId: string; reason: string }> = [];

for (const item of evidence) {
  const feature = pkg.features.find((candidate) => candidate.id === item.featureId);
  if (!feature) {
    skipped.push({ featureId: item.featureId, reason: 'Feature not found.' });
    continue;
  }
  if (feature.earliestPossibleYear !== undefined || feature.latestPossibleYear !== undefined) {
    skipped.push({ featureId: item.featureId, reason: 'Feature already has date evidence.' });
    continue;
  }
  Object.assign(feature, {
    documentedDateText: item.documentedDateText,
    earliestPossibleYear: item.earliestPossibleYear,
    latestPossibleYear: item.latestPossibleYear,
    dateBasis: item.dateBasis,
    dateConfidence: item.dateConfidence,
    sourceRecords: [
      ...feature.sourceRecords.filter(
        (source) => source.sourceRecordId !== item.source.sourceRecordId,
      ),
      item.source,
    ],
    tags: [...new Set([...feature.tags, 'targeted-authoritative-date-evidence'])],
    updatedAt: accessedAt,
    reviewNotes: `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}${item.note}`,
  });
  applied.push(feature.id);
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify({ projectId: pkg.project.id, generatedAt: accessedAt, applied, skipped, evidence }, null, 2)}\n`,
  'utf8',
);
console.log(
  `Applied ${applied.length} targeted Culross date evidence record(s); skipped ${skipped.length}.`,
);
