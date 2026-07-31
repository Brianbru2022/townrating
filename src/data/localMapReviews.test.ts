import { describe, expect, it } from 'vitest';
import { alloaPackage } from './alloa';
import { withLocalMapReviews } from './localMapReviews';

describe('local map alignment review', () => {
  it('adds the Alloa draft only when a development review is explicitly enabled', () => {
    const withReview = withLocalMapReviews(alloaPackage, true);
    const withoutReview = withLocalMapReviews(alloaPackage, false);

    expect(withReview.historicMaps).toContainEqual(
      expect.objectContaining({ id: 'nls-alloa-os-25-inch-1900-mosaic-alignment-review' }),
    );
    expect(withoutReview.historicMaps).not.toContainEqual(
      expect.objectContaining({ id: 'nls-alloa-os-25-inch-1900-mosaic-alignment-review' }),
    );
  });
});
