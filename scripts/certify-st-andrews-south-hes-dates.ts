import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { booleanIntersects, booleanPointInPolygon, point } from '@turf/turf';
import type { Feature, Geometry } from 'geojson';
import type { HeritageFeature, ProjectPackage, SourceRecord } from '../src/domain/models';
import { extractHistoricEnglandDate } from '../src/domain/historicDateExtraction';
import { validateFeatures } from '../src/domain/validation';

const args = process.argv.slice(2);
const reviewedDate = args.find((item) => item.startsWith('--date='))?.split('=', 2)[1] ?? '2026-09-02';
const reviewedAt = `${reviewedDate}T18:30:00.000Z`;
const defaultStems = [
  'kincaple',
  'peat-inn',
  'newpark-st-andrews',
  'balone',
  'denhead-st-andrews',
  'st-andrews',
  'prior-muir',
  'brownhills-st-andrews',
  'boarhills',
  'kingsbarns',
  'balcomie',
  'dunino',
  'stravithie',
];
const requestedStems = args.filter((item) => !item.startsWith('--'));
const stems = requestedStems.length ? requestedStems : defaultStems;
const reportSlug = args.find((item) => item.startsWith('--report-slug='))?.split('=', 2)[1] ?? 'st-andrews-south';

interface CachedDescription {
  url: string;
  description: string;
  fetchedAt: string;
}

const listed = JSON.parse(
  await readFile(resolve('data/reference/scotland-hes/hes-listed-building-descriptions.json'), 'utf8'),
) as Record<string, CachedDescription>;
const scheduled = JSON.parse(
  await readFile(resolve('data/reference/scotland-hes/hes-scheduled-monument-descriptions.json'), 'utf8'),
) as Record<string, CachedDescription>;

const visitorTags = new Set([
  'curated-visitor-attraction',
  'service-context-visitor',
  'service-context-food',
  'service-context-trail',
  'visitor-context-trail',
  'service-context-picnic',
  'service-context-parking',
  'visitor-context-parking',
  'service-context-toilets',
]);

const isHeritage = (feature: HeritageFeature) =>
  feature.tags.some(
    (tag) =>
      (tag.startsWith('hes-') && tag !== 'hes-date-reviewed') ||
      tag === 'nrhe' ||
      tag === 'nrhe-record' ||
      tag === 'nrhe-site',
  );
const isListed = (feature: HeritageFeature) => feature.tags.includes('hes-listed-building');
const hasDate = (feature: HeritageFeature) =>
  Boolean(
    feature.documentedDateText?.trim() &&
      feature.earliestPossibleYear != null &&
      feature.latestPossibleYear != null &&
      feature.dateBasis !== 'unknown',
  );

const administrativeDatePattern = /^date:\s*\d{4}-\d{2}\b/i;

function clearAdministrativeDate(feature: HeritageFeature) {
  if (!administrativeDatePattern.test(feature.documentedDateText?.trim() ?? '')) return false;
  delete feature.documentedDateText;
  delete feature.earliestPossibleYear;
  delete feature.latestPossibleYear;
  delete feature.datePrecision;
  feature.dateBasis = 'unknown';
  feature.dateConfidence = 'low';
  feature.tags = feature.tags.filter((tag) => !['hes-date-reviewed', 'date-reviewed'].includes(tag));
  feature.sourceRecords = feature.sourceRecords.filter(
    (record) => !administrativeDatePattern.test(record.quotedDateText?.trim() ?? ''),
  );
  return true;
}

function reference(feature: HeritageFeature, prefix: 'LB' | 'SM') {
  return (
    feature.sourceRecords
      .find((record) => new RegExp(`^${prefix}\\d+$`, 'i').test(record.sourceRecordId ?? ''))
      ?.sourceRecordId?.toUpperCase() ?? feature.id.match(new RegExp(`${prefix}\\d+`, 'i'))?.[0].toUpperCase()
  );
}

