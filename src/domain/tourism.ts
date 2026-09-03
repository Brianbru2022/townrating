import type { TownProject, TouristAppealRating } from './models';

const defaultLabelByRating: Record<TouristAppealRating, string> = {
  0: 'Not a tourist town',
  1: 'Local detour',
  2: 'Worth a planned stop',
  3: 'Destination draw',
};

export interface TownScoreBand {
  rating: TouristAppealRating;
  indicator: string;
  label: string;
}

export function townScoreBand(score: number): TownScoreBand {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError('Town tourism score must be between 0 and 100.');
  }
  if (score >= 90) return { rating: 3, indicator: '★★★', label: 'Exceptional Destination' };
  if (score >= 80) return { rating: 2, indicator: '★★', label: 'Strong Destination' };
  if (score >= 70) return { rating: 1, indicator: '★', label: 'Worth a Visit' };
  if (score >= 60) return { rating: 0, indicator: '◆', label: 'Notable Stop' };
  return { rating: 0, indicator: '', label: 'Minor Interest' };
}

export function legacyTownScore(rating: TouristAppealRating): number {
  return rating === 3 ? 90 : rating === 2 ? 80 : rating === 1 ? 70 : 0;
}

export function townDogAccessScoreAdjustment(
  rating: TouristAppealRating | undefined,
): 0 | -1 | -2 | -3 {
  if (rating === undefined || rating === 3) return 0;
  if (rating === 2) return -1;
  if (rating === 1) return -2;
  return -3;
}

export function townScoreAfterDogAccess(
  baseScore: number,
  dogAccessRating: TouristAppealRating | undefined,
): number {
  if (!Number.isFinite(baseScore) || baseScore < 0 || baseScore > 100) {
    throw new RangeError('Base town tourism score must be between 0 and 100.');
  }
  return Math.max(0, baseScore + townDogAccessScoreAdjustment(dogAccessRating));
}

export function touristAppealStars(rating: TouristAppealRating | undefined): string {
  if (rating === undefined || rating === 0) return '';
  return '★'.repeat(rating);
}

export function touristAppealIndicator(project: TownProject): string {
  const appeal = project.touristAppeal;
  if (!appeal) return '';
  if (appeal.score !== undefined) return townScoreBand(appeal.score).indicator;
  if (appeal.rating === 0) return '⊘';
  return touristAppealStars(appeal.rating) || appeal.label || defaultLabelByRating[appeal.rating];
}

export function touristAppealLabel(project: TownProject): string {
  const indicator = touristAppealIndicator(project);
  if (!indicator) return project.locality;
  return `${project.locality} ${indicator}`;
}

export function touristAppealSummary(project: TownProject): string | undefined {
  const appeal = project.touristAppeal;
  if (!appeal) return undefined;
  return appeal.summary ?? appeal.label ?? defaultLabelByRating[appeal.rating];
}
