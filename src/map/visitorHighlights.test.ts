import { describe, expect, it, vi } from 'vitest';
import type { HeritageFeature, ProjectPackage } from '../domain/models';
import { visitorHighlightGeoJson } from './visitorHighlights';

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

function pointFeature(id: string, coordinates: [number, number]): HeritageFeature {
  return {
    id,
    projectId: 'test-town',
    name: id,
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
    tags: [],
    createdAt: '',
    updatedAt: '',
    reviewed: true,
  };
}

function packageWithHighlights(rating: 0 | 1 | 2 | 3): ProjectPackage {
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
              [-5, 55],
              [-2, 55],
              [-2, 58],
              [-5, 58],
              [-5, 55],
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
      visitorHighlights: [
        {
          rank: 2,
          featureId: 'second',
          name: 'Second Place',
          reason: 'Second reason.',
          tagline: 'Riverside outlook',
          visitorScore: 78,
          timeToSpend: '45-60 minutes',
          openingTimes: 'Open daily, 10am-5pm.',
          admission: 'Adult £8; child £4.',
          visitorWebsiteUrl: 'https://example.org/visit/second',
          sourceName: 'Source',
          sourceUrl: 'https://example.com/second',
          verifiedInBoundaryAt: '2026-08-01',
        },
        {
          rank: 1,
          featureId: 'first',
          name: 'First Place',
          reason: 'First reason.',
          tagline: 'Tower panorama',
          visitorScore: 82,
          timeToSpend: '60-90 minutes',
          openingTimes: 'Open Tuesday-Sunday, 10am-4pm.',
          admission: 'Free entry; donations welcome.',
          visitorWebsiteUrl: 'https://example.org/visit/first',
          sourceName: 'Source',
          sourceUrl: 'https://example.com/first',
          verifiedInBoundaryAt: '2026-08-01',
        },
        {
          rank: 4,
          featureId: 'nearby',
          name: 'Nearby Place',
          reason: 'Nearby reason.',
          tagline: 'Woodland detour',
          visitorScore: 76,
          timeToSpend: '45-60 minutes',
          openingTimes: 'Open daily during daylight hours.',
          admission: 'Free.',
          visitorWebsiteUrl: 'https://example.org/visit/nearby',
          sourceName: 'Source',
          sourceUrl: 'https://example.com/nearby',
          verifiedInBoundaryAt: '2026-08-01',
        },
      ],
    },
    features: [
      pointFeature('first', [-3, 56]),
      pointFeature('second', [-4, 57]),
      pointFeature('nearby', [5, 60]),
    ],
    sources: [],
    historicMaps: [],
    settlementPolygons: [],
    validation: [],
  };
}

describe('visitorHighlightGeoJson', () => {
  it('excludes zero-rated towns', () => {
    expect(visitorHighlightGeoJson(packageWithHighlights(0)).features).toEqual([]);
  });

  it('includes ranked point data from curated visitor highlights', () => {
    const geoJson = visitorHighlightGeoJson(packageWithHighlights(2));

    expect(geoJson.features.map((feature) => feature.properties.rank)).toEqual([1, 2]);
    expect(geoJson.features[0]?.geometry.coordinates).toEqual([-3, 56]);
    expect(geoJson.features[0]?.properties).toMatchObject({
      id: 'first',
      name: 'First Place',
      reason: 'First reason.',
      sourceUrl: 'https://example.com/first',
    });
  });

  it('does not leak an incomplete raw highlight onto the map', () => {
    const pkg = packageWithHighlights(2);
    pkg.project.visitorHighlights?.push({
      rank: 3,
      featureId: 'incomplete',
      name: 'Incomplete place',
      reason: 'A raw mapped record without researched visit details.',
      visitorScore: 80,
      sourceName: 'OpenStreetMap',
      sourceUrl: 'https://www.openstreetmap.org/node/123',
      verifiedInBoundaryAt: '2026-08-13',
    });
    pkg.features.push(pointFeature('incomplete', [-3.5, 56.5]));

    expect(
      visitorHighlightGeoJson(pkg).features.some(
        (feature) => feature.properties.id === 'incomplete',
      ),
    ).toBe(false);
  });
});
