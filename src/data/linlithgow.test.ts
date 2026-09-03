import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { publishedPlannerCuration } from './visitorPlannerCuration';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { linlithgowPackage } from './linlithgow';

describe('Linlithgow published package', () => {
  it('publishes the NRS locality-backed Linlithgow package with reviewed non-map evidence', () => {
    expect(linlithgowPackage.project.id).toBe('linlithgow-scotland');
    expect(linlithgowPackage.project.region).toBe('West Lothian');
    expect(linlithgowPackage.features).toHaveLength(729);
    expect(linlithgowPackage.validation).toHaveLength(0);

    const listedBuildings = linlithgowPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(166);
    expect(listedBuildings.filter(hasEstablishedDate)).toHaveLength(164);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(157);

    expect(
      linlithgowPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(159);

    const currentPlaces = linlithgowPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(275);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = linlithgowPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(22);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      linlithgowPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(100);
  });

  it('publishes a boundary-checked destination guide and curated visitor planner', () => {
    expect(linlithgowPackage.project.touristAppeal).toEqual(
      expect.objectContaining({ rating: 3, label: 'Destination draw' }),
    );
    expect(linlithgowPackage.project.visualIdentity).toEqual(
      expect.objectContaining({
        theme: 'royal-palace-loch-and-canal',
        heroImage: '/town-guides/linlithgow-palace-loch-watercolour-guide.png',
      }),
    );
    expect(linlithgowPackage.project.townGuide?.intro).not.toMatch(/parking|toilets/i);
    expect(linlithgowPackage.project.visitorHighlights).toHaveLength(6);
    expect(linlithgowPackage.project.visitorHighlights?.map((place) => place.visitorScore)).toEqual([
      93, 89, 83, 82, 78, 72,
    ]);

    const curation = publishedPlannerCuration['linlithgow-scotland'];
    expect(curation.eat).toHaveLength(7);
    expect(curation.trails).toHaveLength(4);
    expect(curation.parking).toHaveLength(5);
    expect(curation.toilets).toHaveLength(3);
    expect(curation.picnic).toHaveLength(2);

    const publishedIds = [
      ...(linlithgowPackage.project.visitorHighlights ?? []).map((place) => place.featureId),
      ...Object.values(curation).flat(),
    ];
    const boundary = linlithgowPackage.project.townStudyArea?.localityBoundary;
    expect(boundary).toBeDefined();
    for (const id of new Set(publishedIds)) {
      const feature = linlithgowPackage.features.find((candidate) => candidate.id === id);
      expect(feature?.geometry?.type, id).toBe('Point');
      if (feature?.geometry?.type === 'Point' && boundary) {
        expect(booleanPointInPolygon(point(feature.geometry.coordinates), boundary), id).toBe(true);
      }
    }
  });
});
