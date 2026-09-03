export type DogFriendlyRating = 0 | 1 | 2 | 3;

export type DogAccessStatus =
  | 'welcoming'
  | 'restricted'
  | 'not-allowed'
  | 'unconfirmed';

export interface DogAccessInfo {
  rating: DogFriendlyRating;
  status: DogAccessStatus;
  label: string;
  summary: string;
  sourceName?: string;
  sourceUrl?: string;
  reviewedAt: string;
}

export function isDogFriendly(info?: DogAccessInfo): boolean {
  return Boolean(info && info.rating > 0);
}

/**
 * Rates the attraction experience for a visitor who must bring a dog.
 * Dog access can preserve an attraction's visitor score, but never improve it.
 */
export function dogOwnerAttractionScore(
  visitorScore: number,
  info?: DogAccessInfo,
): number {
  if (!Number.isFinite(visitorScore) || visitorScore < 0 || visitorScore > 100) {
    throw new RangeError('Attraction visitor score must be between 0 and 100.');
  }

  let penalty: number;
  if (!info || info.status === 'unconfirmed') penalty = 12;
  else if (info.status === 'not-allowed') penalty = 25;
  else if (info.rating === 3) penalty = 0;
  else if (info.rating === 2) penalty = 4;
  else if (info.rating === 1) penalty = 10;
  else penalty = 20;

  return Math.max(0, visitorScore - penalty);
}

export function dogPawRatingLabel(info: DogAccessInfo): string {
  if (info.status === 'unconfirmed') {
    return `Dog access unconfirmed: ${info.label}`;
  }
  if (info.rating === 0) {
    return `No dogs: ${info.label}`;
  }
  const unit = info.rating === 1 ? 'paw' : 'paws';
  return `${info.rating} ${unit} out of 3: ${info.label}`;
}
