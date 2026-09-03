import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectPackage } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve('data/projects/cove-bay.json');
const reportPath = resolve('data/review/cove-bay-local-nrhe-audit-2026-08-28.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const priorReport = JSON.parse(await readFile(reportPath, 'utf8').catch(() => '{"excluded":[]}')) as {
  excluded?: Array<{ id: string; name: string; reason: string }>;
};
const reviewedAt = '2026-08-28T17:45:00Z';

type DateReview = {
  text: string;
  earliest: number;
  latest: number;
  precision: string;
  description: string;
};

const reviews: Record<string, DateReview> = {
  '112540': { text: '19th-century railway station', earliest: 1800, latest: 1899, precision: 'century range', description: 'The former Cove Bay Station, retained as a distinct railway-heritage point.' },
  '173305': { text: '19th-century cottage', earliest: 1800, latest: 1899, precision: 'century range', description: 'A recorded 19th-century fishing-village cottage at 1 Colsea Road.' },
  '173306': { text: '19th-century cottage', earliest: 1800, latest: 1899, precision: 'century range', description: 'A recorded 19th-century fishing-village cottage at 5 Colsea Road.' },
  '173448': { text: '20th-century houses', earliest: 1900, latest: 1999, precision: 'century range', description: 'A recorded 20th-century residential group at 4–14 Marchmont Street.' },
  '173715': { text: '19th-century cottages', earliest: 1800, latest: 1899, precision: 'century range', description: 'The 19th-century cottage group at 1–6 Seaview Terrace.' },
  '230569': { text: '19th-century cottage', earliest: 1800, latest: 1899, precision: 'century range', description: 'A recorded 19th-century fishing-village cottage at 3 Colsea Road.' },
  '230571': { text: '19th-century cottage', earliest: 1800, latest: 1899, precision: 'century range', description: 'A recorded 19th-century fishing-village cottage at 7 Colsea Road.' },
  '230720': { text: '19th-century cottage', earliest: 1800, latest: 1899, precision: 'century range', description: 'A recorded 19th-century fishing-village cottage at 6 Colsea Road.' },
  '230721': { text: '19th-century cottage', earliest: 1800, latest: 1899, precision: 'century range', description: 'A recorded 19th-century fishing-village cottage at 4 Colsea Road.' },
  '378675': { text: '19th-century chapel and houses', earliest: 1800, latest: 1899, precision: 'century range', description: 'Station Croft, recorded as a 19th-century chapel and residential site.' },
  '379201': { text: '19th- to 20th-century mission hall and houses', earliest: 1800, latest: 1999, precision: 'multi-period range', description: 'The Colsea Terrace mission-room site, recorded across the 19th and 20th centuries.' },
  '382114': { text: 'Lifeboat station founded in the 19th century; later storehouse use', earliest: 1800, latest: 2026, precision: 'multi-period range', description: 'Cove Bay’s former lifeboat-station and later storehouse site, retained as maritime heritage.' },
};

const manualMerges: Array<{ nrheId: string; targetId: string; reason: string }> = [
  { nrheId: '173309', targetId: 'hes-listed-building:LB15633', reason: 'Cove Bay Hotel duplicate.' },
  { nrheId: '230561', targetId: 'hes-listed-building:LB15623', reason: '2 Loirston Road duplicate.' },
  { nrheId: '230712', targetId: 'hes-listed-building:LB15628', reason: '1 Spark Terrace duplicate.' },
  { nrheId: '20245', targetId: 'curated-attractions:cove-harbour-old-village', reason: 'Harbour duplicate merged into the dated 1878 visitor and heat point.' },
  { nrheId: '81285', targetId: 'historic-environment-record:MAB25995', reason: 'Second World War harbour-defence duplicate.' },
];

const nrheById = new Map(pkg.features.filter((feature) => feature.id.startsWith('nrhe:')).map((feature) => [feature.id.slice(5), feature]));
for (const merge of manualMerges) {
  const sourceFeature = nrheById.get(merge.nrheId);
  const target = pkg.features.find((feature) => feature.id === merge.targetId);
  if (!sourceFeature || !target) continue;
  const incoming = sourceFeature.sourceRecords;
  const incomingIds = new Set(incoming.map((record) => record.sourceRecordId).filter(Boolean));
  target.sourceRecords = [...target.sourceRecords.filter((record) => !incomingIds.has(record.sourceRecordId)), ...incoming];
  target.tags = [...new Set([...target.tags, 'nrhe-linked'])];
  target.reviewNotes = `${target.reviewNotes ? `${target.reviewNotes} ` : ''}${merge.reason} The official NRHE record is linked without creating an overlapping heat pin.`;
  target.updatedAt = reviewedAt;
}

