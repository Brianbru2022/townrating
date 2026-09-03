import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve('data/projects/stonehaven.json');
const auditPath = resolve('data/review/stonehaven-full-visitor-audit-2026-08-27.json');
const enrichmentPath = resolve('data/review/stonehaven-hes-date-enrichment-2026-08-27.json');
const reviewedAt = '2026-08-27T23:30:00Z';

type MutableFeature = HeritageFeature & Record<string, any>;
type MutablePackage = ProjectPackage & { features: MutableFeature[] };
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as MutablePackage;
const audit = JSON.parse(await readFile(auditPath, 'utf8')) as Record<string, any>;
const enrichment = JSON.parse(await readFile(enrichmentPath, 'utf8')) as Record<string, any>;

interface DateEvidence {
  text: string;
  earliest: number;
  latest: number;
  basis: HeritageFeature['dateBasis'];
  confidence: HeritageFeature['dateConfidence'];
  description: string;
}

const manualDates: Record<string, DateEvidence> = {
  LB2915: { text: 'Dated 1582; restored 1913', earliest: 1582, latest: 1582, basis: 'documented_construction', confidence: 'high', description: 'Small oblong Gothic building, dated 1582 and restored in 1913.' },
  LB2916: { text: 'Dated 1786; late-19th-century extensions', earliest: 1786, latest: 1786, basis: 'documented_construction', confidence: 'high', description: 'Two-storey and attic building dated 1786, with late-19th-century extensions.' },
  LB9367: { text: '18th-century coaching inn', earliest: 1700, latest: 1799, basis: 'documented_date_range', confidence: 'medium', description: 'An 18th-century coaching inn described by HES.' },
  LB2914: { text: 'Built 1782; extended 1862; remodelled 1903', earliest: 1782, latest: 1782, basis: 'documented_construction', confidence: 'high', description: 'Gothic church built in 1782, extended in 1862 and remodelled in 1903.' },
  LB2917: { text: 'Early 19th century', earliest: 1800, latest: 1839, basis: 'documented_date_range', confidence: 'medium', description: 'HES describes the building as early 19th century.' },
  LB9366: { text: 'Probably 18th century', earliest: 1700, latest: 1799, basis: 'estimated_from_authoritative_source', confidence: 'low', description: 'HES describes the enclosing walls as probably 18th century.' },
  LB2918: { text: 'Unveiled 20 May 1923', earliest: 1923, latest: 1923, basis: 'documented_event', confidence: 'high', description: 'The Black Hill war memorial was unveiled on 20 May 1923.' },
  LB9368: { text: '18th century; later porches', earliest: 1700, latest: 1799, basis: 'documented_date_range', confidence: 'medium', description: 'HES describes the house as 18th century, with later porches.' },
  LB9370: { text: '18th century; later widening', earliest: 1700, latest: 1799, basis: 'documented_date_range', confidence: 'medium', description: 'HES describes the bridge as 18th century with later widening.' },
  LB9374: { text: 'Dated 1821', earliest: 1821, latest: 1821, basis: 'documented_construction', confidence: 'high', description: 'The bridge carries an inset panel dated 1821.' },
  LB9376: { text: 'Early 19th century', earliest: 1800, latest: 1839, basis: 'documented_date_range', confidence: 'medium', description: 'HES describes the small Gothic building as early 19th century.' },
  LB41553: { text: 'Built 1879', earliest: 1879, latest: 1879, basis: 'documented_construction', confidence: 'high', description: 'Cast-iron footbridge engineered by G S Hird and made by Blaikie Brothers in 1879.' },
  LB41587: { text: 'Late 18th or early 19th century', earliest: 1760, latest: 1839, basis: 'documented_date_range', confidence: 'medium', description: 'HES describes the terrace as late 18th or early 19th century.' },
  LB41614: { text: '18th–19th centuries; remodelled 1920', earliest: 1700, latest: 1899, basis: 'documented_date_range', confidence: 'medium', description: 'Former mill of 18th- and 19th-century fabric, remodelled in 1920 and converted in 1993.' },
  LB50272: { text: '1890s', earliest: 1890, latest: 1899, basis: 'documented_date_range', confidence: 'high', description: 'HES dates the former shoe shop and dwellings to the 1890s.' },
};

function hesSource(reference: string, notes: string): SourceRecord {
  return {
    sourceName: 'Historic Environment Scotland designation description manual date review',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: reference,
    sourceUrl: `https://portal.historicenvironment.scot/designation/${reference}`,
    accessedAt: reviewedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    reliability: 'official_statutory',
    notes,
  };
}

