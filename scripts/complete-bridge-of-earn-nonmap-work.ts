import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/bridge-of-earn.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/bridge-of-earn-completion-review.json');
const curationPath = resolve('data/curation/bridge-of-earn-current-place-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const reviewedAt = new Date().toISOString();
const reviewedDate = reviewedAt.slice(0, 10);

interface ManualDate {
  id: string;
  documentedDateText: string;
  earliestPossibleYear?: number;
  latestPossibleYear?: number;
  datePrecision: string;
  dateBasis: HeritageFeature['dateBasis'];
  dateConfidence: HeritageFeature['dateConfidence'];
  source: SourceRecord;
}

const manualDates: ManualDate[] = [
  {
    id: 'hes-listed-building:LB4527',
    documentedDateText: 'Designed by Francis Grant after 1793',
    earliestPossibleYear: 1793,
    datePrecision: 'HES description terminus post quem',
    dateBasis: 'estimated_from_authoritative_source',
    dateConfidence: 'medium',
    source: {
      sourceName: 'Historic Environment Scotland listing description manual fallback',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'LB4527',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/LB4527',
      accessedAt: reviewedAt,
      licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
      reliability: 'official_statutory',
      notes:
        'HES describes Kilgraston House as designed by Francis Grant after 1793; this is used as a conservative earliest possible date.',
    },
  },
  {
    id: 'hes-scheduled-monument:SM9468',
    documentedDateText:
      'Medieval bridge; construction grant mentioned in 1329 and bridge ruinous by 1592',
    earliestPossibleYear: 1329,
    latestPossibleYear: 1592,
    datePrecision: 'HES scheduled-monument documentary range',
    dateBasis: 'documented_date_range',
    dateConfidence: 'high',
    source: {
      sourceName: 'Historic Environment Scotland scheduled monument description',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM9468',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM9468',
      accessedAt: reviewedAt,
      licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution.',
      reliability: 'official_statutory',
      notes:
        'HES describes the remains as the medieval Old Bridge of Earn, with documentary mentions from 1329 and a ruinous-state reference in 1592.',
    },
  },
];

const namedCurrentContext: Record<string, string> = {
  'osm-park:way-137101366':
    'Victory Park is the main mapped public open-space/recreation context in Bridge of Earn.',
  'osm-community:node-3301456255':
    'The Earn Coffee Shop is a current village cafe useful as local service context.',
  'osm-community:node-3301519291':
    'The War Memorial is a present-day commemorative landmark in the village centre context.',
  'osm-community:node-3886480375':
    'The Village Inn and Restaurant is current food and hospitality context, not historic-date evidence.',
  'osm-community:node-4460996150':
    'Spice Garden is current food/takeaway context on Main Street.',
  'osm-community:node-4460996154':
    'Tower Bakery is current local food/service context for the village.',
};

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function removeTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = feature.tags.filter((tag) => !tags.includes(tag));
}

function mergeSourceRecords(existing: SourceRecord[], incoming: SourceRecord): SourceRecord[] {
  return [
    ...existing.filter(
      (source) =>
        !(
          source.sourceOrganisation === incoming.sourceOrganisation &&
          source.sourceRecordId === incoming.sourceRecordId &&
          source.sourceName === incoming.sourceName
        ),
    ),
    incoming,
  ];
}

