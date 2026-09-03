import { describe, expect, it } from 'vitest';
import { hasHistoricTimelineDate } from '../domain/timeline';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { quarriersVillagePackage } from './quarriersVillage';

describe("Quarrier's Village published package", () => {
  it('uses the official NRS locality boundary and publishes source-backed statutory and community evidence', () => {
    expect(quarriersVillagePackage.project.boundary.properties?.localityName).toBe(
      "Quarrier's Village",
    );
    expect(quarriersVillagePackage.project.boundary.properties?.localityCode).toBe('S52000531');
    expect(quarriersVillagePackage.project.region).toBe('Inverclyde');
    expect(quarriersVillagePackage.features).toHaveLength(57);
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

  it('has a restrained visitor-guide identity and curated planner places', () => {
    expect(quarriersVillagePackage.project.touristAppeal).toMatchObject({
      rating: 0,
      label: 'Not a tourist town',
    });
    expect(quarriersVillagePackage.project.visualIdentity).toMatchObject({
      theme: 'planned-village',
      heroImage: '/town-guides/quarriers-village-watercolour-guide.png',
      primaryColour: '#153A3F',
    });
    expect(quarriersVillagePackage.project.townGuide).toMatchObject({
      headline: 'A quiet model village of sandstone homes, gardens and social history',
      suggestedTime: 'One to two hours',
    });
    expect(
      quarriersVillagePackage.project.townGuide?.intro.toLocaleLowerCase(),
    ).not.toMatch(/\b(parking|toilet|toilets)\b/);

    expect(topVisitPlaces(quarriersVillagePackage, 5).map((place) => place.name)).toEqual([
      'Mount Zion Church',
      "Quarrier's Village heritage walk",
      'Homelea and Faith Avenue cottage homes',
      "Quarriers' War Memorial",
    ]);

    const curation = publishedPlannerCurationForProject('quarriers-village-scotland');
    expect(
      visitorNeedPlaces(quarriersVillagePackage, 'eat', 5, {
        curatedFeatureIds: curation.eat,
      }).map((place) => [place.name, place.visitorScore, place.priceBand]),
    ).toEqual([['Three Sisters Bake', 62, '££']]);
    expect(
      visitorNeedPlaces(quarriersVillagePackage, 'trails', 5, {
        curatedFeatureIds: curation.trails,
      }).map((place) => [place.name, place.externalUrl]),
    ).toEqual([
      [
        "Quarrier's Village Avenues and Church Treasure Trail",
        'https://www.treasuretrails.co.uk/products/things-to-do-quarriers-village-glasgow-lanarkshire',
      ],
      [
        "Quarrier's Village heritage walk",
        'https://main.carers.quarriers.org.uk/latest/resources/',
      ],
    ]);
    expect(
      visitorNeedPlaces(quarriersVillagePackage, 'parking', 5, {
        curatedFeatureIds: curation.parking,
      }).map((place) => place.name),
    ).toEqual(['Faith Avenue parking']);
    expect(visitorNeedPlaces(quarriersVillagePackage, 'picnic', 5, {
      curatedFeatureIds: curation.picnic,
    })).toEqual([]);
  });
});
