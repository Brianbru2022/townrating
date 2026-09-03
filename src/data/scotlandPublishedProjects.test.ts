import { describe, expect, it } from 'vitest';
import { publishedProjectPackages } from './publishedProjects';

describe('Scottish published town library', () => {
  it('contains all 145 currently reviewed Scottish settlements and localities', () => {
    expect(publishedProjectPackages).toHaveLength(145);
    expect(new Set(publishedProjectPackages.map((pkg) => pkg.project.id)).size).toBe(145);
    expect(publishedProjectPackages.every((pkg) => pkg.project.countryCode === 'GB-SCT')).toBe(
      true,
    );
  });

  it('has a fresh town rating and separate dog-owner rating for every settlement', () => {
    for (const pkg of publishedProjectPackages) {
      const appeal = pkg.project.touristAppeal;
      expect(appeal?.reviewedAt, pkg.project.id).toMatch(/^2026-08-(25|26|27)$/);
      expect(appeal?.score, pkg.project.id).toBeGreaterThanOrEqual(0);
      expect(appeal?.score, pkg.project.id).toBeLessThanOrEqual(100);
      expect(appeal?.dogAccessRating, pkg.project.id).toBeGreaterThanOrEqual(1);
      expect(appeal?.dogAccessRating, pkg.project.id).toBeLessThanOrEqual(3);
      expect(appeal?.dogAccessSummary, pkg.project.id).toBeTruthy();
      expect(appeal?.sourceUrls?.length, pkg.project.id).toBeGreaterThan(0);
      expect(appeal?.dogAccessScoreAdjustment, pkg.project.id).toBeLessThanOrEqual(0);
      expect(appeal?.dogOwnerScore, pkg.project.id).toBe(
        (appeal?.score ?? 0) + (appeal?.dogAccessScoreAdjustment ?? 0),
      );
      expect(appeal?.dogOwnerScore, pkg.project.id).toBeLessThanOrEqual(appeal?.score ?? 0);
    }
  });

  it('keeps Alva on the notable-stop band for both audiences', () => {
    const appeal = publishedProjectPackages.find((pkg) => pkg.project.id === 'alva-scotland')
      ?.project.touristAppeal;
    expect(appeal?.score).toBe(65);
    expect(appeal?.dogOwnerScore).toBe(64);
  });
});
