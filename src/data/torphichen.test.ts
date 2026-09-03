import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { touristAppealLabel } from '../domain/tourism';
import { foodRecommendation, visitRecommendation } from '../domain/visiting';
import { torphichenPackage } from './torphichen';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Torphichen published package', () => {
  it('publishes the NRS locality-backed Torphichen package with reviewed non-map evidence', () => {
    expect(torphichenPackage.project.id).toBe('torphichen-scotland');
    expect(torphichenPackage.project.region).toBe('West Lothian');
    expect(torphichenPackage.project.name).toBe('Torphichen');
    expect(torphichenPackage.project.boundary.properties?.localityName).toBe('Torphichen');
    expect(touristAppealLabel(torphichenPackage.project)).toBe('Torphichen ★');
    expect(torphichenPackage.features).toHaveLength(68);
    expect(torphichenPackage.validation).toHaveLength(0);

    const listedBuildings = torphichenPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(14);
    expect(listedBuildings.every(hasEstablishedDate)).toBe(true);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(12);

    expect(
      torphichenPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(12);

    expect(
      torphichenPackage.features.filter(
        (feature) => feature.id.startsWith('hes-') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(14);

    const currentPlaces = torphichenPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(19);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    expect(
      torphichenPackage.features.filter((feature) =>
        feature.tags.includes('osm-current-park'),
      ),
    ).toHaveLength(0);

    expect(
      torphichenPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(19);
  });

  it('retains one star after a conservative boundary-first visitor audit', () => {
    expect(torphichenPackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(
      torphichenPackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ['Torphichen Preceptory, Parish Kirk and sanctuary stone', 82],
      ['Torphichen village square and Jubilee Well', 52],
    ]);
    expect(visitRecommendation(82)?.label).toBe('Recommended');
    expect(visitRecommendation(52)?.label).toBe('Worth a look');
  });

  it('publishes a small researched planner without padding empty categories', () => {
    const curation = publishedPlannerCurationForProject(torphichenPackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => torphichenPackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? [])).toEqual(['Torphichen Inn']);
    expect(curation.trails).toEqual([]);
    expect(curation.picnic).toEqual([]);
    expect(names(curation.parking ?? [])).toEqual([
      'Bowyett / Preceptory street-side parking',
    ]);
    expect(names(curation.toilets ?? [])).toEqual([
      'Torphichen Kirk visitor toilet, Bowyett',
    ]);
    expect(foodRecommendation(66)?.label).toBe('Good local option');
  });

  it('keeps every public visitor marker inside the original NRS locality', () => {
    const studyArea = torphichenPackage.project.townStudyArea;
    const curation = publishedPlannerCurationForProject(torphichenPackage.project.id);
    expect(studyArea?.localityCode).toBe('S52000617');
    expect(studyArea?.visitorBoundary).toBeUndefined();

    const ids = [
      ...(torphichenPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ];
    for (const id of new Set(ids)) {
      const feature = torphichenPackage.features.find((candidate) => candidate.id === id);
      const coordinates =
        feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : undefined;
      expect(coordinates, id).toBeDefined();
      expect(booleanPointInPolygon(point(coordinates!), studyArea!.localityBoundary), id).toBe(true);
    }
  });

  it('combines duplicate heritage records and ships a place-specific editorial guide', () => {
    expect(
      torphichenPackage.features.find(
        (feature) => feature.id === 'hes-listed-building:LB14534',
      )?.tags,
    ).toContain('visitor-audit-combined');
    expect(
      torphichenPackage.features.find(
        (feature) => feature.id === 'osm-community:node-3725355463',
      )?.tags,
    ).toContain('map-hidden');
    for (const id of [
      'osm-community:way-1011207756',
      'osm-community:way-1063051064',
      'osm-community:way-1063051065',
    ]) {
      expect(torphichenPackage.features.find((feature) => feature.id === id)?.tags, id).toContain(
        'visitor-audit-excluded',
      );
    }
    expect(torphichenPackage.project.visualIdentity).toMatchObject({
      theme: 'hospitaller-preceptory-and-sanctuary-village',
      heroImage: '/town-guides/torphichen-preceptory-watercolour-guide.png',
    });
    expect(torphichenPackage.project.visualIdentity?.motifs).toEqual([
      'Hospitaller story',
      'Sanctuary stone',
      'Village square',
      'Medieval kirk',
    ]);
    const guideCopy = [
      torphichenPackage.project.townGuide?.headline,
      torphichenPackage.project.townGuide?.intro,
      torphichenPackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets|evidence/i);
  });
});
