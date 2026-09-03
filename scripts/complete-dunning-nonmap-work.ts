import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Confidence, HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { hasEstablishedDate } from '../src/domain/timeline';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/dunning.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/dunning-completion-review.json');
const curationPath = resolve('data/curation/dunning-current-place-curation.json');
const pkg = JSON.parse(await readFile(projectPath, 'utf8')) as ProjectPackage;
const reviewedAt = new Date().toISOString();
const reviewedDate = reviewedAt.slice(0, 10);

interface DateEvidence {
  text: string;
  earliest?: number;
  latest?: number;
  precision: string;
  confidence: Confidence;
  sourceName: string;
  sourceOrganisation: string;
  sourceRecordId: string;
  sourceUrl: string;
  reliability: SourceRecord['reliability'];
  notes: string;
}

function addTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = [...new Set([...feature.tags, ...tags])];
}

function removeTags(feature: HeritageFeature, ...tags: string[]): void {
  feature.tags = feature.tags.filter((tag) => !tags.includes(tag));
}

function appendReviewNote(feature: HeritageFeature, note: string): void {
  if (feature.reviewNotes?.includes(note)) return;
  feature.reviewNotes = `${feature.reviewNotes ? `${feature.reviewNotes} ` : ''}${note}`.trim();
}

function sourceFor(evidence: DateEvidence): SourceRecord {
  return {
    sourceName: evidence.sourceName,
    sourceOrganisation: evidence.sourceOrganisation,
    sourceRecordId: evidence.sourceRecordId,
    sourceUrl: evidence.sourceUrl,
    accessedAt: reviewedAt,
    licence: 'Open Government Licence v3.0; retain source attribution.',
    reliability: evidence.reliability,
    quotedDateText: evidence.text,
    notes: evidence.notes,
  };
}

const manualEvidence = new Map<string, DateEvidence>([
  [
    'hes-listed-building:LB5943',
    {
      text: 'Former lodge of Old Bank House; early 19th century',
      earliest: 1800,
      latest: 1839,
      precision: 'HES listed-building description broad period',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland listing description manual fallback',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'LB5943',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/LB5943',
      reliability: 'official_statutory',
      notes:
        'HES describes the former lodge as early 19th century; the 1971 designation date is not used as date evidence.',
    },
  ],
  [
    'hes-listed-building:LB6022',
    {
      text: 'Later shop block dated c. 1850/60',
      earliest: 1850,
      latest: 1860,
      precision: 'HES listed-building component date',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland listing description manual fallback',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'LB6022',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/LB6022',
      reliability: 'official_statutory',
      notes:
        'HES dates the higher shop block component to c. 1850/60; the re-categorisation date is ignored.',
    },
  ],
  [
    'hes-scheduled-monument:SM6884',
    {
      text: 'Standing stone of prehistoric date',
      earliest: -12000,
      latest: 42,
      precision: 'HES scheduled-monument broad prehistoric period',
      confidence: 'low',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM6884',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM6884',
      reliability: 'official_statutory',
      notes:
        'HES describes the monument as a standing stone of prehistoric date. This is broad period evidence, not a precise erection date.',
    },
  ],
  [
    'hes-scheduled-monument:SM3675',
    {
      text: 'Roman temporary camp, likely used during one or more first- or second-century AD campaigns',
      earliest: 1,
      latest: 199,
      precision: 'HES scheduled-monument Roman campaign period',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM3675',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM3675',
      reliability: 'official_statutory',
      notes:
        'HES states that the Roman temporary camp was likely in use during one or more military campaigns in the first or second centuries AD.',
    },
  ],
  [
    'hes-scheduled-monument:SM9434',
    {
      text: 'Fort of probable later prehistoric date',
      earliest: -800,
      latest: 400,
      precision: 'HES scheduled-monument broad later-prehistoric period',
      confidence: 'low',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM9434',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM9434',
      reliability: 'official_statutory',
      notes:
        'HES identifies Dun Knock as a fort in the prehistoric domestic and defensive class; the broad later-prehistoric range is used conservatively.',
    },
  ],
  [
    'hes-scheduled-monument:SM90321',
    {
      text: "Early medieval ecclesiastical site below the 12th-century St Serf's Church",
      earliest: 400,
      latest: 1199,
      precision: 'HES scheduled-monument pre-12th-century and early-medieval evidence',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM90321',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM90321',
      reliability: 'official_statutory',
      notes:
        'HES describes buried remains of an early medieval ecclesiastical site beneath the 12th-century church, with pre-12th-century structures and burials.',
    },
  ],
  [
    'hes-property-in-care:pic066',
    {
      text: 'Dupplin Cross, early 9th century',
      earliest: 800,
      latest: 839,
      precision: 'HES property-in-care visitor description broad early-century date',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland visitor information',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'PIC066',
      sourceUrl: 'https://www.historicenvironment.scot/visit/all/st-serfs-church-and-dupplin-cross/',
      reliability: 'official_non_statutory',
      notes:
        'HES visitor information describes the Dupplin Cross as a Pictish carving of the early 9th century.',
    },
  ],
  [
    'nrhe:26713',
    {
      text: 'NRHE classification period: BATTLE SITE (10TH CENTURY)',
      earliest: 900,
      latest: 999,
      precision: 'NRHE classification century period',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '26713',
      sourceUrl: 'https://www.trove.scot/place/26713',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification. This is broad battle-site period evidence, not a precise event date.',
    },
  ],
  [
    'nrhe:26715',
    {
      text: 'NRHE classification period: STANDING STONE (PREHISTORIC)',
      earliest: -12000,
      latest: 42,
      precision: 'NRHE classification broad prehistoric period',
      confidence: 'low',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '26715',
      sourceUrl: 'https://www.trove.scot/place/26715',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification. This is broad period evidence for the standing stone, not a precise erection date.',
    },
  ],
]);

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
  addTags(feature, 'date-reviewed', 'curation-date-enriched', 'dunning-nonmap-date-reviewed');
  removeTags(feature, 'reviewed-no-defensible-date');
  appendReviewNote(
    feature,
    `Dunning completion review: source-backed date evidence applied on ${reviewedDate}.`,
  );
}

