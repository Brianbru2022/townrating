import { describe, expect, it } from 'vitest';
import { hasHistoricTimelineDate } from '../domain/timeline';
import { validateFeatures } from '../domain/validation';
import { killinPackage } from './killin';

describe('Killin published package', () => {
  it('uses the NRS locality and separates statutory, NRHE and present-day sources', () => {
    expect(killinPackage.project.boundary.properties?.localityName).toBe('Killin');
    expect(killinPackage.project.boundary.properties?.localityCode).toBe('S52000349');
    expect(killinPackage.project.region).toBe('Stirling');
    const listed = killinPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listed).toHaveLength(26);
    expect(
      listed.filter((feature) => feature.tags.includes('town-selection-inside-locality')),
    ).toHaveLength(17);
    expect(
      listed.filter((feature) => feature.tags.includes('town-selection-heritage-buffer')),
    ).toHaveLength(9);
    expect(killinPackage.features.filter((feature) => feature.id.startsWith('nrhe:'))).toHaveLength(
      33,
    );
    expect(
      killinPackage.features.filter((feature) => feature.tags.includes('osm-community-place')),
    ).toHaveLength(38);
    expect(killinPackage.features.filter(hasHistoricTimelineDate)).toHaveLength(29);
    expect(
      killinPackage.features.find((feature) => feature.id === 'hes-listed-building:LB8248'),
    ).toMatchObject({
      earliestPossibleYear: 1744,
      reviewed: true,
    });
    expect(killinPackage.historicMaps).toHaveLength(0);
    expect(killinPackage.settlementPolygons).toHaveLength(0);
    expect(validateFeatures(killinPackage.project, killinPackage.features)).not.toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
  });
});
