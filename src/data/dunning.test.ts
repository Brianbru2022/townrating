import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { touristAppealLabel } from '../domain/tourism';
import { foodRecommendation, trailRecommendation, visitRecommendation } from '../domain/visiting';
import { dunningPackage } from './dunning';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Dunning published package', () => {
  it('publishes the NRS locality-backed Dunning package with reviewed non-map evidence', () => {
    expect(dunningPackage.project.id).toBe('dunning-scotland');
    expect(dunningPackage.project.region).toBe('Perth and Kinross');
    expect(dunningPackage.project.boundary.properties?.localityName).toBe('Dunning');
    expect(dunningPackage.project.boundary.properties?.localityCode).toBe('S52000216');
    expect(touristAppealLabel(dunningPackage.project)).toBe('Dunning ★');
    expect(dunningPackage.features).toHaveLength(164);
    expect(dunningPackage.validation).toHaveLength(0);

    const listedBuildings = dunningPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(92);
    expect(listedBuildings.filter(hasEstablishedDate)).toHaveLength(33);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(30);

    expect(
      dunningPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(20);

    expect(
      dunningPackage.features.filter(
        (feature) =>
          feature.id.startsWith('hes-') &&
          !feature.tags.includes('hes-listed-building') &&
          hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(5);

    const currentPlaces = dunningPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(20);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = dunningPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(2);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      dunningPackage.features.filter((feature) => feature.tags.includes('dunning-service-polished')),
    ).toHaveLength(20);
    expect(
      dunningPackage.features.filter((feature) => feature.tags.includes('service-context-food')),
    ).toHaveLength(2);
    expect(
      dunningPackage.features.filter((feature) => feature.tags.includes('service-context-toilets')),
    ).toHaveLength(1);
    expect(
      dunningPackage.features.filter((feature) => feature.tags.includes('service-context-parking')),
    ).toHaveLength(1);
    expect(
      dunningPackage.features.filter((feature) => feature.tags.includes('service-context-heritage')),
    ).toHaveLength(6);
    expect(
      dunningPackage.features.filter((feature) => feature.tags.includes('service-context-memorial')),
    ).toHaveLength(3);

    expect(
      dunningPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(79);
  });

  it('retains one star after a conservative visitor audit', () => {
    expect(dunningPackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(
      dunningPackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ["St Serf's Church and Dupplin Cross", 82],
      ['Dunning Thorn Tree', 48],
    ]);
    expect(visitRecommendation(82)?.label).toBe('Recommended');
    expect(visitRecommendation(48)?.label).toBe('Worth a look');
  });

  it('publishes only researched, named planner places in deliberate order', () => {
    const curation = publishedPlannerCurationForProject(dunningPackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => dunningPackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? [])).toEqual([
      'Kirkstyle Inn',
      'The Tee Room at Rollo Park',
    ]);
    expect(names(curation.trails ?? [])).toEqual([
      'Dunning Circular',
      'Dunning Witch Trail',
    ]);
    expect(names(curation.parking ?? [])).toEqual(['Rollo Park visitor car park']);
    expect(names(curation.toilets ?? [])).toEqual([
      'Rollo Recreation Ground public toilets, Station Road',
    ]);
    expect(names(curation.picnic ?? [])).toEqual(['Thorntree Square picnic benches']);
    expect(foodRecommendation(82)?.label).toBe('Top food stop');
    expect(foodRecommendation(68)?.label).toBe('Good local option');
    expect(trailRecommendation(82)?.label).toBe('Recommended');
    expect(trailRecommendation(76)?.label).toBe('Interesting trail');
  });

  it('preserves the NRS locality and adds only the public Rollo Park visitor extension', () => {
    const studyArea = dunningPackage.project.townStudyArea;
    const curation = publishedPlannerCurationForProject(dunningPackage.project.id);
    expect(studyArea?.localityCode).toBe('S52000216');
    expect(studyArea?.visitorBoundary?.properties).toMatchObject({
      sourceDataset: 'Curated Dunning visitor boundary',
      originalSourceDataset: studyArea?.sourceName,
    });
    expect(
      booleanPointInPolygon(
        point([-3.5912178868439755, 56.31312130462876]),
        studyArea!.localityBoundary,
      ),
    ).toBe(false);
    expect(
      booleanPointInPolygon(
        point([-3.5912178868439755, 56.31312130462876]),
        studyArea!.visitorBoundary!,
      ),
    ).toBe(true);
    const ids = [
      ...(dunningPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ];
    for (const id of new Set(ids)) {
      const feature = dunningPackage.features.find((candidate) => candidate.id === id);
      const coordinates =
        feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : undefined;
      expect(coordinates, id).toBeDefined();
      expect(booleanPointInPolygon(point(coordinates!), studyArea!.visitorBoundary!), id).toBe(true);
    }
  });

  it('excludes nearby places and ships a place-specific editorial guide', () => {
    for (const id of [
      'osm-community:node-12022637366',
      'osm-community:node-12022638574',
      'osm-community:node-2553037364',
    ]) {
      expect(
        dunningPackage.features.find((feature) => feature.id === id)?.tags,
        id,
      ).toContain('visitor-audit-excluded');
    }
    expect(dunningPackage.project.visualIdentity).toMatchObject({
      theme: 'pictish-cross-and-perthshire-village',
      heroImage: '/town-guides/dunning-st-serfs-2026-guide.png',
    });
    expect(dunningPackage.project.visualIdentity?.motifs).toEqual([
      'Pictish carving',
      'Medieval kirk',
      'Thorn Tree',
      'Village walks',
    ]);
    const guideCopy = [
      dunningPackage.project.townGuide?.headline,
      dunningPackage.project.townGuide?.intro,
      dunningPackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets|evidence/i);
  });
});
