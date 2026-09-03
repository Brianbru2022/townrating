import { describe, expect, it, vi } from 'vitest';
import type {
  AttractionEditorialAssessment,
  EditorialRecordReview,
  FoodEditorialAssessment,
  ProjectPackage,
} from '../domain/models';
import {
  editorialRatingMethodVersion,
  publishedAttractionScore,
} from '../domain/editorialResearch';
import { attractionPublicationIssues } from '../domain/visitorPublication';
import { attractionVisitPlan } from '../domain/attractionVisit';
import { visitPlaceFromFeature } from '../domain/visitorExperience';
import { publishedDogAccessForPlace } from '../data/dogAccessCuration';
import {
  homePoiOverviews,
  homePoiMatchesDiscoveryScope,
  homePoiMatchesRatingRange,
  homePoiStarRating,
  homePoiPermanentLabelLimit,
  homePoiVisibleAtZoom,
  homeTownOverviewGeoJson,
  homeTownMatchesRatingRange,
  homeTownOverviews,
  selectVisibleHomeLabels,
  sortHomeDiscoveryPois,
  type HomeLabelCandidate,
  type HomeTownOverview,
} from './homeOverview';

vi.mock('../data/dogAccessCuration', () => ({
  publishedDogAccessForPlace: () => ({
    rating: 2,
    status: 'welcoming',
    label: 'Dogs welcome on leads',
    summary: 'Dogs are welcome on leads throughout the publicly accessible visitor areas.',
    sourceName: 'Operator access page',
    sourceUrl: 'https://example.org/access-and-dogs',
    reviewedAt: '2026-08-13',
  }),
}));

function packageFor(
  id: string,
  locality: string,
  rating: 0 | 1 | 2 | 3,
  featureCount: number,
  centre: [number, number],
  score?: number,
): ProjectPackage {
  return {
    project: {
      id,
      locality,
      centre,
      touristAppeal: { score, rating, label: rating === 0 ? 'Not a tourist town' : 'Rated town' },
    },
    features: Array.from({ length: featureCount }, (_, index) => ({ id: `${id}:${index}` })),
  } as unknown as ProjectPackage;
}

function distributeScore(score: number, caps: number[]): number[] {
  let remaining = score;
  return caps.map((cap) => {
    const value = Math.min(cap, remaining);
    remaining -= value;
    return value;
  });
}

function attractionReview(score: number): EditorialRecordReview {
  const [experienceDepth, distinctiveness, presentation, journeyWorth, accessAndReliability, evidenceConfidence] =
    distributeScore(score, [30, 20, 20, 15, 10, 5]);
  const attractionAssessment: AttractionEditorialAssessment = {
    experienceDepth,
    distinctiveness,
    presentation,
    journeyWorth,
    accessAndReliability,
    evidenceConfidence,
    visitability: 'full_visitor_experience',
  };
  return {
    status: 'editorially_researched',
    category: 'attraction',
    methodVersion: editorialRatingMethodVersion,
    reviewedAt: '2026-08-13',
    scoreRationale: 'Test fixture with a reproducible visitor-experience assessment.',
    evidenceUrls: ['https://example.org/visitor-attraction'],
    attractionAssessment,
  };
}

function foodReview(score: number): EditorialRecordReview {
  const [foodAndDrinkQuality, daytimeRelevance, distinctiveness, consistency, visitorFit, evidenceConfidence] =
    distributeScore(score, [30, 20, 15, 15, 10, 10]);
  const foodAssessment: FoodEditorialAssessment = {
    foodAndDrinkQuality,
    daytimeRelevance,
    distinctiveness,
    consistency,
    visitorFit,
    evidenceConfidence,
  };
  return {
    status: 'editorially_researched',
    category: 'food',
    methodVersion: editorialRatingMethodVersion,
    reviewedAt: '2026-08-13',
    scoreRationale: 'Test fixture with a reproducible daytime food assessment.',
    evidenceUrls: ['https://example.org/visitor-cafe'],
    foodAssessment,
  };
}

