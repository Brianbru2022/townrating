import { describe, expect, it } from 'vitest';
import { buildReviewQueue } from './review';
import type { HeritageFeature, ProjectPackage, ValidationResult } from './models';

const feature = (overrides: Partial<HeritageFeature> = {}): HeritageFeature => ({
  id: 'feature:1',
  projectId: 'test',
  name: 'Review target',
  alternativeNames: [],
  countryCode: 'GB',
  featureType: 'other',
  locationType: 'exact',
  geometry: { type: 'Point', coordinates: [-3.7, 56.1] },
  documentedDateText: 'Built 1900',
  earliestPossibleYear: 1900,
  latestPossibleYear: 1900,
  dateBasis: 'documented_construction',
  dateConfidence: 'high',
  locationConfidence: 'high',
  sourceRecords: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  reviewed: true,
  ...overrides,
});

const project = (features: HeritageFeature[], validation: ValidationResult[] = []): ProjectPackage =>
  ({ features, validation }) as unknown as ProjectPackage;

describe('review queue', () => {
  it('selects date, location and validation review records without treating reviewed records as open', () => {
    const dated = feature();
    const undated = feature({
      id: 'feature:2',
      name: 'Undated place',
      documentedDateText: undefined,
      earliestPossibleYear: undefined,
      latestPossibleYear: undefined,
      dateBasis: 'unknown',
      dateConfidence: 'unknown',
      reviewed: false,
    });
    const location = feature({
      id: 'feature:3',
      name: 'Approximate place',
      locationConfidence: 'low',
    });
    const excluded = feature({
      id: 'feature:4',
      evidenceScope: 'out_of_scope',
      documentedDateText: undefined,
      earliestPossibleYear: undefined,
      latestPossibleYear: undefined,
      dateBasis: 'unknown',
      dateConfidence: 'unknown',
      reviewed: false,
    });
    const reviewedNoDate = feature({
      id: 'feature:5',
      name: 'Undateable record',
      documentedDateText: undefined,
      earliestPossibleYear: undefined,
      latestPossibleYear: undefined,
      dateBasis: 'unknown',
      dateConfidence: 'unknown',
      reviewed: true,
      tags: ['reviewed-no-defensible-date'],
    });
    const pkg = project([dated, undated, location, excluded, reviewedNoDate], [
      { recordId: 'feature:3', severity: 'warning', field: 'geometry', message: 'Check point.' },
    ]);

    expect(buildReviewQueue(pkg, 'date').map((item) => item.feature.id)).toEqual(['feature:2']);
    expect(buildReviewQueue(pkg, 'location').map((item) => item.feature.id)).toEqual(['feature:3']);
    expect(buildReviewQueue(pkg, 'validation')[0].reasons).toContain('Check point.');
    expect(buildReviewQueue(pkg, 'all').map((item) => item.feature.id)).toEqual([
      'feature:3',
      'feature:2',
    ]);
  });
});