for (const [reference, evidence] of Object.entries(manualDates)) {
  const feature = pkg.features.find((item) => item.id === `hes-listed-building:${reference}`);
  if (!feature) throw new Error(`Missing Stonehaven HES feature ${reference}`);
  Object.assign(feature, {
    documentedDateText: evidence.text,
    earliestPossibleYear: evidence.earliest,
    latestPossibleYear: evidence.latest,
    dateBasis: evidence.basis,
    dateConfidence: evidence.confidence,
    sourceRecords: [
      ...feature.sourceRecords.filter((source) => source.sourceName !== 'Historic Environment Scotland designation description manual date review'),
      hesSource(reference, evidence.description),
    ],
    tags: [...new Set([...feature.tags, 'hes-date-reviewed'])],
    reviewed: true,
    updatedAt: reviewedAt,
  });
}

const merges = [
  {
    directId: 'hes-listed-building:LB50183',
    curatedId: 'curated-attraction:stonehaven-open-air-pool',
    date: { text: 'Built and opened 1934', earliest: 1934, latest: 1934, basis: 'documented_construction', confidence: 'high' },
  },
  {
    directId: 'hes-listed-building:LB41625',
    curatedId: 'curated-attraction:stonehaven-harbour-auld-toon',
    date: { text: '16th-century origins; Old Pier before 1795; South Pier 1825–26; Fish Jetty 1830s; breakwater 1901–08', earliest: 1500, latest: 1908, basis: 'documented_date_range', confidence: 'high' },
  },
  {
    directId: 'hes-listed-building:LB41655',
    curatedId: 'curated-attraction:stonehaven-tolbooth-museum',
    date: { text: 'Late 16th century; north wing added 17th century; restored 1963', earliest: 1560, latest: 1699, basis: 'documented_date_range', confidence: 'high' },
  },
  {
    directId: 'hes-listed-building:LB2918',
    curatedId: 'curated-attraction:stonehaven-black-hill-war-memorial',
    date: { text: 'Unveiled 20 May 1923', earliest: 1923, latest: 1923, basis: 'documented_event', confidence: 'high' },
  },
] as const;

for (const merge of merges) {
  const direct = pkg.features.find((item) => item.id === merge.directId);
  const curated = pkg.features.find((item) => item.id === merge.curatedId);
  if (!direct || !curated) throw new Error(`Cannot merge ${merge.directId} into ${merge.curatedId}`);
  Object.assign(curated, {
    designationType: direct.designationType,
    designationCategory: direct.designationCategory,
    statutoryStatus: direct.statutoryStatus,
    documentedDateText: merge.date.text,
    earliestPossibleYear: merge.date.earliest,
    latestPossibleYear: merge.date.latest,
    dateBasis: merge.date.basis,
    dateConfidence: merge.date.confidence,
    sourceRecords: [...curated.sourceRecords, ...direct.sourceRecords.filter((source) => !curated.sourceRecords.some((existing) => existing.sourceRecordId === source.sourceRecordId && existing.sourceOrganisation === source.sourceOrganisation))],
    tags: [...new Set([...curated.tags, ...direct.tags, 'heritage-pin-date-audited'])],
    reviewed: true,
    updatedAt: reviewedAt,
  });
}
pkg.features = pkg.features.filter((item) => !merges.some((merge) => merge.directId === item.id));

const heritagePins = pkg.features.filter((item) => item.tags.includes('hes-listed-building') && item.evidenceScope !== 'out_of_scope' && !item.tags.includes('map-hidden'));
const undated = heritagePins.filter((item) => !item.documentedDateText?.trim() || item.earliestPossibleYear === undefined || item.latestPossibleYear === undefined);
if (undated.length) throw new Error(`Undated Stonehaven heritage pins remain: ${undated.map((item) => item.id).join(', ')}`);

audit.heritageDateAudit = {
  pins: heritagePins.length,
  dated: heritagePins.length,
  undated: [],
  insideLocality: heritagePins.filter((item) => item.tags.includes('town-selection-inside-locality')).length,
  heritageBufferCandidates: heritagePins.filter((item) => item.tags.includes('town-selection-heritage-buffer')).length,
  officialDescriptionDatesNormalised: enrichment.enriched,
  individuallyReviewedFallbacks: Object.keys(manualDates).length,
  mergedDuplicateVisitorPins: merges.map((item) => item.curatedId),
  method: 'Official HES listed-building spatial register plus construction date or period from each official HES designation description. Exact years retain high confidence; century ranges are normalised conservatively; qualified wording such as probably retains low confidence.',
  source: 'https://portal.historicenvironment.scot/search',
};
audit.notes = [
  ...(audit.notes ?? []).filter((note: string) => !note.startsWith('Heritage-date audit:')),
  `Heritage-date audit: all ${heritagePins.length} HES-designated Stonehaven pins now carry a source-backed construction date or period; ${audit.heritageDateAudit.heritageBufferCandidates} are labelled as heritage-buffer context.`,
];

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(errors.map((item) => `${item.recordId}: ${item.message}`).join('\n'));

await Promise.all([
  writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8'),
  writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8'),
]);
console.log(`Stonehaven heritage-date audit complete: ${heritagePins.length}/${heritagePins.length} pins dated; ${audit.heritageDateAudit.heritageBufferCandidates} buffer candidates labelled.`);
