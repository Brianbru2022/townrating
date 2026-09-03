import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/brownmuir-fordoun.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/brownmuir-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Brownmuir full visitor audit', () => {
  const projectId = 'brownmuir-fordoun-scotland';
  const curation = (planner as any).projects[projectId];

  it('keeps the settlement selectable but below the town-map threshold', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 24, rating: 0, label: 'Minor Interest' });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });

  it('records verified zero results for every visitor category', () => {
    expect(topVisitPlaces(pkg as any, 20)).toHaveLength(0);
    for (const category of ['eat', 'trails', 'picnic', 'parking', 'toilets'] as const) {
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    }
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
  });

  it('shows both statutory records with defensible dates and unchanged names', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    expect(statutory).toHaveLength(2);
    expect(statutory.every((feature) => !feature.tags.includes('map-hidden'))).toBe(true);
    expect(statutory.find((feature) => feature.id === 'hes-listed-building:LB9635')?.documentedDateText).toBe('1712');
    expect(statutory.find((feature) => feature.id === 'hes-scheduled-monument:SM2231')?.documentedDateText).toBe('Medieval');
    expect(statutory.every((feature) => feature.earliestPossibleYear != null && feature.latestPossibleYear != null)).toBe(true);
    expect(statutory.every((feature) => !feature.name.includes(feature.documentedDateText))).toBe(true);
    expect(report.heritage).toMatchObject({ visibleDatedStatutoryPins: 2, visibleUndatedStatutoryPins: 0, hiddenStatutoryPins: 0 });
  });

  it('does not borrow nearby facilities or private heritage', () => {
    expect(report.exclusions.some((value) => value.includes('Green Bean Coffee Shop'))).toBe(true);
    expect(report.exclusions.some((value) => value.includes('private listed farmhouse'))).toBe(true);
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Brownmuir');
  });
});
