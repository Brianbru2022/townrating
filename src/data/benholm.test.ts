import { describe, expect, it } from 'vitest';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import pkg from '../../data/projects/benholm.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/benholm-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { homeTownOverviews } from '../map/homeOverview';

const curation = (planner as any).projects['benholm-scotland'];

describe('Benholm full visitor audit', () => {
  it('publishes the verified reopened visitor set without filler', () => {
    const highlights = (pkg.project as any).visitorHighlights;
    expect(highlights).toHaveLength(2);
    expect(visitorNeedPlaces(pkg as any, 'see', 20, { curatedFeatureIds: highlights.map((item: any) => item.featureId) })).toHaveLength(2);
    expect(visitorNeedPlaces(pkg as any, 'eat', 20, { curatedFeatureIds: curation.eat })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'trails', 20, { curatedFeatureIds: curation.trails })).toHaveLength(1);
    expect(curation.picnic).toEqual([]);
    expect(visitorNeedPlaces(pkg as any, 'parking', 20, { curatedFeatureIds: curation.parking })).toHaveLength(1);
    expect(visitorNeedPlaces(pkg as any, 'toilets', 20, { curatedFeatureIds: curation.toilets })).toHaveLength(1);
  });

  it('keeps every published marker inside the strict boundary', () => {
    const ids = new Set([...(pkg.project as any).visitorHighlights.map((item: any) => item.featureId), ...curation.eat, ...curation.trails, ...curation.parking, ...curation.toilets]);
    const boundary = (pkg.project as any).townStudyArea?.visitorBoundary ?? pkg.project.boundary;
    for (const feature of (pkg.features as any[]).filter((item) => ids.has(item.id))) {
      expect(booleanPointInPolygon(point(feature.geometry.coordinates), boundary), feature.name).toBe(true);
    }
  });

  it('shows all nine HES listed buildings with construction dates', () => {
    const listed = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    const visible = listed.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(listed).toHaveLength(9);
    expect(visible).toHaveLength(9);
    expect(visible.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown')).toEqual([]);
    expect(report.heritage).toMatchObject({ representedListedBuildings: 9, visibleDatedPins: 9, visibleUndatedPins: 0 });
  });

  it('promotes the settlement only because two independent current visits now coexist', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 64, dogOwnerScore: 64, rating: 1 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(1);
    expect(report.previousScore).toBe(42);
    expect(report.scoreChangeReason).toContain('Mill reopened');
    expect((pkg.project as any).researchNotes).toContain('two distinct, reliably visitable 60+ heritage attractions');
  });

  it('records provider, restoration, fee and accessibility caveats', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Benholm product');
    expect(report.namedTrailSearch.rejected[0]).toContain('Unrestored');
    expect(report.practicalAudit.parking).toContain('£2 suggested car donation');
    expect(report.practicalAudit.picnic).toContain('No verified picnic table');
    expect(report.verification.operatorHoursPreferredOverTourismConflict).toBe(true);
  });
});
