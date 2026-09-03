import type { HeritageFeature, SourceRecord } from './models';

export interface AttractionVisitPlan {
  timeToSpend: string;
  openingTimes: string;
  admission: string;
  parking: string;
  toilets: string;
  picnic: string;
  foodNote: string;
}

function isCurrentVisitorSource(source: SourceRecord): boolean {
  return Boolean(
    source.sourceName === 'OpenStreetMap current community places' ||
      source.notes?.startsWith('Current OSM') ||
      source.notes?.startsWith('Current-place curation') ||
      source.notes?.startsWith('Current-context curation') ||
      source.notes?.startsWith('Current daytime food curation'),
  );
}

function detailsFromSource(source: SourceRecord): Map<string, string> {
  const values = new Map<string, string>();
  if (!isCurrentVisitorSource(source) || !source.notes) return values;
  const detailText = source.notes.replace(
    /^(?:Current OSM(?: [^:]+)?|Current-place curation|Current-context curation|Current daytime food curation)\s*:\s*/i,
    '',
  );
  for (const entry of detailText.replace(/\.$/, '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key && value) values.set(key, value);
  }
  return values;
}

function currentDetails(feature: HeritageFeature): Map<string, string> {
  const details = new Map<string, string>();
  for (const source of feature.sourceRecords) {
    for (const [key, value] of detailsFromSource(source)) details.set(key, value);
  }
  return details;
}

function firstValue(details: Map<string, string>, ...keys: string[]): string | undefined {
  return keys.map((key) => details.get(key)).find(Boolean);
}

function readableFlag(
  value: string | undefined,
  yesText: string,
  noText: string,
): string | undefined {
  if (!value) return undefined;
  if (/^(yes|true|available|public)$/i.test(value)) return yesText;
  if (/^(no|false|none)$/i.test(value)) return noText;
  return value.replaceAll('_', ' ');
}

const openAccessTypes = new Set([
  'bridge',
  'canal',
  'dock',
  'harbour',
  'market',
  'memorial',
  'monument',
  'park',
  'public_art',
  'square',
  'street',
]);

export function recommendedAttractionDuration(
  feature: HeritageFeature,
  visitorScore?: number,
): string {
  const explicit = firstValue(currentDetails(feature), 'time_to_spend', 'visit_duration');
  if (explicit) return explicit;

  const nameAndType = `${feature.name} ${feature.featureType}`.toLocaleLowerCase();
  if (/zoo|safari|theme park|adventure park/.test(nameAndType)) return 'Allow 3-5 hours';
  if (/heritage railway|country park|farm park|forest drive/.test(nameAndType)) {
    return 'Allow 2-4 hours';
  }
  if (/museum|gallery|visitor centre/.test(nameAndType)) {
    return visitorScore !== undefined && visitorScore >= 90
      ? 'Allow 2-3 hours'
      : 'Allow 60-120 minutes';
  }
  if (/cathedral|abbey|castle|palace|country_house|manor_house/.test(nameAndType)) {
    return visitorScore !== undefined && visitorScore >= 85
      ? 'Allow 90 minutes-3 hours'
      : 'Allow 60-120 minutes';
  }
  if (/garden|designed_landscape|nature reserve|wood|fen|meadow/.test(nameAndType)) {
    return visitorScore !== undefined && visitorScore >= 85
      ? 'Allow 2-4 hours'
      : 'Allow 60-120 minutes';
  }
  if (/archaeological_site|fort|ruin/.test(nameAndType)) return 'Allow 45-90 minutes';
  if (/church|chapel|burial_ground/.test(nameAndType)) return 'Allow 20-45 minutes';
  if (/bridge|harbour|viewpoint|waterfall/.test(nameAndType)) return 'Allow 30-60 minutes';
  if (/market|square|street|townscape/.test(nameAndType)) return 'Allow 45-90 minutes';
  if (/memorial|monument|public_art|statue|plaque/.test(nameAndType)) {
    return 'Allow 10-25 minutes';
  }
  return 'Allow 45-90 minutes';
}

export function attractionVisitPlan(
  feature: HeritageFeature,
  visitorScore?: number,
): AttractionVisitPlan {
  const details = currentDetails(feature);
  const opening = firstValue(details, 'opening_hours:description', 'opening_hours');
  const rawAdmission = firstValue(details, 'entrance_fee', 'charge', 'fee');
  const isOpenAccess = openAccessTypes.has(feature.featureType);
  const admission = rawAdmission
    ? /^(no|free|none|0|£0(?:\.00)?)$/i.test(rawAdmission)
      ? 'Free'
      : /^(yes|paid|pay)$/i.test(rawAdmission)
        ? 'Admission charged; check current prices before travelling.'
        : rawAdmission
    : isOpenAccess
      ? 'Free'
      : "Check the attraction's current admission prices before travelling.";
  const parking = readableFlag(
    firstValue(details, 'parking_note', 'parking_details', 'parking'),
    'Visitor parking is available.',
    'No dedicated visitor parking is provided.',
  );
  const toilets = readableFlag(
    firstValue(details, 'toilets', 'visitor_toilets'),
    'Visitor toilets are available on site.',
    'No visitor toilets are available on site.',
  );
  const picnic = readableFlag(
    firstValue(details, 'picnic', 'picnic_area', 'picnic_tables'),
    'Picnic provision is available on site.',
    'No dedicated picnic provision is available.',
  );
  const food = readableFlag(
    firstValue(details, 'cafe', 'café', 'restaurant', 'food', 'food_and_drink'),
    'An on-site café or food outlet is available.',
    'No on-site café is available.',
  );

  return {
    timeToSpend: recommendedAttractionDuration(feature, visitorScore),
    openingTimes:
      opening ??
      (isOpenAccess
        ? 'Open access; daylight visits are recommended.'
        : "Opening times vary; check the attraction's current visitor information before travelling."),
    admission,
    parking:
      parking ??
      'Attraction-specific parking is not confirmed; check current visitor information or local signs.',
    toilets:
      toilets ??
      'On-site toilets are not confirmed; check before relying on them.',
    picnic: picnic ?? 'Dedicated picnic provision is not confirmed.',
    foodNote:
      food ??
      'On-site café availability is not confirmed; plan a separate daytime food stop unless current visitor information says otherwise.',
  };
}
