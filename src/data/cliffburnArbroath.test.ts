import { describe, expect, it } from 'vitest';
import pkg from '../../data/projects/cliffburn-arbroath.json';
import planner from '../../data/cairn-o-mount-visitor-planner-curation.json';
import report from '../../data/review/cliffburn-arbroath-full-visitor-audit-2026-08-30.json';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homeTownOverviews } from '../map/homeOverview';

describe('Cliffburn full visitor audit', () => {
  const curation = (planner as any).projects['cliffburn-arbroath-scotland'];
  it('remains selector-only at 22 despite separate nearby visitor assets', () => {
    expect((pkg.project as any).touristAppeal).toMatchObject({ score: 22, rating: 0 });
    expect(homeTownOverviews([pkg as any])).toHaveLength(0);
    expect(report.publishOnTownMap).toBe(false);
  });
  it('publishes only the in-boundary park and picnic cards', () => {
    expect(topVisitPlaces(pkg as any, 20).map((place) => place.name)).toEqual(['Victoria Park and Arbroath Cliffs approach']);
    expect(visitorNeedPlaces(pkg as any, 'eat', 20, { curatedFeatureIds: curation.eat })).toHaveLength(0);
    expect(visitorNeedPlaces(pkg as any, 'picnic', 20, { curatedFeatureIds: curation.picnic })).toHaveLength(1);
    for (const category of ['trails', 'parking', 'toilets'] as const)
      expect(visitorNeedPlaces(pkg as any, category, 20, { curatedFeatureIds: curation[category] })).toHaveLength(0);
    expect(report.publication).toEqual({ see: 1, eat: 0, trails: 0, picnic: 1, parking: 0, toilets: 0 });
    const parking = (pkg.features as any[]).find((feature) => feature.id === 'curated-parking:cliffburn-arbroath-cliffs');
    const toilets = (pkg.features as any[]).find((feature) => feature.id === 'curated-toilets:cliffburn-ness-victoria-park');
    expect(parking.geometry.coordinates).toEqual([-2.55748, 56.561157]);
    expect(toilets.geometry.coordinates).toEqual([-2.557444, 56.561279]);
  });
  it('does not turn heritage-buffer buildings into Cliffburn heat dots', () => {
    const listed = (pkg.features as any[]).filter((feature) => feature.tags.includes('hes-listed-building'));
    expect(listed).toHaveLength(14);
    expect(listed.every((feature) => feature.tags.includes('town-selection-heritage-buffer') && feature.tags.includes('map-hidden'))).toBe(true);
    expect(report.heritage).toMatchObject({ expectedStrictStatutoryRecords: 0, representedStrictStatutoryRecords: 0, contextListedBuildingsRetained: 14 });
  });
  it('shows only dated in-boundary NRHE points', () => {
    const nrhe = (pkg.features as any[]).filter((feature) => feature.tags.includes('nrhe'));
    const visible = nrhe.filter((feature) => !feature.tags.includes('map-hidden'));
    expect(visible.map((feature) => feature.id).sort()).toEqual(['nrhe:304864', 'nrhe:35528', 'nrhe:70767']);
    expect(visible.every((feature) => feature.documentedDateText && feature.dateBasis !== 'unknown')).toBe(true);
    expect(nrhe.find((feature) => feature.id === 'nrhe:131208').tags).toContain('map-hidden');
    expect(report.heritage.visibleUndatedHeritagePins).toBe(0);
  });
  it('records the working trail search and practical unknowns', () => {
    expect(report.namedTrailSearch.relatedContext[0]).toContain('official Visit Angus PDF');
    expect(report.practicalAudit.parking).toContain('capacity and maximum stay are not published');
    expect(report.practicalAudit.toilets).toContain('RADAR');
    expect(report.verification).toMatchObject({ strictStatutoryDatasetComplete: true, allVisibleHeritagePinsDated: true, datesStoredWithoutChangingMapNames: true, curatedCategoryCoordinatesChecked: true });
  });
});