const dateReviews = [];
for (const entry of manualDates) {
  const feature = pkg.features.find((candidate) => candidate.id === entry.id);
  if (!feature) throw new Error(`Missing Bridge of Earn manual date target ${entry.id}.`);
  Object.assign(feature, {
    documentedDateText: entry.documentedDateText,
    earliestPossibleYear: entry.earliestPossibleYear,
    latestPossibleYear: entry.latestPossibleYear,
    datePrecision: entry.datePrecision,
    dateBasis: entry.dateBasis,
    dateConfidence: entry.dateConfidence,
    sourceRecords: mergeSourceRecords(feature.sourceRecords, entry.source),
    reviewed: true,
    updatedAt: reviewedAt,
  });
  addTags(feature, 'date-reviewed', 'curation-date-enriched', 'bridge-of-earn-nonmap-date-reviewed');
  removeTags(feature, 'reviewed-no-defensible-date');
  feature.reviewNotes =
    `${feature.reviewNotes ?? ''} Bridge of Earn manual non-map review applied source-backed date on ${reviewedDate}.`.trim();
  dateReviews.push({
    id: feature.id,
    name: feature.name,
    date: entry.documentedDateText,
    range: [entry.earliestPossibleYear, entry.latestPossibleYear],
  });
}

const reviewedWithoutDate = [];
for (const feature of pkg.features) {
  if (
    !feature.id.startsWith('nrhe:') ||
    feature.earliestPossibleYear !== undefined ||
    feature.latestPossibleYear !== undefined ||
    feature.documentedDateText
  ) {
    continue;
  }
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  addTags(feature, 'date-reviewed', 'reviewed-no-defensible-date', 'bridge-of-earn-date-reviewed-no-date');
  feature.reviewNotes =
    `${feature.reviewNotes ?? ''} Bridge of Earn NRHE manual pass found no defensible published date in the available official classification/source wording; retained as undated evidence rather than guessing.`.trim();
  reviewedWithoutDate.push({
    id: feature.id,
    name: feature.name,
    classification: feature.shortDescription,
    sourceUrl: feature.sourceRecords.find((source) => source.sourceUrl)?.sourceUrl,
  });
}

const currentPlaces = [];
const currentParks = [];
for (const feature of pkg.features) {
  if (feature.tags.includes('osm-community-place') || feature.tags.includes('osm-current-park')) {
    feature.reviewed = true;
    feature.updatedAt = reviewedAt;
    addTags(feature, 'bridge-of-earn-current-context-reviewed');
    feature.shortDescription =
      namedCurrentContext[feature.id] ??
      (feature.tags.includes('osm-community-parking')
        ? 'Current mapped parking context in Bridge of Earn; useful locally but not historic-date evidence.'
        : feature.tags.includes('osm-community-leisure')
          ? 'Current mapped playground/leisure context in Bridge of Earn; useful locally but not historic-date evidence.'
          : feature.shortDescription);
    feature.reviewNotes =
      `${feature.reviewNotes ?? ''} Bridge of Earn current-place/service context reviewed on ${reviewedDate}.`.trim();
    const summary = {
      id: feature.id,
      name: feature.name,
      tags: feature.tags,
      summary: feature.shortDescription,
    };
    if (feature.tags.includes('osm-current-park')) currentParks.push(summary);
    else currentPlaces.push(summary);
  }
}

pkg.validation = validateFeatures(pkg.project, pkg.features);
const errors = pkg.validation.filter((item) => item.severity === 'error');
if (errors.length) throw new Error(`Refusing to write ${errors.length} validation error(s).`);

await mkdir(dirname(reviewPath), { recursive: true });
await mkdir(dirname(curationPath), { recursive: true });
await writeFile(
  reviewPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      policy:
        'Completed non-map Bridge of Earn pass: manual HES dates where defensible, NRHE records retained undated where official wording is period-unassigned/event-only, and current OSM service context reviewed separately from historic evidence.',
      dateReviews,
      reviewedWithoutDate,
      currentPlaces: currentPlaces.length,
      currentParks: currentParks.length,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(
  curationPath,
  `${JSON.stringify(
    {
      projectId: pkg.project.id,
      reviewedAt,
      currentPlaces,
      currentParks,
    },
    null,
    2,
  )}\n`,
  'utf8',
);
await writeFile(projectPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(
  `Completed Bridge of Earn non-map work: ${dateReviews.length} date review(s), ${reviewedWithoutDate.length} reviewed-without-date, ${currentPlaces.length} current place(s), ${currentParks.length} current park(s).`,
);
