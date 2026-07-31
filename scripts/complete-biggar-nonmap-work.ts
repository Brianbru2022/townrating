import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/biggar.json');
const reportPath = resolve(process.argv[3] ?? 'data/review/biggar-non-map-completion.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const reviewedAt = new Date().toISOString();

function feature(id: string): HeritageFeature {
  const found = pkg.features.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Expected ${id} in Biggar package.`);
  return found;
}
function addSource(target: HeritageFeature, source: SourceRecord): void {
  target.sourceRecords = [
    ...target.sourceRecords.filter((record) => record.sourceName !== source.sourceName),
    source,
  ];
}
function addTags(target: HeritageFeature, ...tags: string[]): void {
  target.tags = [...new Set([...target.tags, ...tags])];
}

const gasworks = feature('hes-listed-building:LB22172');
addSource(gasworks, {
  sourceName: 'Historic Environment Scotland: Biggar Gasworks history and stories',
  sourceOrganisation: 'Historic Environment Scotland',
  sourceRecordId: 'LB22172-gasworks-history',
  sourceUrl:
    'https://www.historicenvironment.scot/visit/all/biggar-gasworks-museum/history-and-stories/',
  accessedAt: reviewedAt,
  licence:
    'Cited official web source; retain the source link and do not redistribute text or imagery.',
  notes:
    'Historic Environment Scotland states that the gasworks opened in 1839 and that the original retort house dates from that year. Later replacement equipment and buildings are not represented as 1839 fabric.',
  reliability: 'official_statutory',
});
Object.assign(gasworks, {
  featureType: 'factory',
  documentedDateText: 'Gasworks opened in 1839; original retort house dates from 1839',
  earliestPossibleYear: 1839,
  latestPossibleYear: 1839,
  datePrecision: 'Documented opening year',
  dateBasis: 'documented_construction',
  dateConfidence: 'high',
  reviewed: true,
  reviewNotes:
    'Date reviewed against Historic Environment Scotland’s Biggar Gasworks history. It dates the original operation and retort house, not every later alteration.',
  updatedAt: reviewedAt,
});
addTags(gasworks, 'date-reviewed', 'biggar-priority-date-reviewed');

for (const id of ['nrhe:199159', 'nrhe:296342']) {
  const memorial = feature(id);
  addTags(memorial, 'community-memorial', 'community-source-reviewed');
  memorial.reviewed = true;
  memorial.reviewNotes =
    `${memorial.reviewNotes ?? ''} Community memorial classification reviewed against the linked official NRHE record; the broad 20th-century wording is retained rather than an unsupported unveiling date.`.trim();
  memorial.updatedAt = reviewedAt;
}

const bufferDecisions = pkg.features
  .filter((candidate) => candidate.tags.includes('town-selection-heritage-buffer'))
  .map((candidate) => {
    candidate.evidenceScope = 'related_context';
    candidate.reviewed = true;
    candidate.reviewNotes =
      `${candidate.reviewNotes ?? ''} Manual scope decision: the official point is outside the NRS Biggar locality and remains related context only; excluded from Biggar totals, heat scoring and parish-only exports.`.trim();
    candidate.updatedAt = reviewedAt;
    return { id: candidate.id, name: candidate.name, decision: 'related_context' };
  });

const pinReview = pkg.features
  .filter(
    (candidate) =>
      candidate.evidenceScope === 'related_context' &&
      candidate.geometry?.type === 'Point' &&
      (candidate.tags.includes('town-selection-heritage-buffer') ||
        candidate.tags.includes('osm-community-place')),
  )
  .map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    decision: 'coordinate retained',
  }));

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      dateEvidence: [
        {
          id: gasworks.id,
          outcome: '1839 source-backed opening/original-retort-house date published.',
        },
      ],
      communityEvidence: [
        {
          id: 'nrhe:199159',
          outcome:
            'Official NRHE war-memorial record made visible as a reviewed community memorial.',
        },
        {
          id: 'nrhe:296342',
          outcome:
            'Official NRHE Biggar High School war-memorial plaques record made visible as a reviewed community memorial.',
        },
        {
          id: 'osm-community:node-4342554235',
          outcome: 'Museum current-place details curated from the operator’s website.',
        },
        {
          id: 'osm-community:way-87262038',
          outcome: 'Gasworks visitor details curated from Historic Environment Scotland.',
        },
      ],
      bufferDecisions,
      coordinateReview: {
        outcome:
          'All flagged points are outside the NRS locality and intentionally retained as related context; no authoritative source justified a coordinate move.',
        records: pinReview,
      },
      settlementEvidence: {
        outcome: 'No settlement-age polygons published.',
        rationale:
          'The Biggar conservation-area geometry is a current planning designation and the NRHE medieval-burgh record is a representative point. Together they support interpretation but do not prove a historic settlement footprint. Publishing an age polygon from them would misrepresent the evidence.',
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  `Completed Biggar non-map review: ${bufferDecisions.length} buffer decision(s), ${pinReview.length} retained context pin(s).`,
);
