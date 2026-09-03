import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve('data/projects/peterculter.json');
const reportPath = resolve('data/review/peterculter-local-nrhe-audit-2026-08-28.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const priorReport = JSON.parse(await readFile(reportPath, 'utf8').catch(() => '{"excluded":[]}')) as {
  excluded?: Array<{ id: string; name: string; reason: string }>;
};
const reviewedAt = '2026-08-28T12:00:00Z';

type DateReview = {
  text: string;
  earliest: number;
  latest: number;
  precision: string;
  basis?: HeritageFeature['dateBasis'];
  confidence?: HeritageFeature['dateConfidence'];
  description: string;
  extraSource?: SourceRecord;
};

const reviews: Record<string, DateReview> = {
  '112875': {
    text: '19th-century railway station', earliest: 1800, latest: 1899,
    precision: 'century range', description: 'The former Culter Station, retained as a dated railway-heritage point from the local NRHE classification.',
  },
  '114571': {
    text: 'Medieval to post-medieval rig and furrow', earliest: 1066, latest: 1799,
    precision: 'multi-period range', description: 'Recorded cultivation remains at Bucklerburn Farm, shown as archaeological landscape evidence rather than a visitor attraction.',
  },
  '114572': {
    text: 'Medieval to post-medieval rig and furrow', earliest: 1066, latest: 1799,
    precision: 'multi-period range', description: 'Recorded cultivation remains at Guttrie Hill, shown as archaeological landscape evidence rather than a visitor attraction.',
  },
  '175038': {
    text: 'First World War memorial with Second World War tablet dedicated on 20 June 1949', earliest: 1918, latest: 1949,
    precision: 'documented commemorative phases', basis: 'documented_date_range', confidence: 'medium',
    description: 'Peterculter’s granite war memorial records both World Wars; the Second World War tablet was dedicated on 20 June 1949.',
    extraSource: {
      sourceName: 'Peterculter War Memorial record', sourceOrganisation: 'War Memorials Online',
      sourceRecordId: '240927', sourceUrl: 'https://www.warmemorialsonline.org.uk/memorial/240927/',
      accessedAt: reviewedAt, licence: 'Website terms apply', reliability: 'secondary',
      notes: 'Records the First and Second World War dedications and the 20 June 1949 tablet ceremony.',
    },
  },
  '19424': {
    text: 'Medieval holy well', earliest: 1066, latest: 1560,
    precision: 'period range', description: 'St Peter’s Well, retained as a distinct medieval sacred-site record rather than merged with the nearby church.',
  },
  '19431': {
    text: 'Paper mill founded circa 1750–1751', earliest: 1750, latest: 1751,
    precision: 'documented sources differ by one year', basis: 'documented_date_range', confidence: 'high',
    description: 'The former Peterculter paper mill site, founded circa 1750–1751 and retained as a distinct industrial-heritage point.',
    extraSource: {
      sourceName: 'Culter Paper Mills historic photograph record', sourceOrganisation: 'Aberdeen Local Studies',
      sourceRecordId: '163', sourceUrl: 'https://www.silvercityvault.org.uk/index.php?a=ViewItem&key=SnsiTiI6MjA4LCJQIjp7Iml0ZW1pZCI6Ijk1MzU0IiwicGVyY2VudFRlcm1zVG9NYXRjaCI6IjAuNiIsIm1heFF1ZXJ5VGVybXMiOiIyMCIsIm1pbkRvY0ZyZXEiOiIxIiwibWluVGVybUZyZXEiOiIxIn19&pg=1',
      accessedAt: reviewedAt, licence: 'Website terms apply', reliability: 'archival',
      notes: 'Aberdeen Local Studies gives 1750; the HES/Trove record gives 1751, so the map retains the honest 1750–1751 range.',
    },
  },
  '298161': {
    text: 'Church hall moved from Ballater to Peterculter in 1907', earliest: 1907, latest: 1907,
    precision: 'documented year', basis: 'documented_construction', confidence: 'high',
    description: 'The corrugated-iron St Peter’s church hall, brought from St Saviour’s Episcopal Church in Ballater in 1907.',
    extraSource: {
      sourceName: "Peterculter Ex St Peter's Church", sourceOrganisation: 'Places of Worship in Scotland',
      sourceRecordId: '750', sourceUrl: 'https://powis.scot/sites/peterculter-ex-st-peters-church-750/',
      accessedAt: reviewedAt, licence: 'Website terms apply', reliability: 'academic',
      notes: 'Records that the hall came from St Saviour’s Episcopal Church, Ballater, in 1907.',
    },
  },
  '331394': {
    text: 'First World War drill hall; 20th century', earliest: 1914, latest: 1918,
    precision: 'documented conflict period', description: 'The Bush drill hall and later council-depot site, retained as a First World War military-history point.',
  },
  '332369': {
    text: '19th- to 20th-century rifle range, including First World War use', earliest: 1800, latest: 1918,
    precision: 'multi-period range', description: 'The former Newmill rifle range, recorded across the 19th and early 20th centuries with First World War use.',
  },
  '184183': {
    text: 'Gordon Arms Hotel operated from 1899; rebuilt in 2002', earliest: 1899, latest: 2002,
    precision: 'documented operating and rebuilding years', basis: 'documented_date_range', confidence: 'medium',
    description: 'The Gordon Arms Hotel site, documented from 1899 and reconstructed in 2002; retained as a local social-history point.',
    extraSource: {
      sourceName: 'Gordon Arms Hotel historic photograph record', sourceOrganisation: 'Aberdeen Local Studies',
      sourceRecordId: '4596', sourceUrl: 'https://www.silvercityvault.org.uk/index.php?a=ViewItem&key=SnsiTiI6NywiUCI6eyJpdGVtaWQiOiI2MDU2NyIsInBlcmNlbnRUZXJtc1RvTWF0Y2giOiIwLjYiLCJtYXhRdWVyeVRlcm1zIjoiMjAiLCJtaW5Eb2NGcmVxIjoiMSIsIm1pblRlcm1GcmVxIjoiMSJ9fQ&pg=3',
      accessedAt: reviewedAt, licence: 'Website terms apply', reliability: 'archival',
      notes: 'Records operation from 1899 to 2002 and reconstruction in 2002.',
    },
  },
};

