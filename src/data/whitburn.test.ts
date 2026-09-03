import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { foodRecommendation, visitRecommendation } from '../domain/visiting';
import { whitburnPackage } from './whitburn';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Whitburn published package', () => {
  it('publishes the NRS locality-backed Whitburn package with reviewed non-map evidence', () => {
    expect(whitburnPackage.project.id).toBe('whitburn-scotland');
    expect(whitburnPackage.project.region).toBe('West Lothian');
    expect(whitburnPackage.project.name).toBe('Whitburn');
    expect(whitburnPackage.project.boundary.properties?.localityName).toBe('Whitburn');
    expect(whitburnPackage.features).toHaveLength(118);
    expect(whitburnPackage.validation).toHaveLength(0);
    expect(whitburnPackage.project.touristAppeal).toMatchObject({
      rating: 0,
      label: 'Not a tourist town',
    });
    const listedBuildings = whitburnPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(3);
    expect(listedBuildings.every(hasEstablishedDate)).toBe(true);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(2);

    expect(
      whitburnPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(19);

    const currentPlaces = whitburnPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(89);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = whitburnPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(1);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      whitburnPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(5);
  });

  it('retains a zero-star rating after excluding stronger places outside the town polygon', () => {
    expect(whitburnPackage.project.touristAppeal).toMatchObject({
      rating: 0,
      label: 'Not a tourist town',
    });
    expect(
      whitburnPackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ['Whitburn Community Museum and historic Burgh Halls', 56],
      ['Whitburn mining memorials, Market Place', 40],
    ]);
    expect(visitRecommendation(56)?.label).toBe('Worth a look');
    expect(visitRecommendation(40)?.label).toBe('Point of interest');
    expect(whitburnPackage.project.touristAppeal?.summary).toMatch(/Polkemmet.*outside/i);
  });

  it('publishes a compact researched planner without generic filler', () => {
    const curation = publishedPlannerCurationForProject(whitburnPackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => whitburnPackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? []).slice(0, 3)).toEqual([
      'Casa Amiga',
      'Karma Indian Cuisine',
      "Andy's Coffee House",
    ]);
    expect(curation.eat).toHaveLength(3);
    expect(curation.trails).toEqual([]);
    expect(names(curation.picnic ?? [])).toEqual(['Mansewood Crescent picnic table']);
    expect(names(curation.parking ?? [])).toEqual([
      'Armadale Road / Partnership Centre car park',
    ]);
    expect(names(curation.toilets ?? [])).toEqual([
      'Armadale Road public toilets, Whitburn',
    ]);
    expect(foodRecommendation(79)?.label).toBe('Great choice');
    expect(foodRecommendation(78)?.label).toBe('Great choice');
    expect(foodRecommendation(66)?.label).toBe('Good local option');
  });

  it('keeps every public visitor marker inside the original NRS locality', () => {
    const studyArea = whitburnPackage.project.townStudyArea;
    const curation = publishedPlannerCurationForProject(whitburnPackage.project.id);
    expect(studyArea?.localityCode).toBe('S52000645');
    expect(studyArea?.visitorBoundary).toBeUndefined();

    const ids = [
      ...(whitburnPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ];
    for (const id of new Set(ids)) {
      const feature = whitburnPackage.features.find((candidate) => candidate.id === id);
      const coordinates =
        feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : undefined;
      expect(coordinates, id).toBeDefined();
      expect(booleanPointInPolygon(point(coordinates!), studyArea!.localityBoundary), id).toBe(true);
      expect(feature?.name, id).not.toMatch(/Polkemmet|Owl Centre|Whitrigg/i);
    }
  });

  it('ships a place-specific guide and combines duplicate town-centre records', () => {
    expect(whitburnPackage.project.visualIdentity).toMatchObject({
      theme: 'mining-heritage-and-burgh-clock',
      heroImage: '/town-guides/whitburn-baillie-institute-watercolour-guide.png',
    });
    expect(whitburnPackage.project.visualIdentity?.motifs).toEqual([
      'Mining stories',
      'Community museum',
      'Burgh clock',
      'Local food',
    ]);
    for (const id of [
      'nrhe:374746',
      'osm-community:node-13357509293',
      'nrhe:275462',
      'osm-community:way-1456488006',
    ]) {
      expect(whitburnPackage.features.find((feature) => feature.id === id)?.tags, id).toContain(
        'visitor-audit-combined',
      );
    }
    const guideCopy = [
      whitburnPackage.project.townGuide?.headline,
      whitburnPackage.project.townGuide?.intro,
      whitburnPackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets|evidence/i);
  });
});
