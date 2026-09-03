import type {
  HeritageFeature,
  ProjectPackage,
  TouristAppealRating,
  VisitorHighlight,
} from './models';
import type { PlannerCurationState } from './plannerCuration';
import { currentPlaceInfo } from './visitorExperience';
import {
  publicVisitorUrl,
  publishedAttractionScore,
  publishedTrailScore,
} from './editorialResearch';
import { townScoreBand } from './tourism';

export const townRatingPolicyVersion = '2026-08-09-strict-visitor-draw-v1';

export const townRatingLabels: Readonly<Record<TouristAppealRating, string>> = {
  0: 'Not a tourist town',
  1: 'Local detour',
  2: 'Worth a planned stop',
  3: 'Destination draw',
};

export interface ScoredTownExperience {
  featureId: string;
  name: string;
  score: number;
  sourceUrl?: string;
}

export interface TownRatingEvidence {
  attractions: ScoredTownExperience[];
  trails: ScoredTownExperience[];
}

function descendingScores(scores: readonly number[]): number[] {
  return scores.filter(Number.isFinite).map(Number).sort((left, right) => right - left);
}

/**
 * The public town rating measures destination draw, not amenity provision. Food,
 * parking, toilets, picnic provision and other practical categories are therefore
 * deliberately absent from this function.
 */
export function townRatingFromEvidence(
  attractionScores: readonly number[],
  genuineTrailScores: readonly number[] = [],
): TouristAppealRating {
  const attractions = descendingScores(attractionScores);
  const trails = descendingScores(genuineTrailScores);
  const topAttraction = attractions[0] ?? 0;
  const plannedStopDepth =
    attractions.filter((score) => score >= 60).length +
    trails.filter((score) => score >= 75).length;
  const destinationDepth =
    attractions.filter((score) => score >= 70).length +
    trails.filter((score) => score >= 80).length;

  if (
    topAttraction >= 90 &&
    attractions.filter((score) => score >= 80).length >= 3 &&
    destinationDepth >= 5
  ) {
    return 3;
  }

  if (
    topAttraction >= 85 &&
    attractions.filter((score) => score >= 70).length >= 2 &&
    plannedStopDepth >= 3
  ) {
    return 2;
  }

  if (
    topAttraction >= 75 ||
    attractions.filter((score) => score >= 60).length >= 2
  ) {
    return 1;
  }

  return 0;
}

function numericDetail(feature: HeritageFeature, ...keys: string[]): number | undefined {
  const details = currentPlaceInfo(feature).currentDetails;
  for (const key of keys) {
    const value = Number(details.find((detail) => detail.key === key)?.value);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function responsibleTrailUrl(feature: HeritageFeature): string | undefined {
  const details = currentPlaceInfo(feature).currentDetails;
  for (const key of ['website', 'external_url']) {
    const url = publicVisitorUrl(details.find((detail) => detail.key === key)?.value);
    if (url) return url;
  }
  return publicVisitorUrl(
    feature.visitorWebsiteUrl,
    ...feature.sourceRecords.map((source) => source.sourceUrl),
  );
}

function scoredAttractions(
  highlights: readonly VisitorHighlight[],
  trailIds: ReadonlySet<string>,
  featuresById: ReadonlyMap<string, HeritageFeature>,
): ScoredTownExperience[] {
  const byFeature = new Map<string, ScoredTownExperience>();
  for (const highlight of highlights) {
    if (trailIds.has(highlight.featureId)) continue;
    const feature = featuresById.get(highlight.featureId);
    const score = publishedAttractionScore(highlight, feature);
    if (score === undefined || score <= 0) continue;
    const existing = byFeature.get(highlight.featureId);
    if (!existing || score > existing.score) {
      byFeature.set(highlight.featureId, {
        featureId: highlight.featureId,
        name: highlight.name,
        score,
        sourceUrl: publicVisitorUrl(highlight.visitorWebsiteUrl),
      });
    }
  }
  return [...byFeature.values()].sort(
    (left, right) => right.score - left.score || left.name.localeCompare(right.name, 'en-GB'),
  );
}

export function townRatingEvidenceForProject(
  pkg: Pick<ProjectPackage, 'project' | 'features'>,
  curation: PlannerCurationState,
): TownRatingEvidence {
  const trailIds = new Set(curation.trails ?? []);
  const featuresById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  const trails = [...trailIds]
    .map((featureId): ScoredTownExperience | undefined => {
      const feature = featuresById.get(featureId);
      if (!feature) return undefined;
      const score = publishedTrailScore(
        feature,
        numericDetail(feature, 'trail_score', 'visit_score'),
      );
      const sourceUrl = responsibleTrailUrl(feature);
      if (!score || !sourceUrl) return undefined;
      return { featureId, name: feature.name, score, sourceUrl };
    })
    .filter((trail): trail is ScoredTownExperience => Boolean(trail))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'en-GB'));

  return {
    attractions: scoredAttractions(pkg.project.visitorHighlights ?? [], trailIds, featuresById),
    trails,
  };
}

