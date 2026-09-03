import { describe, expect, it, vi } from 'vitest';
import type { HeritageFeature, ProjectPackage, VisitorHighlight } from './models';
import {
  foodRecommendation,
  foodRecommendationColour,
  formatVisitScore,
  topVisitPlaces,
  trailRecommendation,
  visitRecommendation,
  visitRecommendationColour,
} from './visiting';
import { dogOwnerAttractionScore, type DogAccessInfo } from './dogAccess';

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

function feature(
  id: string,
  name: string,
  tags: string[] = [],
  coordinates: [number, number] = [0, 0],
): HeritageFeature {
  return {
    id,
    projectId: 'test-town',
    name,
    alternativeNames: [],
    countryCode: 'GB-SCT',
    featureType: 'other',
    geometry: { type: 'Point', coordinates },
    locationType: 'exact',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    locationConfidence: 'high',
    sourceRecords: [
      {
        sourceName: 'Visitor operator',
        sourceOrganisation: 'Example Visitor Operator',
        sourceUrl: `https://example.org/visit/${id}`,
        accessedAt: '2026-08-13',
        reliability: 'secondary',
      },
    ],
    tags,
    createdAt: '',
    updatedAt: '',
    reviewed: true,
  };
}

function researchedHighlight(
  featureId: string,
  rank: number,
  name: string,
  overrides: Partial<VisitorHighlight> = {},
): VisitorHighlight {
  return {
    rank,
    featureId,
    name,
    reason: `${name} offers a distinctive, properly researched visitor experience.`,
    tagline: `${name} highlight`.slice(0, 45),
    visitorScore: 76,
    timeToSpend: 'Allow 45-60 minutes',
    openingTimes: 'Open daily, 10am-4pm.',
    admission: 'Free entry.',
    freeAdmission: true,
    visitorWebsiteUrl: `https://example.org/visit/${featureId}`,
    sourceName: 'Visitor operator',
    sourceUrl: `https://example.org/visit/${featureId}`,
    verifiedInBoundaryAt: '2026-08-13',
    ...overrides,
  };
}

function pkg(rating: 0 | 1 | 2 | 3, features: HeritageFeature[]): ProjectPackage {
  return {
    project: {
      id: 'test-town',
      name: 'Test Town',
      countryCode: 'GB-SCT',
      country: 'Scotland',
      locality: 'Test Town',
      centre: [0, 0],
      boundary: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
              [-1, -1],
            ],
          ],
        },
      },
      boundarySource: '',
      boundaryConfidence: 'high',
      sourceLanguage: 'en',
      preferredBasemap: 'openstreetmap',
      createdAt: '',
      methodology: {
        age: {},
        significance: {
          highest_national: 1,
          national: 1,
          regional: 1,
          local: 1,
          recognised: 1,
        },
        confidence: { high: 1, medium: 1, low: 1, unknown: 1 },
        survival: {
          substantially_intact: 1,
          altered_recognisable: 1,
          heavily_altered: 1,
          site_only_or_demolished: 1,
          unknown: 1,
        },
      },
      touristAppeal: { rating, label: rating ? 'Rated town' : 'Not a tourist town' },
    },
    features,
    sources: [],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
}

