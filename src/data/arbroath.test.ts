import { point } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { describe, expect, it } from 'vitest';
import audit from '../../data/review/arbroath-full-visitor-audit-2026-08-30.json';
import project from '../../data/projects/arbroath.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Arbroath full visitor audit', () => {
  const pkg = project as any;
  const curation = publishedPlannerCurationForProject('arbroath-scotland');

  it('publishes every completed visitor category without arbitrary practical caps', () => {
    expect(pkg.project.visitorHighlights).toHaveLength(7);
    expect(visitorNeedPlaces(pkg, 'eat', 20, { curatedFeatureIds: curation.eat })).toHaveLength(7);
    expect(visitorNeedPlaces(pkg, 'trails', 20, { curatedFeatureIds: curation.trails })).toHaveLength(5);
    expect(visitorNeedPlaces(pkg, 'parking', 20, { curatedFeatureIds: curation.parking })).toHaveLength(10);
    expect(visitorNeedPlaces(pkg, 'toilets', 20, { curatedFeatureIds: curation.toilets })).toHaveLength(6);
    expect(visitorNeedPlaces(pkg, 'picnic', 20, { curatedFeatureIds: curation.picnic })).toHaveLength(3);
  });

  it('keeps all public visitor markers inside the separately reviewed visitor boundary', () => {
    const boundary = pkg.project.townStudyArea.visitorBoundary;
    const ids = [
      ...pkg.project.visitorHighlights.map((item: any) => item.featureId),
      ...(curation.eat ?? []), ...(curation.trails ?? []), ...(curation.parking ?? []),
      ...(curation.toilets ?? []), ...(curation.picnic ?? []),
    ];
    for (const id of new Set(ids)) {
      const feature = pkg.features.find((item: any) => item.id === id);
      expect(feature, id).toBeDefined();
      expect(booleanPointInPolygon(point(feature.geometry.coordinates), boundary), id).toBe(true);
    }
  });

  it('retains every local HES designation and exposes no undated heat pin', () => {
    const hes = pkg.features.filter((feature: any) => feature.tags.includes('hes-listed-building'));
    const visible = hes.filter((feature: any) => !feature.tags.includes('map-hidden'));
    expect(hes).toHaveLength(112);
    expect(visible).toHaveLength(111);
    expect(visible.every((feature: any) => feature.documentedDateText && feature.earliestPossibleYear != null && feature.latestPossibleYear != null && feature.dateBasis !== 'unknown')).toBe(true);
    expect(audit.heritageDateAudit).toMatchObject({ statutoryDesignations: 112, visiblePins: 111, datedVisiblePins: 111, hiddenRetained: 1 });
  });

  it('uses only assessed 60+ See and Eat entries and preserves the corrected town score', () => {
    expect(pkg.project.touristAppeal).toMatchObject({ score: 86, dogOwnerScore: 84, methodVersion: '2026-08-30-strict-settlement-full-audit-v3' });
    expect(pkg.project.visitorHighlights.every((item: any) => item.visitorScore >= 60)).toBe(true);
    expect(visitorNeedPlaces(pkg, 'eat', 20, { curatedFeatureIds: curation.eat }).every((item) => (item.visitorScore ?? 0) >= 60)).toBe(true);
  });

  it('records the Treasure Trails false match instead of publishing the Tayport redirect', () => {
    expect(audit.trailProviderSearches[0].provider).toBe('TreasureTrails.co.uk');
    expect(audit.trailProviderSearches[0].result).toContain('Tayport');
    expect(pkg.features.filter((feature: any) => feature.visitorWebsiteUrl?.includes('treasuretrails.co.uk'))).toHaveLength(0);
  });
});
