import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/boysack.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/boysack-full-visitor-audit-2026-08-30.json';
import { homeTownOverviews } from '../map/homeOverview';

describe('Boysack full visitor audit', () => {
  it('retains Boysack in the selector without publishing a town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 26, dogOwnerScore: 24, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toEqual([]);
    expect((pkg.project as any).visitorHighlights).toEqual([]);
    expect((planner as any).projects['boysack-scotland']).toEqual({});
  });

  it('retains every HES designation with a defensible material-period date', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    expect(statutory).toHaveLength(6);
    expect(statutory.every((feature) => feature.documentedDateText?.trim())).toBe(true);
    expect(statutory.every((feature) => !feature.tags.includes('map-hidden'))).toBe(true);
    expect(report.heritage).toMatchObject({ expectedListedBuildings: 3, representedListedBuildings: 3, expectedScheduledMonuments: 3, representedScheduledMonuments: 3, visibleDatedPins: 6, visibleUndatedPins: 0, hiddenUndatedNrheContext: 10 });
  });

  it('does not turn buried cropmarks or private mill buildings into See entries', () => {
    expect(report.attractionAssessment.every((item) => item.score < 60)).toBe(true);
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Boysack');
    expect((pkg.project as any).researchNotes).toContain('not promoted visitor attractions');
  });
});