export function ratingForProject(
  pkg: Pick<ProjectPackage, 'project' | 'features'>,
  curation: PlannerCurationState,
): TouristAppealRating {
  const evidence = townRatingEvidenceForProject(pkg, curation);
  return townRatingFromEvidence(
    evidence.attractions.map((item) => item.score),
    evidence.trails.map((item) => item.score),
  );
}

export function withDefaultTownRatingPolicy(
  pkg: ProjectPackage,
  curation: PlannerCurationState,
): ProjectPackage {
  const explicitScore = pkg.project.touristAppeal?.score;
  if (explicitScore !== undefined) {
    const band = townScoreBand(explicitScore);
    return {
      ...pkg,
      project: {
        ...pkg.project,
        touristAppeal: {
          ...pkg.project.touristAppeal,
          score: explicitScore,
          rating: band.rating,
          label: band.label,
        },
      },
    };
  }
  const evidence = townRatingEvidenceForProject(pkg, curation);

  // Existing packages are being migrated to the researched editorial contract.
  // Until a town has publishable evidence, preserve its existing classification
  // instead of incorrectly converting "not yet reassessed" into zero stars.
  if (evidence.attractions.length === 0 && evidence.trails.length === 0) {
    return pkg;
  }

  const rating = townRatingFromEvidence(
    evidence.attractions.map((item) => item.score),
    evidence.trails.map((item) => item.score),
  );
  return {
    ...pkg,
    project: {
      ...pkg.project,
      touristAppeal: {
        ...pkg.project.touristAppeal,
        rating,
        label: townRatingLabels[rating],
      },
    },
  };
}

function joinedNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'its strongest visitor places';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function townRatingSummary(
  locality: string,
  rating: TouristAppealRating,
  evidence: TownRatingEvidence,
): string {
  const leadingAttractions = evidence.attractions.slice(0, rating >= 2 ? 3 : 2).map((item) => item.name);
  const leadingTrails = evidence.trails.slice(0, 1).map((item) => item.name);
  if (rating === 0) {
    return `${locality} has recorded local interest, but its current in-boundary visitor offer does not meet the threshold for a tourist-town rating.`;
  }
  if (rating === 1) {
    return `${locality} qualifies as a local detour through ${joinedNames(leadingAttractions)}. It is best treated as a shorter stop rather than a half-day destination.`;
  }
  const experiences = [...leadingAttractions, ...leadingTrails].slice(0, rating === 3 ? 4 : 3);
  if (rating === 2) {
    return `${locality} supports a coherent half-day visit through ${joinedNames(experiences)}.`;
  }
  return `${locality} has destination-scale depth led by ${joinedNames(experiences)}, with enough independent visitor experiences for most of a day.`;
}