const retainedIds = new Set(Object.keys(reviews).map((id) => `nrhe:${id}`));
const imported = pkg.features.filter((feature) => feature.id.startsWith('nrhe:'));
const newlyExcluded = imported.filter((feature) => !retainedIds.has(feature.id)).map((feature) => ({
  id: feature.id,
  name: feature.name,
  reason: /MARYCULTER/.test(feature.name)
    ? 'Outside the Peterculter settlement: Maryculter record south of the River Dee.'
    : feature.id === 'nrhe:110848'
      ? 'Generic town index record, not a distinct heritage asset.'
      : 'Period unassigned or outlying/contextual record with no defensible asset date in the local extract; retained in the audit, not published as a heat pin.',
}));
const excluded = newlyExcluded.length ? newlyExcluded : (priorReport.excluded ?? []);

pkg.features = pkg.features.filter((feature) => !feature.id.startsWith('nrhe:') || retainedIds.has(feature.id));

for (const feature of pkg.features.filter((item) => retainedIds.has(item.id))) {
  const id = feature.id.slice('nrhe:'.length);
  const review = reviews[id];
  feature.documentedDateText = review.text;
  feature.earliestPossibleYear = review.earliest;
  feature.latestPossibleYear = review.latest;
  feature.datePrecision = review.precision;
  feature.dateBasis = review.basis ?? 'estimated_from_authoritative_source';
  feature.dateConfidence = review.confidence ?? 'medium';
  feature.shortDescription = review.description;
  feature.reviewed = true;
  feature.reviewNotes = 'Distinct Peterculter NRHE asset retained after local polygon, duplicate and date-evidence review. The heat date uses the cited construction or official NRHE classification period, never the record-creation date.';
  feature.tags = [...new Set([...feature.tags, 'nrhe-period-extracted', 'date-reviewed', 'town-selection-inside-locality'])];
  if (review.extraSource) feature.sourceRecords = [...feature.sourceRecords, review.extraSource];
  feature.updatedAt = reviewedAt;
}

pkg.project.visualIdentity = {
  theme: 'Peterculter granite village lane and St Peter’s tower',
  badgeImage: '/town-guides/peterculter-st-peters-village-watercolour-guide-v1.png',
  badgeAlt: 'Illustrated granite lane leading to St Peter’s tower in Peterculter',
  heroImage: '/town-guides/peterculter-st-peters-village-watercolour-guide-v1.png',
  heroAlt: 'A warm visitor-guide illustration of Peterculter’s old stone village and St Peter’s tower',
  heroObjectPosition: '50% 48%',
  motifs: ['granite cottages', 'St Peter’s tower', 'old village lane', 'Deeside greenery'],
  primaryColour: '#315f63', accentColour: '#b06d36', backgroundColour: '#f4eee0',
};

pkg.project.updatedAt = reviewedAt;
pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(errors.map((item) => item.message).join('; '));

const visibleHeritage = pkg.features.filter((feature) =>
  feature.tags.some((tag) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)) &&
  !feature.tags.includes('map-hidden'),
);
const undated = visibleHeritage.filter((feature) =>
  !feature.documentedDateText?.trim() || feature.earliestPossibleYear == null || feature.latestPossibleYear == null,
);
if (undated.length) throw new Error(`Undated visible Peterculter heritage: ${undated.map((feature) => feature.id).join(', ')}`);

await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
await writeFile(reportPath, `${JSON.stringify({
  projectId: pkg.project.id,
  auditedAt: reviewedAt,
  localCanmoreRecordsInsidePolygon: 37,
  statutoryOrCuratedRecordsLinkedByImporter: 10,
  distinctNrhePinsAdded: [...retainedIds],
  visibleHeritagePins: visibleHeritage.length,
  visibleHeritagePinsWithDates: visibleHeritage.length - undated.length,
  undatedVisibleHeritagePins: undated.map((feature) => feature.id),
  excluded,
  rule: 'Duplicate records link to the existing asset; distinct records publish only when a defensible construction or period date is available. Record-creation and designation dates are never used as building dates.',
}, null, 2)}\n`, 'utf8');

console.log(`Peterculter heritage repaired: ${visibleHeritage.length} visible dated pins, ${retainedIds.size} distinct NRHE additions, ${excluded.length} unpublishable or out-of-scope NRHE records audited.`);