function dateEvidence(feature: HeritageFeature) {
  const lb = reference(feature, 'LB');
  if (lb && listed[lb])
    return {
      text: listed[lb].description,
      url: listed[lb].url,
      reference: lb,
      sourceName: 'HES Listed Building description cache',
      reliability: 'official_statutory' as const,
    };
  const sm = reference(feature, 'SM');
  if (sm && scheduled[sm])
    return {
      text: scheduled[sm].description,
      url: scheduled[sm].url,
      reference: sm,
      sourceName: 'HES Scheduled Monument description cache',
      reliability: 'official_statutory' as const,
    };
  return {
    text: [
      feature.shortDescription,
      feature.fullDescription,
      feature.name,
      ...feature.sourceRecords
        .filter(
          (record) =>
            !/\b(?:designation|listing|amendment|assessment)\s+date\b/i.test(record.notes ?? '') &&
            !administrativeDatePattern.test(record.quotedDateText?.trim() ?? ''),
        )
        .flatMap((record) => [record.quotedDateText, record.notes]),
    ]
      .filter(Boolean)
      .join('. '),
    url: feature.sourceRecords.find((record) => record.sourceUrl)?.sourceUrl,
    reference: feature.sourceRecords.find((record) => record.sourceRecordId)?.sourceRecordId,
    sourceName: 'HES NRHE local record classification',
    reliability: 'official_non_statutory' as const,
  };
}

