import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DogAccessInfo } from '../domain/dogAccess';
import { AttractionScorePair } from './AttractionScorePair';

describe('AttractionScorePair', () => {
  it('shows a distinct non-increasing dog-owner score with access paws', () => {
    const dogAccess: DogAccessInfo = {
      rating: 2,
      status: 'restricted',
      label: 'Grounds good; interior unconfirmed',
      summary: 'The grounds are accessible but indoor pet-dog access is not confirmed.',
      reviewedAt: '2026-08-25',
    };
    const html = renderToStaticMarkup(
      createElement(AttractionScorePair, { visitorScore: 74, dogAccess }),
    );

    expect(html).toContain('Attraction ratings');
    expect(html).toContain('Visitor');
    expect(html).toContain('>74<');
    expect(html).toContain('With a dog');
    expect(html).toContain('>70<');
    expect(html.match(/🐾/gu)).toHaveLength(2);
  });
});
