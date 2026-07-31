import { describe, expect, it } from 'vitest';
import type { HeritageFeature } from './models';
import { dateWording, featureTimelineState } from './timeline';

const feature = {
  id: 'x',
  projectId: 'p',
  name: 'Range',
  alternativeNames: [],
  countryCode: 'GB',
  featureType: 'other',
  geometry: { type: 'Point', coordinates: [0, 0] },
  locationType: 'exact',
  earliestPossibleYear: 1810,
  latestPossibleYear: 1830,
  dateBasis: 'documented_date_range',
  dateConfidence: 'high',
  locationConfidence: 'high',
  sourceRecords: [],
  tags: [],
  createdAt: '',
  updatedAt: '',
  reviewed: true,
} satisfies HeritageFeature;
describe('timeline', () => {
  it('represents ranges honestly', () => {
    expect(featureTimelineState(feature, 1809)).toBe('hidden');
    expect(featureTimelineState(feature, 1815)).toBe('possible');
    expect(featureTimelineState(feature, 1830)).toBe('definite');
  });
  it('uses date-basis wording', () =>
    expect(dateWording(feature)).toBe('Documented date range: 1810–1830'));
});
