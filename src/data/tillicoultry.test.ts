import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { hasHistoricTimelineDate } from '../domain/timeline';
import { visitorNeedPlaces } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { tillicoultryPackage } from './tillicoultry';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Tillicoultry published package', () => {
  it('retains curated evidence and labels official NRHE classifications as broad timeline ranges', () => {
    const historicFeatures = tillicoultryPackage.features.filter(
      (feature) =>
        !feature.tags.includes('osm-community-place') && !feature.tags.includes('current-context'),
    );
    expect(historicFeatures).toHaveLength(167);
    const curated = historicFeatures.filter((feature) => feature.id.startsWith('curated:'));
    expect(curated).toHaveLength(39);
    expect(curated.every(hasHistoricTimelineDate)).toBe(true);
    expect(
      historicFeatures.filter((feature) => feature.tags.includes('nrhe-period-extracted')),
    ).toHaveLength(62);
    expect(historicFeatures.filter((feature) => !hasHistoricTimelineDate(feature))).toHaveLength(53);
    expect(
      tillicoultryPackage.features.filter((feature) => feature.tags.includes('osm-current-park')),
    ).toHaveLength(3);
    expect(tillicoultryPackage.features.find((feature) => feature.id === 'nrhe:220130')).toMatchObject({
      name: 'Murray Square Clock',
      earliestPossibleYear: 1928,
    });
    expect(tillicoultryPackage.features.find((feature) => feature.id === 'nrhe:48275')).toMatchObject({
      dateBasis: 'present_by',
      earliestPossibleYear: 1926,
    });
    expect(tillicoultryPackage.features.find((feature) => feature.id === 'curated:westertown-historic-core')).toMatchObject({
      earliestPossibleYear: 1560,
      locationType: 'approximate',
    });
    expect(tillicoultryPackage.features.find((feature) => feature.id === 'nrhe:48274')).toMatchObject({
      earliestPossibleYear: 1846,
      latestPossibleYear: 1869,
    });
    expect(tillicoultryPackage.features.find((feature) => feature.id === 'nrhe:48283')).toMatchObject({
      earliestPossibleYear: 1806,
      latestPossibleYear: 1806,
    });
    expect(tillicoultryPackage.features.find((feature) => feature.id === 'nrhe:48279')).toMatchObject({
      latestPossibleYear: 1806,
      dateBasis: 'present_by',
    });
    expect(
      tillicoultryPackage.features.find((feature) => feature.id === 'nrhe:48279')?.earliestPossibleYear,
    ).toBeUndefined();
    expect(tillicoultryPackage.features.find((feature) => feature.id === 'curated:hes-lb42050')).toMatchObject({
      earliestPossibleYear: 1879,
      latestPossibleYear: 1879,
      dateConfidence: 'high',
    });
    expect(tillicoultryPackage.features.find((feature) => feature.id === 'nrhe:310490')).toMatchObject({
      earliestPossibleYear: 1892,
      latestPossibleYear: 1892,
    });
  });

  it('keeps unsited supplied records out of map rendering and out-of-parish points as context', () => {
    expect(tillicoultryPackage.features.filter((feature) => !feature.geometry)).toHaveLength(14);
    expect(tillicoultryPackage.features.filter((feature) => feature.id.startsWith('nrhe:'))).toHaveLength(
      120,
    );
    expect(
      tillicoultryPackage.features.filter(
        (feature) =>
          feature.evidenceScope === 'related_context' &&
          !feature.tags.includes('osm-community-place') &&
          !feature.tags.includes('tillicoultry-visitor-audit'),
      ),
    ).toHaveLength(4);
  });

  it('publishes an honest current visitor list rather than out-of-boundary specialist places', () => {
    expect(topVisitPlaces(tillicoultryPackage, 10).map((place) => place.name)).toEqual([
      'Firpark Ski Centre',
      'Tillicoultry Glen east-side route',
      'Affinity Sterling Mills Outlet Shopping',
      'Tillicoultry Clock Tower',
      'Clock Mill and Upper Mill Street',
      'Tillicoultry Old Churchyard and medieval stones',
    ]);
    expect(
      tillicoultryPackage.features.find(
        (feature) =>
          feature.id === 'curated-attraction:tillicoultry-tillicoultry-golf-club',
      )?.tags,
    ).toContain('map-hidden');
  });

  it('preserves the NRS locality and adds only a narrow visitor extension into the glen', () => {
    const studyArea = tillicoultryPackage.project.townStudyArea;
    expect(studyArea?.localityCode).toBe('S52000615');
    expect(studyArea?.visitorBoundary?.properties).toMatchObject({
      sourceDataset: 'Curated Tillicoultry visitor boundary',
      originalSourceDataset: studyArea?.sourceName,
    });
    expect(
      booleanPointInPolygon(point([-3.7444, 56.1638]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.73886, 56.15735]), studyArea!.localityBoundary),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.75611, 56.15546]), studyArea!.visitorBoundary!),
    ).toBe(false);
  });

  it('ships a complete curated visitor planner inside the active visitor boundary', () => {
    const curation = publishedPlannerCurationForProject(tillicoultryPackage.project.id);
    expect(curation.eat).toHaveLength(6);
    expect(curation.trails).toHaveLength(3);
    expect(
      visitorNeedPlaces(tillicoultryPackage, 'trails', 10, {
        curatedFeatureIds: curation.trails,
      }).map((place) => place.name),
    ).toEqual([
      'The Devon Way from Tillicoultry',
      'Tillicoultry Glen east-side walk',
      'Tillicoultry textile-town walk',
    ]);
    expect(curation.parking).toHaveLength(5);
    expect(curation.toilets).toHaveLength(3);
    expect(curation.picnic).toEqual([
      'curated-picnic:tillicoultry-upper-mill-recreation-ground',
      'osm-community:node-11828395926',
    ]);

    const publicIds = Object.values(curation).flat();
    const activeBoundary = tillicoultryPackage.project.townStudyArea?.visitorBoundary;
    expect(activeBoundary).toBeDefined();
    for (const id of publicIds) {
      const feature = tillicoultryPackage.features.find((candidate) => candidate.id === id);
      const coordinates =
        feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : undefined;
      expect(coordinates, id).toBeDefined();
      expect(
        booleanPointInPolygon(point(coordinates as [number, number]), activeBoundary!),
        id,
      ).toBe(true);
    }
  });

  it('uses a place-specific visual identity and visitor-first guide copy', () => {
    expect(tillicoultryPackage.project.touristAppeal?.rating).toBe(1);
    expect(tillicoultryPackage.project.visualIdentity).toMatchObject({
      theme: 'ochil-mill-town',
      heroImage: '/town-guides/tillicoultry-clock-mill-watercolour-guide.png',
    });
    expect(tillicoultryPackage.project.visualIdentity?.motifs).toEqual([
      'Tillicoultry Glen',
      'Clock Mill',
      'Firpark skiing',
      'Devon Way',
    ]);
    expect(tillicoultryPackage.project.townGuide?.currentAdvisory?.title).toBe(
      'Tillicoultry Glen path closure',
    );
  });

  it('records explicit source-use terms for every public feature', () => {
    expect(
      tillicoultryPackage.features
        .filter((feature) => feature.evidenceScope !== 'out_of_scope')
        .every((feature) => Boolean(feature.licence)),
    ).toBe(true);
    expect(
      tillicoultryPackage.features.filter((feature) => feature.tags.includes('source-use-restricted')),
    ).toHaveLength(7);
  });

  it('publishes the official parish boundary while keeping unapproved historic maps out', () => {
    expect(tillicoultryPackage.project.boundaryConfidence).toBe('high');
    expect(tillicoultryPackage.historicMaps.map((map) => map.id)).toEqual([
      'hes-listed-buildings-by-category',
    ]);
  });
});
