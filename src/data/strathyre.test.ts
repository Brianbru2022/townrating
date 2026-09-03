import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { touristAppealLabel } from '../domain/tourism';
import { validateFeatures } from '../domain/validation';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { foodRecommendation, topVisitPlaces, trailRecommendation, visitRecommendation } from '../domain/visiting';
import { strathyrePackage } from './strathyre';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

const curation = publishedPlannerCurationForProject('strathyre-scotland');

describe('Strathyre published package', () => {
  it('uses the OSM-derived village boundary and preserves the strict planner rule', () => {
    expect(strathyrePackage.project.boundary.properties).toMatchObject({
      sourceDataset: 'OSM-derived Strathyre visitor-town boundary',
      localityName: 'Strathyre',
      residentialBufferMetres: 90,
      visitorSpineBufferMetres: 120,
    });
    expect(strathyrePackage.project.townStudyArea).toMatchObject({
      sourceName: 'OpenStreetMap residential landuse-derived visitor boundary',
      bufferMetres: 90,
    });
    expect(strathyrePackage.project.townStudyArea?.notes).toContain(
      'NRS 2022 does not publish Strathyre as a census locality',
    );
    expect(strathyrePackage.project.centre).toEqual([-4.3289, 56.3242]);
    expect(validateFeatures(strathyrePackage.project, strathyrePackage.features)).not.toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('keeps Strathyre as an unstarred specialist outdoor stop with a finished guide', () => {
    expect(strathyrePackage.project.touristAppeal).toMatchObject({
      rating: 0,
      label: 'Not a tourist town',
    });
    expect(touristAppealLabel(strathyrePackage.project)).toBe('Strathyre ⊘');
    expect(strathyrePackage.project.visualIdentity).toMatchObject({
      theme: 'river-forest-and-highland-routes',
      heroImage: '/town-guides/strathyre-river-forest-watercolour-guide.png',
    });
    expect(strathyrePackage.project.townGuide?.headline).toBe(
      'Forest trails, public art and a Highland village tucked between the hills',
    );
    expect(strathyrePackage.project.townGuide?.intro).not.toMatch(/parking|toilet/i);
    expect(strathyrePackage.project.townGuide?.perfectFor).toHaveLength(3);
  });

  it('publishes sights as sights rather than misclassifying walks as attractions', () => {
    const sights = topVisitPlaces(strathyrePackage, 10);
    expect(sights.map((place) => place.name)).toEqual([
      'BLiSS Trail Strathyre sculptures',
      'Dugald Buchanan Monument',
      'Strathyre station heritage and heron fountain',
    ]);
    expect(sights.map((place) => place.visitorScore)).toEqual([53, 44, 42]);
    expect(sights.map((place) => visitRecommendation(place.visitorScore)?.label)).toEqual([
      'Worth a look',
      'Point of interest',
      'Point of interest',
    ]);
    expect(
      strathyrePackage.features.find((feature) => feature.id === 'hes-listed-building:LB50348'),
    ).toMatchObject({
      name: 'Dugald Buchanan Monument',
      earliestPossibleYear: 1883,
      latestPossibleYear: 1883,
      dateConfidence: 'high',
    });
  });

  it('publishes the researched food stop and outdoor routes with the agreed score bands', () => {
    const food = visitorNeedPlaces(strathyrePackage, 'eat', 10, {
      curatedFeatureIds: curation.eat,
    });
    expect(food.map((place) => place.name)).toEqual(['The Broch Café']);
    expect(food[0]).toMatchObject({ visitorScore: 84, dogFriendly: true, priceBand: '££' });
    expect(foodRecommendation(food[0]?.visitorScore)?.label).toBe('Top food stop');

    const trails = visitorNeedPlaces(strathyrePackage, 'trails', 10, {
      curatedFeatureIds: curation.trails,
    });
    expect(trails.map((place) => place.name)).toEqual([
      'An Sidhean viewpoint route',
      'Rob Roy Loop',
      'Tighanes Burn Trail',
      'NCN 7 Strathyre railway path',
    ]);
    expect(trails.map((place) => place.visitorScore)).toEqual([84, 82, 79, 76]);
    expect(trails.map((place) => trailRecommendation(place.visitorScore)?.label)).toEqual([
      'Recommended',
      'Recommended',
      'Interesting trail',
      'Interesting trail',
    ]);
  });

  it('ships named public facilities and does not promote the limited hall spaces as parking', () => {
    const parking = visitorNeedPlaces(strathyrePackage, 'parking', 10, {
      curatedFeatureIds: curation.parking,
    });
    expect(parking.map((place) => place.name)).toEqual([
      'Strathyre Village Forest car park',
      'Broch Field community car park - donation requested',
    ]);
    expect(
      parkingPriceStatus(
        strathyrePackage.features.find((feature) => feature.id === parking[0]?.id)!,
      ),
    ).toBe('free');
    expect(curation.parking).not.toContain('curated-parking:strathyre-strathyre-village-hall');

    expect(
      visitorNeedPlaces(strathyrePackage, 'toilets', 10, {
        curatedFeatureIds: curation.toilets,
      }).map((place) => place.name),
    ).toEqual(['Strathyre Village Hall public toilets, Main Street']);
    expect(
      visitorNeedPlaces(strathyrePackage, 'picnic', 10, {
        curatedFeatureIds: curation.picnic,
      }).map((place) => place.name),
    ).toEqual([
      'Strathyre Village Forest picnic tables, beside the car park',
      'Broch Field picnic benches, beside NCN 7',
    ]);
  });

  it('keeps every published marker inside the active visitor boundary', () => {
    const featuresById = new Map(strathyrePackage.features.map((feature) => [feature.id, feature]));
    const featureIds = new Set([
      ...(strathyrePackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);
    const boundary =
      strathyrePackage.project.townStudyArea?.visitorBoundary ?? strathyrePackage.project.boundary;

    for (const featureId of featureIds) {
      const feature = featuresById.get(featureId);
      expect(feature, featureId).toBeDefined();
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point') throw new Error(`${featureId} is not a point`);
      expect(booleanPointInPolygon(point(feature.geometry.coordinates), boundary), featureId).toBe(
        true,
      );
    }
  });
});
