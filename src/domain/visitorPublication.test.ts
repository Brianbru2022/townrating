import { describe, expect, it } from 'vitest';
import type { DogAccessInfo } from './dogAccess';
import {
  attractionPublicationIssues,
  foodPublicationIssues,
  hasResearchedDogAccess,
  isPublishableAttraction,
  isPublishableFood,
} from './visitorPublication';

const researchedDogAccess: DogAccessInfo = {
  rating: 2,
  status: 'welcoming',
  label: 'Dogs welcome in the grounds',
  summary: 'Dogs are welcome on leads throughout the outdoor visitor areas.',
  sourceName: 'Attraction visitor information',
  sourceUrl: 'https://visitor.example.org/dogs',
  reviewedAt: '2026-08-13',
};

const attraction = {
  score: 82,
  tagline: 'Rooftop city views',
  reason: 'Climb the restored tower for a memorable view over the historic centre.',
  openingTimes: 'Wednesday-Sunday, 10am-4pm; last admission 3.30pm.',
  admission: 'Adult £8; child £4; family £20.',
  timeToSpend: 'Allow 60-90 minutes.',
  dogAccess: researchedDogAccess,
};

const food = {
  score: 78,
  tagline: 'Courtyard coffee and cake',
  reason: 'A relaxed independent cafe known for house-roasted coffee and seasonal baking.',
  openingTimes: 'Monday-Saturday, 9am-4pm; Sunday, 10am-3pm.',
  priceBand: '££',
  foodStyle: 'Independent cafe and bakery',
  dogAccess: researchedDogAccess,
};

describe('visitor publication contract', () => {
  it('publishes a fully researched attraction', () => {
    expect(isPublishableAttraction(attraction)).toBe(true);
  });

  it('accepts the visitorScore field used by assembled public cards', () => {
    const card = { ...attraction, score: undefined };

    expect(attractionPublicationIssues({ ...card, visitorScore: 86 })).toEqual([]);
  });

  it('rejects attraction placeholders and unrealistic durations', () => {
    expect(
      attractionPublicationIssues({
        ...attraction,
        tagline: 'Visitor highlight',
        openingTimes: 'Check opening hours',
        admission: 'Pay',
        timeToSpend: '5-20 minutes',
      }),
    ).toEqual([
      'specific short highlight pill missing',
      'usable opening times missing',
      'realistic time to spend missing',
      'explicit price or free status missing',
    ]);
  });

  it('requires a source-backed dog policy rather than a generated fallback', () => {
    const unresearched: DogAccessInfo = {
      rating: 0,
      status: 'unconfirmed',
      label: 'Check before visiting',
      summary: 'Check the official website or contact the operator before travelling with a dog.',
      reviewedAt: '2026-08-13',
    };
    expect(hasResearchedDogAccess(unresearched)).toBe(false);
    expect(isPublishableAttraction({ ...attraction, dogAccess: unresearched })).toBe(false);
  });

  it('accepts an honestly researched unpublished dog policy', () => {
    expect(
      hasResearchedDogAccess({
        rating: 0,
        status: 'unconfirmed',
        label: 'Policy not published',
        summary: 'No reliable current dog policy is published on the operator visitor page.',
        sourceName: 'Operator visitor page',
        sourceUrl: 'https://visitor.example.org/access',
        reviewedAt: '2026-08-13',
      }),
    ).toBe(true);
  });

  it('publishes complete food research and rejects missing visitor facts', () => {
    expect(isPublishableFood(food)).toBe(true);
    expect(
      foodPublicationIssues({
        ...food,
        tagline: 'Top food stop',
        priceBand: undefined,
        foodStyle: undefined,
      }),
    ).toEqual([
      'specific short highlight pill missing',
      'consistent price band missing',
      'food style missing',
    ]);
  });

  it('publishes only food places in the 60-100 score bands', () => {
    expect(isPublishableFood({ ...food, score: 60 })).toBe(true);
    expect(isPublishableFood({ ...food, score: 100 })).toBe(true);
    expect(foodPublicationIssues({ ...food, score: 59 })).toContain(
      'food score must be between 60 and 100',
    );
  });
});
