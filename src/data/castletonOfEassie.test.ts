import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/castleton-of-eassie.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/castleton-of-eassie-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Castleton of Eassie full visitor audit', () => {
  const curation = (planner as any).projects['castleton-of-eassie-scotland'];
  it('remains selector-only at an evidence-led 28%', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 28, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });
  it('does not publish private archaeology or borrowed facilities as visitor cards', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) {
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    }
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('publishes the complete dated statutory record and only defensibly dated NRHE context', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('hes-listed-building') || feature.tags.includes('nrhe'));
    const statutory = heritage.filter((feature) => feature.tags.includes('hes-scheduled-monument'));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(statutory).toHaveLength(1);
    expect(statutory[0]).toMatchObject({ id: 'hes-scheduled-monument:SM3554', earliestPossibleYear: 1100, latestPossibleYear: 1299, documentedDateText: 'Likely 12th or 13th century AD' });
    expect(statutory[0].tags).not.toContain('map-hidden');
    expect(visible).toHaveLength(4);
    expect(visible.every((feature) => feature.documentedDateText && feature.dateBasis !== 'unknown')).toBe(true);
    expect(heritage.find((feature) => feature.id === 'nrhe:32134')?.tags).toContain('duplicate-of-statutory-designation');
    expect(report.heritage).toMatchObject({ expectedScheduledMonuments: 1, representedScheduledMonuments: 1, visibleDatedStatutoryPins: 1, visibleUndatedHeritagePins: 0 });
  });
  it('records checked trail providers, facilities and strict-boundary exclusions', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('HTTP 200');
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
    expect(report.exclusions.some((value) => value.includes('Eassie Stone'))).toBe(true);
    expect(report.exclusions.some((value) => value.includes('private house'))).toBe(true);
  });
});
