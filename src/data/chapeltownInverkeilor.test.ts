import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/chapeltown-inverkeilor.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/chapeltown-inverkeilor-full-visitor-audit-2026-08-30.json';
import localHesReport from '../../data/review/chapeltown-audit-local-hes-completeness-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Chapeltown of Inverkeilor full visitor audit', () => {
  const curation = (planner as any).projects['chapeltown-inverkeilor-scotland'];
  it('remains selectable at 28 but has no home-map marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 28, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });
  it('publishes no private or borrowed visitor cards', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) {
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    }
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('reconciles the local statutory data and dates every visible historic pin', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('nrhe'));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(localHesReport.projects[0]).toMatchObject({ projectId: 'chapeltown-inverkeilor-scotland', listedBuildings: 1, scheduledMonuments: 0 });
    expect(heritage.filter((feature) => feature.tags.includes('hes-listed-building'))).toHaveLength(1);
    expect(heritage.filter((feature) => feature.tags.includes('hes-scheduled-monument'))).toHaveLength(0);
    expect(visible).toHaveLength(8);
    expect(visible.every((feature) => feature.documentedDateText && feature.dateBasis !== 'unknown')).toBe(true);
    expect(heritage.find((feature) => feature.id === 'nrhe:294325')?.tags).toContain('map-hidden');
    expect(report.heritage).toMatchObject({ expectedListedBuildings: 1, representedListedBuildings: 1, expectedScheduledMonuments: 0, visibleDatedHeritagePins: 8, visibleUndatedHeritagePins: 0 });
  });
  it('records trail, facility, access and boundary exclusions', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('HTTP 200');
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
    expect(report.exclusions.some((value) => value.includes('private burial place'))).toBe(true);
    expect(report.heritage.nearbyScheduledMonumentsExcludedByExactBoundary).toEqual(['SM5987','SM5989','SM5990','SM5991']);
  });
});
