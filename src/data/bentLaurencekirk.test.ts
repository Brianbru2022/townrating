import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/bent-laurencekirk.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/bent-laurencekirk-full-visitor-audit-2026-08-30.json';
import { homeTownOverviews } from '../map/homeOverview';

describe('Bent full visitor audit', () => {
  it('retains the place in the selector without publishing a town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 20, dogOwnerScore: 18, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toEqual([]);
    expect((pkg.project as any).visitorHighlights).toEqual([]);
    expect((planner as any).projects['bent-laurencekirk-scotland']).toEqual({});
  });

  it('records the genuine zero statutory-HES result and hides the three undated NRHE records', () => {
    const statutory = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building') || feature.tags.includes('hes-scheduled-monument'));
    const nrhe = (pkg.features as any[]).filter((feature) => feature.tags.includes('nrhe'));
    expect(statutory).toEqual([]);
    expect(nrhe).toHaveLength(3);
    expect(nrhe.every((feature) => feature.tags.includes('map-hidden'))).toBe(true);
    expect(report.heritage).toMatchObject({ expectedStatutoryDesignations: 0, representedStatutoryDesignations: 0, visibleUndatedPins: 0, hiddenUndatedNrheContext: 3 });
  });

  it('records every zero-result visitor check without borrowing Laurencekirk merit', () => {
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Bent');
    expect(report.practicalAudit.parking).toContain('outside the boundary');
    expect((pkg.project as any).researchNotes).toContain('Laurencekirk services');
  });
});
