import audit from '../../data/review/salmonds-muir-full-visitor-audit-2026-08-30.json';
import project from '../../data/projects/salmonds-muir.json';
import { describe, expect, it } from 'vitest';
import { homeTownOverviews } from '../map/homeOverview';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe("Salmond's Muir full visitor audit", () => {
  it('keeps the hamlet selector-only without borrowing nearby destinations', () => {
    expect(project.project.touristAppeal?.score).toBe(28);
    expect(project.project.touristAppeal?.methodVersion).toBe('2026-08-30-strict-settlement-full-audit-v3');
    expect(homeTownOverviews([project as any])).toEqual([]);
    expect(project.project.researchNotes).toContain('zero records');
  });

  it('retains and dates all four known local HER records', () => {
    const heritage = project.features.filter((feature) => feature.tags.includes('angus-her'));
    expect(heritage).toHaveLength(4);
    expect(heritage.every((feature) => feature.documentedDateText && !feature.tags.includes('map-hidden'))).toBe(true);
    expect(heritage.every((feature) => !feature.name.includes(feature.documentedDateText!))).toBe(true);
    expect(audit.heritage).toMatchObject({
      localHesListedBuildings: 0,
      localNrheRecords: 0,
      angusHerRecordsRetained: 4,
      visibleDatedHeritagePins: 4,
      visibleUndatedHeritagePins: 0,
    });
  });

  it('publishes no unsupported visitor or practical categories', () => {
    expect(audit.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(publishedPlannerCurationForProject(project.project.id)).toMatchObject({
      eat: [], trails: [], picnic: [], parking: [], toilets: [],
    });
    expect(audit.namedTrailSearch.retained).toEqual([]);
    expect(audit.namedTrailSearch.TreasureTrails).toContain('Dundee, Forfar and Montrose');
  });
});
