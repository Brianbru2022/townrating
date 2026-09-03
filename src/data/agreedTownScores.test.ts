import { describe, expect, it } from 'vitest';
import { publishedProjectPackages } from './publishedProjects';

const removedNonScottishIds = [
  'burton-cheshire-england',
  'neston-cheshire-england',
  'parkgate-cheshire-england',
  'mold-clwyd-wales',
];

describe('agreed numerical town scores', () => {
  it('removes previously agreed non-Scottish towns from the published library', () => {
    for (const id of removedNonScottishIds) {
      expect(publishedProjectPackages.some((pkg) => pkg.project.id === id), id).toBe(false);
    }
  });

  it('publishes Scotland only', () => {
    expect(publishedProjectPackages).toHaveLength(35);
    expect(publishedProjectPackages.every((pkg) => pkg.project.countryCode === 'GB-SCT')).toBe(true);
  });

  it('keeps the reassessed town and dog ratings within their contracts', () => {
    for (const pkg of publishedProjectPackages) {
      expect(pkg.project.touristAppeal?.score).toBeGreaterThanOrEqual(0);
      expect(pkg.project.touristAppeal?.score).toBeLessThanOrEqual(100);
      expect(pkg.project.touristAppeal?.dogAccessRating).toBeGreaterThanOrEqual(1);
      expect(pkg.project.touristAppeal?.dogAccessRating).toBeLessThanOrEqual(3);
      expect(pkg.project.touristAppeal?.dogAccessSummary).toBeTruthy();
      expect(pkg.project.touristAppeal?.sourceUrls?.length).toBeGreaterThan(0);
    }
  });
});
