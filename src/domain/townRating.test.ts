import { describe, expect, it } from 'vitest';
import type {
  AttractionEditorialAssessment,
  EditorialRecordReview,
  HeritageFeature,
  ProjectPackage,
} from './models';
import { editorialRatingMethodVersion } from './editorialResearch';
import {
  ratingForProject,
  townRatingFromEvidence,
  townRatingLabels,
  withDefaultTownRatingPolicy,
} from './townRating';

function trailFeature(notes: string, sourceUrl?: string): HeritageFeature {
  const editorialReview: EditorialRecordReview | undefined =
    sourceUrl || /external_url=\/trails\//i.test(notes)
      ? {
          status: 'editorially_researched',
          category: 'trail',
          methodVersion: editorialRatingMethodVersion,
          reviewedAt: '2026-08-13',
          scoreRationale: 'A sourced route with sufficient substance for a planned town visit.',
          evidenceUrls: ['https://example.org/responsible-route-evidence'],
        }
      : undefined;
  return {
    id: 'trail-1',
    projectId: 'example',
    name: 'Example trail',
    alternativeNames: [],
    countryCode: 'GB',
    featureType: 'walking_route',
    geometry: { type: 'Point', coordinates: [-0.1, 52] },
    earliestYear: null,
    latestYear: null,
    dateBasis: 'unknown',
    confidence: 'unknown',
    significance: 'local',
    survival: 'substantially_intact',
    publicAccess: 'unknown',
    sources: [],
    sourceRecords: [
      {
        sourceName: sourceUrl ? 'Responsible route publisher' : 'OpenStreetMap current community places',
        sourceOrganisation: sourceUrl ? 'Route publisher' : 'OpenStreetMap contributors',
        sourceUrl,
        accessedAt: '2026-08-09',
        reliability: sourceUrl ? 'secondary' : 'discovery_only',
        notes,
      },
    ],
    tags: [],
    reviewStatus: 'reviewed',
    editorialReview,
  } as unknown as HeritageFeature;
}

function attractionReview(score: number): EditorialRecordReview {
  const assessment: AttractionEditorialAssessment = {
    experienceDepth: Math.min(score, 30),
    distinctiveness: Math.min(Math.max(score - 30, 0), 20),
    presentation: Math.min(Math.max(score - 50, 0), 20),
    journeyWorth: Math.min(Math.max(score - 70, 0), 15),
    accessAndReliability: Math.min(Math.max(score - 85, 0), 10),
    evidenceConfidence: Math.min(Math.max(score - 95, 0), 5),
    visitability: 'full_visitor_experience',
  };
  return {
    status: 'editorially_researched',
    category: 'attraction',
    methodVersion: editorialRatingMethodVersion,
    reviewedAt: '2026-08-13',
    scoreRationale: 'A reproducible assessment of the visitor experience.',
    evidenceUrls: ['https://example.org/attraction-evidence'],
    attractionAssessment: assessment,
  };
}

function projectWithTrail(feature: HeritageFeature): ProjectPackage {
  return {
    project: {
      id: 'example',
      locality: 'Example',
      visitorHighlights: [
        {
          featureId: 'a',
          name: 'Major attraction',
          reason: 'A substantial visitor experience with strong presentation.',
          visitorScore: 86,
          editorialReview: attractionReview(86),
        },
        {
          featureId: 'b',
          name: 'Supporting attraction',
          reason: 'A worthwhile supporting stop with a distinct visitor experience.',
          visitorScore: 72,
          editorialReview: attractionReview(72),
        },
      ],
    },
    features: [feature],
  } as unknown as ProjectPackage;
}

describe('strict town tourist rating policy', () => {
  it('uses the public 0-3 labels', () => {
    expect(townRatingLabels).toEqual({
      0: 'Not a tourist town',
      1: 'Local detour',
      2: 'Worth a planned stop',
      3: 'Destination draw',
    });
  });

  it('requires one 75+ attraction or two independent 60+ attractions for rating 1', () => {
    expect(townRatingFromEvidence([60])).toBe(0);
    expect(townRatingFromEvidence([75])).toBe(1);
    expect(townRatingFromEvidence([64, 60])).toBe(1);
  });

  it('requires an 85+ anchor and coherent half-day depth for rating 2', () => {
    expect(townRatingFromEvidence([86, 72])).toBe(1);
    expect(townRatingFromEvidence([86, 72], [80])).toBe(2);
    expect(townRatingFromEvidence([86, 72, 60])).toBe(2);
  });

  it('reserves rating 3 for a 90+ highlight and destination-scale depth', () => {
    expect(townRatingFromEvidence([92, 86, 82, 74], [84])).toBe(3);
    expect(townRatingFromEvidence([89, 88, 86, 82, 78])).toBe(2);
  });

  it('does not allow a trail to create a local-detour rating', () => {
    expect(townRatingFromEvidence([60], [95])).toBe(0);
    expect(townRatingFromEvidence([], [95, 90])).toBe(0);
  });

  it('does not relabel an unresearched legacy town as zero during migration', () => {
    const pkg = {
      project: {
        id: 'legacy-example',
        locality: 'Legacy Example',
        touristAppeal: { rating: 2, label: 'Worth a planned stop' },
        visitorHighlights: [
          {
            featureId: 'legacy-place',
            name: 'Unresearched attraction',
            reason: 'Legacy copy awaiting a current editorial assessment.',
            visitorScore: 92,
          },
        ],
      },
      features: [],
    } as unknown as ProjectPackage;

    expect(withDefaultTownRatingPolicy(pkg, {}).project.touristAppeal).toEqual(
      pkg.project.touristAppeal,
    );
  });

  it('ignores a mapped path without a responsible external route source', () => {
    const pkg = projectWithTrail(trailFeature('visit_score=82; route=foot'));
    expect(ratingForProject(pkg, { trails: ['trail-1'] })).toBe(1);
  });

  it('counts an explicitly scored trail with a responsible route source', () => {
    const pkg = projectWithTrail(
      trailFeature('Current-place curation: visit_score=82; route=foot', 'https://example.org/route'),
    );
    expect(ratingForProject(pkg, { trails: ['trail-1'] })).toBe(2);
  });

  it('counts an explicitly scored trail with a bundled route download', () => {
    const pkg = projectWithTrail(
      trailFeature(
        'Current-place curation: visit_score=82; route=foot; external_url=/trails/example/walk.pdf',
      ),
    );
    expect(ratingForProject(pkg, { trails: ['trail-1'] })).toBe(2);
  });
});
