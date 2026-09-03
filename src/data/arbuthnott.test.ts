import { describe, expect, it } from 'vitest';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import pkg from '../../data/projects/arbuthnott.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { homeTownOverviews } from '../map/homeOverview';

const curation = (planner as any).projects['arbuthnott-scotland'];

describe('Arbuthnott full visitor audit', () => {
  it('publishes the complete verified visitor set without filler', () => {
    expect((pkg.project as any).visitorHighlights).toHaveLength(3);
    expect(visitorNeedPlaces(pkg as any, 'eat', 20, { curatedFeatureIds: curation.eat })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'trails', 20, { curatedFeatureIds: curation.trails })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'parking', 20, { curatedFeatureIds: curation.parking })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'toilets', 20, { curatedFeatureIds: curation.toilets })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'picnic', 20, { curatedFeatureIds: curation.picnic })).toHaveLength(0);
  });

  it('keeps every published visitor marker inside the settlement boundary', () => {
    const ids = new Set([
      ...(pkg.project as any).visitorHighlights.map((item: any) => item.featureId),
      ...curation.eat,
      ...curation.trails,
      ...curation.parking,
      ...curation.toilets,
    ]);
    const boundary = (pkg.project as any).townStudyArea?.visitorBoundary ?? pkg.project.boundary;
    for (const feature of (pkg.features as any[]).filter((item) => ids.has(item.id))) {
      expect(booleanPointInPolygon(point(feature.geometry.coordinates), boundary)).toBe(true);
    }
  });

  it('shows all ten HES records with construction dates', () => {
    const hes = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    expect(hes).toHaveLength(10);
    expect(hes.filter((feature) => !feature.tags.includes('map-hidden'))).toHaveLength(10);
    expect(hes.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown')).toHaveLength(0);
  });

  it('keeps the focused settlement below the main-map threshold but in the selector', () => {
    expect((pkg.project as any).touristAppeal.score).toBe(54);
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect((pkg.project as any).townGuide.headline).toContain('not a complete visitor town');
  });

  it('records explicit trail and picnic exclusions', async () => {
    const report = await import('../../data/review/arbuthnott-full-visitor-audit-2026-08-30.json');
    expect(report.default.trailProviderSearches[0].result).toContain('No Arbuthnott product');
    expect(report.default.picnicAudit.published).toBe(0);
  });
});
