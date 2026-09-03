import type {
  AttractionEditorialAssessment,
  AttractionVisitability,
  EditorialRecordReview,
  FoodEditorialAssessment,
  HeritageFeature,
  Reliability,
  SourceRecord,
  VisitorHighlight,
} from './models';

export type EditorialEvidenceTier =
  | 'official_or_operator'
  | 'established_secondary'
  | 'reference_evidence_only'
  | 'osm_discovery_only'
  | 'no_web_evidence';

export interface EditorialSourceInput {
  sourceName?: string;
  sourceOrganisation?: string;
  sourceUrl?: string;
  reliability?: Reliability;
}

const officialReliabilities = new Set<Reliability>([
  'official_statutory',
  'official_non_statutory',
  'local_authority',
  'academic',
]);

const officialHostPatterns = [
  /(?:^|\.)gov\.uk$/i,
  /(?:^|\.)nationaltrust\.org\.uk$/i,
  /(?:^|\.)english-heritage\.org\.uk$/i,
  /(?:^|\.)forestryengland\.uk$/i,
  /(?:^|\.)nationalparks\.uk$/i,
  /(?:^|\.)wildlifetrusts\.org$/i,
  /(?:^|\.)rspb\.org\.uk$/i,
  /(?:^|\.)canalrivertrust\.org\.uk$/i,
  /(?:^|\.)visitbritain\.com$/i,
  /(?:^|\.)visitengland\.com$/i,
];

const boilerplatePatterns = [
  /is a nationally recorded historic landmark within/i,
  /is a current .* mapped within/i,
  /recorded by OpenStreetMap/i,
  /inside the town boundary/i,
  /adds a worthwhile .* stop/i,
  /useful when planning/i,
  /current .* mapped place/i,
  /a local point of interest/i,
];

export function webHostname(sourceUrl?: string): string | undefined {
  if (!sourceUrl) return undefined;
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.hostname.replace(/^www\./i, '');
  } catch {
    return undefined;
  }
}

const evidenceOnlyHosts = [
  /(?:^|\.)openstreetmap\.org$/i,
  /(?:^|\.)overpass-api\.de$/i,
  /(?:^|\.)wikidata\.org$/i,
  /(?:^|\.)wikipedia\.org$/i,
  /(?:^|\.)geograph\.org\.uk$/i,
  /(?:^|\.)britishlistedbuildings\.co\.uk$/i,
  /(?:^|\.)mapillary\.com$/i,
  /(?:^|\.)trove\.scot$/i,
  /(?:^|\.)portal\.historicenvironment\.scot$/i,
  /(?:^|\.)data\.ordnancesurvey\.co\.uk$/i,
];

const evidenceOnlyPaths = [
  { host: /(?:^|\.)historicengland\.org\.uk$/i, path: /^\/listing\/the-list\/list-entry\//i },
  { host: /(?:^|\.)google\.[a-z.]+$/i, path: /^\/maps(?:\/|$)/i },
  { host: /(?:^|\.)bing\.com$/i, path: /^\/maps(?:\/|$)/i },
];

export function isResearchEvidenceOnlyUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./i, '');
    return (
      evidenceOnlyHosts.some((pattern) => pattern.test(hostname)) ||
      evidenceOnlyPaths.some(
        ({ host, path }) => host.test(hostname) && path.test(url.pathname),
      )
    );
  } catch {
    return false;
  }
}

/**
 * A public website must help somebody plan or understand a visit. Mapping,
 * designation and encyclopaedia pages remain valid research evidence but are
 * deliberately hidden from the tourist-facing website action.
 */
export function visitorWebsiteRejectionReason(value?: string): string | undefined {
  if (!value?.trim()) return 'missing';
  if (value.startsWith('/') && !value.startsWith('//')) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return 'unsupported protocol';
    if (isResearchEvidenceOnlyUrl(url.href)) {
      return 'research evidence, not a visitor website';
    }
    return undefined;
  } catch {
    return 'invalid URL';
  }
}

export function isVisitorHelpfulUrl(value?: string): boolean {
  return visitorWebsiteRejectionReason(value) === undefined;
}

export function publicVisitorUrl(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (!value || !isVisitorHelpfulUrl(value)) continue;
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    try {
      return new URL(value).href;
    } catch {
      // isVisitorHelpfulUrl already rejects malformed external values.
    }
  }
  return undefined;
}

export const editorialRatingMethodVersion = '2026-08-13-researched-visitor-value-v1';

