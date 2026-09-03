import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DogAccessInfo, DogFriendlyRating } from '../domain/dogAccess';
import { DogPawBadge } from './DogAccess';

function dogAccess(rating: DogFriendlyRating): DogAccessInfo {
  return {
    rating,
    status: rating === 0 ? 'not-allowed' : 'welcoming',
    label: rating === 0 ? 'Dogs are not allowed' : 'Dog friendly',
    summary: 'Test dog-access summary.',
    reviewedAt: '2026-08-08',
  };
}

describe('DogPawBadge', () => {
  it.each([1, 2, 3] as const)('shows exactly %i pawprints', (rating) => {
    const html = renderToStaticMarkup(
      createElement(DogPawBadge, { info: dogAccess(rating) }),
    );

    expect(html.match(/🐾/gu)).toHaveLength(rating);
    expect(html).not.toContain('No dogs');
  });

  it('shows a clear no-dogs pill for a confirmed zero rating', () => {
    const html = renderToStaticMarkup(createElement(DogPawBadge, { info: dogAccess(0) }));

    expect(html).toContain('dog-paw-badge--0');
    expect(html).toContain('No dogs');
    expect(html).toContain('🐾');
    expect(html).not.toContain('dog-paw-prohibited');
    expect(html).toContain('No dogs: Dogs are not allowed');
  });

  it('shows an unknown marker rather than a prohibition for an unconfirmed policy', () => {
    const info: DogAccessInfo = {
      ...dogAccess(0),
      status: 'unconfirmed',
      label: 'Dog policy not confirmed',
    };
    const html = renderToStaticMarkup(createElement(DogPawBadge, { info }));

    expect(html).toContain('dog-paw-badge--unconfirmed');
    expect(html).toContain('dog-paw-unknown');
    expect(html).not.toContain('No dogs');
  });

  it('can hide a zero rating in compact category lists', () => {
    const html = renderToStaticMarkup(
      createElement(DogPawBadge, { info: dogAccess(0), hideZero: true }),
    );

    expect(html).toBe('');
  });
});
