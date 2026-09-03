import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/bolshan.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/bolshan-full-visitor-audit-2026-08-30.json';
import { homeTownOverviews } from '../map/homeOverview';

describe('Bolshan full visitor audit', () => {
  it('retains Bolshan in the selector without publishing a town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 24, dogOwnerScore: 22, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toEqual([]);
    expect((pkg.project as any).visitorHighlights).toEqual([]);
    expect((planner as any).projects['bolshan-scotland']).toEqual({});
  });

  it('records the genuine zero statutory-HES result and hides all three undated NRHE records', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    const nrhe = (pkg.features as any[]).filter((feature) => feature.tags.includes('nrhe'));
    expect(statutory).toEqual([]);
    expect(nrhe).toHaveLength(3);
    expect(nrhe.every((feature) => feature.tags.includes('map-hidden'))).toBe(true);
    expect(report.heritage).toMatchObject({ expectedStatutoryDesignations: 0, representedStatutoryDesignations: 0, visibleUndatedPins: 0, hiddenUndatedNrheContext: 3 });
  });

  it('assesses the archaeological sites without converting them into visitor attractions', () => {
    expect(report.attractionAssessment).toHaveLength(3);
    expect(report.attractionAssessment.every((item) => item.score < 60)).toBe(true);
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Bolshan');
    expect((pkg.project as any).researchNotes).toContain('Braikie Castle');
  });
});
