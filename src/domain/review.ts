import type { HeritageFeature, ProjectPackage, ValidationResult } from './models';
import { hasHistoricTimelineDate } from './timeline';

export type ReviewFilter = 'all' | 'date' | 'location' | 'unreviewed' | 'validation';
export type LocalReviewStatus = 'needs_research' | 'approved' | 'excluded';

export interface LocalReviewDecision {
  featureId: string;
  status: LocalReviewStatus;
  note?: string;
  updatedAt: string;
}

export interface ReviewQueueItem {
  feature: HeritageFeature;
  reasons: string[];
  warnings: ValidationResult[];
}

function needsGeometryReview(feature: HeritageFeature): boolean {
  return (
    !feature.geometry ||
    feature.locationConfidence === 'low' ||
    feature.locationConfidence === 'unknown' ||
    /geometry|digitis|alignment|street line|park polygon/i.test(
      `${feature.locationType} ${feature.reviewNotes ?? ''}`,
    )
  );
}

function hasReviewedNoDefensibleDate(feature: HeritageFeature): boolean {
  return feature.tags.includes('reviewed-no-defensible-date');
}

export function buildReviewQueue(
  pkg: ProjectPackage,
  filter: ReviewFilter = 'all',
): ReviewQueueItem[] {
  return pkg.features
    .filter((feature) => feature.evidenceScope !== 'out_of_scope')
    .map((feature) => {
      const warnings = pkg.validation.filter((warning) => warning.recordId === feature.id);
      const missingDate = !hasHistoricTimelineDate(feature) && !hasReviewedNoDefensibleDate(feature);
      const geometryReview = needsGeometryReview(feature);
      const reasons = [
        ...(feature.tags.includes('catalogue-general-view')
          ? ['Catalogue/general-view record is retained for provenance and hidden from the map.']
          : []),
        ...(feature.tags.includes('archaeology-evidence')
          ? ['Broad archaeological evidence is retained without an inferred construction date.']
          : []),
        ...(missingDate ? ['Historic date evidence is needed.'] : []),
        ...(geometryReview ? ['Location or geometry needs review.'] : []),
        ...(!feature.reviewed ? ['Record has not been curator-reviewed.'] : []),
        ...warnings.map((warning) => warning.message),
      ];
      return { feature, reasons, warnings };
    })
    .filter(({ feature, warnings }) => {
      if (filter === 'date') return !hasHistoricTimelineDate(feature) && !hasReviewedNoDefensibleDate(feature);
      if (filter === 'location') return needsGeometryReview(feature);
      if (filter === 'unreviewed') return !feature.reviewed;
      if (filter === 'validation') return warnings.length > 0;
      return true;
    })
    .filter((item) => item.reasons.length > 0)
    .sort((left, right) => left.feature.name.localeCompare(right.feature.name));
}
