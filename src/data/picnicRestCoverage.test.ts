import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { publishedProjectPackages } from './publishedProjects';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const generatedTags = new Set(['verified-picnic-facility', 'picnic-rest-fallback']);

function isGenerated(tags: string[]): boolean {
  return tags.some((tag) => generatedTags.has(tag));
}

describe('bundled picnic and rest-stop coverage', () => {
  it('publishes every generated facility through the picnic category inside its active boundary', () => {
    let generatedCount = 0;

    for (const pkg of publishedProjectPackages) {
      const picnicIds = new Set(publishedPlannerCurationForProject(pkg.project.id).picnic ?? []);
      const boundary = pkg.project.townStudyArea?.visitorBoundary ?? pkg.project.boundary;

      for (const feature of pkg.features.filter((item) => isGenerated(item.tags))) {
        generatedCount += 1;
        expect(picnicIds.has(feature.id), `${pkg.project.locality}: ${feature.name}`).toBe(true);
        const geometry = feature.geometry;
        expect(geometry?.type, `${pkg.project.locality}: ${feature.name}`).toBe('Point');
        if (!geometry || geometry.type !== 'Point') {
          throw new Error(`${pkg.project.locality}: ${feature.name} is not a point`);
        }
        expect(
          booleanPointInPolygon(point(geometry.coordinates), boundary),
          `${pkg.project.locality}: ${feature.name}`,
        ).toBe(true);
        expect(feature.name).not.toMatch(/^(bench|picnic table|picnic site|outdoor seating)$/i);
        expect(feature.reviewed).toBe(true);
        expect(
          feature.sourceRecords.some(
            (source) =>
              source.sourceOrganisation.includes('OpenStreetMap') &&
              /^https:\/\/www\.openstreetmap\.org\/(node|way)\//.test(source.sourceUrl ?? ''),
          ),
        ).toBe(true);
        expect(feature.sourceRecords.map((source) => source.notes).join(' ')).not.toMatch(
          /access=(?:no|private|permit|customers|residents|military)/i,
        );
      }
    }

    expect(generatedCount).toBeGreaterThan(1_500);
  });

  it('labels bench fallbacks honestly and keeps the reference towns useful', () => {
    const generatedBenches = publishedProjectPackages.flatMap((pkg) =>
      pkg.features.filter((feature) => feature.tags.includes('picnic-rest-fallback')),
    );

    expect(generatedBenches.length).toBeGreaterThan(1_000);
    expect(generatedBenches.every((feature) => /rest bench$/i.test(feature.name))).toBe(true);
    expect(
      generatedBenches.every((feature) => !feature.tags.includes('verified-picnic-facility')),
    ).toBe(true);

    const expected = new Map([
      [
        'kirriemuir-scotland',
        [
          'Kirrie Hill Picnic Area',
          'Kirrie Hill Picnic Tables',
          'Barrie Garden rest bench',
          'Rosefield Community Garden rest bench',
          'The Den rest bench',
        ],
      ],
      [
        'south-queensferry-scotland',
        [
          'The Binks east picnic table',
          'The Binks west picnic table',
          'Forth Bridges rest bench',
          'Inchcolm Park rest bench',
          'Queensferry Museum rest bench',
        ],
      ],
    ]);

    for (const [projectId, names] of expected) {
      const pkg = publishedProjectPackages.find((item) => item.project.id === projectId);
      expect(pkg).toBeDefined();
      const picnicIds = new Set(publishedPlannerCurationForProject(projectId).picnic ?? []);
      expect(
        pkg!.features
          .filter((feature) => picnicIds.has(feature.id))
          .map((feature) => feature.name)
          .sort(),
      ).toEqual([...names].sort());
    }
  });
});