function bounded(value: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

export function maximumAttractionScoreForVisitability(
  visitability: AttractionVisitability,
): number {
  switch (visitability) {
    case 'no_visible_remains':
      return 34;
    case 'earthworks_or_site':
      return 44;
    case 'fragmentary_remains':
      return 59;
    case 'substantial_visible_remains':
      return 84;
    default:
      return 100;
  }
}

/**
 * Editorial attraction score. A historic title, designation grade or OSM tag
 * contributes no points by itself; the score measures the visit that exists.
 */
export function attractionEditorialScore(input: AttractionEditorialAssessment): number {
  const raw =
    bounded(input.experienceDepth, 30) +
    bounded(input.distinctiveness, 20) +
    bounded(input.presentation, 20) +
    bounded(input.journeyWorth, 15) +
    bounded(input.accessAndReliability, 10) +
    bounded(input.evidenceConfidence, 5);
  return Math.min(raw, maximumAttractionScoreForVisitability(input.visitability));
}

const visitabilitySensitiveTypes = new Set([
  'archaeological_site',
  'castle',
  'fort',
  'monastery',
  'ruin',
]);

/** A historic name or designation does not establish that a visitable place survives. */
export function requiresAttractionVisitabilityAssessment(
  feature?: Pick<HeritageFeature, 'featureType' | 'name' | 'survival'>,
): boolean {
  if (!feature) return false;
  if (feature.survival === 'site_only_or_demolished') return true;
  return (
    visitabilitySensitiveTypes.has(feature.featureType) ||
    /\b(?:castle|fort|friary|monastery|abbey|ruins?|site of|earthworks?)\b/i.test(feature.name)
  );
}

/** Daytime food score for coffee, cake, breakfast, brunch and lunch stops. */
export function foodEditorialScore(input: FoodEditorialAssessment): number {
  return (
    bounded(input.foodAndDrinkQuality, 30) +
    bounded(input.daytimeRelevance, 20) +
    bounded(input.distinctiveness, 15) +
    bounded(input.consistency, 15) +
    bounded(input.visitorFit, 10) +
    bounded(input.evidenceConfidence, 10)
  );
}

export function isOsmEditorialSource(source: EditorialSourceInput): boolean {
  const hostname = webHostname(source.sourceUrl);
  return Boolean(
    /openstreetmap|overpass/i.test(
      `${source.sourceName ?? ''} ${source.sourceOrganisation ?? ''}`,
    ) || hostname === 'openstreetmap.org' || hostname?.endsWith('.openstreetmap.org'),
  );
}

export function editorialEvidenceTier(
  sources: readonly EditorialSourceInput[],
): EditorialEvidenceTier {
  let hasResponsibleWebSource = false;
  let hasReferenceEvidence = false;
  let hasOsmSource = false;

  for (const source of sources) {
    const hostname = webHostname(source.sourceUrl);
    if (!hostname) continue;
    if (isOsmEditorialSource(source)) {
      hasOsmSource = true;
      continue;
    }
    if (isResearchEvidenceOnlyUrl(source.sourceUrl)) {
      hasReferenceEvidence = true;
      continue;
    }
    hasResponsibleWebSource = true;
    if (
      (source.reliability && officialReliabilities.has(source.reliability)) ||
      officialHostPatterns.some((pattern) => pattern.test(hostname))
    ) {
      return 'official_or_operator';
    }
  }

  if (hasResponsibleWebSource) return 'established_secondary';
  if (hasReferenceEvidence) return 'reference_evidence_only';
  if (hasOsmSource) return 'osm_discovery_only';
  return 'no_web_evidence';
}

function validEditorialReview(
  review: EditorialRecordReview | undefined,
  category: EditorialRecordReview['category'],
  sources: readonly EditorialSourceInput[],
): review is EditorialRecordReview {
  if (
    !review ||
    review.status !== 'editorially_researched' ||
    review.category !== category ||
    review.methodVersion !== editorialRatingMethodVersion ||
    !review.reviewedAt ||
    !review.scoreRationale.trim() ||
    review.evidenceUrls.length === 0
  ) {
    return false;
  }
  const tier = editorialEvidenceTier([
    ...sources,
    ...review.evidenceUrls.map((sourceUrl) => ({ sourceUrl })),
  ]);
  return ['official_or_operator', 'established_secondary'].includes(tier);
}

function sourceDetail(feature: HeritageFeature, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`, 'i');
  for (const source of feature.sourceRecords) {
    const value = pattern.exec(source.notes ?? '')?.[1]?.trim();
    if (value) return value;
  }
  return undefined;
}

function responsibleLegacyEvidence(sources: readonly EditorialSourceInput[]): boolean {
  return ['official_or_operator', 'established_secondary'].includes(
    editorialEvidenceTier(sources),
  );
}

function usefulLegacyOpening(value?: string): boolean {
  return Boolean(
    value?.trim() &&
      !/check (?:the )?(?:current )?(?:opening )?(?:hours|times|calendar|dates|timetable)|seasonal opening;?\s*check/i.test(
        value,
      ),
  );
}

function usefulLegacyPrice(value?: string): boolean {
  return Boolean(
    value?.trim() &&
      !/^(?:pay|paid admission)\.?$/i.test(value.trim()) &&
      !/check .* (?:admission|price|prices|tariff)/i.test(value),
  );
}

function specificLegacyTagline(value?: string): boolean {
  if (!value?.trim() || value.trim().length > 45) return false;
  return !/^(?:visitor highlight|local interest|historic place|worth a look|top food stop|great choice|good local option)$/i.test(
    value.trim(),
  );
}

/** A public score exists only when its saved assessment can reproduce it. */
export function publishedAttractionScore(
  highlight: VisitorHighlight,
  feature?: HeritageFeature,
): number | undefined {
  const rawScore = Number(highlight.visitorScore);
  if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100) return undefined;

  const review = highlight.editorialReview;
  const sources = [
    ...(feature?.sourceRecords ?? []),
    { sourceName: highlight.sourceName, sourceUrl: highlight.sourceUrl },
  ];
  if (isEditorialBoilerplate(highlight.reason)) return undefined;
  if (validEditorialReview(review, 'attraction', sources) && review.attractionAssessment) {
    const calculated = attractionEditorialScore(review.attractionAssessment);
    return calculated === Math.round(rawScore) ? calculated : undefined;
  }

  // Preserve older, manually curated visitor records while they are migrated
  // to the reproducible assessment model. Thin generated/OSM records still fail.
  return highlight.verifiedInBoundaryAt &&
    specificLegacyTagline(highlight.tagline) &&
    usefulLegacyOpening(highlight.openingTimes) &&
    usefulLegacyPrice(highlight.admission) &&
    responsibleLegacyEvidence(sources)
    ? Math.round(rawScore)
    : undefined;
}

export function publishedFeatureAttractionScore(
  feature: HeritageFeature,
  rawScore: number | undefined,
  visitorCopy?: string,
): number | undefined {
  if (rawScore === undefined || rawScore < 0 || rawScore > 100) return undefined;
  if (isEditorialBoilerplate(visitorCopy ?? feature.shortDescription)) return undefined;
  const review = feature.editorialReview;
  if (validEditorialReview(review, 'attraction', feature.sourceRecords) && review.attractionAssessment) {
    const calculated = attractionEditorialScore(review.attractionAssessment);
    return calculated === Math.round(rawScore) ? calculated : undefined;
  }

  const savedScore = Number(sourceDetail(feature, 'visit_score'));
  return feature.reviewed &&
    savedScore === Math.round(rawScore) &&
    Boolean(feature.attractionGuide?.headline?.trim()) &&
    Boolean(feature.attractionGuide?.intro?.trim()) &&
    usefulLegacyOpening(sourceDetail(feature, 'opening_hours:description') ?? sourceDetail(feature, 'opening_hours')) &&
    usefulLegacyPrice(sourceDetail(feature, 'entrance_fee') ?? sourceDetail(feature, 'fee')) &&
    responsibleLegacyEvidence(feature.sourceRecords)
    ? Math.round(rawScore)
    : undefined;
}

export function publishedFoodScore(
  feature: HeritageFeature,
  rawScore: number | undefined,
  visitorCopy?: string,
): number | undefined {
  if (rawScore === undefined || rawScore < 0 || rawScore > 100) return undefined;
  if (isEditorialBoilerplate(visitorCopy ?? feature.shortDescription)) return undefined;
  const review = feature.editorialReview;
  if (validEditorialReview(review, 'food', feature.sourceRecords) && review.foodAssessment) {
    const calculated = foodEditorialScore(review.foodAssessment);
    return calculated === Math.round(rawScore) ? calculated : undefined;
  }

  const savedScore = Number(sourceDetail(feature, 'visit_score'));
  return feature.reviewed &&
    savedScore === Math.round(rawScore) &&
    usefulLegacyOpening(sourceDetail(feature, 'opening_hours:description') ?? sourceDetail(feature, 'opening_hours')) &&
    /^(?:£|££|£££)$/u.test(sourceDetail(feature, 'price_band') ?? '') &&
    Boolean(sourceDetail(feature, 'cuisine')) &&
    Boolean(sourceDetail(feature, 'description')) &&
    responsibleLegacyEvidence(feature.sourceRecords)
    ? Math.round(rawScore)
    : undefined;
}

export function publishedTrailScore(
  feature: HeritageFeature,
  rawScore: number | undefined,
): number | undefined {
  if (rawScore === undefined || rawScore < 0 || rawScore > 100) return undefined;
  return validEditorialReview(feature.editorialReview, 'trail', feature.sourceRecords)
    ? Math.round(rawScore)
    : undefined;
}

export function isEditorialBoilerplate(value?: string): boolean {
  if (!value?.trim()) return true;
  return boilerplatePatterns.some((pattern) => pattern.test(value));
}

export function sourceRecordEditorialTier(
  records: readonly SourceRecord[],
): EditorialEvidenceTier {
  return editorialEvidenceTier(records);
}
