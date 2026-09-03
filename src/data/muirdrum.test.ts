import audit from '../../data/review/muirdrum-full-visitor-audit-2026-08-30.json';
import project from '../../data/projects/muirdrum.json';
import { describe, expect, it } from 'vitest';
import { homeTownOverviews } from '../map/homeOverview';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Muirdrum full visitor audit', () => {
  it('keeps the village selector-only on independently assessed value', () => {
    expect(project.project.touristAppeal?.score).toBe(34);
    expect(project.project.touristAppeal?.methodVersion).toBe('2026-08-30-strict-settlement-full-audit-v3');
    expect(homeTownOverviews([project as any])).toEqual([]);
    expect(project.project.researchNotes).toContain('restoration of the Fairy Steps right of way remains ongoing');
  });

  it('retains all three local NRHE records and never maps an undated one', () => {
    expect(project.features).toHaveLength(3);
    const visible = project.features.filter((feature) => !feature.tags.includes('map-hidden'));
    const hidden = project.features.filter((feature) => feature.tags.includes('map-hidden'));
    expect(visible).toHaveLength(1);
    expect(hidden).toHaveLength(2);
    expect(visible.every((feature) => feature.documentedDateText && !feature.name.includes(feature.documentedDateText))).toBe(true);
    expect(audit.heritage).toMatchObject({ localNrheRecords: 3, retainedHeritageRecords: 3, visibleDatedHeritagePins: 1, visibleUndatedHeritagePins: 0, mapHiddenRecords: 2 });
  });

  it('publishes no unsupported visitor or practical categories', () => {
    expect(audit.publication).toEqual({ see: 0, eat: 0, trails: 0, picnic: 0, parking: 0, toilets: 0 });
    expect(publishedPlannerCurationForProject(project.project.id)).toMatchObject({ eat: [], trails: [], picnic: [], parking: [], toilets: [] });
    expect(audit.namedTrailSearch.retained).toEqual([]);
    expect(audit.namedTrailSearch.AngusCouncil).toContain('restoration remains ongoing');
  });
});
