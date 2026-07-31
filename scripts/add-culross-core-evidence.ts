import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  HeritageFeature,
  ProjectPackage,
  SettlementAgePolygon,
  SourceRecord,
} from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/culross.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const accessedAt = new Date().toISOString();

interface Evidence {
  id: string;
  text: string;
  earliest: number;
  latest: number;
  basis: HeritageFeature['dateBasis'];
  confidence: HeritageFeature['dateConfidence'];
  sourceUrl: string;
  notes: string;
}

const evidence: Evidence[] = [
  {
    id: 'hes-listed-building:LB23964',
    text: 'Built 1608 (later developments and remodelling recorded separately)',
    earliest: 1608,
    latest: 1608,
    basis: 'documented_construction',
    confidence: 'high',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/LB23964',
    notes:
      'The HES listing dates Culross Abbey House to 1608; later 1670, 1830 and 1952 changes are not substituted for the original construction date.',
  },
  {
    id: 'hes-listed-building:LB23994',
    text: 'Built 1626 (later 1783 and 1957–1959 alterations recorded separately)',
    earliest: 1626,
    latest: 1626,
    basis: 'documented_construction',
    confidence: 'high',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/LB23994',
    notes:
      'The HES listing states that the Culross Town House was built as a council chamber in 1626 to replace an earlier building.',
  },
  {
    id: 'hes-scheduled-monument:SM13334',
    text: 'Cistercian monastery founded in 1217',
    earliest: 1217,
    latest: 1217,
    basis: 'documented_construction',
    confidence: 'high',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/SM13334',
    notes:
      'The date records the foundation of Culross Abbey, not a claim that all visible fabric dates to 1217.',
  },
  {
    id: 'hes-scheduled-monument:SM5288',
    text: 'Culross Palace built 1597–1611',
    earliest: 1597,
    latest: 1611,
    basis: 'documented_date_range',
    confidence: 'high',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/SM5288',
    notes:
      'The date range is retained for the palace complex and is not reduced to a single inferred year.',
  },
  {
    id: 'hes-designed-landscape:GDL00123',
    text: 'Terraced gardens date from 1693',
    earliest: 1693,
    latest: 1693,
    basis: 'documented_construction',
    confidence: 'high',
    sourceUrl: 'https://portal.historicenvironment.scot/designation/GDL00123',
    notes:
      'The date refers to the terraced-garden evidence within the designed landscape, not the full present extent of parkland and woodland.',
  },
];

function feature(id: string): HeritageFeature {
  const found = pkg.features.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing Culross core-evidence feature ${id}.`);
  return found;
}
for (const item of evidence) {
  const target = feature(item.id);
  const source: SourceRecord = {
    sourceName: 'Historic Environment Scotland designation record date review',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: item.id.split(':').at(-1),
    sourceUrl: item.sourceUrl,
    accessedAt,
    licence:
      'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    notes: item.notes,
    reliability: 'official_statutory',
  };
  Object.assign(target, {
    documentedDateText: item.text,
    earliestPossibleYear: item.earliest,
    latestPossibleYear: item.latest,
    dateBasis: item.basis,
    dateConfidence: item.confidence,
    sourceRecords: [
      ...target.sourceRecords.filter((record) => record.sourceName !== source.sourceName),
      source,
    ],
    tags: [...new Set([...target.tags, 'date-reviewed', 'hes-date-reviewed'])],
    reviewed: true,
    updatedAt: accessedAt,
  });
}

function evidenceArea(
  id: string,
  category: SettlementAgePolygon['category'],
  description: string,
): SettlementAgePolygon {
  const target = feature(id);
  if (target.geometry?.type !== 'Polygon' && target.geometry?.type !== 'MultiPolygon')
    throw new Error(`${id} requires an official polygon.`);
  return {
    id: `culross-${id.replaceAll(':', '-')}-evidence-area`,
    projectId: pkg.project.id,
    geometry: target.geometry,
    earliestEvidenceYear: target.earliestPossibleYear,
    latestEvidenceYear: target.latestPossibleYear,
    category,
    evidenceMapIds: ['nls-os-six-inch-1888-1913'],
    evidenceDescription: description,
    confidence: 'high',
    digitisationMethod:
      'Official HES designation polygon retained as a bounded evidence area; it is not extrapolated into an assumed parish-wide settlement footprint.',
    sourceRecords: target.sourceRecords,
    reviewed: true,
  };
}
const settlementPolygons = [
  evidenceArea(
    'hes-scheduled-monument:SM13334',
    'developed_by_1700',
    'Culross Abbey scheduled-monument area. The Abbey was founded in 1217; this area indicates only the current statutory monument extent as medieval core evidence.',
  ),
  evidenceArea(
    'hes-scheduled-monument:SM5288',
    'developed_by_1700',
    'Culross Palace scheduled-monument area. The Palace dates to 1597–1611; this area is a source-backed early-modern burgh evidence area, not a complete town boundary.',
  ),
  evidenceArea(
    'hes-designed-landscape:GDL00123',
    'developed_by_1700',
    'Culross Abbey House designed landscape. HES records terraced gardens dating from 1693; the current inventory boundary is displayed only as the reviewed evidence extent.',
  ),
];
const generatedIds = new Set(settlementPolygons.map((item) => item.id));
pkg.settlementPolygons = [
  ...settlementPolygons,
  ...pkg.settlementPolygons.filter((item) => !generatedIds.has(item.id)),
];
pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  `Added ${evidence.length} date-reviewed Culross core records and ${settlementPolygons.length} settlement-evidence areas.`,
);
