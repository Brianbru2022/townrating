import type { FeatureCollection, Point } from 'geojson';
import type { ProjectPackage, VisitorHighlight } from '../domain/models';
import { isMappableVisitorHighlightFeature, topVisitPlaces } from '../domain/visiting';

export interface VisitorHighlightProperties {
  id: string;
  rank: VisitorHighlight['rank'];
  name: string;
  reason: string;
  sourceName: string;
  sourceUrl: string;
}

export function sortedVisitorHighlights(pkg: ProjectPackage): VisitorHighlight[] {
  if (!pkg.project.touristAppeal || pkg.project.touristAppeal.rating === 0) return [];
  const publishableIds = new Set(
    topVisitPlaces(pkg, Number.MAX_SAFE_INTEGER).map((place) => place.id),
  );
  return [...(pkg.project.visitorHighlights ?? [])]
    .filter((highlight) => publishableIds.has(highlight.featureId))
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name))
    .slice(0, 5);
}

export function visitorHighlightGeoJson(
  pkg: ProjectPackage,
): FeatureCollection<Point, VisitorHighlightProperties> {
  const featuresById = new Map(pkg.features.map((feature) => [feature.id, feature]));
  return {
    type: 'FeatureCollection',
    features: sortedVisitorHighlights(pkg)
      .map((highlight) => {
        const feature = featuresById.get(highlight.featureId);
        if (!feature || !isMappableVisitorHighlightFeature(pkg, feature)) {
          return undefined;
        }
        const geometry = feature.geometry;
        if (geometry?.type !== 'Point') return undefined;
        return {
          type: 'Feature' as const,
          geometry,
          properties: {
            id: feature.id,
            rank: highlight.rank,
            name: highlight.name,
            reason: highlight.reason,
            sourceName: highlight.sourceName,
            sourceUrl: highlight.sourceUrl,
          },
        };
      })
      .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature)),
  };
}
