import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/caldhame.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/caldhame-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Caldhame full visitor audit', () => {
  const curation = (planner as any).projects['caldhame-scotland'];
  it('remains selectable at 26 but has no home-map town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 26, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });
  it('records zero results for all six visitor categories', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('has no statutory HES record and does not invent dates for three NRHE records', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    const nrhe = (pkg.features as any[]).filter((feature) => feature.tags.includes('nrhe'));
    expect(statutory).toHaveLength(0);
    expect(nrhe).toHaveLength(3);
    expect(nrhe.every((feature) => feature.tags.includes('map-hidden') && feature.dateBasis === 'unknown')).toBe(true);
    expect(report.heritage).toMatchObject({ expectedStatutoryRecords: 0, representedStatutoryRecords: 0, nrheRecordsMapHiddenForInsufficientDateEvidence: 3 });
  });
  it('documents named-trail and practical checks', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Caldhame');
    expect(report.namedTrailSearch.VisitAngus).toContain('No named Caldhame trail');
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
  });
});
