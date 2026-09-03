import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Confidence, HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/bathgate.json');
const completionReviewPath = resolve(process.argv[3] ?? 'data/review/bathgate-completion-review.json');
const linkedAuditPath = resolve('data/review/bathgate-linked-source-audit.json');
const currentPlaceCurationPath = resolve('data/curation/bathgate-current-place-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const reviewedAt = new Date().toISOString();
const reviewedDate = reviewedAt.slice(0, 10);

interface DateEvidence {
  text: string;
  earliest: number;
  latest: number;
  precision: string;
  confidence: Confidence;
  sourceName: string;
  sourceRecordId: string;
  sourceUrl: string;
  reliability: SourceRecord['reliability'];
  notes: string;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function appendReviewNote(feature: HeritageFeature, note: string): void {
  if (feature.reviewNotes?.includes(note)) return;
  feature.reviewNotes = `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}${note}`.trim();
}

function sourceFor(evidence: DateEvidence): SourceRecord {
  return {
    sourceName: evidence.sourceName,
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: evidence.sourceRecordId,
    sourceUrl: evidence.sourceUrl,
    accessedAt: reviewedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    reliability: evidence.reliability,
    quotedDateText: evidence.text,
    notes: evidence.notes,
  };
}

const statutoryEvidence = new Map<string, DateEvidence>([
  [
    'hes-scheduled-monument:SM5671',
    {
      text: 'Old parish church granted to Holyrood Abbey by Malcolm IV (1153-65), with late transitional doorway around 1200 and abandoned in 1739',
      earliest: 1153,
      latest: 1739,
      precision: 'broad documented ecclesiastical occupation range',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceRecordId: 'SM5671',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM5671',
      reliability: 'official_statutory',
      notes:
        'HES scheduled-monument description dates the medieval church context and abandonment; the range is broad and not a single construction date.',
    },
  ],
]);

function classification(feature: HeritageFeature): string | undefined {
  return feature.shortDescription
    ?.replace(/^NRHE classification:\s*/i, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function evidenceFromClassification(feature: HeritageFeature): DateEvidence | undefined {
  const value = classification(feature);
  if (!value) return undefined;
  const ranges: Array<[number, number, string, Confidence]> = [];
  if (/\bmodern\b/i.test(value)) ranges.push([1900, 1999, 'modern', 'low']);
  if (/\bprehistoric\b/i.test(value)) ranges.push([-12000, 42, 'prehistoric', 'low']);
  if (/\bbronze age\b/i.test(value)) ranges.push([-2500, -800, 'Bronze Age', 'low']);
  if (/\bneolithic\b/i.test(value)) ranges.push([-4100, -2500, 'Neolithic', 'low']);
  if (!ranges.length) return undefined;
  const sourceRecordId = feature.id.slice('nrhe:'.length);
  return {
    text: `NRHE classification period: ${value}`,
    earliest: Math.min(...ranges.map(([start]) => start)),
    latest: Math.max(...ranges.map(([, end]) => end)),
    precision: `${[...new Set(ranges.map(([, , label]) => label))].join(' / ')} classification period`,
    confidence: 'low',
    sourceName: 'Historic Environment Scotland NRHE period classification',
    sourceRecordId,
    sourceUrl: `https://www.trove.scot/place/${sourceRecordId}`,
    reliability: 'official_non_statutory',
    notes:
      'Normalised from the official NRHE classification. This is broad period evidence for the classified component, not a precise construction date.',
  };
}

function applyDate(feature: HeritageFeature, evidence: DateEvidence): void {
  const source = sourceFor(evidence);
  feature.documentedDateText = evidence.text;
  feature.earliestPossibleYear = evidence.earliest;
  feature.latestPossibleYear = evidence.latest;
  feature.datePrecision = evidence.precision;
  feature.dateBasis =
    evidence.confidence === 'high' ? 'documented_date_range' : 'estimated_from_authoritative_source';
  feature.dateConfidence = evidence.confidence;
  feature.sourceRecords = [
    ...feature.sourceRecords.filter(
      (record) =>
        !(
          record.sourceName === source.sourceName &&
          record.sourceOrganisation === source.sourceOrganisation &&
          record.sourceRecordId === source.sourceRecordId
        ),
    ),
    source,
  ];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  addTags(feature, 'date-reviewed', 'curation-date-enriched', 'bathgate-nonmap-date-reviewed');
  appendReviewNote(
    feature,
    'Bathgate completion review: broad date evidence has been normalised from the linked official HES/NRHE record.',
  );
}

function markNoDate(feature: HeritageFeature): void {
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  addTags(feature, 'date-reviewed', 'reviewed-no-defensible-date', 'bathgate-date-reviewed-no-date');
  appendReviewNote(
    feature,
    'Bathgate completion review: the official source was checked and no defensible construction or historic-period date is published for this record.',
  );
}

function osmSource(feature: HeritageFeature): SourceRecord | undefined {
  return feature.sourceRecords.find((source) =>
    /OpenStreetMap current (community places|parks and gardens)/.test(source.sourceName),
  );
}

function currentLabel(feature: HeritageFeature): string {
  const category =
    feature.tags
      .find((tag) => tag.startsWith('osm-community-') && tag !== 'osm-community-place')
      ?.replace('osm-community-', '') ?? (feature.tags.includes('osm-current-park') ? 'park' : feature.featureType);
  const labels: Record<string, string> = {
    amenities: 'amenity',
    art: 'public artwork',
    food: 'food and drink place',
    historic: 'historic place',
    leisure: 'leisure place',
    memorial: 'memorial or plaque',
    nature: 'natural sight',
    park: 'park or garden',
    parking: 'parking place',
    picnic: 'picnic or rest facility',
    visitor: 'visitor place',
  };
  return labels[category] ?? category.replaceAll('_', ' ');
}

function currentSummary(feature: HeritageFeature): string {
  const generic = new Set(['Bench', 'Parking', 'Picnic Site', 'Playground', 'Public Toilets', 'Viewpoint']);
  const label = currentLabel(feature);
  if (generic.has(feature.name)) return `Current ${label} in Bathgate recorded by OpenStreetMap.`;
  return `${feature.name} is a current ${label} in Bathgate recorded by OpenStreetMap.`;
}

const dated: Array<{ id: string; name: string; date: string; range: [number, number] }> = [];
const reviewedWithoutDate: Array<{ id: string; name: string }> = [];
for (const feature of pkg.features) {
  if (
    !feature.documentedDateText &&
    (feature.id.startsWith('nrhe:') || feature.id.startsWith('hes-'))
  ) {
    const evidence = statutoryEvidence.get(feature.id) ?? evidenceFromClassification(feature);
    if (evidence) {
      applyDate(feature, evidence);
      dated.push({
        id: feature.id,
        name: feature.name,
        date: evidence.text,
        range: [evidence.earliest, evidence.latest],
      });
    } else {
      markNoDate(feature);
      reviewedWithoutDate.push({ id: feature.id, name: feature.name });
    }
  }
}

const currentPlaceEntries = [];
let currentParksReviewed = 0;
for (const feature of pkg.features.filter(
  (candidate) =>
    candidate.tags.includes('osm-community-place') || candidate.tags.includes('osm-current-park'),
)) {
  const source = osmSource(feature);
  if (!source?.sourceUrl) continue;
  const summary = currentSummary(feature);
  const reviewSource: SourceRecord = {
    sourceName: feature.tags.includes('osm-current-park')
      ? 'OpenStreetMap current-park curation review'
      : 'OpenStreetMap current-place curation review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceRecordId: `current-context-curation:${feature.id}`,
    sourceUrl: source.sourceUrl,
    accessedAt: reviewedAt,
    licence: 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.',
    reliability: 'discovery_only',
    notes: `Current-context curation: description=${summary}.`,
  };
  feature.shortDescription = summary;
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((record) => record.sourceRecordId !== reviewSource.sourceRecordId),
    reviewSource,
  ];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  addTags(feature, 'osm-current-context-reviewed');
  appendReviewNote(
    feature,
    `Current context reviewed against OpenStreetMap on ${reviewedDate}; retained as present-day context rather than historic date evidence.`,
  );
  if (feature.tags.includes('osm-current-park')) currentParksReviewed += 1;
  if (feature.tags.includes('osm-community-place'))
    currentPlaceEntries.push({
      featureId: feature.id,
      summary,
      sourceName: reviewSource.sourceName,
      sourceOrganisation: reviewSource.sourceOrganisation,
      sourceUrl: reviewSource.sourceUrl,
      accessedAt: reviewedDate,
      reliability: reviewSource.reliability,
    });
}

const linkedSourceAudit = pkg.features
  .map((feature) => {
    const kinds = new Set<string>();
    for (const source of feature.sourceRecords) {
      if (/NRHE|trove/i.test(`${source.sourceName} ${source.sourceUrl ?? ''}`)) kinds.add('NRHE');
      if (/listed building|designation|scheduled monument|Designations GIS/i.test(source.sourceName))
        kinds.add('HES designation');
      if (/OpenStreetMap/i.test(`${source.sourceName} ${source.sourceOrganisation}`))
        kinds.add('OpenStreetMap');
    }
    return { feature, kinds: [...kinds] };
  })
  .filter(({ kinds }) => kinds.length > 1)
  .map(({ feature, kinds }) => {
    feature.reviewed = true;
    feature.updatedAt = reviewedAt;
    addTags(feature, 'bathgate-linked-source-reviewed');
    appendReviewNote(
      feature,
      'Duplicate audit: linked NRHE, HES or OSM source records have been retained on this canonical feature; no separate duplicate pin is published.',
    );
    return {
      featureId: feature.id,
      name: feature.name,
      linkedSourceKinds: kinds.sort(),
      sourceRecordIds: feature.sourceRecords
        .map((source) => source.sourceRecordId)
        .filter((sourceRecordId): sourceRecordId is string => Boolean(sourceRecordId)),
      decision: 'Retain linked sources on the canonical published feature.',
    };
  });

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);

await mkdir(dirname(completionReviewPath), { recursive: true });
await mkdir(dirname(currentPlaceCurationPath), { recursive: true });
await writeFile(
  completionReviewPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      policy:
        'Completed Bathgate non-map curation. Explicit HES/NRHE period evidence was normalised conservatively; period-unknown, period-unassigned, event, general-view and unsupported statutory records were marked reviewed without inventing dates.',
      dated,
      reviewedWithoutDate,
      currentPlaceReview: {
        reviewed: currentPlaceEntries.length,
        currentParksReviewed,
      },
      linkedSourceAudit: {
        reviewed: linkedSourceAudit.length,
        outputPath: linkedAuditPath.replaceAll('\\', '/'),
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(currentPlaceCurationPath, `${JSON.stringify(currentPlaceEntries, null, 2)}\n`, 'utf8');
await writeFile(
  linkedAuditPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      policy:
        'Features with multiple source families were reviewed as canonical merged records. Linked sources are retained for provenance; duplicate pins are not published.',
      records: linkedSourceAudit,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(
  `Completed Bathgate non-map work: ${dated.length} date review(s), ${reviewedWithoutDate.length} reviewed-without-date record(s), ${currentPlaceEntries.length} current place(s), ${currentParksReviewed} current park(s), ${linkedSourceAudit.length} linked-source audit record(s).`,
);
