import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/craichie.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/craichie-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Craichie full visitor audit', () => {
  const curation = (planner as any).projects['craichie-scotland'];
  it('remains selectable at 32 but has no home-map marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 32, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });
  it('publishes no unsupported visitor-category cards', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const)
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('retains the complete local HES set and displays only dated historic dots', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument') || feature.tags.includes('nrhe'));
    const mill = heritage.find((feature) => feature.id === 'hes-listed-building:LB4601');
    const farmhouse = heritage.find((feature) => feature.id === 'hes-listed-building:LB4620');
    expect(heritage).toHaveLength(5);
    expect(mill).toMatchObject({ documentedDateText: 'Dated 1708; rebuilt 1817', earliestPossibleYear: 1708, latestPossibleYear: 1817, dateBasis: 'documented_year' });
    expect(farmhouse).toMatchObject({ documentedDateText: 'Rebuilt early 19th century; adjoining lintel dated 1745', earliestPossibleYear: 1800, latestPossibleYear: 1832, dateBasis: 'documented_period' });
    expect(mill.tags).not.toContain('map-hidden');
    expect(farmhouse.tags).not.toContain('map-hidden');
    expect(heritage.filter((feature) => feature.tags.includes('nrhe')).every((feature) => feature.tags.includes('map-hidden'))).toBe(true);
    expect(report.heritage).toMatchObject({ expectedStatutoryRecords: 2, representedStatutoryRecords: 2, nrheRecordsRetained: 3, visibleDatedListedBuildingPins: 2, visibleUndatedHeritagePins: 0 });
  });
  it('keeps material dates out of map names and records the full practical search', () => {
    expect(report.verification).toMatchObject({ statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true, curatedCategoryCoordinatesChecked: true });
    expect(report.namedTrailSearch.TreasureTrails).toContain('Forfar');
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
    expect(report.practicalAudit.transport).toContain('Service 27');
  });
});
