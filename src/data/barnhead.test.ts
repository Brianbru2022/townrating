import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/barnhead-angus.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/barnhead-full-visitor-audit-2026-08-30.json';
import { homeTownOverviews } from '../map/homeOverview';

describe('Barnhead full visitor audit', () => {
  it('retains the locality in the selector without publishing a town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 24, dogOwnerScore: 22, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toEqual([]);
    expect((pkg.project as any).visitorHighlights).toEqual([]);
    expect((planner as any).projects['barnhead-angus-scotland']).toEqual({});
  });

  it('shows both HES listed buildings with construction dates', () => {
    const listed = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    const visible = listed.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(listed).toHaveLength(2);
    expect(visible).toHaveLength(2);
    expect(visible.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown')).toEqual([]);
    expect(listed.map((feature) => feature.documentedDateText)).toEqual(['late 18th cent.', 'Late 18th cent.']);
    expect(report.heritage).toMatchObject({ representedListedBuildings: 2, visibleDatedPins: 2, visibleUndatedPins: 0, hiddenScheduledContext: 1 });
  });

  it('does not transfer The Lurgies or its facilities into Barnhead', () => {
    expect(report.attractionAssessment.find((item) => item.name === 'The Lurgies')?.score).toBe(72);
    expect(report.attractionAssessment.find((item) => item.name === 'The Lurgies')?.result).toContain('outside the strict boundary');
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(report.practicalAudit.parking).toContain('outside the boundary');
    expect((pkg.project as any).researchNotes).toContain('official directions use Barnhead only as a road reference');
  });

  it('records named-trail provider zero results', () => {
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Barnhead product');
    expect(report.namedTrailSearch.councilAndTourism).toContain('no trail begins inside Barnhead');
  });
});
