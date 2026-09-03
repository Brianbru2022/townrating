import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/drunkendub.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/drunkendub-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Drunkendub full visitor audit', () => {
  const c = (planner as any).projects['drunkendub-scotland'];
  it('remains a 20-point selector-only locality', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 20, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
  });
  it('publishes no unsupported visitor cards', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) {
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: c[category] })).toHaveLength(0);
    }
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('retains and dates all four listed records while showing only strict-locality heritage', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(4);
    expect(heritage.every((feature) => feature.documentedDateText && feature.dateBasis !== 'unknown')).toBe(true);
    expect(visible.map((feature) => feature.id)).toEqual(['hes-listed-building:LB4768']);
    expect(visible[0]).toMatchObject({ documentedDateText: '1842', earliestPossibleYear: 1842 });
    expect(report.verification).toMatchObject({ statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true });
  });
  it('records negative trail and practical findings explicitly', () => {
    expect(report.namedTrailSearch.retained).toEqual([]);
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
    expect(report.practicalAudit.eat).toContain('No qualifying cafe');
  });
});
