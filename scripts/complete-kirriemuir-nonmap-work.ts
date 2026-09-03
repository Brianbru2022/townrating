import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Confidence, HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { hasHistoricTimelineDate } from '../src/domain/timeline';
import { validateFeatures } from '../src/domain/validation';

const projectPath = resolve(process.argv[2] ?? 'data/projects/kirriemuir.json');
const reviewPath = resolve(process.argv[3] ?? 'data/review/kirriemuir-completion-review.json');
const curationPath = resolve('data/curation/kirriemuir-current-place-curation.json');
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
    'hes-scheduled-monument:SM125',
    {
      text: 'Standing stone of prehistoric date',
      earliest: -12000,
      latest: 42,
      precision: 'HES scheduled-monument broad prehistoric period',
      confidence: 'low',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM125',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM125',
      reliability: 'official_statutory',
      notes:
        'HES identifies the monument as the Hill of Kirriemuir standing stone; the broad prehistoric range is used conservatively.',
    },
  ],
  [
    'hes-scheduled-monument:SM143',
    {
      text: 'Roman road',
      earliest: 43,
      latest: 410,
      precision: 'HES scheduled-monument Roman-period classification',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland scheduled monument designation',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: 'SM143',
      sourceUrl: 'https://portal.historicenvironment.scot/designation/SM143',
      reliability: 'official_statutory',
      notes:
        'HES identifies the monument as the Roman road at Caddam Wood. The broad Roman Britain period is used rather than a construction year.',
    },
  ],
  [
    'nrhe:32315',
    {
      text: 'NRHE classification period: SOUTERRAIN (PREHISTORIC)',
      earliest: -12000,
      latest: 42,
      precision: 'NRHE classification broad prehistoric period',
      confidence: 'low',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '32315',
      sourceUrl: 'https://www.trove.scot/place/32315',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification. This is broad period evidence for the souterrain, not a precise construction date.',
    },
  ],
  [
    'nrhe:32179',
    {
      text: 'NRHE classification period: STONE CIRCLE (NEOLITHIC) - (BRONZE AGE)',
      earliest: -4100,
      latest: -800,
      precision: 'NRHE classification Neolithic to Bronze Age period',
      confidence: 'low',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '32179',
      sourceUrl: 'https://www.trove.scot/place/32179',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification. The range covers broad Scottish Neolithic to Bronze Age periods.',
    },
  ],
  [
    'nrhe:77465',
    {
      text: 'NRHE classification period: BURGH (MEDIEVAL), TOWN (MEDIEVAL) - (POST MEDIEVAL)',
      earliest: 1100,
      latest: 1899,
      precision: 'NRHE classification medieval to post-medieval town period',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '77465',
      sourceUrl: 'https://www.trove.scot/place/77465',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification for Kirriemuir burgh/town evidence; it is not a single foundation-year assertion.',
    },
  ],
  [
    'nrhe:77466',
    {
      text: 'NRHE classification period: WELL (POST MEDIEVAL)',
      earliest: 1600,
      latest: 1899,
      precision: 'NRHE classification post-medieval period',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '77466',
      sourceUrl: 'https://www.trove.scot/place/77466',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification. This dates the classified well only to a broad post-medieval period.',
    },
  ],
  [
    'nrhe:195148',
    {
      text: 'NRHE classification period: MANSE (18TH CENTURY) (1787)',
      earliest: 1787,
      latest: 1787,
      precision: 'NRHE classification explicit year',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '195148',
      sourceUrl: 'https://www.trove.scot/place/195148',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification year for the manse record.',
    },
  ],
  [
    'nrhe:222558',
    {
      text: 'NRHE classification period: HOTEL (19TH CENTURY)',
      earliest: 1800,
      latest: 1899,
      precision: 'NRHE classification century period',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '222558',
      sourceUrl: 'https://www.trove.scot/place/222558',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification. This is broad period evidence for the hotel record.',
    },
  ],
  [
    'nrhe:266213',
    {
      text: 'NRHE classification period: HOTEL (19TH CENTURY)',
      earliest: 1800,
      latest: 1899,
      precision: 'NRHE classification century period',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '266213',
      sourceUrl: 'https://www.trove.scot/place/266213',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification. This is broad period evidence for the hotel record.',
    },
  ],
  [
    'nrhe:289504',
    {
      text: 'NRHE classification period: POLICE STATION (19TH CENTURY) - (20TH CENTURY)',
      earliest: 1800,
      latest: 1999,
      precision: 'NRHE classification broad 19th- to 20th-century period',
      confidence: 'medium',
      sourceName: 'Historic Environment Scotland NRHE period classification',
      sourceOrganisation: 'Historic Environment Scotland',
      sourceRecordId: '289504',
      sourceUrl: 'https://www.trove.scot/place/289504',
      reliability: 'official_non_statutory',
      notes:
        'Normalised from the official NRHE classification. The broad range retains the classification uncertainty.',
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
  addTags(feature, 'date-reviewed', 'curation-date-enriched', 'kirriemuir-nonmap-date-reviewed');
  removeTags(feature, 'reviewed-no-defensible-date');
  appendReviewNote(
    feature,
    `Kirriemuir completion review: source-backed date evidence applied on ${reviewedDate}.`,
  );
}

function markNoDate(feature: HeritageFeature, note: string): void {
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  addTags(feature, 'date-reviewed', 'reviewed-no-defensible-date', 'kirriemuir-date-reviewed-no-date');
  appendReviewNote(feature, note);
}

function currentCategory(feature: HeritageFeature): string {
  if (feature.tags.includes('osm-current-park')) return 'park';
  return (
    feature.tags
      .find((tag) => tag.startsWith('osm-community-') && tag !== 'osm-community-place')
      ?.replace('osm-community-', '') ?? feature.featureType
  );
}

function currentLabel(feature: HeritageFeature): string {
  const labels: Record<string, string> = {
    food: 'food and drink place',
    historic: 'historic place',
    leisure: 'leisure place',
    memorial: 'memorial or plaque',
    park: 'park or recreation ground',
    parking: 'parking place',
    picnic: 'picnic or rest facility',
    visitor: 'visitor information place',
    amenities: 'amenity',
    art: 'art or culture place',
    nature: 'natural sight',
  };
  return labels[currentCategory(feature)] ?? currentCategory(feature).replaceAll('_', ' ');
}

function currentSummary(feature: HeritageFeature): string {
  const important: Record<string, string> = {
    'Gateway to the Glens Museum':
      'Gateway to the Glens Museum is a key visitor stop for Kirriemuir town history and glens context.',
    "J M Barrie's Birthplace":
      "J M Barrie's Birthplace is Kirriemuir's strongest literary visitor attraction and Peter Pan context.",
    'Kirriemuir Camera Obscura':
      'Kirriemuir Camera Obscura is a distinctive hilltop visitor attraction associated with J M Barrie.',
    'Peter Pan Statue':
      'Peter Pan Statue is a central Kirriemuir visitor landmark connected with J M Barrie.',
    'Bon Scott Statue':
      'Bon Scott Statue is a music-tourism landmark for visitors following the AC/DC connection.',
    'Tayside Police Museum':
      'Tayside Police Museum is a small specialist museum and visitor stop in Kirriemuir.',
    'Public toilets': 'Current public toilets in Kirriemuir recorded by OpenStreetMap.',
  };
  if (important[feature.name]) return important[feature.name];
  const generic = new Set(['Bench', 'Parking', 'Picnic Site', 'Playground', 'Guidepost']);
  if (generic.has(feature.name))
    return `Current ${currentLabel(feature)} in Kirriemuir recorded by OpenStreetMap.`;
  if (feature.tags.includes('osm-current-park'))
    return `${feature.name} is current mapped open-space/recreation context in Kirriemuir.`;
  return `${feature.name} is a current ${currentLabel(feature)} in Kirriemuir recorded by OpenStreetMap.`;
}

function serviceTags(feature: HeritageFeature): string[] {
  const tags = ['kirriemuir-service-reviewed'];
  const category = currentCategory(feature);
  if (category === 'food') tags.push('service-context-food');
  if (category === 'amenities' || /toilet/i.test(feature.name)) tags.push('service-context-toilets');
  if (category === 'parking') tags.push('service-context-parking');
  if (category === 'visitor') tags.push('service-context-visitor');
  if (category === 'art') tags.push('service-context-heritage');
  if (category === 'historic') tags.push('service-context-heritage');
  if (category === 'memorial') tags.push('service-context-memorial');
  if (category === 'leisure') tags.push('service-context-leisure');
  if (category === 'picnic') tags.push('service-context-picnic');
  if (feature.tags.includes('osm-current-park')) tags.push('service-context-park');
  return tags;
}

pkg.project.touristAppeal = {
  rating: 2,
  label: 'Worth a detour',
  summary:
    "Kirriemuir has solid visitor appeal as J M Barrie's birthplace and the Gateway to the Glens, with the Camera Obscura, Peter Pan and Bon Scott landmarks, local museums, viewpoints, food, parking and toilets supporting a worthwhile short visit.",
};

const dated: Array<{ id: string; name: string; date: string; range: [number | undefined, number | undefined] }> = [];
const reviewedWithoutDate: Array<{ id: string; name: string; reason: string }> = [];

for (const feature of pkg.features) {
  const evidence = manualEvidence.get(feature.id);
  if (!evidence) continue;
  applyDate(feature, evidence);
  dated.push({
    id: feature.id,
    name: feature.name,
    date: evidence.text,
    range: [evidence.earliest, evidence.latest],
  });
}

for (const feature of pkg.features) {
  if (
    (feature.tags.includes('hes-listed-building') ||
      feature.id.startsWith('hes-scheduled-monument:') ||
      feature.id.startsWith('hes-conservation-area:') ||
      feature.id.startsWith('nrhe:')) &&
    feature.evidenceScope !== 'out_of_scope' &&
    feature.evidenceScope !== 'related_context' &&
    !hasHistoricTimelineDate(feature)
  ) {
    markNoDate(
      feature,
      `Kirriemuir source review: official HES/NRHE wording checked on ${reviewedDate}; no defensible construction/use date was published, so the record is retained as undated evidence.`,
    );
    reviewedWithoutDate.push({
      id: feature.id,
      name: feature.name,
      reason: 'Official source wording lacks defensible date evidence.',
    });
  }
}

const currentPlaces = [];
const currentParks = [];
for (const feature of pkg.features) {
  if (!feature.tags.includes('osm-community-place') && !feature.tags.includes('osm-current-park')) continue;
  feature.reviewed = true;
  feature.updatedAt = reviewedAt;
  feature.shortDescription = currentSummary(feature);
  addTags(feature, 'current-context', ...serviceTags(feature));
  appendReviewNote(
    feature,
    `Kirriemuir current-place/service context reviewed on ${reviewedDate}; retained as present-day visitor context, not historic-date evidence.`,
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
        'Completed non-map Kirriemuir pass: added conservative source-backed dates, marked checked official records with no defensible date, reviewed current OpenStreetMap visitor context, and assigned tourist appeal.',
      touristAppeal: pkg.project.touristAppeal,
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
  `Completed Kirriemuir non-map work: ${dated.length} date review(s), ${reviewedWithoutDate.length} reviewed-without-date, ${currentPlaces.length} current place(s), ${currentParks.length} current park(s).`,
);
