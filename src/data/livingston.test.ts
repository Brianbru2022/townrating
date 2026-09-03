import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { publishedPlannerCuration } from './visitorPlannerCuration';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { livingstonPackage } from './livingston';

describe('Livingston published package', () => {
  it('publishes the NRS locality-backed Livingston package including Livingston Village', () => {
    expect(livingstonPackage.project.id).toBe('livingston-scotland');
    expect(livingstonPackage.project.region).toBe('West Lothian');
    expect(livingstonPackage.project.name).toBe('Livingston');
    expect(livingstonPackage.project.boundary.properties?.localityName).toBe('Livingston');
    expect(livingstonPackage.project.researchNotes).toContain('Livingston Village');
    expect(livingstonPackage.features).toHaveLength(1144);
    expect(livingstonPackage.validation).toHaveLength(0);

    const livingstonVillageFeatures = livingstonPackage.features.filter((feature) =>
      `${feature.name} ${feature.shortDescription ?? ''}`.includes('Livingston Village'),
    );
    expect(livingstonVillageFeatures.length).toBeGreaterThan(0);

    const listedBuildings = livingstonPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(56);
    expect(listedBuildings.filter(hasEstablishedDate)).toHaveLength(55);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(28);

    expect(
      livingstonPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(78);

    const currentPlaces = livingstonPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(902);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = livingstonPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(17);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      livingstonPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(81);
  });

  it('publishes a strict in-boundary visitor guide without duplicating Almond Valley', () => {
    expect(livingstonPackage.project.touristAppeal).toEqual(
      expect.objectContaining({ rating: 2, label: 'Worth a planned stop' }),
    );
    expect(livingstonPackage.project.visualIdentity).toEqual(
      expect.objectContaining({
        theme: 'river-almond-new-town-and-village',
        heroImage: '/town-guides/livingston-river-almond-watercolour-guide.png',
      }),
    );
    expect(livingstonPackage.project.townGuide?.intro).not.toMatch(/parking|toilets/i);
    expect(livingstonPackage.project.visitorHighlights?.map((place) => place.name)).toEqual([
      'Almond Valley Heritage Centre',
      'Livingston Designer Outlet',
      'Almondvale Park and Livingston Public Art',
      "Livingston 'Livi' Skatepark",
      'Livingston Village historic core',
      'The Wee Museum of Memory',
      'Eliburn Park and Reservoir',
    ]);
    expect(livingstonPackage.project.visitorHighlights?.map((place) => place.visitorScore)).toEqual(
      [86, 81, 78, 72, 66, 64, 62],
    );
    expect(livingstonPackage.project.visitorHighlights?.map((place) => place.name)).not.toContain(
      'Scottish Shale Oil Museum',
    );

    const curation = publishedPlannerCuration['livingston-scotland'];
    expect(curation.eat).toHaveLength(5);
    expect(curation.trails).toHaveLength(3);
    expect(curation.parking).toHaveLength(9);
    expect(curation.parking).toEqual(expect.arrayContaining([
      'osm-community:way-176819736',
      'osm-community:way-44000111',
      'osm-community:way-543190593',
    ]));
    expect(curation.toilets).toHaveLength(6);
    expect(curation.picnic).toHaveLength(4);

    const publishedIds = [
      ...(livingstonPackage.project.visitorHighlights ?? []).map((place) => place.featureId),
      ...Object.values(curation).flat(),
    ];
    const boundary = livingstonPackage.project.townStudyArea?.localityBoundary;
    expect(boundary).toBeDefined();
    for (const id of new Set(publishedIds)) {
      const feature = livingstonPackage.features.find((candidate) => candidate.id === id);
      expect(feature?.geometry?.type, id).toBe('Point');
      if (feature?.geometry?.type === 'Point' && boundary) {
        expect(booleanPointInPolygon(point(feature.geometry.coordinates), boundary), id).toBe(true);
      }
    }
  });
});
