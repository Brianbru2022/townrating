import { describe, expect, it } from 'vitest';
import type { TownProject } from './models';
import {
  touristAppealIndicator,
  touristAppealLabel,
  touristAppealSummary,
  townDogAccessScoreAdjustment,
  townScoreAfterDogAccess,
  townScoreBand,
} from './tourism';

describe('tourist appeal labels', () => {
  it('adds a compact star suffix when a project has a tourist draw rating', () => {
    const project = {
      locality: 'Linlithgow',
      touristAppeal: { rating: 3, label: 'Strong visitor draw' },
    } as TownProject;

    expect(touristAppealLabel(project)).toBe('Linlithgow ★★★');
    expect(touristAppealSummary(project)).toBe('Strong visitor draw');
  });

  it('falls back to the plain town name when a project has no tourist rating', () => {
    expect(touristAppealLabel({ locality: 'Example' } as TownProject)).toBe('Example');
  });

  it('preserves the legacy zero indicator for unscored towns', () => {
    const project = {
      locality: 'Kirknewton',
      touristAppeal: { rating: 0, label: 'Not a tourist town' },
    } as TownProject;

    expect(touristAppealIndicator(project)).toBe('⊘');
    expect(touristAppealLabel(project)).toBe('Kirknewton ⊘');
    expect(touristAppealSummary(project)).toBe('Not a tourist town');
  });

  it('does not show a destination badge for a numerical score below 60', () => {
    const project = {
      locality: 'Example',
      touristAppeal: { score: 59, rating: 0, label: 'Minor Interest' },
    } as TownProject;
    expect(touristAppealLabel(project)).toBe('Example');
  });

  it.each([
    [59, 0, '', 'Minor Interest'],
    [60, 0, '◆', 'Notable Stop'],
    [69, 0, '◆', 'Notable Stop'],
    [70, 1, '★', 'Worth a Visit'],
    [79, 1, '★', 'Worth a Visit'],
    [80, 2, '★★', 'Strong Destination'],
    [89, 2, '★★', 'Strong Destination'],
    [90, 3, '★★★', 'Exceptional Destination'],
  ] as const)('derives the public band at score %i', (score, rating, indicator, label) => {
    expect(townScoreBand(score)).toEqual({ rating, indicator, label });
  });

  it('rejects scores outside 0-100', () => {
    expect(() => townScoreBand(-1)).toThrow(/0 and 100/);
    expect(() => townScoreBand(101)).toThrow(/0 and 100/);
  });

  it('uses the numerical score for the notable-stop diamond', () => {
    const project = {
      locality: 'Burton',
      touristAppeal: { score: 62, rating: 0, label: 'Notable Stop' },
    } as TownProject;
    expect(touristAppealLabel(project)).toBe('Burton ◆');
  });

  it('allows dog access to reduce a town score slightly, but never increase it', () => {
    expect(townDogAccessScoreAdjustment(3)).toBe(0);
    expect(townDogAccessScoreAdjustment(2)).toBe(-1);
    expect(townDogAccessScoreAdjustment(1)).toBe(-2);
    expect(townDogAccessScoreAdjustment(0)).toBe(-3);
    expect(townScoreAfterDogAccess(65, 2)).toBe(64);
    expect(townScoreAfterDogAccess(65, 3)).toBe(65);
  });
});
