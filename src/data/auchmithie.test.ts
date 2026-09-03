import { describe, expect, it } from 'vitest';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import pkg from '../../data/projects/auchmithie.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/auchmithie-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { homeTownOverviews } from '../map/homeOverview';

const curation = (planner as any).projects['auchmithie-scotland'];

describe('Auchmithie full visitor audit', () => {
  it('publishes the complete verified visitor set without filler', () => {
    const highlights = (pkg.project as any).visitorHighlights;
    expect(highlights).toHaveLength(2);
    expect(visitorNeedPlaces(pkg as any, 'see', 20, { curatedFeatureIds: highlights.map((item: any) => item.featureId) })).toHaveLength(2);
    expect(visitorNeedPlaces(pkg as any, 'eat', 20, { curatedFeatureIds: curation.eat })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'trails', 20, { curatedFeatureIds: curation.trails })).toHaveLength(3);
    expect(visitorNeedPlaces(pkg as any, 'picnic', 20, { curatedFeatureIds: curation.picnic })).toHaveLength(2);
    expect(visitorNeedPlaces(pkg as any, 'parking', 20, { curatedFeatureIds: curation.parking })).toHaveLength(3);
    expect(visitorNeedPlaces(pkg as any, 'toilets', 20, { curatedFeatureIds: curation.toilets })).toHaveLength(1);
  });

  it('keeps every published visitor marker inside the strict settlement boundary', () => {
    const ids = new Set([...(pkg.project as any).visitorHighlights.map((item: any) => item.featureId), ...curation.eat, ...curation.trails, ...curation.picnic, ...curation.parking, ...curation.toilets]);
    const boundary = (pkg.project as any).townStudyArea?.visitorBoundary ?? pkg.project.boundary;
    for (const feature of (pkg.features as any[]).filter((item) => ids.has(item.id))) {
      expect(booleanPointInPolygon(point(feature.geometry.coordinates), boundary), feature.name).toBe(true);
    }
  });

  it('shows all nine HES listed buildings with construction dates', () => {
    const hes = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    const visible = hes.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(hes).toHaveLength(9);
    expect(visible).toHaveLength(9);
    expect(visible.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown')).toHaveLength(0);
    const fort = (pkg.features as any[]).find((feature) => feature.id === 'hes-scheduled-monument:SM2875');
    expect(fort.tags).toContain('map-hidden');
  });

  it('maps the independently worthwhile village without borrowing nearby merit', () => {
    expect((pkg.project as any).touristAppeal.score).toBe(72);
    expect((pkg.project as any).touristAppeal.dogOwnerScore).toBe(70);
    expect(homeTownOverviews([pkg as any])).toHaveLength(1);
    expect((pkg.project as any).researchNotes).toContain('Ethie Castle, Arbroath, St Vigeans');
  });

  it('records named-trail zero results and practical caveats', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Auchmithie product');
    expect(report.heritage).toMatchObject({ representedListedBuildings: 9, visibleDatedPins: 9, visibleUndatedPins: 0 });
    expect(report.verification).toMatchObject({ parkingFeesNotInferred: true, toiletAccessibilityChecked: true });
    expect(report.verification.trailLinksChecked).toHaveLength(4);
  });
});
