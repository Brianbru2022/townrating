import { booleanPointInPolygon, point } from '@turf/turf';
import type { HeritageFeature, TownProject, ValidationResult } from './models';

export function validateFeatures(
  project: TownProject,
  features: HeritageFeature[],
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const seen = new Map<string, Set<string>>();
  const seenIds = new Set<string>();
  for (const feature of features) {
    if (seenIds.has(feature.id))
      results.push({
        recordId: feature.id,
        severity: 'error',
        field: 'id',
        message: 'Feature ID must be unique within a project.',
      });
    seenIds.add(feature.id);
    if (!feature.sourceRecords.length)
      results.push({
        recordId: feature.id,
        severity: 'error',
        field: 'sourceRecords',
        message: 'A source record is required.',
      });
    if (!feature.licence)
      results.push({
        recordId: feature.id,
        severity: 'warning',
        field: 'licence',
        message: 'Licence is not recorded; redistribution must be prevented.',
      });
    if (
      feature.earliestPossibleYear &&
      feature.latestPossibleYear &&
      feature.earliestPossibleYear > feature.latestPossibleYear
    )
      results.push({
        recordId: feature.id,
        severity: 'error',
        field: 'date',
        message: 'Earliest year is after latest year.',
      });
    if (!feature.geometry) {
      const pendingGeometry =
        /geometry|polygon|digitis|alignment|street|change_area|historic_site|location_to_verify/i.test(
          feature.locationType,
        );
      results.push({
        recordId: feature.id,
        severity: pendingGeometry ? 'warning' : 'error',
        field: 'geometry',
        message: pendingGeometry
          ? 'Geometry is intentionally pending import or digitisation.'
          : 'Geometry is missing.',
      });
    } else if (feature.geometry.type !== 'GeometryCollection' && !feature.geometry.coordinates)
      results.push({
        recordId: feature.id,
        severity: 'error',
        field: 'geometry',
        message: 'Geometry is malformed.',
      });
    const spatialIdentity = `${feature.name}|${JSON.stringify(feature.geometry)}`;
    const currentSourceIds = new Set(
      feature.sourceRecords.flatMap((source) =>
        source.sourceRecordId ? [source.sourceRecordId] : [],
      ),
    );
    const priorSourceIds = seen.get(spatialIdentity);
    const hasDistinctAuthoritativeRecords =
      priorSourceIds &&
      currentSourceIds.size > 0 &&
      ![...currentSourceIds].some((id) => priorSourceIds.has(id));
    if (priorSourceIds && !hasDistinctAuthoritativeRecords)
      results.push({
        recordId: feature.id,
        severity: 'warning',
        message: 'Possible duplicate record.',
      });
    seen.set(spatialIdentity, new Set([...(priorSourceIds ?? []), ...currentSourceIds]));
    if (
      feature.geometry?.type === 'Point' &&
      feature.evidenceScope !== 'related_context' &&
      feature.evidenceScope !== 'out_of_scope' &&
      !booleanPointInPolygon(point(feature.geometry.coordinates), project.boundary)
    )
      results.push({
        recordId: feature.id,
        severity: 'warning',
        field: 'geometry',
        message: 'Point is outside the project boundary.',
      });
  }
  return results;
}
