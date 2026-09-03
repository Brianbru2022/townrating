import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import { validateFeatures } from '../src/domain/validation';

const reviewedAt = '2026-09-02T23:35:00.000Z';
const stems = ['scotscraig', 'tayport', 'rhynd-fife', 'carrick-leuchars', 'leuchars', 'guardbridge'];

interface CachedDescription { url: string; description: string; fetchedAt: string }
const listed = JSON.parse(await readFile(resolve('data/reference/scotland-hes/hes-listed-building-descriptions.json'), 'utf8')) as Record<string, CachedDescription>;
const scheduled = JSON.parse(await readFile(resolve('data/reference/scotland-hes/hes-scheduled-monument-descriptions.json'), 'utf8')) as Record<string, CachedDescription>;

const isHeritage = (feature: HeritageFeature) => feature.tags.some((tag) => (tag.startsWith('hes-') && tag !== 'hes-date-reviewed') || tag === 'nrhe');
const hasDate = (feature: HeritageFeature) => Boolean(feature.documentedDateText?.trim() && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown');
const reference = (feature: HeritageFeature, prefix: 'LB' | 'SM') => feature.sourceRecords.find((record) => new RegExp(`^${prefix}\\d+$`, 'i').test(record.sourceRecordId ?? ''))?.sourceRecordId?.toUpperCase() ?? feature.id.match(new RegExp(`${prefix}\\d+`, 'i'))?.[0].toUpperCase();

function evidence(feature: HeritageFeature) {
  const lb = reference(feature, 'LB');
  if (lb && listed[lb]) return { text: listed[lb].description, url: listed[lb].url, reference: lb, sourceName: 'HES Listed Building description cache', reliability: 'official_statutory' as const };
  const sm = reference(feature, 'SM');
  if (sm && scheduled[sm]) return { text: scheduled[sm].description, url: scheduled[sm].url, reference: sm, sourceName: 'HES Scheduled Monument description cache', reliability: 'official_statutory' as const };
  return {
    text: [feature.shortDescription, feature.fullDescription, feature.name, ...feature.sourceRecords.map((record) => record.notes)].filter(Boolean).join('. '),
    url: feature.sourceRecords.find((record) => record.sourceUrl)?.sourceUrl,
    reference: feature.sourceRecords.find((record) => record.sourceRecordId)?.sourceRecordId,
    sourceName: 'HES NRHE local record classification',
    reliability: 'official_non_statutory' as const,
  };
}

function applyDate(feature: HeritageFeature, result: NonNullable<ReturnType<typeof extractHistoricEnglandDate>>, item: ReturnType<typeof evidence>) {
  const dateSource: SourceRecord = {
    sourceName: item.sourceName,
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: item.reference,
    sourceUrl: item.url,
    accessedAt: reviewedAt,
    quotedDateText: result.evidenceText,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    reliability: item.reliability,
    notes: 'Material construction or archaeological period normalised from the downloaded local HES description/classification. Administrative designation dates are excluded.',
  };
  Object.assign(feature, {
    documentedDateText: result.evidenceText,
    earliestPossibleYear: result.earliestPossibleYear,
    latestPossibleYear: result.latestPossibleYear,
    datePrecision: result.datePrecision,
    dateBasis: result.dateBasis,
    dateConfidence: result.dateConfidence,
    updatedAt: reviewedAt,
    reviewed: true,
  });
  feature.sourceRecords = [...feature.sourceRecords.filter((record) => record.sourceName !== item.sourceName), dateSource];
  feature.tags = [...new Set([...feature.tags, 'hes-date-reviewed', 'date-reviewed'])];
}

const projects: Array<Record<string, unknown>> = [];
for (const stem of stems) {
  const path = resolve(`data/projects/${stem}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  const heritage = pkg.features.filter(isHeritage);
  let enriched = 0;
  for (const feature of heritage) {
    if (!hasDate(feature)) {
      const item = evidence(feature);
      const result = extractHistoricEnglandDate(item.text);
      if (result) { applyDate(feature, result, item); enriched += 1; }
    } else feature.tags = [...new Set([...feature.tags, 'hes-date-reviewed', 'date-reviewed'])];
    const isContext = feature.evidenceScope === 'related_context' || feature.tags.includes('town-selection-heritage-buffer');
    if (!hasDate(feature) || isContext) feature.tags = [...new Set([...feature.tags, 'heritage-record-retained', 'map-hidden'])];
    else feature.tags = feature.tags.filter((tag) => tag !== 'map-hidden');
  }
  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${stem}: ${errors.map((item) => item.message).join('; ')}`);
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  const local = heritage.filter((feature) => feature.evidenceScope !== 'related_context' && !feature.tags.includes('town-selection-heritage-buffer'));
  const visible = local.filter((feature) => !feature.tags.includes('map-hidden'));
  projects.push({
    projectId: pkg.project.id,
    totalHesAndNrhe: heritage.length,
    localRecords: local.length,
    listedBuildings: heritage.filter((feature) => feature.tags.includes('hes-listed-building')).length,
    scheduledMonuments: heritage.filter((feature) => feature.tags.includes('hes-scheduled-monument')).length,
    nrhe: heritage.filter((feature) => feature.tags.includes('nrhe') || feature.tags.includes('hes-nrhe')).length,
    enriched,
    datedLocalRecords: local.filter(hasDate).length,
    undatedLocalRecordsRetainedHidden: local.filter((feature) => !hasDate(feature) && feature.tags.includes('map-hidden')).length,
    visibleHeritagePins: visible.length,
    visiblePinsWithoutDates: visible.filter((feature) => !hasDate(feature)).length,
    visiblePinNamesContainingDate: visible.filter((feature) => feature.documentedDateText && feature.name.includes(feature.documentedDateText)).length,
  });
}

await writeFile(resolve('data/review/scotscraig-guardbridge-hes-date-certification-2026-09-02.json'), `${JSON.stringify({
  reviewedAt,
  sourceMode: 'Downloaded local HES Listed Buildings, Scheduled Monuments and NRHE datasets with locally cached official descriptions',
  rule: 'Every HES/NRHE record is retained. Only records with defensible material dates are heat-map visible; dates remain metadata and are never appended to map labels.',
  projects,
  totals: {
    records: projects.reduce((sum, item) => sum + Number(item.totalHesAndNrhe), 0),
    visiblePins: projects.reduce((sum, item) => sum + Number(item.visibleHeritagePins), 0),
    visiblePinsWithoutDates: projects.reduce((sum, item) => sum + Number(item.visiblePinsWithoutDates), 0),
    visiblePinNamesContainingDate: projects.reduce((sum, item) => sum + Number(item.visiblePinNamesContainingDate), 0),
  },
}, null, 2)}\n`, 'utf8');
console.log(`Certified local HES/NRHE dates for ${stems.length} projects.`);
