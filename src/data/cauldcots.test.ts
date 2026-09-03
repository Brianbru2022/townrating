import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/cauldcots.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/cauldcots-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Cauldcots full visitor audit', () => {
  const curation = (planner as any).projects['cauldcots-scotland'];
  it('remains selectable at 22 but has no home-map marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 22, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });
  it('records zero verified visitor-category cards', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) {
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    }
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });
  it('dates the former station without inventing a farm date', () => {
    const station = (pkg.features as any[]).find((feature) => feature.id === 'nrhe:194427');
    const farm = (pkg.features as any[]).find((feature) => feature.id === 'nrhe:294328');
    expect(station).toMatchObject({ earliestPossibleYear: 1883, latestPossibleYear: 1930, dateBasis: 'documented_date_range' });
    expect(station.tags).not.toContain('map-hidden');
    expect(farm).toMatchObject({ dateBasis: 'unknown' });
    expect(farm.tags).toContain('map-hidden');
    expect(report.heritage).toMatchObject({ expectedStatutoryRecords: 0, representedStatutoryRecords: 0, visibleDatedNrhePins: 1, visibleUndatedHeritagePins: 0 });
  });
  it('documents checked trail, facility and boundary results', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('HTTP 200');
    expect(report.practicalAudit.parking).toContain('No dedicated public visitor car park');
    expect(report.exclusions.some((value) => value.includes('outside the strict boundary'))).toBe(true);
  });
});
