import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/eassie.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/eassie-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Eassie full visitor audit', () => {
  const curation = (planner as any).projects['eassie-scotland'];
  it('keeps the locality selector-only and separates its exceptional attraction', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 38, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(topVisitPlaces(pkg as any, 20).map((place) => [place.name, place.visitorScore])).toEqual([['Eassie Sculptured Stone and Old Church', 84]]);
  });
  it('publishes the official trail and no unsupported practical categories', () => {
    expect(visitorNeedPlaces(pkg as any, 'trails', 20, { curatedFeatureIds: curation.trails }).map((place) => place.name)).toEqual(['Angus Pictish Trail – Eassie Church stop']);
    for (const category of ['eat', 'picnic', 'parking', 'toilets'] as const) expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    expect(report.publication).toEqual({ see: 1, eat: 0, trails: 1, picnic: 0, parking: 0, toilets: 0 });
  });
  it('retains all local heritage and shows only defensibly dated pins', () => {
    const heritage = (pkg.features as any[]).filter((feature) => feature.tags.some((tag: string) => ['hes-listed-building', 'hes-scheduled-monument', 'nrhe'].includes(tag)));
    const visible = heritage.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(heritage).toHaveLength(24);
    expect(heritage.filter((feature) => feature.tags.includes('hes-listed-building'))).toHaveLength(4);
    expect(heritage.filter((feature) => feature.tags.includes('hes-scheduled-monument'))).toHaveLength(1);
    expect(heritage.filter((feature) => feature.tags.includes('nrhe'))).toHaveLength(19);
    expect(visible).toHaveLength(17);
    expect(visible.every((feature) => feature.documentedDateText && feature.dateBasis !== 'unknown' && !feature.name.includes(feature.documentedDateText))).toBe(true);
    expect(heritage.find((feature) => feature.id === 'hes-listed-building:LB4644')).toMatchObject({ documentedDateText: '1758', earliestPossibleYear: 1758 });
    expect(heritage.find((feature) => feature.id === 'hes-scheduled-monument:SM90125')?.documentedDateText).toContain('church dedicated 1246');
  });
  it('records the parking uncertainty and checked named-trail products', () => {
    expect(report.practicalAudit.parking).toContain('does not publish a dedicated visitor car park');
    expect(report.namedTrailSearch.retained).toEqual(['Angus Pictish Trail – Eassie Church stop']);
    expect(report.verification).toMatchObject({ statutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true });
  });
});
