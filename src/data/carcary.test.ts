import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/carcary.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/carcary-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Carcary full visitor audit', () => {
  const curation = (planner as any).projects['carcary-scotland'];
  it('remains selectable at 24 but has no home-map town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 24, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });
  it('records zero results for all visitor categories', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('has no statutory HES record and does not invent a date for its NRHE record', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    const nrhe = (pkg.features as any[]).filter((feature) => feature.tags.includes('nrhe'));
    expect(statutory).toHaveLength(0);
    expect(nrhe).toHaveLength(1);
    expect(nrhe[0]).toMatchObject({ dateBasis: 'unknown' });
    expect(nrhe[0].tags).toContain('map-hidden');
    expect(report.heritage).toMatchObject({ expectedStatutoryRecords: 0, representedStatutoryRecords: 0, nrheRecordsMapHiddenForInsufficientDateEvidence: 1 });
  });
  it('documents trail, facility and boundary exclusions', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Carcary');
    expect(report.exclusions.some((value) => value.includes('Kinnaird Castle'))).toBe(true);
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
  });
});
