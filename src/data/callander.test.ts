import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { callanderPackage } from './callander';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Callander published package', () => {
  it('uses an OSM-provenance visitor boundary and a Callander guide identity', () => {
    expect(callanderPackage.project.boundary.properties).toMatchObject({
      sourceDataset: 'Curated Callander visitor study boundary',
      localityName: 'Callander',
      originalSourceDataset: 'OpenStreetMap Nominatim place polygon',
      originalOsmType: 'way',
      originalOsmId: 369986773,
      visitorExtensionReviewedAt: '2026-08-06',
    });
    expect(callanderPackage.project.townStudyArea).toMatchObject({
      localityName: 'Callander',
      localityCode: '369986773',
      sourceName: 'OpenStreetMap Nominatim place polygon',
    });
    expect(callanderPackage.project.visualIdentity).toMatchObject({
      theme: 'trossachs-waterfall',
      badgeImage: '/town-guides/callander-bracklinn-falls-guide.png',
      heroImage: '/town-guides/callander-bracklinn-falls-guide.png',
      primaryColour: '#173F3D',
      accentColour: '#7B8F3E',
      backgroundColour: '#EEF6E8',
    });
    expect(callanderPackage.project.townGuide?.headline).toBe(
      'Waterfalls, crag-top views and a lively Trossachs base',
    );
    expect(callanderPackage.project.touristAppeal).toMatchObject({
      rating: 2,
      label: 'Worth a planned stop',
    });
    expect(callanderPackage.project.townStudyArea?.visitorBoundary).toEqual(
      callanderPackage.project.boundary,
    );
  });

  it('publishes the researched Callander attraction list and scores', () => {
    const attractions = topVisitPlaces(callanderPackage, 10);

    expect(attractions.map((place) => place.name)).toEqual([
      'Bracklinn Falls and Bridge',
      'Hamilton Toy Museum and Collectors Shop',
      'Ancaster Square and historic Main Street',
      'Old Kirkyard, Watch House and Tom na Chisaig',
      'Red Bridge and River Teith',
    ]);
    expect(attractions.map((place) => place.visitorScore)).toEqual([88, 78, 64, 57, 52]);
    expect(attractions.map((place) => place.freeAdmission)).toEqual([
      true,
      false,
      true,
      true,
      true,
    ]);
  });

  it('keeps every published visitor marker inside the active curated boundary', () => {
    const featuresById = new Map(callanderPackage.features.map((feature) => [feature.id, feature]));
    const curation = publishedPlannerCurationForProject('callander-scotland');
    const featureIds = new Set([
      ...(callanderPackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);

    for (const featureId of featureIds) {
      const feature = featuresById.get(featureId);
      expect(feature, featureId).toBeDefined();
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point') {
        throw new Error(`${featureId} is not mapped as a point`);
      }
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), callanderPackage.project.boundary),
        featureId,
      ).toBe(true);
    }
  });

  it('ships the audited Callander food, trail and practical lists', () => {
    const curation = publishedPlannerCurationForProject('callander-scotland');

    const food = visitorNeedPlaces(callanderPackage, 'eat', 20, {
      curatedFeatureIds: curation.eat,
    });
    expect(food.map((place) => place.name)).toEqual([
      'Grace Restaurant at Callander Meadows',
      'Puddingstone Place',
      'Deli Ecosse',
      'Pips Coffee House',
      'Atrium Cafe',
      'The Waverley Hotel',
      'The Riverside Inn',
      'Ben Ledi Coffee Company',
    ]);
    expect(food.map((place) => place.visitorScore)).toEqual([87, 84, 82, 80, 79, 76, 74, 72]);
    expect(food.filter((place) => place.dogFriendly).map((place) => place.name)).toEqual([
      'Grace Restaurant at Callander Meadows',
      'Pips Coffee House',
      'Atrium Cafe',
      'The Waverley Hotel',
      'The Riverside Inn',
      'Ben Ledi Coffee Company',
    ]);

    const trails = visitorNeedPlaces(callanderPackage, 'trails', 20, {
      curatedFeatureIds: curation.trails,
    });
    expect(trails.map((place) => place.name)).toEqual([
      'Bracklinn Falls Circuit',
      'Callander Riverfront and Square Treasure Trail',
      'Callander Crags',
      'Callander Heritage Trail - Stories in the Stones',
      'Callander Meadows and River Teith',
      'Three Bridges of Callander',
      'Lower Woods',
      'Callander Glacier Trail',
    ]);
    expect(trails.map((place) => place.visitorScore)).toEqual([88, 88, 85, 81, 76, 75, 72, 70]);

    const parking = visitorNeedPlaces(callanderPackage, 'parking', 10, {
      curatedFeatureIds: curation.parking,
    });
    expect(parking.map((place) => place.name)).toEqual([
      'Station Road Car Park',
      'Riverside - The Meadows Car Park',
      'North Ancaster Square Car Park',
      'Glenartney Road Car Park',
      'Bracklinn Falls Car Park',
    ]);
    expect(
      parking.map((place) =>
        parkingPriceStatus(callanderPackage.features.find((feature) => feature.id === place.id)!),
      ),
    ).toEqual(['paid', 'paid', 'free', 'free', 'free']);

    expect(
      visitorNeedPlaces(callanderPackage, 'toilets', 10, {
        curatedFeatureIds: curation.toilets,
      }).map((place) => place.name),
    ).toEqual([
      'Station Road Car Park public toilets',
      'McLaren Community Leisure Centre toilets, Mollands Road',
      'Callander Library toilets, South Church Street',
    ]);
    expect(
      visitorNeedPlaces(callanderPackage, 'picnic', 10, {
        curatedFeatureIds: curation.picnic,
      }).map((place) => place.name),
    ).toEqual(['Bracklinn Falls circuit picnic bench']);
  });
});
