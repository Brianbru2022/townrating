import type { HeatmapLayerSpecification } from 'maplibre-gl';

export const historicHeatmapMaxZoom = 22;

export function historicHeatmapPaint(): HeatmapLayerSpecification['paint'] {
  return {
    'heatmap-weight': ['get', 'score'],
    'heatmap-intensity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      0.62,
      13,
      1.35,
      16,
      2.05,
      19,
      2.45,
    ],
    // Tighten the footprint at street scale so the old core resolves into
    // individual clusters instead of becoming a single expanding blur.
    'heatmap-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      18,
      12,
      24,
      15,
      19,
      18,
      13,
    ],
    'heatmap-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      0.52,
      13,
      0.62,
      17,
      0.74,
      20,
      0.68,
    ],
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(0,0,0,0)',
      0.1,
      '#f3e8b7',
      0.3,
      '#e7b45f',
      0.55,
      '#d77b3f',
      0.78,
      '#a84e38',
      1,
      '#74322f',
    ],
  };
}