function applyDate(
  feature: HeritageFeature,
  result: NonNullable<ReturnType<typeof extractHistoricEnglandDate>>,
  item: ReturnType<typeof dateEvidence>,
) {
  const dateSource: SourceRecord = {
    sourceName: item.sourceName,
    sourceOrganisation: 'Historic Environment Scotland',
    sourceRecordId: item.reference,
    sourceUrl: item.url,
    accessedAt: reviewedAt,
    quotedDateText: result.evidenceText,
    licence: 'Open Government Licence v3.0; retain Historic Environment Scotland attribution and source link.',
    reliability: item.reliability,
    notes:
      'Material construction or archaeological period normalised from the downloaded local HES description/classification. Administrative designation dates are excluded.',
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
  feature.sourceRecords = [
    ...feature.sourceRecords.filter((record) => record.sourceName !== item.sourceName),
    dateSource,
  ];
  feature.tags = [...new Set([...feature.tags, 'hes-date-reviewed', 'date-reviewed'])];
}

function intersects(feature: HeritageFeature, area: Feature<Geometry>) {
  const wrapped: Feature<Geometry> = { type: 'Feature', properties: {}, geometry: feature.geometry };
  if (feature.geometry.type === 'Point' && booleanPointInPolygon(point(feature.geometry.coordinates), area)) return true;
  if (feature.geometry.type !== 'Point' && booleanIntersects(wrapped, area)) return true;
  return (feature.additionalPointLocations ?? []).some((location) =>
    booleanPointInPolygon(point(location.coordinates), area),
  );
}

const projects: Array<Record<string, unknown>> = [];
for (const stem of stems) {
  const path = resolve(`data/projects/${stem}.json`);
  const pkg = JSON.parse(await readFile(path, 'utf8')) as ProjectPackage;
  const strictBoundary = pkg.project.townStudyArea?.localityBoundary ?? pkg.project.boundary;
  const bufferedBoundary = pkg.project.townStudyArea?.bufferedBoundary ?? strictBoundary;
  let removedOutOfScope = 0;
  let enriched = 0;

  pkg.features = pkg.features.filter((feature) => {
    if (!isHeritage(feature)) return true;
    const insideStrict = intersects(feature, strictBoundary);
    const insideBuffer = isListed(feature) && intersects(feature, bufferedBoundary);
    const keep = insideStrict || insideBuffer;
    if (!keep && !feature.tags.some((tag) => visitorTags.has(tag))) removedOutOfScope += 1;
    return keep || feature.tags.some((tag) => visitorTags.has(tag));
  });

  const heritage = pkg.features.filter(isHeritage);
  for (const feature of heritage) {
    const insideStrict = intersects(feature, strictBoundary);
    const insideBuffer = isListed(feature) && !insideStrict && intersects(feature, bufferedBoundary);
    feature.tags = feature.tags.filter(
      (tag) => !['town-selection-inside-locality', 'town-selection-heritage-buffer'].includes(tag),
    );
    if (insideStrict) {
      feature.tags.push('town-selection-inside-locality');
      feature.evidenceScope = 'parish_evidence';
    } else if (insideBuffer) {
      feature.tags.push('town-selection-heritage-buffer');
      feature.evidenceScope = 'related_context';
    }

    clearAdministrativeDate(feature);
    if (!hasDate(feature)) {
      const item = dateEvidence(feature);
      const result = extractHistoricEnglandDate(item.text);
      if (result && !administrativeDatePattern.test(result.evidenceText.trim())) {
        applyDate(feature, result, item);
        enriched += 1;
      }
    } else {
      feature.tags.push('hes-date-reviewed', 'date-reviewed');
    }

    if (feature.documentedDateText && feature.name.includes(feature.documentedDateText)) {
      feature.name = feature.name
        .replace(feature.documentedDateText, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+[-–—,:]\s*$/, '')
        .trim();
    }

    feature.tags.push('heritage-record-retained');
    if (!insideStrict || !hasDate(feature)) feature.tags.push('map-hidden');
    else feature.tags = feature.tags.filter((tag) => tag !== 'map-hidden');
    feature.tags = [...new Set(feature.tags)];
  }

  pkg.validation = validateFeatures(pkg.project, pkg.features);
  const errors = pkg.validation.filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(`${stem}: ${errors.map((item) => item.message).join('; ')}`);

  const local = heritage.filter((feature) => intersects(feature, strictBoundary));
  const visible = local.filter((feature) => !feature.tags.includes('map-hidden'));
  const visibleUndated = visible.filter((feature) => !hasDate(feature));
  const visibleDateLabels = visible.filter(
    (feature) => feature.documentedDateText && feature.name.includes(feature.documentedDateText),
  );
  if (visibleUndated.length) throw new Error(`${stem}: ${visibleUndated.length} visible heritage records have no date.`);
  if (visibleDateLabels.length) throw new Error(`${stem}: ${visibleDateLabels.length} visible labels contain date text.`);

  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  projects.push({
    projectId: pkg.project.id,
    totalHesAndNrheRetained: heritage.length,
    localRecords: local.length,
    listedBuildings: heritage.filter((feature) => feature.tags.includes('hes-listed-building')).length,
    scheduledMonuments: heritage.filter((feature) => feature.tags.includes('hes-scheduled-monument')).length,
    nrhe: heritage.filter((feature) => feature.tags.includes('nrhe')).length,
    relatedBufferRecords: heritage.filter((feature) => feature.tags.includes('town-selection-heritage-buffer')).length,
    removedOutOfScope,
    enriched,
    datedLocalRecords: local.filter(hasDate).length,
    undatedLocalRecordsRetainedHidden: local.filter(
      (feature) => !hasDate(feature) && feature.tags.includes('map-hidden'),
    ).length,
    visibleHeritagePins: visible.length,
    visiblePinsWithoutDates: visibleUndated.length,
    visiblePinNamesContainingDate: visibleDateLabels.length,
  });
}

await writeFile(
  resolve(`data/review/${reportSlug}-hes-date-certification-${reviewedDate}.json`),
  `${JSON.stringify(
    {
      reviewedAt,
      sourceMode:
        'Downloaded local HES Listed Buildings, Scheduled Monuments and NRHE datasets with locally cached official descriptions',
      spatialRule:
        'Strict editorial boundary for local records; the 500 m contextual ring is retained only for listed buildings and never contributes visible heat.',
      dateRule:
        'Every in-scope HES/NRHE record is retained. Only strict-boundary records with defensible material dates are heat-map visible; dates remain metadata and are never appended to map labels.',
      projects,
      totals: {
        records: projects.reduce((sum, item) => sum + Number(item.totalHesAndNrheRetained), 0),
        removedOutOfScope: projects.reduce((sum, item) => sum + Number(item.removedOutOfScope), 0),
        visiblePins: projects.reduce((sum, item) => sum + Number(item.visibleHeritagePins), 0),
        visiblePinsWithoutDates: projects.reduce((sum, item) => sum + Number(item.visiblePinsWithoutDates), 0),
        visiblePinNamesContainingDate: projects.reduce(
          (sum, item) => sum + Number(item.visiblePinNamesContainingDate),
          0,
        ),
      },
    },
    null,
    2,
  )}\n`,
  'utf8',
);
console.log(`Certified spatial scope and local HES/NRHE dates for ${stems.length} projects.`);
