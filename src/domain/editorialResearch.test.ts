import { describe, expect, it } from 'vitest';
import {
  attractionEditorialScore,
  editorialEvidenceTier,
  editorialRatingMethodVersion,
  isEditorialBoilerplate,
  isOsmEditorialSource,
  publicVisitorUrl,
  publishedAttractionScore,
  publishedFoodScore,
} from './editorialResearch';
import type { HeritageFeature, VisitorHighlight } from './models';

const source = {
  sourceName: 'Council visitor page',
  sourceOrganisation: 'Example Council',
  sourceUrl: 'https://example.gov.uk/visit/place',
  accessedAt: '2026-08-13',
  reliability: 'local_authority' as const,
};

function feature(overrides: Partial<HeritageFeature> = {}): HeritageFeature {
  return {
    id: 'place-1',
    projectId: 'example-england',
    name: 'Example place',
    alternativeNames: [],
    countryCode: 'GB-ENG',
    featureType: 'other',
    locationType: 'exact',
    dateBasis: 'unknown',
    dateConfidence: 'unknown',
    locationConfidence: 'high',
    sourceRecords: [source],
    tags: [],
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    reviewed: true,
    ...overrides,
  };
}

describe('editorial research evidence', () => {
  it('treats OpenStreetMap as discovery evidence only', () => {
    const source = {
      sourceName: 'OpenStreetMap current community places',
      sourceUrl: 'https://www.openstreetmap.org/node/123',
    };
    expect(isOsmEditorialSource(source)).toBe(true);
    expect(editorialEvidenceTier([source])).toBe('osm_discovery_only');
  });

  it('recognises official and responsible web evidence', () => {
    expect(
      editorialEvidenceTier([
        {
          sourceName: 'Council parking guide',
          sourceUrl: 'https://example.gov.uk/parking/tariffs',
          reliability: 'local_authority',
        },
      ]),
    ).toBe('official_or_operator');
    expect(
      editorialEvidenceTier([
        {
          sourceName: 'Established walking guide',
          sourceUrl: 'https://walking.example.org/route',
          reliability: 'secondary',
        },
      ]),
    ).toBe('established_secondary');
  });

  it('detects catalogue boilerplate that needs editorial replacement', () => {
    expect(
      isEditorialBoilerplate(
        'THE OLD CROSS is a nationally recorded historic landmark within Exampleton.',
      ),
    ).toBe(true);
    expect(
      isEditorialBoilerplate(
        'Climb the medieval tower for long views across the market roofs and surrounding fens.',
      ),
    ).toBe(false);
  });

  it('keeps mapping and designation links out of tourist website actions', () => {
    expect(publicVisitorUrl('https://www.openstreetmap.org/node/123')).toBeUndefined();
    expect(
      publicVisitorUrl('https://historicengland.org.uk/listing/the-list/list-entry/123'),
    ).toBeUndefined();
    expect(publicVisitorUrl('https://operator.example/visit')).toBe(
      'https://operator.example/visit',
    );
  });

  it('publishes an attraction score only when saved dimensions reproduce it', () => {
    const assessment = {
      experienceDepth: 20,
      distinctiveness: 15,
      presentation: 15,
      journeyWorth: 10,
      accessAndReliability: 8,
      evidenceConfidence: 4,
      visitability: 'full_visitor_experience' as const,
    };
    const highlight: VisitorHighlight = {
      rank: 1,
      featureId: 'place-1',
      name: 'Example attraction',
      reason: 'A distinctive interpreted attraction with enough depth for a purposeful visit.',
      visitorScore: attractionEditorialScore(assessment),
      editorialReview: {
        status: 'editorially_researched',
        category: 'attraction',
        methodVersion: editorialRatingMethodVersion,
        reviewedAt: '2026-08-13',
        scoreRationale: 'The score reflects a substantial interpreted visitor experience.',
        evidenceUrls: [source.sourceUrl],
        attractionAssessment: assessment,
      },
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl,
      verifiedInBoundaryAt: '2026-08-13',
    };
    expect(publishedAttractionScore(highlight, feature())).toBe(72);
    expect(publishedAttractionScore({ ...highlight, visitorScore: 90 }, feature())).toBeUndefined();
    expect(
      publishedAttractionScore(
        { ...highlight, editorialReview: undefined },
        feature(),
      ),
    ).toBeUndefined();
  });

  it('caps a castle with no visible remains below public recommendation level', () => {
    const assessment = {
      experienceDepth: 25,
      distinctiveness: 18,
      presentation: 18,
      journeyWorth: 13,
      accessAndReliability: 8,
      evidenceConfidence: 5,
      visitability: 'no_visible_remains' as const,
    };
    expect(attractionEditorialScore(assessment)).toBe(34);
  });

  it('requires a reproducible researched assessment for food scores', () => {
    const food = feature({
      editorialReview: {
        status: 'editorially_researched',
        category: 'food',
        methodVersion: editorialRatingMethodVersion,
        reviewedAt: '2026-08-13',
        scoreRationale: 'Strong daytime food, reliable opening and a distinctive local offer.',
        evidenceUrls: [source.sourceUrl],
        foodAssessment: {
          foodAndDrinkQuality: 24,
          daytimeRelevance: 18,
          distinctiveness: 12,
          consistency: 12,
          visitorFit: 8,
          evidenceConfidence: 8,
        },
      },
    });
    expect(publishedFoodScore(food, 82, 'A strong independent daytime cafe.')).toBe(82);
    expect(publishedFoodScore(food, 90, 'A strong independent daytime cafe.')).toBeUndefined();
  });
});
