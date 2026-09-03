import { describe, expect, it } from 'vitest';
import { cartoVoyagerMapStyle, freeMapAttribution, freeMapStyle, freeMapStyleLabels } from './styles';

describe('free map styles without a Stadia key', () => {
  it('keeps Voyager as the default-safe map and does not expose key-only terrain', () => {
    expect(freeMapStyleLabels.voyager).toBe('Voyager');
    expect(freeMapStyleLabels.stadiaTerrain).toBeUndefined();
    expect(freeMapStyle('stadiaTerrain')).toBe(cartoVoyagerMapStyle);
    expect(freeMapAttribution('stadiaTerrain')).toBe('OpenStreetMap contributors, CARTO');
    expect(cartoVoyagerMapStyle).toContain('/gl/voyager-gl-style/style.json');
    expect(cartoVoyagerMapStyle).not.toContain('/rastertiles/');
  });
});
