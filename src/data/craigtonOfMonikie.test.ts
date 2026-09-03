import audit from '../../data/review/craigton-of-monikie-full-visitor-audit-2026-08-30.json';
import project from '../../data/projects/craigton-of-monikie.json';
import { describe, expect, it } from 'vitest';
import { homeTownOverviews } from '../map/homeOverview';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { visitorNeedPlaces } from '../domain/visitorExperience';

describe('Craigton of Monikie full visitor audit', () => {
  it('keeps the village selector-only and separates the country-park attraction', () => {
    expect(project.project.touristAppeal?.score).toBe(44);
    expect(project.project.touristAppeal?.methodVersion).toBe('2026-08-30-strict-settlement-full-audit-v3');
    expect(homeTownOverviews([project as any])).toEqual([]);
    expect(project.project.touristAppeal?.summary).toContain('assessed separately');
    expect(project.project.visitorHighlights?.map((highlight) => highlight.name)).toEqual(['Monikie Country Park']);
  });

  it('retains every local heritage record and exposes only accurately dated pins', () => {
    const heritage = project.features.filter((feature) => feature.id.startsWith('hes-') || feature.id.startsWith('nrhe:'));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(9);
    expect(visible).toHaveLength(4);
    expect(visible.every((feature) => feature.documentedDateText && feature.dateBasis !== 'unknown')).toBe(true);
    expect(visible.every((feature) => !feature.name.includes(feature.documentedDateText!))).toBe(true);
    expect(audit.heritage).toMatchObject({ totalRecordsRetained: 9, visibleDatedHeritagePins: 4, visibleUndatedHeritagePins: 0, mapHiddenRecords: 5 });
  });

  it('publishes the verified café, route and practical contracts at exact coordinates', () => {
    expect(audit.publication).toEqual({ see: 1, eat: 1, trails: 1, picnic: 1, parking: 1, toilets: 1 });
    expect(publishedPlannerCurationForProject(project.project.id)).toMatchObject({
      eat: ['curated-eat:cafe-byzantium-monikie'], trails: ['curated-trails:monikie-reservoir-circuit'], picnic: ['curated-picnic:monikie-country-park'], parking: ['curated-parking:monikie-country-park'], toilets: ['curated-toilets:monikie-country-park'],
    });
    const curation = publishedPlannerCurationForProject(project.project.id);
    for (const [need, count] of Object.entries({ eat: 1, trails: 1, picnic: 1, parking: 1, toilets: 1 })) {
      expect(visitorNeedPlaces(project as any, need as any, 20, { curatedFeatureIds: (curation as any)[need] }), need).toHaveLength(count);
    }
    const parking = project.features.find((feature) => feature.id === 'curated-parking:monikie-country-park');
    expect(parking?.geometry.coordinates).toEqual([-2.8121175, 56.5347668]);
    expect(parking?.shortDescription).toContain('free');
    expect(audit.namedTrailSearch.retained).toEqual(['curated-trails:monikie-reservoir-circuit']);
  });
});
