import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/ecclesgreig.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/ecclesgreig-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Ecclesgreig full visitor audit', () => {
  const curation = (planner as any).projects['ecclesgreig-scotland'];
  it('keeps the private estate locality selector-only without inventing a public attraction', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 22, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
  });
  it('publishes no unsupported visitor categories', () => {
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) {
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    }
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('retains every local heritage record and exposes only dated pins', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(4);
    expect(heritage.filter((feature) => feature.tags.includes('hes-listed-building'))).toHaveLength(1);
    expect(heritage.filter((feature) => feature.tags.includes('nrhe'))).toHaveLength(3);
    expect(visible).toHaveLength(3);
    expect(visible.every((feature) => feature.documentedDateText && feature.dateBasis !== 'unknown' && !feature.name.includes(feature.documentedDateText))).toBe(true);
    expect(heritage.find((feature) => feature.id === 'hes-listed-building:LB16323')).toMatchObject({ documentedDateText: '1844', earliestPossibleYear: 1844 });
    expect(heritage.find((feature) => feature.id === 'nrhe:133177')?.documentedDateText).toBe('19th century');
    expect(heritage.find((feature) => feature.id === 'nrhe:133179')?.tags).toContain('map-hidden');
  });
  it('records practical exclusions and checks named-trail platforms', () => {
    expect(report.practicalAudit.parking).toContain('private estate');
    expect(report.namedTrailSearch.TreasureTrails).toContain('St Cyrus');
    expect(report.verification).toMatchObject({ statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true });
  });
});
