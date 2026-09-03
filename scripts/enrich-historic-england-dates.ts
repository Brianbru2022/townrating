import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';

interface OfficialTextRecord {
  featureId: string;
  listEntry: string;
  name: string;
  designationType: string;
  sourceUrl: string;
  details: string;
}

interface OfficialTextAudit {
  accessedAt: string;
  source: string;
  records: OfficialTextRecord[];
  errors: Array<{ featureId: string; reason: string }>;
}

const projectPath = resolve(process.argv[2] ?? 'data/projects/peterborough.json');
const auditDate = new Date().toISOString().slice(0, 10);
const sourcePath = resolve(
  process.argv[3] ?? `data/review/peterborough-nhle-official-text-${auditDate}.json`,
);
const auditPath = resolve(
  process.argv[4] ?? `data/review/peterborough-nhle-date-enrichment-${auditDate}.json`,
);
const reviewedAt = `${auditDate}T00:00:00Z`;

const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const officialText = JSON.parse(await readFile(sourcePath, 'utf8')) as OfficialTextAudit;
if (officialText.errors.length) {
  console.warn(
    `Official text audit contains ${officialText.errors.length} unavailable record(s); they will remain explicitly unresolved.`,
  );
}

const recordsByFeatureId = new Map(
  officialText.records.map((record) => [record.featureId, record]),
);
const enriched: Array<{
  featureId: string;
  listEntry: string;
  name: string;
  evidenceText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  datePrecision: string;
  dateBasis: string;
  dateConfidence: string;
  sourceUrl: string;
}> = [];
const unresolved: Array<{
  featureId: string;
  listEntry?: string;
  name: string;
  designationType?: string;
  sourceUrl?: string;
  reason: string;
}> = [];

function alreadyDated(feature: HeritageFeature): boolean {
  return (
    feature.earliestPossibleYear !== undefined || feature.latestPossibleYear !== undefined
  );
}

const enrichmentReviewNote =
  `Earliest dated fabric or historic component normalised from the official Historic England list-entry text on ${auditDate}; later restoration and administrative listing dates were excluded.`;
const unresolvedReviewNote =
  `Official list-entry text checked on ${auditDate}; no defensible historic date expression was found.`;

for (const feature of pkg.features.filter((item) => item.tags.includes('nhle'))) {
  const previouslyEnriched = feature.tags.includes('historic-england-date-enriched');
  if (alreadyDated(feature) && !previouslyEnriched) continue;
  if (previouslyEnriched) {
    delete feature.documentedDateText;
    delete feature.earliestPossibleYear;
    delete feature.latestPossibleYear;
    delete feature.datePrecision;
    feature.dateBasis = 'unknown';
    feature.dateConfidence = 'unknown';
    feature.sourceRecords = feature.sourceRecords.filter(
      (item) => item.sourceName !== 'Historic England official list entry date evidence',
    );
    feature.tags = feature.tags.filter((tag) => tag !== 'historic-england-date-enriched');
    feature.reviewNotes = feature.reviewNotes
      ?.replace(enrichmentReviewNote, '')
      .replace(unresolvedReviewNote, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const record = recordsByFeatureId.get(feature.id);
  if (!record) {
    unresolved.push({
      featureId: feature.id,
      name: feature.name,
      designationType: feature.designationType,
      reason: 'No captured official list-entry text.',
    });
    continue;
  }

  const extracted = extractHistoricEnglandDate(
    feature.designationType === 'scheduled_monument'
      ? `${record.name}. ${record.details}`
      : record.details,
  );
  if (!extracted) {
    unresolved.push({
      featureId: feature.id,
      listEntry: record.listEntry,
      name: feature.name,
      designationType: feature.designationType,
      sourceUrl: record.sourceUrl,
      reason: 'No defensible construction year, century or historic period found in the official text.',
    });
    feature.reviewNotes = `${feature.reviewNotes ?? ''} ${unresolvedReviewNote}`.trim();
    feature.updatedAt = reviewedAt;
    continue;
  }

  const source: SourceRecord = {
    sourceName: 'Historic England official list entry date evidence',
    sourceOrganisation: 'Historic England',
    sourceRecordId: record.listEntry,
    sourceUrl: record.sourceUrl,
    accessedAt: reviewedAt,
    reliability: 'official_statutory',
    licence: 'Open Government Licence v3.0; contains Historic England data.',
    notes: `Earliest dated fabric or historic component normalised from the official list-entry wording: ${extracted.evidenceText}`,
  };
  feature.documentedDateText = extracted.evidenceText;
  feature.earliestPossibleYear = extracted.earliestPossibleYear;
  feature.latestPossibleYear = extracted.latestPossibleYear;
  feature.datePrecision = extracted.datePrecision;
  feature.dateBasis = extracted.dateBasis;
  feature.dateConfidence = extracted.dateConfidence;
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((item) => item.sourceName !== source.sourceName),
    source,
  ];
  feature.tags = [...new Set([...feature.tags, 'historic-england-date-enriched'])];
  feature.reviewed = true;
  feature.reviewNotes = `${feature.reviewNotes ?? ''} ${enrichmentReviewNote}`.trim();
  feature.updatedAt = reviewedAt;
  enriched.push({
    featureId: feature.id,
    listEntry: record.listEntry,
    name: feature.name,
    ...extracted,
    sourceUrl: record.sourceUrl,
  });
}

const nhleCount = pkg.features.filter((feature) => feature.tags.includes('nhle')).length;
const datedNhleCount = pkg.features.filter(
  (feature) => feature.tags.includes('nhle') && alreadyDated(feature),
).length;
const baseResearchNotes = (pkg.project.researchNotes ?? '')
  .replace(
    /\s*Historic England official list-entry date enrichment completed \d{4}-\d{2}-\d{2}: \d+ of \d+ statutory records now carry defensible date evidence; unresolved entries were individually checked and retained as unknown\./g,
    '',
  )
  .trim();
pkg.project.researchNotes = `${baseResearchNotes} Historic England official list-entry date enrichment completed ${auditDate}: ${datedNhleCount} of ${nhleCount} statutory records now carry defensible date evidence; unresolved entries were individually checked and retained as unknown.`.trim();

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(
  auditPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      sourcePath,
      methodology:
        'Normalised the earliest dated fabric or historic component from captured official Historic England list-entry text. Administrative listing dates and restoration-only dates were excluded.',
      counts: {
        nhleRecords: nhleCount,
        enriched: enriched.length,
        datedAfterEnrichment: datedNhleCount,
        unresolved: unresolved.length,
      },
      enriched,
      unresolved,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  `Enriched ${enriched.length} Historic England record(s); ${unresolved.length} remain unresolved.`,
);