describe('top visit places', () => {
  it('keeps or reduces attraction scores for dog owners without ever increasing them', () => {
    const access = (
      rating: 0 | 1 | 2 | 3,
      status: DogAccessInfo['status'],
    ): DogAccessInfo => ({
      rating,
      status,
      label: 'Test policy',
      summary: 'A sufficiently detailed test dog-access policy.',
      reviewedAt: '2026-08-25',
    });

    expect(dogOwnerAttractionScore(74, access(3, 'welcoming'))).toBe(74);
    expect(dogOwnerAttractionScore(74, access(2, 'restricted'))).toBe(70);
    expect(dogOwnerAttractionScore(74, access(1, 'restricted'))).toBe(64);
    expect(dogOwnerAttractionScore(74, access(0, 'unconfirmed'))).toBe(62);
    expect(dogOwnerAttractionScore(74, access(0, 'not-allowed'))).toBe(49);
    expect(dogOwnerAttractionScore(8, access(0, 'not-allowed'))).toBe(0);
  });

  it('formats attraction scores with public visit recommendation bands', () => {
    expect(formatVisitScore(68)).toBe('68');
    expect(visitRecommendation(95)).toMatchObject({
      label: 'Exceptional',
      className: 'score-exceptional',
    });
    expect(visitRecommendation(85)).toMatchObject({
      label: 'Highly recommended',
      className: 'score-high',
    });
    expect(visitRecommendation(75)).toMatchObject({
      label: 'Recommended',
      className: 'score-recommended',
    });
    expect(visitRecommendation(45)).toMatchObject({
      label: 'Worth a look',
      className: 'score-look',
    });
    expect(visitRecommendation(35)).toMatchObject({
      label: 'Point of interest',
      className: 'score-interest',
    });
    expect(visitRecommendation(34)).toMatchObject({
      label: 'Not normally listed',
      className: 'score-low',
    });
  });

  it('uses the planner rating palette for map markers', () => {
    expect(visitRecommendationColour(visitRecommendation(95))).toBe('#f6d85f');
    expect(visitRecommendationColour(visitRecommendation(85))).toBe('#f1c840');
    expect(visitRecommendationColour(visitRecommendation(75))).toBe('#0c7180');
    expect(visitRecommendationColour(visitRecommendation(45))).toBe('#5f7f58');
    expect(visitRecommendationColour(visitRecommendation(35))).toBe('#7b6688');
    expect(visitRecommendationColour(visitRecommendation(20))).toBe('#77817e');
    expect(foodRecommendationColour(foodRecommendation(90))).toBe('#d1537b');
    expect(foodRecommendationColour(foodRecommendation(80))).toBe('#b85c86');
    expect(foodRecommendationColour(foodRecommendation(70))).toBe('#0c7180');
    expect(foodRecommendationColour(foodRecommendation(60))).toBe('#5f7f58');
    expect(foodRecommendationColour(foodRecommendation(59))).toBeUndefined();
    expect(visitRecommendationColour()).toBeUndefined();
    expect(foodRecommendationColour()).toBeUndefined();
  });

  it('formats trail scores with trail-specific recommendation bands', () => {
    expect(trailRecommendation(92)).toMatchObject({
      label: 'Highly recommended',
      className: 'score-high',
    });
    expect(trailRecommendation(90)).toMatchObject({
      label: 'Highly recommended',
      className: 'score-high',
    });
    expect(trailRecommendation(89)).toMatchObject({
      label: 'Recommended',
      className: 'score-recommended',
    });
    expect(trailRecommendation(78)).toMatchObject({
      label: 'Interesting trail',
      className: 'score-interest',
    });
  });

  it('formats food scores with cafe and restaurant recommendation language', () => {
    expect(foodRecommendation(95)).toMatchObject({
      label: 'Destination dining',
      className: 'score-exceptional',
    });
    expect(foodRecommendation(80)).toMatchObject({
      label: 'Top food stop',
      className: 'score-high',
    });
    expect(foodRecommendation(70)).toMatchObject({
      label: 'Great choice',
      className: 'score-recommended',
    });
    expect(foodRecommendation(60)).toMatchObject({
      label: 'Good local option',
      className: 'score-look',
    });
    expect(foodRecommendation(59)).toBeUndefined();
  });

  it('returns none for zero-rated towns even when current places exist', () => {
    expect(
      topVisitPlaces(pkg(0, [feature('museum', 'Local Museum', ['osm-community-art'])])),
    ).toEqual([]);
  });

  it('shows deliberately curated highlights for a zero-rated service town', () => {
    const testPackage = pkg(0, [feature('church', 'Village Church')]);
    testPackage.project.visitorHighlights = [
      researchedHighlight('church', 1, 'Village Church', {
        reason: 'A genuine short local stop, without promoting the settlement as a tourist town.',
        tagline: 'Village craftsmanship',
        visitorScore: 48,
      }),
    ];

    expect(topVisitPlaces(testPackage).map((place) => place.name)).toEqual(['Village Church']);
  });

  it('uses only real candidate records and limits the list to five', () => {
    const testPackage = pkg(2, [
        feature('parking', 'Parking', ['osm-community-parking']),
        feature('museum', 'Museum', ['service-context-heritage']),
        feature('camera', 'Camera Obscura', ['service-context-visitor']),
        feature('statue', 'Peter Pan Statue', ['osm-community-art']),
        feature('castle', 'Castle', ['service-context-heritage']),
        feature('abbey', 'Abbey', ['service-context-heritage']),
        feature('extra', 'Extra Tower', ['service-context-visitor']),
        feature('bench', 'Bench', ['osm-community-picnic']),
    ]);
    testPackage.project.visitorHighlights = [
      researchedHighlight('abbey', 1, 'Abbey', { tagline: 'Abbey interiors' }),
      researchedHighlight('castle', 2, 'Castle', { tagline: 'Castle panorama' }),
      researchedHighlight('museum', 3, 'Museum', { tagline: 'Local collections' }),
      researchedHighlight('camera', 4, 'Camera Obscura', { tagline: 'Optical views' }),
      researchedHighlight('extra', 5, 'Extra Tower', { tagline: 'Tower outlook' }),
      researchedHighlight('statue', 6, 'Peter Pan Statue', { tagline: 'Literary landmark' }),
    ];
    const places = topVisitPlaces(testPackage);

    expect(places.map((place) => place.name)).toEqual([
      'Abbey',
      'Castle',
      'Museum',
      'Camera Obscura',
      'Extra Tower',
    ]);
    expect(
      places.every(
        (place) =>
          typeof place.visitorScore === 'number' &&
          place.visitorScore >= 0 &&
          place.visitorScore <= 100,
      ),
    ).toBe(true);
  });

  it('uses curated visitor highlights without padding weaker heuristic candidates', () => {
    const testPackage = pkg(2, [
      feature('museum', 'Important Museum', ['service-context-heritage']),
      feature('birthplace', 'Original Name'),
      feature('camera', 'Camera Obscura'),
    ]);
    testPackage.project.visitorHighlights = [
      researchedHighlight('camera', 2, 'Curated Camera', { tagline: 'Hilltop optics' }),
      researchedHighlight('birthplace', 1, 'Curated Birthplace', {
        tagline: 'Literary birthplace',
      }),
    ];

    const places = topVisitPlaces(testPackage);

    expect(places.map((place) => place.name)).toEqual(['Curated Birthplace', 'Curated Camera']);
    expect(places.every((place) => typeof place.visitorScore === 'number')).toBe(true);
  });

  it('uses curated visitor highlight scores when supplied', () => {
    const testPackage = pkg(2, [feature('birthplace', 'Original Name')]);
    testPackage.project.visitorHighlights = [
      researchedHighlight('birthplace', 1, 'Curated Birthplace', {
        reason: 'Selected from visitor sources.',
        tagline: 'Original study',
        visitorScore: 68,
        openingTimes: 'Thursday-Sunday, 10am-4pm.',
        admission: 'Free.',
        freeAdmission: true,
        organisationPills: ['NTS'],
        attractionGuide: {
          toilets: 'Toilets beside the entrance.',
          food: [{ name: 'Museum Cafe', visitorScore: 82, priceBand: '££' }],
          thingsToDo: [{ name: 'See the original study' }],
        },
        visitorWebsiteUrl: 'https://example.com/birthplace',
        sourceUrl: 'https://example.com/birthplace',
      }),
    ];

    expect(topVisitPlaces(testPackage)).toMatchObject([
      {
        name: 'Curated Birthplace',
        visitorScore: 68,
        openingTimes: 'Thursday-Sunday, 10am-4pm.',
        admission: 'Free.',
        freeAdmission: true,
        organisationPills: ['NTS'],
        externalUrl: 'https://example.com/birthplace',
        attractionGuide: {
          toilets: 'Toilets beside the entrance.',
          food: [{ name: 'Museum Cafe', visitorScore: 82, priceBand: '££' }],
          thingsToDo: [{ name: 'See the original study' }],
        },
      },
    ]);
  });

  it('wraps an older curated attraction in the current guide presentation', () => {
    const tower = feature('tower', 'Old Town Tower');
    tower.featureType = 'tower';
    const testPackage = pkg(2, [tower]);
    testPackage.project.visitorHighlights = [
      researchedHighlight('tower', 1, 'Old Town Tower', {
        reason: 'A compact landmark with a broad view over the town.',
        tagline: 'Town panorama',
        visitorScore: 78,
      }),
    ];

    expect(topVisitPlaces(testPackage)[0]?.attractionGuide).toMatchObject({
      headline: 'Town panorama',
      intro: 'A compact landmark with a broad view over the town.',
      motifs: ['Town panorama', 'Historic tower'],
      bestFor: ['Architecture and history', 'A closer look'],
      parking: expect.stringContaining('not confirmed'),
      toilets: expect.stringContaining('not confirmed'),
      picnic: expect.stringContaining('not confirmed'),
      foodNote: expect.stringContaining('not confirmed'),
    });
    expect(topVisitPlaces(testPackage)[0]).toMatchObject({
      timeToSpend: 'Allow 45-60 minutes',
      openingTimes: expect.any(String),
      admission: expect.any(String),
      dogAccess: { status: 'welcoming' },
    });
  });

  it('excludes otherwise attractive places outside the town boundary', () => {
    const testPackage = pkg(2, [
          feature('outside', 'Outside Castle', ['service-context-heritage'], [5, 5]),
          feature('inside', 'Inside Museum', ['service-context-heritage'], [0, 0]),
    ]);
    testPackage.project.visitorHighlights = [
      researchedHighlight('outside', 1, 'Outside Castle', { tagline: 'Castle remains' }),
      researchedHighlight('inside', 2, 'Inside Museum', { tagline: 'Town collections' }),
    ];
    expect(topVisitPlaces(testPackage).map((place) => place.name)).toEqual(['Inside Museum']);
  });

  it('uses an explicit visitor boundary for tightly curated town extensions', () => {
    const testPackage = pkg(2, [
      feature('extension', 'Bridge Viewpoint', ['service-context-heritage'], [5, 5]),
    ]);
    const visitorBoundary = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [4, 4],
            [6, 4],
            [6, 6],
            [4, 6],
            [4, 4],
          ],
        ],
      },
    };
    testPackage.project.townStudyArea = {
      localityName: 'Test Town',
      sourceName: 'Test locality',
      sourceUrl: 'https://example.com/locality',
      sourceVersion: 'test',
      bufferMetres: 0,
      localityBoundary: testPackage.project.boundary,
      bufferedBoundary: testPackage.project.boundary,
      visitorBoundary,
      notes: 'Test visitor extension.',
    };
    testPackage.project.visitorHighlights = [
      researchedHighlight('extension', 1, 'Bridge Viewpoint', { tagline: 'Bridge panorama' }),
    ];

    expect(topVisitPlaces(testPackage).map((place) => place.name)).toEqual([
      'Bridge Viewpoint',
    ]);
  });

  it('skips curated highlights outside the town boundary without padding the curated list', () => {
    const testPackage = pkg(2, [
      feature('outside', 'Outside Castle', ['service-context-heritage'], [5, 5]),
      feature('inside', 'Inside Museum', ['service-context-heritage'], [0, 0]),
    ]);
    testPackage.project.visitorHighlights = [
      researchedHighlight('outside', 1, 'Curated Outside Castle', {
        reason: 'Outside the town boundary.',
        tagline: 'Castle remains',
      }),
    ];

    expect(topVisitPlaces(testPackage).map((place) => place.name)).toEqual([]);
  });

  it('does not allow curated nearby highlights outside the town boundary', () => {
    const testPackage = pkg(2, [
      feature('outside', 'Nearby Camera Obscura', ['service-context-visitor'], [5, 5]),
    ]);
    testPackage.project.visitorHighlights = [
      researchedHighlight('outside', 1, 'Nearby Camera Obscura', {
        reason: 'A real nearby visitor draw with verified coordinates.',
        tagline: 'Optical panorama',
      }),
    ];

    expect(topVisitPlaces(testPackage).map((place) => place.name)).toEqual([]);
  });
});
