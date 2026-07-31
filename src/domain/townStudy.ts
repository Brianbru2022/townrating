import { booleanPointInPolygon, buffer, point } from '@turf/turf';
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson';

export type TownSelection = 'inside_locality' | 'heritage_buffer' | 'excluded';

export function bufferedTownBoundary(
  locality: Feature<Polygon | MultiPolygon>,
  bufferMetres: number,
): Feature<Polygon | MultiPolygon> {
  const result = buffer(locality, bufferMetres, { units: 'meters', steps: 16 });
  if (!result || (result.geometry.type !== 'Polygon' && result.geometry.type !== 'MultiPolygon'))
    throw new Error('Could not create a usable town heritage buffer.');
  return result as Feature<Polygon | MultiPolygon>;
}

export function classifyTownPoint(
  geometry: Point,
  locality: Feature<Polygon | MultiPolygon>,
  bufferedLocality: Feature<Polygon | MultiPolygon>,
): TownSelection {
  const candidate = point(geometry.coordinates);
  if (booleanPointInPolygon(candidate, locality)) return 'inside_locality';
  if (booleanPointInPolygon(candidate, bufferedLocality)) return 'heritage_buffer';
  return 'excluded';
}
