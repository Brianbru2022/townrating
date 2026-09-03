import assessment from '../../data/review/east-neuk-fife-town-assessment-2026-08-25.json';
import { describe, expect, it } from 'vitest';
import { validateFeatures } from '../domain/validation';
import { eastNeukPackages } from './eastNeuk';
import { publishedProjectPackages } from './publishedProjects';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('East Neuk Fife settlement review', () => {
  it('documents all 20 requested places and publishes only the nine scoring 60+', () => {
    expect(assessment.assessments).toHaveLength(20);
    expect(assessment.assessments.filter((item) => item.publish)).toHaveLength(9);
    expect(assessment.assessments.filter((item) => item.publish).every((item) => (item.score ?? 0) >= 60)).toBe(true);
    expect(eastNeukPackages).toHaveLength(9);
  });

  it('does not include rejected hamlets, farms or Balcomie Links in the original 60+ East Neuk map set', () => {
    const publishedNames = new Set(eastNeukPackages.map((pkg) => pkg.project.name));
    for (const item of assessment.assessments.filter((candidate) => !candidate.publish)) {
      expect(publishedNames.has(item.resolvedName), item.resolvedName).toBe(false);
    }
  });

  it('ships a sourced boundary, heat-map features and complete town editorial data', () => {
    for (const pkg of eastNeukPackages) {
      expect(pkg.project.touristAppeal?.score, pkg.project.id).toBeGreaterThanOrEqual(60);
      expect(pkg.project.touristAppeal?.dogOwnerScore, pkg.project.id).toBeLessThanOrEqual(pkg.project.touristAppeal?.score ?? 0);
      expect(pkg.project.townGuide?.sourceUrls.length, pkg.project.id).toBeGreaterThan(0);
      expect(pkg.project.visitorHighlights?.length, pkg.project.id).toBeGreaterThanOrEqual(2);
      expect(pkg.project.townStudyArea?.sourceName, pkg.project.id).toContain('Historic Environment Scotland');
      expect(pkg.features.some((feature) => feature.tags.includes('hes-listed-building')), pkg.project.id).toBe(true);
      expect(validateFeatures(pkg.project, pkg.features).some((result) => result.severity === 'error'), pkg.project.id).toBe(false);
      if (pkg.project.name !== 'Kilrenny' && pkg.project.name !== 'Kilconquhar') {
        expect(
          publishedPlannerCurationForProject(pkg.project.id).trails,
          pkg.project.id,
        ).toHaveLength(pkg.project.name === 'Crail' || pkg.project.name === 'Pittenweem' || pkg.project.name === 'St Monans' || pkg.project.name === 'Elie' || pkg.project.name === 'Earlsferry' ? 3 : pkg.project.name === 'Anstruther' ? 4 : pkg.project.name === 'Cellardyke' ? 2 : 1);
      }
    }
  });
});