describe('home town overview labels', () => {
  const packages = [
    packageFor('small-three', 'Small Three', 3, 2, [-3.1, 56.1]),
    packageFor('large-three', 'Large Three', 3, 8, [-3.2, 56.2]),
    packageFor('zero-town', 'Zero Town', 0, 100, [-3.3, 56.3]),
    packageFor('two-star', 'Two Star', 2, 20, [-3.4, 56.4]),
    packageFor('one-star', 'One Star', 1, 50, [-3.5, 56.5]),
  ];

  it('excludes zero-rated towns and keeps label data needed by the map', () => {
    const geoJson = homeTownOverviewGeoJson(packages);

    expect(geoJson.features.map((feature) => feature.properties.id)).not.toContain('zero-town');
    expect(geoJson.features).toContainEqual(
      expect.objectContaining({
        geometry: { type: 'Point', coordinates: [-3.2, 56.2] },
        properties: expect.objectContaining({
          id: 'large-three',
          name: 'Large Three',
          label: 'Large Three ★★★',
          rating: 3,
          stars: '★★★',
          ratingClass: 'rating-3',
          ratingColour: '#b27713',
          featureCount: 8,
          score: 90,
        }),
      }),
    );
  });

  it('prioritises higher ratings, then higher feature counts for same-rated towns', () => {
    expect(homeTownOverviews(packages).map((town) => town.id)).toEqual([
      'large-three',
      'small-three',
      'two-star',
      'one-star',
    ]);
    expect(homeTownOverviews(packages).map((town) => town.collisionPriority)).toEqual([0, 1, 2, 3]);
  });

  it('drops lower-priority overlapping labels while keeping non-overlapping labels visible', () => {
    const [largeThree, smallThree, twoStar] = homeTownOverviews(packages);
    const candidates = [
      labelCandidate(largeThree, 100, 100),
      labelCandidate(smallThree, 106, 102),
      labelCandidate(twoStar, 300, 100),
    ];

    expect(selectVisibleHomeLabels(candidates).map((town) => town.id)).toEqual([
      'large-three',
      'two-star',
    ]);
  });

  it('drops same-rated smaller towns first when labels overlap', () => {
    const [largeThree, smallThree] = homeTownOverviews(packages);
    const candidates = [labelCandidate(smallThree, 100, 100), labelCandidate(largeThree, 100, 100)];

    expect(selectVisibleHomeLabels(candidates).map((town) => town.id)).toEqual(['large-three']);
  });

  it('builds optional attraction and eat overlays from curated places', () => {
    const projectPackage = poiPackageFor();

    expect(homePoiOverviews([projectPackage], 'attraction')).toEqual([
      expect.objectContaining({
        id: 'poi-town:birthplace',
        featureId: 'birthplace',
        projectId: 'poi-town',
        townName: 'POI Town',
        name: 'Birthplace Museum',
        kind: 'attraction',
        discoveryScope: 'town',
        coordinates: [-3.1, 56.1],
        attractionGuide: expect.objectContaining({
          heroImage: '/attraction-guides/birthplace-watercolour-guide.png',
          heroAlt: 'Illustrated birthplace museum',
          headline: 'The story begins here',
          toilets: 'Toilets beside the entrance.',
          thingsToDo: [{ name: 'See the original room' }],
        }),
      }),
      expect.objectContaining({
        id: 'poi-town:outside-view',
        featureId: 'outside-view',
        name: 'Outside Viewpoint',
        kind: 'attraction',
        discoveryScope: 'standalone',
        coordinates: [-3.8, 56.8],
      }),
    ]);
    expect(homePoiOverviews([projectPackage], 'eat', 5, () => ({ eat: ['cafe'] }))).toEqual([
      expect.objectContaining({
        id: 'poi-town:cafe',
        name: 'Town Cafe',
        kind: 'eat',
        discoveryScope: 'town',
        coordinates: [-3.11, 56.11],
      }),
      expect.objectContaining({
        id: 'poi-town:outside-cafe',
        name: 'Outside Cafe',
        kind: 'eat',
        discoveryScope: 'standalone',
        coordinates: [-3.9, 56.9],
      }),
    ]);
  });

  it('applies the same researched attraction publication contract on Home', () => {
    const projectPackage = poiPackageFor();
    const highlight = projectPackage.project.visitorHighlights?.[0];
    const feature = projectPackage.features.find((candidate) => candidate.id === 'birthplace');
    if (!highlight || !feature) throw new Error('Missing attraction fixture');
    const score = publishedAttractionScore(highlight, feature);
    const featurePlace = visitPlaceFromFeature(feature);
    const fallbackPlan = attractionVisitPlan(feature, score);

    expect(score).toBe(88);
    expect(
      attractionPublicationIssues({
        score,
        tagline: highlight.tagline,
        reason: highlight.reason,
        timeToSpend: highlight.timeToSpend ?? featurePlace.timeToSpend ?? fallbackPlan.timeToSpend,
        openingTimes: highlight.openingTimes ?? featurePlace.openingTimes ?? fallbackPlan.openingTimes,
        admission: highlight.admission ?? featurePlace.admission ?? fallbackPlan.admission,
        dogAccess: publishedDogAccessForPlace(projectPackage.project.id, 'attraction', feature.id),
      }),
    ).toEqual([]);
  });

  it('keeps the national map selective and reveals recommended places regionally', () => {
    const projectPackage = poiPackageFor();
    const attractions = homePoiOverviews([projectPackage], 'attraction');
    const food = homePoiOverviews([projectPackage], 'eat', 5, () => ({ eat: ['cafe'] }));

    expect(
      attractions.filter((poi) => homePoiVisibleAtZoom(poi, 7.5)).map((poi) => poi.name),
    ).toEqual(['Birthplace Museum']);
    expect(
      attractions.filter((poi) => homePoiVisibleAtZoom(poi, 9)).map((poi) => poi.name),
    ).toEqual(['Birthplace Museum']);
    expect(food.filter((poi) => homePoiVisibleAtZoom(poi, 7.5)).map((poi) => poi.name)).toEqual([
      'Town Cafe',
    ]);
    expect(food.filter((poi) => homePoiVisibleAtZoom(poi, 9)).map((poi) => poi.name)).toEqual([
      'Town Cafe',
      'Outside Cafe',
    ]);
  });

  it('limits permanent POI names most strongly on the national map', () => {
    expect(homePoiPermanentLabelLimit(7.5)).toBe(6);
    expect(homePoiPermanentLabelLimit(8.5)).toBe(10);
    expect(homePoiPermanentLabelLimit(9.99)).toBe(10);
    expect(homePoiPermanentLabelLimit(10)).toBe(16);
  });

  it('can limit Home discovery to standalone places outside town guides', () => {
    const projectPackage = poiPackageFor();
    const places = [
      ...homePoiOverviews([projectPackage], 'attraction'),
      ...homePoiOverviews([projectPackage], 'eat', 5, () => ({ eat: ['cafe'] })),
    ];

    expect(places.filter((poi) => homePoiMatchesDiscoveryScope(poi, 'all'))).toHaveLength(4);
    expect(
      places
        .filter((poi) => homePoiMatchesDiscoveryScope(poi, 'standalone'))
        .map((poi) => poi.name),
    ).toEqual(['Outside Viewpoint', 'Outside Cafe']);
  });

  it('filters towns and discovery places using inclusive user rating ranges', () => {
    const towns = homeTownOverviews(packages);
    const projectPackage = poiPackageFor();
    const attractions = homePoiOverviews([projectPackage], 'attraction');

    expect(towns.filter((town) => homeTownMatchesRatingRange(town, { min: 2, max: 3 })))
      .toHaveLength(3);
    expect(
      towns.filter((town) => homeTownMatchesRatingRange(town, { min: 3, max: 3 }))
        .map((town) => town.id),
    ).toEqual(['large-three', 'small-three']);
    expect(
      attractions
        .filter((poi) => homePoiMatchesRatingRange(poi, { min: 1, max: 1 }))
        .map((poi) => poi.name),
    ).toEqual(['Outside Viewpoint']);
    expect(
      homePoiMatchesRatingRange(
        { ...attractions[0], homeMapEligible: false },
        { min: 1, max: 3 },
      ),
    ).toBe(false);
  });

  it('derives map stars without replacing the underlying percentage score', () => {
    expect(homePoiStarRating('attraction', 44)).toBe(0);
    expect(homePoiStarRating('attraction', 45)).toBe(1);
    expect(homePoiStarRating('attraction', 75)).toBe(2);
    expect(homePoiStarRating('attraction', 90)).toBe(3);
    expect(homePoiStarRating('eat', 60)).toBe(1);
    expect(homePoiStarRating('eat', 80)).toBe(2);
    expect(homePoiStarRating('eat', 90)).toBe(3);
  });

  it('honours an explicit Home-only attraction tag even inside the host boundary', () => {
    const projectPackage = poiPackageFor();
    const birthplace = projectPackage.features.find((feature) => feature.id === 'birthplace');
    if (!birthplace) throw new Error('Missing birthplace fixture');
    birthplace.tags.push('home-standalone-place');

    expect(homePoiOverviews([projectPackage], 'attraction')[0]).toMatchObject({
      featureId: 'birthplace',
      discoveryScope: 'standalone',
    });
  });

  it('orders discovery places by score and permits an explicit map exclusion', () => {
    const projectPackage = poiPackageFor();
    const food = homePoiOverviews([projectPackage], 'eat', 5, () => ({ eat: ['cafe'] }));
    const excluded = { ...food[0], homeMapEligible: false };

    expect(sortHomeDiscoveryPois(food).map((poi) => poi.name)).toEqual([
      'Town Cafe',
      'Outside Cafe',
    ]);
    expect(homePoiVisibleAtZoom(excluded, 9)).toBe(false);
  });
});

