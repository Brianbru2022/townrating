import { describe, expect, it } from 'vitest';
import { hasHistoricTimelineDate } from '../domain/timeline';
import { validateFeatures } from '../domain/validation';
import { biggarPackage } from './biggar';

describe('Biggar published package', () => {
  it('uses the NRS locality and keeps official and current-place sources distinct', () => {
    expect(biggarPackage.project.boundary.properties?.localityName).toBe('Biggar');
    expect(biggarPackage.project.boundary.properties?.localityCode).toBe('S52000066');
    expect(biggarPackage.project.region).toBe('South Lanarkshire');
    const listedBuildings = biggarPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(108);
    expect(
      listedBuildings.filter((feature) => feature.tags.includes('town-selection-inside-locality')),
    ).toHaveLength(100);
    expect(
      listedBuildings.filter((feature) => feature.tags.includes('town-selection-heritage-buffer')),
    ).toHaveLength(8);
    expect(
      new Set(
        listedBuildings.flatMap((feature) =>
          feature.sourceRecords
            .map((source) => source.sourceRecordId)
            .filter((sourceId): sourceId is string => /^LB\d+$/i.test(sourceId ?? '')),
        ),
      ).size,
    ).toBe(108);
    expect(biggarPackage.features.filter((feature) => feature.id.startsWith('nrhe:'))).toHaveLength(
      162,
    );
    expect(
      biggarPackage.features.filter((feature) => feature.tags.includes('osm-community-place')),
    ).toHaveLength(68);
    expect(
      biggarPackage.features.find((feature) => feature.id === 'hes-conservation-area:CA391'),
    ).toBeDefined();
    expect(
      biggarPackage.features.find((feature) => feature.id === 'hes-scheduled-monument:SM2643'),
    ).toBeDefined();
    expect(biggarPackage.features.filter(hasHistoricTimelineDate)).toHaveLength(210);
    expect(
      biggarPackage.features.find((feature) => feature.id === 'hes-listed-building:LB22172'),
    ).toMatchObject({
      featureType: 'factory',
      earliestPossibleYear: 1839,
      latestPossibleYear: 1839,
      reviewed: true,
    });
    expect(biggarPackage.features.find((feature) => feature.id === 'nrhe:199159')?.tags).toContain(
      'community-memorial',
    );
    expect(biggarPackage.features.find((feature) => feature.id === 'nrhe:296342')?.tags).toContain(
      'community-memorial',
    );
    expect(biggarPackage.settlementPolygons).toHaveLength(0);
    expect(validateFeatures(biggarPackage.project, biggarPackage.features)).not.toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
  });
});
