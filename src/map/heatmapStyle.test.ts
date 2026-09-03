import { describe, expect, it } from 'vitest';
import { historicHeatmapMaxZoom, historicHeatmapPaint } from './heatmapStyle';

describe('historic heat-map style', () => {
  it('stays visible at detailed street zooms', () => {
    expect(historicHeatmapMaxZoom).toBeGreaterThanOrEqual(20);
  });

  it('tightens and strengthens the heat footprint at close zoom', () => {
    const paint = historicHeatmapPaint();
    const radius = paint?.['heatmap-radius'];
    const intensity = paint?.['heatmap-intensity'];
    const opacity = paint?.['heatmap-opacity'];

    expect(radius).toEqual(expect.arrayContaining([24, 13]));
    expect(intensity).toEqual(expect.arrayContaining([0.62, 2.45]));
    expect(opacity).toEqual(expect.arrayContaining([0.52, 0.74]));
  });
});
