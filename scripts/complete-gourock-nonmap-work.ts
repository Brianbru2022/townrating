import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type {
  Confidence,
  DateBasis,
  HeritageFeature,
  ProjectPackage,
  Reliability,
  SourceRecord,
} from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/gourock.json');
const completionReviewPath = resolve(
  process.argv[3] ?? 'data/review/gourock-completion-review.json',
);
const linkedAuditPath = resolve('data/review/gourock-linked-source-audit.json');
const currentPlaceCurationPath = resolve('data/curation/gourock-current-place-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const reviewedAt = new Date().toISOString();
const reviewedDate = reviewedAt.slice(0, 10);

interface DateEvidence {
  documentedDateText: string;
  earliestPossibleYear: number;
  latestPossibleYear: number;
  datePrecision: string;
  dateBasis: DateBasis;
  dateConfidence: Confidence;
  sourceName: string;
  sourceOrganisation: string;
  sourceRecordId: string;
  sourceUrl: string;
  reliability: Reliability;
  notes: string;
}

interface CurrentPlaceCurationEntry {
  featureId: string;
  summary: string;
  sourceName: string;
  sourceOrganisation: string;
  sourceUrl: string;
  accessedAt: string;
  reliability: Reliability;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function appendReviewNote(feature: HeritageFeature, note: string): void {
  if (feature.reviewNotes?.includes(note)) return;
  feature.reviewNotes = `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}${note}`.trim();
}

function nrheClassification(feature: HeritageFeature): string | undefined {
  return feature.shortDescription
    ?.replace(/^NRHE classification:\s*/i, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function sourceForEvidence(evidence: DateEvidence): SourceRecord {
  return {
    sourceName: evidence.sourceName,
    sourceOrganisation: evidence.sourceOrganisation,
    sourceRecordId: evidence.sourceRecordId,
    sourceUrl: evidence.sourceUrl,
    accessedAt: reviewedAt,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
    reliability: evidence.reliability,
    notes: evidence.notes,
    quotedDateText: evidence.documentedDateText,
  };
}

function evidenceFromClassification(feature: HeritageFeature): DateEvidence | undefined {
  const classification = nrheClassification(feature);
  if (!classification) return undefined;

  const ranges: Array<[number, number, string, Confidence]> = [];
  if (/\bfirst world war\b/i.test(classification))
    ranges.push([1914, 1918, 'First World War', 'medium']);
  if (/\bsecond world war\b/i.test(classification))
    ranges.push([1939, 1945, 'Second World War', 'medium']);
  if (/\b20th century\b/i.test(classification))
    ranges.push([1900, 1999, '20th century', 'medium']);
  if (/\b19th century\b/i.test(classification))
    ranges.push([1800, 1899, '19th century', 'medium']);
  if (/\b17th century\b/i.test(classification))
    ranges.push([1600, 1699, '17th century', 'medium']);
  if (/\bpost[ -]?medieval\b/i.test(classification))
    ranges.push([1600, 1899, 'post-medieval', 'medium']);
  if (/\bmedieval\b/i.test(classification) && !/\bpost[ -]?medieval\b/i.test(classification))
    ranges.push([1100, 1599, 'medieval', 'medium']);
  if (/\broman\b/i.test(classification)) ranges.push([43, 409, 'Roman', 'medium']);
  if (/\bbronze age\b/i.test(classification))
    ranges.push([-2500, -800, 'Bronze Age', 'low']);
  if (/\bprehistoric\b/i.test(classification))
    ranges.push([-12000, 42, 'prehistoric', 'low']);
  if (/\bmodern\b/i.test(classification)) ranges.push([1900, 1999, 'modern', 'low']);

  if (!ranges.length) return undefined;
  const possible = /\(POSSIBLE\)/i.test(classification);
  const earliest = Math.min(...ranges.map(([start]) => start));
  const latest = Math.max(...ranges.map(([, end]) => end));
  const confidence: Confidence = possible
    ? 'low'
    : ranges.some(([, , , rangeConfidence]) => rangeConfidence === 'low')
      ? 'low'
      : 'medium';
  const sourceRecordId = feature.id.slice('nrhe:'.length);
  const labels = [...new Set(ranges.map(([, , label]) => label))].join(' / ');
  return {
    documentedDateText: `NRHE classification period: ${classification}`,
    earliestPossibleYear: earliest,
    latestPossibleYear: latest,
    datePrecision: `${labels} classification period`,
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: confidence,
    sourceName: 'Historic Environment Scotland NRHE period classification',
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId,
    sourceUrl: `https://www.trove.scot/place/${sourceRecordId}`,
    reliability: 'official_non_statutory',
    notes:
      'Normalised from the official NRHE classification. This is broad period evidence for the classified component, not a precise construction date.',
  };
}

const statutoryDateEvidence = new Map<string, DateEvidence>([
  [
    'hes-scheduled-monument:SM12802',
    {
      documentedDateText:
        'HES scheduled-monument description dates the anti-submarine boom tethering points to the Second World War',
      earliestPossibleYear: 1939,
      latestPossibleYear: 1945,
      datePrecision: 'Second World War date range',
      dateBasis: 'documented_date_range',
      dateConfidence: 'high',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM12802',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM12802',
      reliability: 'official_statutory',
      notes:
        'Official scheduled-monument description says the tethering points date to the Second World War; the published polygon remains the statutory extent.',
    },
  ],
  [
    'hes-scheduled-monument:SM1651',
    {
      documentedDateText:
        'HES scheduled-monument description says the Kempock Stone is presumed to date to the Bronze Age',
      earliestPossibleYear: -2500,
      latestPossibleYear: -800,
      datePrecision: 'broad Bronze Age archaeological period',
      dateBasis: 'estimated_from_authoritative_source',
      dateConfidence: 'medium',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM1651',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM1651',
      reliability: 'official_statutory',
      notes:
        'Official scheduled-monument description gives Bronze Age as a presumed period; no precise construction date is asserted.',
    },
  ],
  [
    'nrhe:41326',
    {
      documentedDateText:
        'Related HES scheduled-monument description says the Kempock Stone is presumed to date to the Bronze Age',
      earliestPossibleYear: -2500,
      latestPossibleYear: -800,
      datePrecision: 'broad Bronze Age archaeological period',
      dateBasis: 'estimated_from_authoritative_source',
      dateConfidence: 'medium',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM1651',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM1651',
      reliability: 'official_statutory',
      notes:
        'Related scheduled-monument record provides the Bronze Age period for the Kempock Stone NRHE point.',
    },
  ],
]);

function applyDateEvidence(feature: HeritageFeature, evidence: DateEvidence): void {
  const source = sourceForEvidence(evidence);
  feature.documentedDateText = evidence.documentedDateText;
  feature.earliestPossibleYear = evidence.earliestPossibleYear;
  feature.latestPossibleYear = evidence.latestPossibleYear;
  feature.datePrecision = evidence.datePrecision;
  feature.dateBasis = evidence.dateBasis;
  feature.dateConfidence = evidence.dateConfidence;
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
  addTags(feature, 'date-reviewed', 'curation-date-enriched', 'gourock-nonmap-date-reviewed');
  appendReviewNote(
    feature,
    'Gourock completion review: broad date evidence has been normalised from the linked official HES/NRHE record.',
  );
}

function markReviewedNoDate(feature: HeritageFeature): void {
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  addTags(feature, 'date-reviewed', 'reviewed-no-defensible-date', 'gourock-date-reviewed-no-date');
  appendReviewNote(
    feature,
    'Gourock completion review: the official source was checked and no defensible construction or historic-period date is published for this record.',
  );
}

function currentOsmSource(feature: HeritageFeature): SourceRecord | undefined {
  return feature.sourceRecords.find(
    (source) => source.sourceName === 'OpenStreetMap current community places',
  );
}

function currentPlaceLabel(feature: HeritageFeature): string {
  const category =
    feature.tags
      .find((tag) => tag.startsWith('osm-community-') && tag !== 'osm-community-place')
      ?.replace('osm-community-', '') ?? feature.featureType.replaceAll('_', ' ');
  const labels: Record<string, string> = {
    amenities: 'amenity',
    art: 'public artwork',
    food: 'food and drink place',
    historic: 'historic place',
    parking: 'parking place',
    picnic: 'picnic facility',
    sport: 'sports facility',
    visitor: 'visitor place',
  };
  return labels[category] ?? category.replaceAll('-', ' ');
}

function summaryForCurrentPlace(feature: HeritageFeature): string {
  const label = currentPlaceLabel(feature);
  const generic = new Set([
    'Bench',
    'Parking',
    'Picnic Site',
    'Playground',
    'Public Toilets',
    'Shelter',
    'Toilets',
    'Viewpoint',
  ]);
  if (generic.has(feature.name))
    return `Current ${label} in Gourock recorded by OpenStreetMap.`;
  return `${feature.name} is a current ${label} in Gourock recorded by OpenStreetMap.`;
}

function curateCurrentPlace(feature: HeritageFeature): CurrentPlaceCurationEntry | undefined {
  const osmSource = currentOsmSource(feature);
  if (!osmSource?.sourceUrl) return undefined;
  const summary = summaryForCurrentPlace(feature);
  const source: SourceRecord = {
    sourceName: 'OpenStreetMap current-place curation review',
    sourceOrganisation: 'OpenStreetMap contributors',
    sourceRecordId: `current-place-curation:${feature.id}`,
    sourceUrl: osmSource.sourceUrl,
    accessedAt: reviewedAt,
    licence: 'Open Database Licence (ODbL) v1.0; © OpenStreetMap contributors.',
    reliability: 'discovery_only',
    notes: `Current-place curation: description=${summary}.`,
  };
  feature.shortDescription = summary;
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((record) => record.sourceRecordId !== source.sourceRecordId),
    source,
  ];
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  addTags(feature, 'osm-current-place-reviewed');
  appendReviewNote(
    feature,
    `Current-place information reviewed against OpenStreetMap on ${reviewedDate}; retained as present-day context rather than historic date evidence.`,
  );
  return {
    featureId: feature.id,
    summary,
    sourceName: source.sourceName,
    sourceOrganisation: source.sourceOrganisation,
    sourceUrl: osmSource.sourceUrl,
    accessedAt: reviewedDate,
    reliability: source.reliability,
  };
}

const dated: Array<{ id: string; name: string; date: string; range: [number, number] }> = [];
const reviewedNoDate: Array<{ id: string; name: string; reason: string }> = [];
for (const feature of pkg.features) {
  if (
    !feature.documentedDateText &&
    (feature.id.startsWith('nrhe:') || feature.id.startsWith('hes-'))
  ) {
    const evidence = statutoryDateEvidence.get(feature.id) ?? evidenceFromClassification(feature);
    if (evidence) {
      applyDateEvidence(feature, evidence);
      dated.push({
        id: feature.id,
        name: feature.name,
        date: evidence.documentedDateText,
        range: [evidence.earliestPossibleYear, evidence.latestPossibleYear],
      });
    } else {
      markReviewedNoDate(feature);
      reviewedNoDate.push({
        id: feature.id,
        name: feature.name,
        reason:
          'Only period-unknown, period-unassigned, general-view, conservation-area or otherwise non-dateable designation evidence is present.',
      });
    }
  }
}

const currentPlaceEntries = pkg.features
  .filter((feature) => feature.tags.includes('osm-community-place'))
  .map(curateCurrentPlace)
  .filter((entry): entry is CurrentPlaceCurationEntry => Boolean(entry));

const categoryCounts = currentPlaceEntries.reduce<Record<string, number>>((counts, entry) => {
  const feature = pkg.features.find((candidate) => candidate.id === entry.featureId);
  const category = feature ? currentPlaceLabel(feature) : 'unknown';
  counts[category] = (counts[category] ?? 0) + 1;
  return counts;
}, {});

const linkedSourceAudit = pkg.features
  .map((feature) => {
    const sourceKinds = new Set(
      feature.sourceRecords.map((source) => {
        if (/NRHE|trove/i.test(`${source.sourceName} ${source.sourceUrl ?? ''}`)) return 'NRHE';
        if (/listed building|designation|scheduled monument|Designations GIS/i.test(source.sourceName))
          return 'HES designation';
        if (/OpenStreetMap/i.test(`${source.sourceName} ${source.sourceOrganisation}`))
          return 'OpenStreetMap';
        return undefined;
      }),
    );
    sourceKinds.delete(undefined);
    return { feature, sourceKinds: [...sourceKinds] };
  })
  .filter(({ sourceKinds }) => sourceKinds.length > 1)
  .map(({ feature, sourceKinds }) => {
    addTags(feature, 'gourock-linked-source-reviewed');
    feature.reviewed = true;
    feature.updatedAt = reviewedAt;
    appendReviewNote(
      feature,
      'Duplicate audit: linked NRHE, HES or OSM source records have been retained on this canonical feature; no separate duplicate pin is published.',
    );
    return {
      featureId: feature.id,
      name: feature.name,
      linkedSourceKinds: sourceKinds.sort(),
      sourceRecordIds: feature.sourceRecords
        .map((source) => source.sourceRecordId)
        .filter((sourceRecordId): sourceRecordId is string => Boolean(sourceRecordId)),
      decision: 'Retain linked sources on the canonical published feature.',
    };
  });

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((result) => result.severity === 'error');
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
        'Completed Gourock non-map curation. Explicit HES/NRHE period evidence was normalised conservatively; period-unknown, period-unassigned, general-view and conservation-area records were marked reviewed without inventing dates.',
      dated,
      reviewedNoDate,
      currentPlaceReview: {
        reviewed: currentPlaceEntries.length,
        categoryCounts,
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
await writeFile(`${currentPlaceCurationPath}`, `${JSON.stringify(currentPlaceEntries, null, 2)}\n`);
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
  `Completed Gourock non-map work: ${dated.length} date review(s), ${reviewedNoDate.length} reviewed-without-date record(s), ${currentPlaceEntries.length} current place(s), ${linkedSourceAudit.length} linked-source audit record(s).`,
);
