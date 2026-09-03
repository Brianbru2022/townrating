import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/craigo-angus.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/craigo-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Craigo full visitor audit', () => {
  const curation = (planner as any).projects['craigo-angus-scotland'];
  it('remains selector-only at 30 while separate visitor places remain available', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 30, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
    expect(topVisitPlaces(pkg as any, 20).map((item) => item.name)).toEqual(['Marykirk Bridge']);
  });
  it('publishes only the verified category cards', () => {
    expect(visitorNeedPlaces(pkg as any, 'trails', 20, { curatedFeatureIds: curation.trails }).map((item) => item.name)).toEqual(['Craigo to Marykirk Bridge Core Path 073', 'Craigo to Logie Core Path 074']);
    for (const category of ['eat', 'picnic', 'parking', 'toilets'] as const) expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    expect(report.publication).toEqual({ see: 1, eat: 0, trails: 2, picnic: 0, parking: 0, toilets: 0 });
  });
  it('retains the complete local HES set and never shows an undated heritage dot', () => {
    const heritage = (pkg.features as any[]).filter((f) => f.tags.includes('hes-listed-building') || f.tags.includes('hes-scheduled-monument') || f.tags.includes('nrhe'));
    const visible = heritage.filter((f) => !f.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(17);
    expect(heritage.filter((f) => f.tags.includes('hes-listed-building'))).toHaveLength(5);
    expect(heritage.filter((f) => f.tags.includes('nrhe'))).toHaveLength(12);
    expect(visible).toHaveLength(10);
    expect(visible.every((f) => f.documentedDateText && f.dateBasis !== 'unknown' && !f.name.includes(f.documentedDateText))).toBe(true);
    expect(report.verification).toMatchObject({ statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true });
  });
  it('keeps the two bridge designations but publishes one bridge visit card', () => {
    expect((pkg.features as any[]).filter((f) => ['hes-listed-building:LB11177', 'hes-listed-building:LB13891'].includes(f.id))).toHaveLength(2);
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(1);
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
    expect(report.namedTrailSearch.retained).toHaveLength(2);
  });
});
