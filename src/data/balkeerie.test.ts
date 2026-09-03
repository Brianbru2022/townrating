import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/balkeerie.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/balkeerie-full-visitor-audit-2026-08-30.json';
import { homeTownOverviews } from '../map/homeOverview';

describe('Balkeerie full visitor audit', () => {
  it('retains the place in the catalogue without publishing an unsupported town marker', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 28, dogOwnerScore: 26, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toEqual([]);
    expect((pkg.project as any).visitorHighlights).toEqual([]);
    expect((planner as any).projects['balkeerie-scotland']).toEqual({});
  });

  it('shows all three HES listed buildings with construction dates', () => {
    const listed = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    const visible = listed.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(listed).toHaveLength(3);
    expect(visible).toHaveLength(3);
    expect(visible.filter((feature) => !feature.documentedDateText || feature.earliestPossibleYear == null || feature.latestPossibleYear == null || feature.dateBasis === 'unknown')).toEqual([]);
    expect(listed.map((feature) => feature.documentedDateText)).toEqual(['dated 1833', '1841', '18th century']);
  });

  it('records zero-result visitor and facility checks rather than inventing entries', () => {
    expect(report.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(report.namedTrailSearch.TreasureTrails).toContain('No dedicated Balkeerie product');
    expect(report.namedTrailSearch.councilAndTourism).toContain('1.4 km away');
    expect(report.practicalAudit.parking).toContain('not assumed public parking');
    expect(report.heritage).toMatchObject({ representedListedBuildings: 3, visibleDatedPins: 3, visibleUndatedPins: 0 });
  });

  it('does not transfer nearby attractions into the hamlet score', () => {
    expect((pkg.project as any).researchNotes).toContain('Eassie Stone, Glamis Castle');
    expect(report.exclusions).toContain('Eassie Stone outside the strict Balkeerie visitor boundary');
  });
});
