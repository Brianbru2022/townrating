import type { StyleSpecification } from 'maplibre-gl';

export type FreeMapStyleId = 'voyager' | 'positron' | 'stadiaTerrain' | 'osm';

export const freeMapStyleLabels: Partial<Record<FreeMapStyleId, string>> = {
  voyager: 'Voyager',
  positron: 'Light',
  ...(import.meta.env.VITE_STADIA_API_KEY ? { stadiaTerrain: 'Stadia Terrain' } : {}),
  osm: 'Classic OSM',
};

export const openStreetMapFallbackStyle = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'openstreetmap', type: 'raster', source: 'openstreetmap' }],
} satisfies StyleSpecification;

// CARTO's legacy PNG basemaps now watermark anonymous requests. Their vector
// styles preserve the same cartography without the raster API-key notice.
export const cartoVoyagerMapStyle =
  'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

export const cartoPositronMapStyle =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function stadiaTileUrl(styleId: string): string {
  const apiKey = import.meta.env.VITE_STADIA_API_KEY;
  const baseUrl = `https://tiles.stadiamaps.com/tiles/${styleId}/{z}/{x}/{y}.png`;
  return apiKey ? `${baseUrl}?api_key=${apiKey}` : baseUrl;
}

export const stadiaTerrainMapStyle = {
  version: 8,
  sources: {
    stadiaTerrain: {
      type: 'raster',
      tiles: [stadiaTileUrl('stamen_terrain')],
      tileSize: 256,
      maxzoom: 20,
      attribution: 'OpenStreetMap contributors, Stamen Design, Stadia Maps',
    },
  },
  layers: [{ id: 'stadia-terrain', type: 'raster', source: 'stadiaTerrain' }],
} satisfies StyleSpecification;

export const homeLabelFreeMapStyle =
  'https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json';

export const homeLabelFreeAttribution = 'OpenStreetMap contributors, CARTO';

export function freeMapStyle(styleId: FreeMapStyleId): StyleSpecification | string {
  if (styleId === 'osm') return openStreetMapFallbackStyle;
  if (styleId === 'positron') return cartoPositronMapStyle;
  if (styleId === 'stadiaTerrain') {
    return import.meta.env.VITE_STADIA_API_KEY ? stadiaTerrainMapStyle : cartoVoyagerMapStyle;
  }
  return cartoVoyagerMapStyle;
}

export function freeMapAttribution(styleId: FreeMapStyleId): string {
  if (styleId === 'stadiaTerrain' && import.meta.env.VITE_STADIA_API_KEY) {
    return 'OpenStreetMap contributors, Stamen Design, Stadia Maps';
  }
  return styleId === 'osm' ? 'OpenStreetMap contributors' : 'OpenStreetMap contributors, CARTO';
}
