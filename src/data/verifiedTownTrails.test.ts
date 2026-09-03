import { describe, expect, it } from 'vitest';
import trailSourceRegistry from '../../data/trail-source-registry.json';
import { publishedProjectPackages } from './publishedProjects';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('verified non-Treasure-Trails routes', () => {
  it('ships every verified route in its town package and planner category', () => {
    for (const trail of trailSourceRegistry.trails) {
      const pkg = publishedProjectPackages.find((candidate) => candidate.project.id === trail.projectId);
      expect(pkg, trail.projectId).toBeDefined();
      const feature = pkg?.features.find((candidate) => candidate.id === trail.featureId);
      expect(feature, trail.featureId).toBeDefined();
      expect(feature?.featureType).toBe('walking_route');
      expect(feature?.sourceRecords[0]?.sourceUrl).toBe(trail.url);
      expect(publishedPlannerCurationForProject(trail.projectId).trails).toContain(trail.featureId);
    }
  });
});
