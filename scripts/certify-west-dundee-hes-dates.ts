import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-09-02T18:00:00.000Z';
const stems = [
  'coldstream-tealing', 'bonnyton-auchterhouse', 'kirkton-of-auchterhouse', 'leoch-auchterhouse',
  'bridgefoot-angus', 'downfield-dundee', 'birkhill-angus', 'muirhead-angus', 'dronley-angus',
  'fowlis-easter', 'liff', 'denhead-of-gray', 'benvie', 'longforgan', 'castle-huntly',
  'invergowrie', 'kingoodie', 'woodhaven-fife', 'muir-of-pert-tealing',
];

interface CachedDescription { url: string; description: string; fetchedAt: string }
const listed = JSON.parse(await readFile(resolve('data/reference/scotland-hes/hes-listed-building-descriptions.json'), 'utf8')) as Record<string, CachedDescription>;
const scheduled = JSON.parse(await readFile(resolve('data/reference/scotland-hes/hes-scheduled-monument-descriptions.json'), 'utf8')) as Record<string, CachedDescription>;

const isHes = (feature: HeritageFeature) => feature.tags.some((tag) =>
  ['hes-listed-building', 'hes-scheduled-monument', 'hes-nrhe', 'nrhe'].includes(tag));
const hasCompleteDate = (feature: HeritageFeature) => Boolean(
  feature.documentedDateText?.trim() &&
  feature.earliestPossibleYear != null &&
  feature.latestPossibleYear != null &&
  feature.dateBasis !== 'unknown',
);
const sourceReference = (feature: HeritageFeature, prefix: 'LB' | 'SM') =>
  feature.sourceRecords.find((record) => new RegExp(`^${prefix}\\d+$`, 'i').test(record.sourceRecordId ?? ''))?.sourceRecordId?.toUpperCase()
  ?? feature.id.match(new RegExp(`${prefix}\\d+`, 'i'))?.[0].toUpperCase();

function evidence(feature: HeritageFeature): { text: string; url?: string; reference?: string; sourceName: string } {
  const lb = sourceReference(feature, 'LB');
  if (lb && listed[lb]) return { text: listed[lb].description, url: listed[lb].url, reference: lb, sourceName: 'HES Listed Building description cache' };
  const sm = sourceReference(feature, 'SM');
  if (sm && scheduled[sm]) return { text: scheduled[sm].description, url: scheduled[sm].url, reference: sm, sourceName: 'HES Scheduled Monument description cache' };
  const text = [feature.shortDescription, feature.fullDescription, feature.name, ...feature.sourceRecords.map((record) => record.notes)].filter(Boolean).join('. ');
  return { text, url: feature.sourceRecords.find((record) => record.sourceUrl)?.sourceUrl, reference: feature.sourceRecords.find((record) => record.sourceRecordId)?.sourceRecordId, sourceName: 'HES NRHE local record classification' };
}

function applyDate(feature: HeritageFeature, result: ReturnType<typeof extractHistoricEnglandDate>, item: ReturnType<typeof evidence>): void {
  if (!result) return;
  const dateSource: SourceRecord = {
    sourceName: item.sourceName, sourceOrganisation: 'Historic Environment Scotland', sourceRecordId: item.reference, sourceUrl: item.url,
    accessedAt: reviewedAt, quotedDateText: result.evidenceText,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    reliability: feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('hes-listed-building') ? 'official_statutory' : 'official_non_statutory',
    notes: 'Material historic date normalised from the local HES description/classification. Administrative designation dates are excluded.',
  };
  feature.documentedDateText = result.evidenceText;
  feature.earliestPossibleYear = result.earliestPossibleYear;
  feature.latestPossibleYear = result.latestPossibleYear;
  feature.datePrecision = result.datePrecision;
  feature.dateBasis = result.dateBasis;
  feature.dateConfidence = result.dateConfidence;
  feature.sourceRecords = [...feature.sourceRecords.filter((record) => record.sourceName !== item.sourceName), dateSource];
  const canMap = feature.evidenceScope !== 'related_context' && !feature.tags.includes('town-selection-heritage-buffer');
  feature.tags = [...new Set([
    ...feature.tags.filter((tag) => canMap ? tag !== 'map-hidden' : true),
    'hes-date-reviewed', 'date-reviewed',
  ])];
  feature.updatedAt = reviewedAt;
  feature.reviewed = true;
}