function labelCandidate(town: HomeTownOverview, x: number, y: number): HomeLabelCandidate {
  return {
    ...town,
    x,
    y,
    width: 120,
    height: 43,
  };
}

function poiPackageFor(): ProjectPackage {
  return {
    project: {
      id: 'poi-town',
      locality: 'POI Town',
      centre: [-3.1, 56.1],
      touristAppeal: { rating: 2, label: 'Worth a detour' },
      boundary: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-3.3, 55.9],
              [-2.9, 55.9],
              [-2.9, 56.3],
              [-3.3, 56.3],
              [-3.3, 55.9],
            ],
          ],
        },
      },
      visitorHighlights: [
        {
          rank: 1,
          featureId: 'birthplace',
          name: 'Birthplace Museum',
          reason: 'The main visitor stop.',
          tagline: 'Original rooms and stories',
          visitorScore: 88,
          timeToSpend: 'Allow 60-90 minutes.',
          openingTimes: 'Wednesday-Sunday, 10am-4pm; last entry 3.30pm.',
          admission: 'Adult £8; child £4; family £20.',
          editorialReview: attractionReview(88),
          attractionGuide: {
            heroImage: '/attraction-guides/birthplace-watercolour-guide.png',
            heroAlt: 'Illustrated birthplace museum',
            headline: 'The story begins here',
            toilets: 'Toilets beside the entrance.',
            thingsToDo: [{ name: 'See the original room' }],
          },
        },
        {
          rank: 2,
          featureId: 'outside-view',
          name: 'Outside Viewpoint',
          reason: 'A curated stop beyond the town boundary.',
          tagline: 'Wide valley panorama',
          visitorScore: 62,
          timeToSpend: 'Allow 30-45 minutes.',
          openingTimes: 'Open access during daylight hours throughout the year.',
          admission: 'Free.',
          editorialReview: attractionReview(62),
        },
      ],
    },
    features: [
      {
        id: 'birthplace',
        projectId: 'poi-town',
        name: 'Birthplace Museum',
        alternativeNames: [],
        countryCode: 'GB-SCT',
        featureType: 'museum',
        geometry: { type: 'Point', coordinates: [-3.1, 56.1] },
        locationType: 'exact',
        dateBasis: 'unknown',
        dateConfidence: 'unknown',
        locationConfidence: 'high',
        sourceRecords: [],
        tags: ['service-context-heritage'],
        createdAt: '',
        updatedAt: '',
        reviewed: true,
      },
      {
        id: 'cafe',
        projectId: 'poi-town',
        name: 'Town Cafe',
        alternativeNames: [],
        countryCode: 'GB-SCT',
        featureType: 'cafe',
        geometry: { type: 'Point', coordinates: [-3.11, 56.11] },
        shortDescription: 'A researched daytime cafe serving coffee, cake and lunch.',
        locationType: 'exact',
        dateBasis: 'unknown',
        dateConfidence: 'unknown',
        locationConfidence: 'high',
        sourceRecords: [
          {
            sourceName: 'OpenStreetMap current community places',
            sourceOrganisation: 'OpenStreetMap',
            sourceUrl: 'https://www.openstreetmap.org/',
            accessedAt: '2026-08-02',
            reliability: 'discovery_only',
            notes:
              'Current visitor details: amenity=cafe; visit_score=82; description=Courtyard coffee: House-roasted coffee, baking and light lunches in a calm courtyard.; opening_hours:description=Monday-Saturday, 9am-4pm.; price_band=££; cuisine=cafe bakery.',
          },
        ],
        editorialReview: foodReview(82),
        tags: ['osm-community-food'],
        createdAt: '',
        updatedAt: '',
        reviewed: true,
      },
      {
        id: 'outside-view',
        projectId: 'poi-town',
        name: 'Outside Viewpoint',
        alternativeNames: [],
        countryCode: 'GB-SCT',
        featureType: 'monument',
        geometry: { type: 'Point', coordinates: [-3.8, 56.8] },
        locationType: 'exact',
        dateBasis: 'unknown',
        dateConfidence: 'unknown',
        locationConfidence: 'high',
        sourceRecords: [],
        tags: ['service-context-heritage', 'home-standalone-place'],
        createdAt: '',
        updatedAt: '',
        reviewed: true,
      },
      {
        id: 'outside-cafe',
        projectId: 'poi-town',
        name: 'Outside Cafe',
        alternativeNames: [],
        countryCode: 'GB-SCT',
        featureType: 'cafe',
        geometry: { type: 'Point', coordinates: [-3.9, 56.9] },
        shortDescription: 'A researched independent cafe suitable for a daytime visit.',
        locationType: 'exact',
        dateBasis: 'unknown',
        dateConfidence: 'unknown',
        locationConfidence: 'high',
        sourceRecords: [
          {
            sourceName: 'OpenStreetMap current community places',
            sourceOrganisation: 'OpenStreetMap',
            sourceUrl: 'https://www.openstreetmap.org/',
            accessedAt: '2026-08-02',
            reliability: 'discovery_only',
            notes:
              'Current visitor details: amenity=cafe; visit_score=72; description=Waterside lunch: Coffee, cakes and daytime lunches beside the water.; opening_hours:description=Tuesday-Sunday, 10am-4pm.; price_band=££; cuisine=cafe light lunch.',
          },
        ],
        editorialReview: foodReview(72),
        tags: ['service-context-food', 'home-standalone-place'],
        createdAt: '',
        updatedAt: '',
        reviewed: true,
      },
    ],
    sources: [],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  } as unknown as ProjectPackage;
}
