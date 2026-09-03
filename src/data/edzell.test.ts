import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/edzell.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/edzell-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Edzell full visitor audit', () => {
  const curated = (planner as any).projects['edzell-scotland'];

  it('retains Edzell on the map from settlement merit and keeps the castle separate', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 72, rating: 1 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(1);
    expect(topVisitPlaces(pkg as any, 20).map((place) => place.name)).toEqual([
      'Dalhousie Memorial Arch',
      'Inglis Memorial Hall, Library and Visitor Centre',
      'Edzell Castle and Garden',
    ]);
    expect((pkg.project as any).townGuide.intro).toContain('Edzell Castle remains a separately scored See attraction');
  });

  it('publishes the fully evidenced visitor contract', () => {
    for (const [category, count] of Object.entries({ eat: 2, trails: 2, picnic: 1, parking: 1, toilets: 1 })) {
      expect(visitorNeedPlaces(pkg as any, category as any, 20, { curatedFeatureIds: curated[category] })).toHaveLength(count);
    }
    expect(report.publication).toEqual({ see: 3, eat: 2, trails: 2, picnic: 1, parking: 1, toilets: 1 });
  });

  it('states parking and toilet unknowns rather than guessing', () => {
    const parking = visitorNeedPlaces(pkg as any, 'parking', 20, { curatedFeatureIds: curated.parking })[0];
    const toilets = visitorNeedPlaces(pkg as any, 'toilets', 20, { curatedFeatureIds: curated.toilets })[0];
    expect(parking.reason).toContain('Capacity, maximum stay, overnight rules, tariff and payment method are not published');
    expect(toilets.reason).toContain('Current opening hours, fee and baby-changing provision are not published');
  });

  it('retains the complete local heritage set and dates every visible pin', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(45);
    expect(heritage.filter((feature) => feature.tags.includes('hes-listed-building') && !feature.tags.includes('town-selection-heritage-buffer'))).toHaveLength(9);
    expect(heritage.filter((feature) => feature.tags.includes('town-selection-heritage-buffer'))).toHaveLength(6);
    expect(heritage.filter((feature) => feature.tags.includes('nrhe'))).toHaveLength(30);
    expect(visible).toHaveLength(27);
    expect(visible.every((feature) => feature.documentedDateText && feature.dateBasis !== 'unknown' && !feature.name.includes(feature.documentedDateText))).toBe(true);
    expect(report.verification).toMatchObject({ statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true });
  });

  it('records named trail searches and current infrastructure exclusions', () => {
    expect(report.namedTrailSearch.retained).toEqual(['Blue Door Walk, Edzell', 'Edzell to Inchbare Circuit']);
    expect(report.namedTrailSearch.TreasureTrails).toContain('No exact Edzell product');
    expect(report.exclusions).toContain('The storm-damaged Shakin Brig is not promoted as an accessible attraction.');
  });
});
