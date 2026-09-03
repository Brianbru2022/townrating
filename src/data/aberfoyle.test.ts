import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { touristAppealLabel } from '../domain/tourism';
import { foodRecommendation, topVisitPlaces, trailRecommendation } from '../domain/visiting';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { homePoiOverviews } from '../map/homeOverview';
import { aberfoylePackage } from './aberfoyle';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Aberfoyle published package', () => {
  it('uses a selective two-star editorial guide and place-led artwork', () => {
    expect(aberfoylePackage.project.touristAppeal).toMatchObject({
      rating: 2,
      label: 'Worth a planned stop',
    });
    expect(touristAppealLabel(aberfoylePackage.project)).toBe('Aberfoyle ★★');
    expect(aberfoylePackage.project.visualIdentity).toMatchObject({
      theme: 'trossachs-village-folklore-and-cycling',
      heroImage: '/town-guides/aberfoyle-main-street-watercolour-guide.png',
      motifs: ['Fairy folklore', 'Forest walks', 'Cycling', 'Village cafes'],
    });
    expect(aberfoylePackage.project.townGuide).toMatchObject({
      headline: 'Fairy folklore, forest-edge walks and a lively village stop',
      suggestedFirstVisit: { title: 'Main Street, Riverside and Doon Hill' },
    });
    expect(
      [
        aberfoylePackage.project.townGuide?.headline,
        aberfoylePackage.project.townGuide?.intro,
        aberfoylePackage.project.townGuide?.visitorMood,
      ].join(' '),
    ).not.toMatch(/parking|toilets|evidence/i);
  });

  it('replaces the imported rectangle with a documented OSM-derived town boundary', () => {
    const studyArea = aberfoylePackage.project.townStudyArea;
    expect(studyArea).toMatchObject({
      localityName: 'Aberfoyle',
      localityCode: '166576344',
      bufferMetres: 100,
      sourceName: 'OpenStreetMap residential landuse-derived visitor boundary',
    });
    expect(studyArea?.localityBoundary.properties?.osmId).toBe(166576344);
    expect(studyArea?.visitorBoundary?.properties?.sourceDataset).toBe(
      'OSM-derived Aberfoyle visitor-town boundary',
    );
    expect(aberfoylePackage.project.boundary).toEqual(studyArea?.visitorBoundary);
  });

  it('publishes only genuine in-town attractions while retaining nearby Home discoveries', () => {
    const attractions = topVisitPlaces(aberfoylePackage, 5);
    expect(attractions.map((place) => place.name)).toEqual([
      'Scottish Wool Centre and seasonal demonstrations',
      'Aberfoyle Bike Park',
    ]);
    expect(attractions.every((place) => place.freeAdmission)).toBe(true);
    expect(attractions.every((place) => !place.organisationPills?.includes('Free'))).toBe(true);
    const standalone = homePoiOverviews([aberfoylePackage], 'attraction', 5).filter(
      (place) => place.discoveryScope === 'standalone',
    );
    expect(standalone.map((place) => place.name)).toEqual([
      'The Lodge Forest Visitor Centre and viewpoint',
      'Three Lochs Forest Drive',
      'Go Ape Aberfoyle',
    ]);
    expect(standalone[0]?.attractionGuide).toMatchObject({
      toilets: expect.any(String),
      picnic: expect.any(String),
      food: [expect.objectContaining({ name: 'The Lodge Cafe', visitorScore: 76 })],
    });
    expect(standalone[0]?.attractionGuide?.trails?.map((trail) => trail.name)).toEqual([
      'Waterfall Trail',
      'Oak Coppice Trail',
      'Craigmore View Trail',
      'Lime Craig Trail',
    ]);
    expect(standalone[1]?.attractionGuide?.trails?.map((trail) => trail.name)).toEqual([
      'Achray Trail',
      'Pine Ridge Trail',
      'Loch Drunkie Trail',
    ]);
    for (const place of standalone.slice(0, 2)) {
      for (const trail of place.attractionGuide?.trails ?? []) {
        expect(trail.externalUrl).toMatch(/^https:\/\//);
      }
    }
    expect(standalone[0]?.attractionGuide?.thingsToDo).toHaveLength(5);
    for (const place of standalone) {
      expect(place.attractionGuide).toMatchObject({
        heroImage: expect.stringMatching(/^\/attraction-guides\/.+\.png$/),
        heroAlt: expect.any(String),
        headline: expect.any(String),
        intro: expect.any(String),
        motifs: expect.arrayContaining([expect.any(String)]),
        bestFor: expect.arrayContaining([expect.any(String)]),
      });
      expect(place.attractionGuide?.thingsToDo?.length).toBeGreaterThan(0);
    }
  });

  it('ships researched food, one official trail and named practical stops', () => {
    const curation = publishedPlannerCurationForProject(aberfoylePackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => aberfoylePackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? [])).toEqual([
      "Maggie's Aberfoyle Kitchen",
      'The Station Coffee Shop',
      'The Faerie Tree',
      'The Forth Inn',
      "Liz MacGregor's Coffee Shop",
      'Aberfoyle Inn',
    ]);
    const food = visitorNeedPlaces(aberfoylePackage, 'eat', 10, {
      curatedFeatureIds: curation.eat,
    });
    expect(food.map((place) => place.visitorScore)).toEqual([84, 82, 80, 78, 75, 71]);
    expect(foodRecommendation(84)?.label).toBe('Top food stop');
    expect(foodRecommendation(78)?.label).toBe('Great choice');
    expect(food.find((place) => place.name === 'The Faerie Tree')?.dogFriendly).toBe(true);
    expect(food.find((place) => place.name === 'The Forth Inn')?.dogFriendly).toBe(true);

    expect(names(curation.trails ?? [])).toEqual(['Doon Hill Trail']);
    expect(
      visitorNeedPlaces(aberfoylePackage, 'trails', 5, {
        curatedFeatureIds: curation.trails,
      })[0]?.visitorScore,
    ).toBe(86);
    expect(trailRecommendation(86)?.label).toBe('Recommended');
    expect(names(curation.parking ?? [])).toEqual(['Riverside Car Park, Main Street']);
    expect(names(curation.toilets ?? [])).toEqual([
      'Riverside Car Park public toilets, Main Street',
    ]);
    expect(names(curation.picnic ?? [])).toEqual([
      'Riverside picnic area, beside the Scottish Wool Centre',
    ]);
    const parking = aberfoylePackage.features.find(
      (feature) => feature.id === curation.parking?.[0],
    );
    expect(parking && parkingPriceStatus(parking)).toBe('free');
  });

  it('keeps every town-planner marker inside the active visitor boundary', () => {
    const activeBoundary = aberfoylePackage.project.townStudyArea?.visitorBoundary;
    expect(activeBoundary).toBeDefined();
    if (!activeBoundary) return;
    const curation = publishedPlannerCurationForProject(aberfoylePackage.project.id);
    const inTownHighlightIds = topVisitPlaces(aberfoylePackage, 5).map((place) => place.id);
    const publicFeatureIds = new Set([...inTownHighlightIds, ...Object.values(curation).flat()]);
    for (const featureId of publicFeatureIds) {
      const feature = aberfoylePackage.features.find((candidate) => candidate.id === featureId);
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point') continue;
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary),
        featureId,
      ).toBe(true);
    }

    for (const featureId of [
      'curated-attraction:aberfoyle-lodge-forest-visitor-centre',
      'three-lochs-drive',
      'go-ape',
    ]) {
      const feature = aberfoylePackage.features.find((candidate) => candidate.id === featureId);
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point') continue;
      expect(
        booleanPointInPolygon(point(feature.geometry.coordinates), activeBoundary),
        featureId,
      ).toBe(false);
    }
  });
});
