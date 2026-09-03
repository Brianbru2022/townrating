import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/dykelands.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/dykelands-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Dykelands full visitor audit', () => {
  const curation = (planner as any).projects['dykelands-scotland'];

  it('keeps the locality selectable but below the town-map threshold', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 20, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });

  it('publishes verified zero results for every visitor category', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) {
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    }
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });

  it('retains all three local NRHE records and only shows the dated record', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.includes('nrhe') || feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(3);
    expect(heritage.filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'))).toHaveLength(0);
    expect(visible.map((feature) => feature.id)).toEqual(['nrhe:350828']);
    expect(visible[0]).toMatchObject({ documentedDateText: 'Medieval to post-medieval', earliestPossibleYear: 1100, latestPossibleYear: 1900 });
    expect(visible.every((feature) => !feature.name.includes(feature.documentedDateText))).toBe(true);
  });

  it('rejects the Alloa importer contamination and records checked exclusions', () => {
    expect((pkg.features as any[]).some((feature) => /ALLOA|Alloa/.test(feature.name))).toBe(false);
    expect(report.heritage.rejectedOutOfAreaIds).toHaveLength(4);
    expect(report.verification).toMatchObject({ statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true, currentOsmVisitorFeatureCountWithin900m: 0, outOfAreaImporterContaminationRemoved: true });
    expect(report.namedTrailSearch.retained).toEqual([]);
    expect(report.exclusions.some((value) => value.includes('Marykirk'))).toBe(true);
  });
});
