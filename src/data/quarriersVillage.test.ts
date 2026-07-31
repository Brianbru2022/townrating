import { describe, expect, it } from 'vitest';
import { hasHistoricTimelineDate } from '../domain/timeline';
import { validateFeatures } from '../domain/validation';
import { quarriersVillagePackage } from './quarriersVillage';

describe("Quarrier's Village published package", () => {
  it('uses the official NRS locality boundary and publishes source-backed statutory and community evidence', () => {
    expect(quarriersVillagePackage.project.boundary.properties?.localityName).toBe(
      "Quarrier's Village",
    );
    expect(quarriersVillagePackage.project.boundary.properties?.localityCode).toBe('S52000531');
    expect(quarriersVillagePackage.project.region).toBe('Inverclyde');
    expect(quarriersVillagePackage.features).toHaveLength(53);
    const listedBuildings = quarriersVillagePackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(12);
    expect(
      listedBuildings.filter((feature) => feature.tags.includes('town-selection-inside-locality')),
    ).toHaveLength(9);
    expect(
      listedBuildings.filter((feature) => feature.evidenceScope === 'related_context'),
    ).toHaveLength(3);
    expect(
      listedBuildings
        .filter((feature) => feature.tags.includes('town-selection-inside-locality'))
        .every(hasHistoricTimelineDate),
    ).toBe(true);
    expect(
      quarriersVillagePackage.features.find(
        (feature) => feature.id === 'hes-listed-building:LB48940',
      ),
    ).toMatchObject({
      name: 'Mount Zion Church, Church Road, Quarriers Village',
      earliestPossibleYear: 1888,
      latestPossibleYear: 1910,
    });
    expect(
      quarriersVillagePackage.features.filter((feature) => feature.id.startsWith('nrhe:')),
    ).toHaveLength(24);
    expect(
      quarriersVillagePackage.features.find(
        (feature) => feature.id === 'hes-listed-building:LB13232',
      )?.additionalPointLocations,
    ).toHaveLength(6);
    expect(
      quarriersVillagePackage.features.filter((feature) =>
        feature.tags.includes('osm-community-place'),
      ),
    ).toHaveLength(13);
    expect(
      quarriersVillagePackage.features.find(
        (feature) => feature.id === 'curated:public-art-the-lost-xvii',
      ),
    ).toMatchObject({
      documentedDateText: 'Created 1990',
      evidenceScope: 'related_context',
      reviewed: true,
    });
    expect(
      quarriersVillagePackage.features.find((feature) => feature.id === 'curated:plaque-holmlea'),
    ).toMatchObject({
      featureType: 'plaque',
      dateBasis: 'present_by',
      earliestPossibleYear: 2020,
      reviewed: true,
    });
    expect(
      quarriersVillagePackage.features.find((feature) => feature.id === 'nrhe:340549')?.tags,
    ).toContain('community-memorial');
    expect(
      quarriersVillagePackage.features.find(
        (feature) => feature.id === 'osm-community:node-13202468343',
      )?.tags,
    ).toContain('map-hidden');
    expect(
      validateFeatures(quarriersVillagePackage.project, quarriersVillagePackage.features),
    ).not.toContainEqual(expect.objectContaining({ severity: 'error' }));
  });
});
