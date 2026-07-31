import { describe, expect, it } from 'vitest';
import type { HeritageFeature } from './models';
import { hasEstablishedDate, hasHistoricTimelineDate } from './timeline';

const base = {
  id: 'x',
  projectId: 'p',
  name: 'Undated',
  alternativeNames: [],
  countryCode: 'GB',
  featureType: 'other',
  geometry: null,
  locationType: 'unknown',
  dateBasis: 'unknown',
  dateConfidence: 'unknown',
  locationConfidence: 'unknown',
  sourceRecords: [],
  tags: [],
  createdAt: '',
  updatedAt: '',
  reviewed: false,
} satisfies HeritageFeature;

describe('established date', () => {
  it('is false when a record has no date evidence', () => {
    expect(hasEstablishedDate(base)).toBe(false);
  });

  it('accepts a documented year or textual date', () => {
    expect(hasEstablishedDate({ ...base, earliestPossibleYear: 1830 })).toBe(true);
    expect(hasEstablishedDate({ ...base, documentedDateText: 'Early 19th century' })).toBe(true);
  });

  it('keeps inventory-presence dates out of historic timeline filtering', () => {
    expect(
      hasHistoricTimelineDate({
        ...base,
        earliestPossibleYear: 2025,
        dateBasis: 'present_by',
        tags: ['inventory-presence-date'],
      }),
    ).toBe(false);
  });

  it('accepts a cited historic period where a calendar range is not defensible', () => {
    expect(
      hasHistoricTimelineDate({
        ...base,
        documentedDateText: 'Early Christian cross slab',
        dateBasis: 'estimated_from_authoritative_source',
        dateConfidence: 'medium',
      }),
    ).toBe(true);
  });

  it('keeps related context out of parish timeline totals', () => {
    expect(
      hasHistoricTimelineDate({
        ...base,
        earliestPossibleYear: 1800,
        dateBasis: 'documented_construction',
        evidenceScope: 'related_context',
      }),
    ).toBe(false);
  });
});
