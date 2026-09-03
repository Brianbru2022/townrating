import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/braehead-of-lunan.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/braehead-of-lunan-full-visitor-audit-2026-08-30.json';
import { homeTownOverviews } from '../map/homeOverview';

describe('Braehead of Lunan full visitor audit', () => {
  it('retains the hamlet in the selector without publishing a town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 36, dogOwnerScore: 35, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toEqual([]);
    expect((pkg.project as any).visitorHighlights).toEqual([]);
    expect((planner as any).projects['braehead-of-lunan-scotland']).toEqual({});
  });

  it('keeps all three HES buildings visible with accurate construction dates', () => {
    const listed = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    expect(listed).toHaveLength(3);
    expect(listed.map((feature) => feature.documentedDateText)).toEqual(['1783', '17th cent.', 'dated 1830']);
    expect(listed.every((feature) => !feature.tags.includes('map-hidden'))).toBe(true);
    expect(report.heritage).toMatchObject({ expectedListedBuildings: 3, representedListedBuildings: 3, visibleDatedPins: 3, visibleUndatedPins: 0, hiddenUndatedNrheContext: 7 });
  });

  it('does not borrow nearby Lunan Bay or Upper Dysart facilities', () => {
    expect(report.attractionAssessment.every((item) => item.score < 60)).toBe(true);
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Braehead');
    expect(report.exclusions[0]).toContain('Upper Dysart');
  });
});