function markNoDate(feature: HeritageFeature, note: string): void {
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  addTags(feature, 'date-reviewed', 'reviewed-no-defensible-date', 'dunning-date-reviewed-no-date');
  appendReviewNote(feature, note);
}

function currentLabel(feature: HeritageFeature): string {
  const category =
    feature.tags
      .find((tag) => tag.startsWith('osm-community-') && tag !== 'osm-community-place')
      ?.replace('osm-community-', '') ?? (feature.tags.includes('osm-current-park') ? 'park' : feature.featureType);
  const labels: Record<string, string> = {
    food: 'food and drink place',
    historic: 'historic place',
    leisure: 'leisure place',
    memorial: 'memorial or plaque',
    park: 'park or recreation ground',
    parking: 'parking place',
    picnic: 'picnic or rest facility',
    visitor: 'visitor information place',
  };
  return labels[category] ?? category.replaceAll('_', ' ');
}

function currentSummary(feature: HeritageFeature): string {
  const label = currentLabel(feature);
  if (feature.tags.includes('osm-current-park')) {
    return `${feature.name} is current mapped open-space/recreation context in Dunning.`;
  }
  if (feature.name === 'Bench' || feature.name === 'Parking' || feature.name === 'Playground') {
    return `Current ${label} in Dunning recorded by OpenStreetMap.`;
  }
  return `${feature.name} is a current ${label} in Dunning recorded by OpenStreetMap.`;
}

const dated: Array<{ id: string; name: string; date: string; range: [number | undefined, number | undefined] }> = [];
const reviewedWithoutDate: Array<{ id: string; name: string; reason: string }> = [];

for (const feature of pkg.features) {
  const evidence = manualEvidence.get(feature.id);
  if (evidence) {
    applyDate(feature, evidence);
    dated.push({
      id: feature.id,
      name: feature.name,
      date: evidence.text,
      range: [evidence.earliest, evidence.latest],
    });
  }
}

for (const feature of pkg.features) {
  if (!feature.id.startsWith('hes-listed-building:') || hasEstablishedDate(feature)) continue;
  markNoDate(
    feature,
    `Dunning listed-building review: HES listing description checked on ${reviewedDate}; no defensible construction/use date was published, and designation/re-categorisation dates were not used as age evidence.`,
  );
  reviewedWithoutDate.push({
    id: feature.id,
    name: feature.name,
    reason: 'HES listed-building description lacks a defensible construction/use date.',
  });
}

for (const feature of pkg.features) {
  if (
    !feature.id.startsWith('nrhe:') ||
    hasEstablishedDate(feature) ||
    manualEvidence.has(feature.id)
  ) {
    continue;
  }
  markNoDate(
    feature,
    `Dunning NRHE review: official classification/source wording checked on ${reviewedDate}; no defensible historic-period date was published, so the record is retained as undated evidence.`,
  );
  reviewedWithoutDate.push({
    id: feature.id,
    name: feature.name,
    reason: 'NRHE classification/source wording remains period-unassigned or event-only without defensible date evidence.',
  });
}

const conservationArea = pkg.features.find((feature) => feature.id === 'hes-conservation-area:CA584');
if (conservationArea && !hasEstablishedDate(conservationArea)) {
  markNoDate(
    conservationArea,
    `Dunning conservation-area review: designation is useful settlement context but does not publish a construction date for the area as a historic feature.`,
  );
  reviewedWithoutDate.push({
    id: conservationArea.id,
    name: conservationArea.name,
    reason: 'Conservation-area designation does not establish a construction date.',
  });
}

const currentPlaces = [];
const currentParks = [];
for (const feature of pkg.features) {
  if (feature.tags.includes('osm-community-place') || feature.tags.includes('osm-current-park')) {
    feature.reviewed = true;
    feature.updatedAt = reviewedAt;
    feature.shortDescription = currentSummary(feature);
    addTags(feature, 'dunning-current-context-reviewed');
    appendReviewNote(
      feature,
      `Dunning current-place/service context reviewed on ${reviewedDate}; retained as present-day visitor context, not historic-date evidence.`,
    );
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
        'Completed non-map Dunning pass: added source-backed dates where HES/NRHE wording supports them, marked checked records with no defensible date, and reviewed current OpenStreetMap service context separately from historic evidence.',
      dated,
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
  `Completed Dunning non-map work: ${dated.length} date review(s), ${reviewedWithoutDate.length} reviewed-without-date, ${currentPlaces.length} current place(s), ${currentParks.length} current park(s).`,
);
