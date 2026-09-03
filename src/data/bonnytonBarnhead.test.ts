import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/bonnyton-barnhead.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/bonnyton-barnhead-full-visitor-audit-2026-08-30.json';
import { homeTownOverviews } from '../map/homeOverview';

describe('Bonnyton full visitor audit', () => {
  it('retains the correct Bonnyton in the selector without a town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 22, dogOwnerScore: 20, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toEqual([]);
    expect((pkg.project as any).visitorHighlights).toEqual([]);
    expect((planner as any).projects['bonnyton-barnhead-scotland']).toEqual({});
  });

  it('keeps the complete HES record visible and accurately dated', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    expect(statutory).toHaveLength(1);
    expect(statutory[0]).toMatchObject({ id: 'hes-listed-building:LB18241', documentedDateText: '19th cent.' });
    expect(statutory[0].tags).not.toContain('map-hidden');
    expect(report.heritage).toMatchObject({ expectedStatutoryDesignations: 1, representedStatutoryDesignations: 1, visibleDatedPins: 1, visibleUndatedPins: 0, hiddenUndatedNrheContext: 11 });
  });

  it('does not convert a private listed farm building into a See', () => {
    expect(report.attractionAssessment[0].score).toBeLessThan(60);
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Bonnyton');
    expect((pkg.project as any).researchNotes).toContain('private working farm');
  });
});