const projects: Array<Record<string, unknown>> = [];
for (const stem of stems) {
  const path = resolve(`data/projects/${stem}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  const features = pkg.features.filter(isHes);
  let enriched = 0;
  let retainedExisting = 0;
  for (const feature of features) {
    if (hasCompleteDate(feature)) {
      retainedExisting += 1;
      feature.tags = [...new Set([...feature.tags, 'hes-date-reviewed', 'date-reviewed'])];
    } else {
      const item = evidence(feature);
      const result = extractHistoricEnglandDate(item.text);
      if (result) { applyDate(feature, result, item); enriched += 1; }
    }
    if (!hasCompleteDate(feature)) feature.tags = [...new Set([...feature.tags, 'heritage-record-retained', 'map-hidden'])];
    if (feature.evidenceScope === 'related_context' || feature.tags.includes('town-selection-heritage-buffer'))
      feature.tags = [...new Set([...feature.tags, 'map-hidden'])];
  }
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${stem}: ${errors.map((item) => item.message).join('; ')}`);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  const inside = features.filter((feature) => feature.evidenceScope !== 'related_context' && !feature.tags.includes('town-selection-heritage-buffer'));
  const visible = inside.filter((feature) => !feature.tags.includes('map-hidden'));
  projects.push({
    projectId: pkg.project.id, totalHesAndNrhe: features.length, insideBoundary: inside.length,
    listedBuildings: features.filter((feature) => feature.tags.includes('hes-listed-building')).length,
    scheduledMonuments: features.filter((feature) => feature.tags.includes('hes-scheduled-monument')).length,
    nrhe: features.filter((feature) => feature.tags.includes('nrhe') || feature.tags.includes('hes-nrhe')).length,
    enriched, retainedExisting, datedInside: inside.filter(hasCompleteDate).length,
    undatedInsideRetainedHidden: inside.filter((feature) => !hasCompleteDate(feature) && feature.tags.includes('map-hidden')).length,
    visibleHeritagePins: visible.length, visiblePinsWithoutDates: visible.filter((feature) => !hasCompleteDate(feature)).length,
    visiblePinNamesContainingAppendedDate: visible.filter((feature) => /\s[—–-]\s(?:c\.?\s*)?(?:\d{3,4}|\d{1,2}(?:st|nd|rd|th) century)$/i.test(feature.name)).length,
  });
}

await writeFile(resolve('data/review/west-dundee-localities-hes-date-certification-2026-09-02.json'), `${JSON.stringify({
  reviewedAt, sourceMode: 'local HES Listed Buildings, Scheduled Monuments and NRHE datasets with locally cached official descriptions',
  rule: 'All HES/NRHE records remain intact. Only records with defensible material dates are map-visible. Dates are data fields, never appended to map labels.',
  projects,
  totals: {
    records: projects.reduce((sum, item) => sum + Number(item.totalHesAndNrhe), 0),
    visiblePins: projects.reduce((sum, item) => sum + Number(item.visibleHeritagePins), 0),
    visiblePinsWithoutDates: projects.reduce((sum, item) => sum + Number(item.visiblePinsWithoutDates), 0),
    visiblePinNamesContainingAppendedDate: projects.reduce((sum, item) => sum + Number(item.visiblePinNamesContainingAppendedDate), 0),
  },
}, null, 2)}\n`, 'utf8');

console.log(`Certified HES dates for ${stems.length} projects.`);
