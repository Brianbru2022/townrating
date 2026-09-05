import { describe, expect, it } from 'vitest';
import { validateFeatures } from '../domain/validation';
import { homeTownOverviews } from '../map/homeOverview';
import { kettinsCollacePackages } from './kettinsCollace';
import { publishedProjectPackages } from './publishedProjects';

describe('Kettins parish to Lundie sequential audit', () => {
  it('keeps every requested place selectable, with Leys transparently representing both parish hamlets', () => {
    expect(kettinsCollacePackages).toHaveLength(18);
    expect(kettinsCollacePackages.map((pkg) => pkg.project.name)).toEqual([
      'Coupar Angus', 'Kettins', 'Markethill', 'Hallyburton House', 'Leys (Easter and Wester Leys)', 'Pitcur',
      'Campmuir', 'Woodside', 'Burrelton', 'Saucher', 'Collace', 'Kirkton of Collace', 'Bandirran', 'Abernyte',
      'Rossie Priory', 'Knapp', 'Littleton', 'Lundie',
    ]);
  });

  it('does not manufacture visitor attractions or borrow facilities across the strict micro-locality boundaries', () => {
    expect(kettinsCollacePackages.every((pkg) => (pkg.project.visitorHighlights ?? []).length === 0)).toBe(true);
    expect(kettinsCollacePackages.every((pkg) => (pkg.project.touristAppeal?.score ?? 100) < 60)).toBe(true);
    expect(homeTownOverviews(kettinsCollacePackages)).toEqual([]);
  });

  it('retains provenance, separated dog scores, a reviewed boundary and a clean schema result for every guide', () => {
    for (const pkg of kettinsCollacePackages) {
      expect(pkg.project.touristAppeal?.dogOwnerScore).toBeLessThanOrEqual(pkg.project.touristAppeal?.score ?? 0);
      expect(pkg.project.touristAppeal?.sourceUrls?.length).toBeGreaterThan(2);
      expect(pkg.project.townStudyArea?.visitorBoundary).toBeDefined();
      expect(pkg.sources.every((source) => Boolean(source.licence && source.sourceUrl))).toBe(true);
      expect(validateFeatures(pkg.project, pkg.features)).toEqual([]);
      expect(publishedProjectPackages.some((candidate) => candidate.project.id === pkg.project.id)).toBe(true);
    }
  });
});
