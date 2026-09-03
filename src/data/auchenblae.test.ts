import { describe, expect, it } from 'vitest';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import pkg from '../../data/projects/auchenblae.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { homeTownOverviews } from '../map/homeOverview';

const curation = (planner as any).projects['auchenblae-scotland'];

describe('Auchenblae full visitor audit', () => {
  it('publishes the complete verified visitor set without filler', () => {
    expect((pkg.project as any).visitorHighlights).toHaveLength(3);
    expect(visitorNeedPlaces(pkg as any, 'see', 20, { curatedFeatureIds: (pkg.project as any).visitorHighlights.map((item: any) => item.featureId) })).toHaveLength(3);
    expect(visitorNeedPlaces(pkg as any, 'eat', 20, { curatedFeatureIds: curation.eat })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'trails', 20, { curatedFeatureIds: curation.trails })).toHaveLength(2);
    expect(visitorNeedPlaces(pkg as any, 'picnic', 20, { curatedFeatureIds: curation.picnic })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'parking', 20, { curatedFeatureIds: curation.parking })).toHaveLength(2);
    expect(visitorNeedPlaces(pkg as any, 'toilets', 20, { curatedFeatureIds: curation.toilets })).toHaveLength(1);
  });

  it('keeps every published visitor marker inside the settlement boundary', () => {
    const ids = new Set([...(pkg.project as any).visitorHighlights.map((item: any) => item.featureId), ...curation.eat, ...curation.trails, ...curation.picnic, ...curation.parking, ...curation.toilets]);
    const boundary = (pkg.project as any).townStudyArea?.visitorBoundary ?? pkg.project.boundary;
    for (const feature of (pkg.features as any[]).filter((item) => ids.has(item.id))) {
      expect(booleanPointInPolygon(point(feature.geometry.coordinates), boundary)).toBe(true);
    }
  });

  it('shows every date-supported HES pin and hides only the two unresolved records', () => {
    const hes = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    const visible = hes.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(hes).toHaveLength(74);
    expect(visible).toHaveLength(72);
    expect(visible.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown')).toHaveLength(0);
    expect(hes.filter((feature) => feature.tags.includes('map-hidden')).map((feature) => feature.id).sort()).toEqual(['hes-listed-building:LB10773', 'hes-listed-building:LB10775']);
  });

  it('publishes the independently worthwhile settlement on the home map', () => {
    expect((pkg.project as any).touristAppeal.score).toBe(66);
    expect(homeTownOverviews([pkg as any])).toHaveLength(1);
    expect((pkg.project as any).townGuide.headline).toContain('earns a short stop');
  });

  it('records trail-provider, parking and toilet exclusions explicitly', async () => {
    const report = await import('../../data/review/auchenblae-full-visitor-audit-2026-08-30.json');
    expect(report.default.trailProviderSearches[0].result).toContain('No Auchenblae product');
    expect(report.default.parkingAudit.footballPitch).toContain('fee status explicitly left unknown');
    expect(report.default.toiletAudit.result).toContain('Former Mackenzie Avenue conveniences excluded');
  });
});