const retainedIds = new Set(Object.keys(reviews).map((id) => `nrhe:${id}`));
const imported = pkg.features.filter((feature) => feature.id.startsWith('nrhe:'));
const mergedIds = new Set(manualMerges.map((item) => `nrhe:${item.nrheId}`));
const newlyExcluded = imported
  .filter((feature) => !retainedIds.has(feature.id) && !mergedIds.has(feature.id))
  .map((feature) => ({
    id: feature.id,
    name: feature.name,
    reason: /ALTENS|BLACKNESS|CRAWPEEL|WELLINGTON|LOIRSTON|REDMOSS|BURNBANKS|NEWH?LANDS/i.test(feature.name)
      ? 'Outside the strict historic Cove Bay settlement or belongs to Altens, Loirston, Redmoss or Burnbanks context.'
      : /GENERAL VIEW|NO CLASS \(EVENT\)|INDUSTRIAL ESTATE|COMMERCIAL PREMISES/i.test(feature.shortDescription ?? '')
        ? 'Archive/event or modern industrial index record, not a distinct historic heat asset.'
        : 'Period unassigned or insufficiently specific local record; retained in the audit without inventing a construction date.',
  }));
const excluded = newlyExcluded.length ? newlyExcluded : (priorReport.excluded ?? []);

pkg.features = pkg.features.filter((feature) => !feature.id.startsWith('nrhe:') || retainedIds.has(feature.id));
for (const feature of pkg.features.filter((item) => retainedIds.has(item.id))) {
  const review = reviews[feature.id.slice(5)];
  feature.documentedDateText = review.text;
  feature.earliestPossibleYear = review.earliest;
  feature.latestPossibleYear = review.latest;
  feature.datePrecision = review.precision;
  feature.dateBasis = 'estimated_from_authoritative_source';
  feature.dateConfidence = 'medium';
  feature.shortDescription = review.description;
  feature.reviewed = true;
  feature.reviewNotes = 'Distinct Cove Bay NRHE asset retained after strict locality, duplicate and date-evidence review. The heat date uses the official classification period, never the record-creation date.';
  feature.tags = [...new Set([...feature.tags, 'nrhe-period-extracted', 'date-reviewed', 'town-selection-inside-locality'])];
  feature.updatedAt = reviewedAt;
}

pkg.project.visualIdentity = {
  theme: 'Cove Bay fishing harbour beneath granite cliffs',
  badgeImage: '/town-guides/cove-bay-granite-harbour-watercolour-guide-v1.png',
  badgeAlt: 'Illustrated granite fishing harbour and coastal cliffs at Cove Bay',
  heroImage: '/town-guides/cove-bay-granite-harbour-watercolour-guide-v1.png',
  heroAlt: 'A visitor-guide illustration of Cove Bay’s old fishing harbour beneath rugged North Sea cliffs',
  heroObjectPosition: '50% 53%',
  motifs: ['1878 harbour', 'granite cliffs', 'fishing cottages', 'North Sea coast'],
  primaryColour: '#315e66', accentColour: '#b2763e', backgroundColour: '#edf1ea',
};
pkg.project.updatedAt = reviewedAt;
pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(errors.map((item) => item.message).join('; '));

const visibleHeritage = pkg.features.filter((feature) =>
  feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'historic-place', 'local-heritage-record', 'nrhe'].includes(tag)) &&
  !feature.tags.includes('map-hidden'),
);
const undated = visibleHeritage.filter((feature) =>
  !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null,
);
if (undated.length) throw new Error(`Undated visible Cove Bay heritage: ${undated.map((feature) => feature.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(reportPath, `${JSON.stringify({
  projectId: pkg.project.id,
  auditedAt: reviewedAt,
  localCanmoreRecordsInsidePolygon: 77,
  recordsLinkedAutomaticallyByImporter: 16,
  manuallyMergedDuplicates: manualMerges,
  distinctNrhePinsAdded: [...retainedIds],
  visibleHeritagePins: visibleHeritage.length,
  visibleHeritagePinsWithDates: visibleHeritage.length - undated.length,
  undatedVisibleHeritagePins: undated.map((feature) => feature.id),
  excluded,
  settlementDecision: 'Cove Bay remains a 64% Notable Stop on its own old harbour, fishing-village heritage and verified coastal circuit; Torry, Nigg Bay, Doonies, Altens, Loirston and Portlethen do not support its score.',
  visitorRecheck: {
    see: 2, eat: 1, trails: 2, picnic: 0, parking: 1, toilets: 0,
    foodResult: 'Cove Bay Hotel Public House remains the only verified 60+ daytime coffee and light-bite option; its current lunch, public-house and dog-menu pages were rechecked.',
    trailResult: 'The exact Cove coastal circuit and University/Aberdeen coastal guides remain valid; no exact Treasure Trails, Curious About, Mystery Guides or Go Quest product was found.',
  },
  rule: 'Duplicate records link to the existing asset. Distinct records publish only with defensible construction or official period evidence; record-creation and designation dates are never used as building dates.',
}, null, 2)}\n`, 'utf8');

console.log(`Cove Bay repaired: ${visibleHeritage.length} visible dated heritage pins, ${retainedIds.size} distinct NRHE additions, ${manualMerges.length} duplicates merged, ${excluded.length} records audited but not published.`);
