import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AttractionGuide } from './AttractionGuide';

describe('AttractionGuide', () => {
  it('shows confirmed facilities, rated food, sourced trails and no more than five activities', () => {
    const html = renderToStaticMarkup(
      createElement(AttractionGuide, {
        guide: {
          toilets: 'Accessible toilets beside the entrance.',
          picnic: 'Picnic tables overlooking the gardens.',
          food: [
            {
              name: 'Garden Cafe',
              visitorScore: 82,
              summary: 'Coffee, cake and lunch on site.',
              priceBand: '££',
            },
          ],
          trails: [
            {
              name: 'Waterfall Trail',
              routeType: 'Forest circuit',
              distance: '1 mile / 1.8 km',
              duration: '30 minutes',
              difficulty: 'Easy',
              summary: 'A gentle route through the forest to the waterfall.',
              externalUrl: 'https://example.com/trail',
            },
            ...Array.from({ length: 6 }, (_, index) => ({
              name: `Extra Trail ${index + 1}`,
              externalUrl: `https://example.com/trail-${index + 1}`,
            })),
          ],
          thingsToDo: Array.from({ length: 6 }, (_, index) => ({
            name: `Activity ${index + 1}`,
          })),
        },
      }),
    );

    expect(html).toContain('Visitor facilities');
    expect(html).toContain('Accessible toilets beside the entrance.');
    expect(html).toContain('Picnic tables overlooking the gardens.');
    expect(html).toContain('Garden Cafe');
    expect(html).toContain('Top food stop');
    expect(html).toContain('82');
    expect(html).toContain('Walks and trails');
    expect(html).toContain('Waterfall Trail');
    expect(html).toContain('1 mile / 1.8 km');
    expect(html).toContain('30 minutes');
    expect(html).toContain('href="https://example.com/trail"');
    expect(html).toContain('Extra Trail 5');
    expect(html).not.toContain('Extra Trail 6');
    expect(html).toContain('Top things to see and do');
    expect(html).toContain('Activity 5');
    expect(html).not.toContain('Activity 6');
  });

  it('renders nothing when no attraction guide has been curated', () => {
    expect(renderToStaticMarkup(createElement(AttractionGuide))).toBe('');
  });
});
