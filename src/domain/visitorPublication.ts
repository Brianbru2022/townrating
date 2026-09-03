import type { DogAccessInfo } from './dogAccess';
import { isEditorialBoilerplate, isResearchEvidenceOnlyUrl } from './editorialResearch';

const weakTaglines = [
  /^visitor highlight$/i,
  /^local interest$/i,
  /^historic (?:place|highlight)$/i,
  /^quick visitor stop$/i,
  /^worth a look$/i,
  /^top food stop$/i,
  /^great choice$/i,
  /^good local (?:option|stop)$/i,
  /^useful food stop$/i,
  /^food\s*(?:&|and)\s*drink$/i,
  /^(?:cafe|restaurant|attraction)$/i,
];

const unresolvedOpeningPatterns = [
  /check (?:the )?(?:current )?(?:opening )?(?:hours|times|calendar|dates|timetable)/i,
  /opening (?:hours|times) (?:vary|not (?:known|published|confirmed))/i,
  /seasonal opening;?\s*check/i,
  /contact .* for (?:opening|hours)/i,
  /confirm before (?:travelling|a journey)/i,
];

const unresolvedPricePatterns = [
  /check .* (?:admission|price|prices|tariff)/i,
  /(?:admission|prices?|tariff) (?:varies|vary|not (?:known|published|confirmed))/i,
  /^paid admission\.?$/i,
  /^pay$/i,
];

function hasHttpUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !isResearchEvidenceOnlyUrl(url.href);
  } catch {
    return false;
  }
}

export function hasSpecificEditorialTagline(value?: string): boolean {
  const tagline = value?.trim();
  if (!tagline || tagline.length < 4 || tagline.length > 45) return false;
  const words = tagline.split(/\s+/u);
  return words.length <= 6 && !weakTaglines.some((pattern) => pattern.test(tagline));
}

export function hasUsefulOpeningInformation(value?: string): boolean {
  const opening = value?.trim();
  if (!opening || opening.length < 8) return false;
  if (
    /(?:no fixed|no reliable|current weekly) opening hours (?:are )?not published.*(?:contact|telephone|confirm)/i.test(
      opening,
    )
  ) {
    return true;
  }
  return !unresolvedOpeningPatterns.some((pattern) => pattern.test(opening));
}

export function hasUsefulPriceInformation(value?: string): boolean {
  const price = value?.trim();
  if (!price || price.length < 2) return false;
  return !unresolvedPricePatterns.some((pattern) => pattern.test(price));
}

export function hasRealisticVisitDuration(value?: string): boolean {
  const duration = value?.trim();
  return Boolean(duration && !/5\s*(?:-|to)\s*20\s*minutes/i.test(duration));
}

/**
 * An explicitly researched "not published" policy is a useful result. A
 * generated "check before visiting" fallback without a source is not.
 */
export function hasResearchedDogAccess(value?: DogAccessInfo): boolean {
  if (
    !value ||
    !value.reviewedAt?.trim() ||
    !value.label?.trim() ||
    value.summary.trim().length < 24 ||
    !hasHttpUrl(value.sourceUrl)
  ) {
    return false;
  }
  if (value.status !== 'unconfirmed') return true;
  return /(?:no reliable current (?:dog )?policy|not (?:published|confirmed)|could not be confirmed)/i.test(
    value.summary,
  );
}

interface BasePublicationCandidate {
  score?: number;
  visitorScore?: number;
  tagline?: string;
  reason?: string;
  openingTimes?: string;
  dogAccess?: DogAccessInfo;
}

export interface AttractionPublicationCandidate extends BasePublicationCandidate {
  timeToSpend?: string;
  admission?: string;
}

export interface FoodPublicationCandidate extends BasePublicationCandidate {
  priceBand?: string;
  foodStyle?: string;
}

function baseIssues(candidate: BasePublicationCandidate): string[] {
  const issues: string[] = [];
  if (!Number.isFinite(candidate.score ?? candidate.visitorScore)) {
    issues.push('editorial score missing');
  }
  if (!hasSpecificEditorialTagline(candidate.tagline)) {
    issues.push('specific short highlight pill missing');
  }
  if (isEditorialBoilerplate(candidate.reason)) {
    issues.push('visitor-facing editorial reason missing');
  }
  if (!hasUsefulOpeningInformation(candidate.openingTimes)) {
    issues.push('usable opening times missing');
  }
  if (!hasResearchedDogAccess(candidate.dogAccess)) {
    issues.push('source-backed dog policy missing');
  }
  return issues;
}

export function attractionPublicationIssues(
  candidate: AttractionPublicationCandidate,
): string[] {
  const issues = baseIssues(candidate);
  if (!hasRealisticVisitDuration(candidate.timeToSpend)) {
    issues.push('realistic time to spend missing');
  }
  if (!hasUsefulPriceInformation(candidate.admission)) {
    issues.push('explicit price or free status missing');
  }
  return issues;
}

export function foodPublicationIssues(candidate: FoodPublicationCandidate): string[] {
  const issues = baseIssues(candidate);
  const score = candidate.score ?? candidate.visitorScore;
  if (Number.isFinite(score) && (score! < 60 || score! > 100)) {
    issues.push('food score must be between 60 and 100');
  }
  if (!/^(?:£|££|£££)$/u.test(candidate.priceBand?.trim() ?? '')) {
    issues.push('consistent price band missing');
  }
  if (!candidate.foodStyle?.trim()) issues.push('food style missing');
  return issues;
}

export function isPublishableAttraction(
  candidate: AttractionPublicationCandidate,
): boolean {
  return attractionPublicationIssues(candidate).length === 0;
}

export function isPublishableFood(candidate: FoodPublicationCandidate): boolean {
  return foodPublicationIssues(candidate).length === 0;
}
