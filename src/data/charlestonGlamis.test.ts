import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/charleston-glamis.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/charleston-glamis-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Charleston (Glamis) full visitor audit', () => {
  const curation = (planner as any).projects['charleston-glamis-scotland'];
  it('remains selectable at 30 but has no home-map marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 30, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });
  it('publishes no unsupported visitor-category cards', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) {
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    }
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('retains every local NRHE record while showing only defensibly dated pins', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.includes('nrhe'));
    const village = heritage.find((feature) => feature.id === 'nrhe:194522');
    const button = heritage.find((feature) => feature.id === 'nrhe:357589');
    const hidden = heritage.filter((feature) => feature.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(6);
    expect(village).toMatchObject({ documentedDateText: 'Village founded in 1833', earliestPossibleYear: 1833, latestPossibleYear: 1833, dateBasis: 'documented_year' });
    expect(button).toMatchObject({ documentedDateText: '18th century', earliestPossibleYear: 1700, latestPossibleYear: 1799, dateBasis: 'documented_century' });
    expect(village.tags).not.toContain('map-hidden');
    expect(button.tags).not.toContain('map-hidden');
    expect(hidden.map((feature) => feature.id).sort()).toEqual(['nrhe:194523', 'nrhe:312762', 'nrhe:32057', 'nrhe:32077']);
    expect(report.heritage).toMatchObject({ expectedStatutoryRecords: 0, representedStatutoryRecords: 0, nrheRecordsRetained: 6, visibleDatedNrhePins: 2, visibleUndatedHeritagePins: 0 });
  });
  it('documents checked trails, facilities and strict-boundary exclusions', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('HTTP 200');
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
    expect(report.practicalAudit.toilets).toContain('outside the strict boundary');
    expect(report.exclusions.some((value) => value.includes('Glamis Castle'))).toBe(true);
    expect(report.verification).toMatchObject({ statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true, curatedCategoryCoordinatesChecked: true });
  });
});
