import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { touristAppealLabel } from '../domain/tourism';
import { validateFeatures } from '../domain/validation';
import { foodRecommendation, trailRecommendation, visitRecommendation } from '../domain/visiting';
import { bridgeOfEarnPackage } from './bridgeOfEarn';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Bridge of Earn published package', () => {
  it('publishes the NRS locality-backed Bridge of Earn package with reviewed non-map evidence', () => {
    expect(bridgeOfEarnPackage.project.id).toBe('bridge-of-earn-scotland');
    expect(bridgeOfEarnPackage.project.region).toBe('Perth and Kinross');
    expect(bridgeOfEarnPackage.project.boundary.properties?.localityName).toBe('Bridge of Earn');
    expect(bridgeOfEarnPackage.project.boundary.properties?.localityCode).toBe('S52000092');
    expect(touristAppealLabel(bridgeOfEarnPackage.project)).toBe('Bridge of Earn ⊘');
    expect(bridgeOfEarnPackage.features).toHaveLength(71);
    expect(bridgeOfEarnPackage.validation).toHaveLength(0);
    expect(
      validateFeatures(bridgeOfEarnPackage.project, bridgeOfEarnPackage.features),
    ).not.toContainEqual(expect.objectContaining({ severity: 'error' }));

    const listedBuildings = bridgeOfEarnPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(20);
    expect(listedBuildings.every(hasEstablishedDate)).toBe(true);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(17);

    expect(
      bridgeOfEarnPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(9);

    expect(
      bridgeOfEarnPackage.features.filter(
        (feature) =>
          feature.id.startsWith('hes-') &&
          !feature.tags.includes('hes-listed-building') &&
          hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(1);

    const currentPlaces = bridgeOfEarnPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(20);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = bridgeOfEarnPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(1);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      bridgeOfEarnPackage.features.filter((feature) =>
        feature.tags.includes('bridge-of-earn-service-polished'),
      ),
    ).toHaveLength(21);
    expect(
      bridgeOfEarnPackage.features.filter((feature) => feature.tags.includes('service-context-food')),
    ).toHaveLength(4);
    expect(
      bridgeOfEarnPackage.features.filter((feature) =>
        feature.tags.includes('service-context-parking'),
      ),
    ).toHaveLength(12);
    expect(
      bridgeOfEarnPackage.features.filter((feature) =>
        feature.tags.includes('service-context-playground'),
      ),
    ).toHaveLength(3);
    expect(
      bridgeOfEarnPackage.features.filter((feature) =>
        feature.tags.includes('service-context-memorial'),
      ),
    ).toHaveLength(1);

    expect(
      bridgeOfEarnPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(15);
  });

  it('preserves the official locality while adding two narrow visitor extensions', () => {
    const studyArea = bridgeOfEarnPackage.project.townStudyArea;
    expect(studyArea?.localityCode).toBe('S52000092');
    expect(studyArea?.localityBoundary.properties).toMatchObject({
      name: 'Bridge of Earn',
      Popcount: 2918,
    });
    expect(studyArea?.visitorBoundary?.properties).toMatchObject({
      sourceDataset: 'Curated Bridge of Earn visitor boundary',
      originalSourceDataset: studyArea?.sourceName,
    });
    expect(
      booleanPointInPolygon(point([-3.4055, 56.3492]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.40482, 56.35182]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.411598, 56.3553455]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.35, 56.36]), studyArea!.visitorBoundary!),
    ).toBe(false);
    expect(
      booleanPointInPolygon(point([-3.411598, 56.3553455]), studyArea!.localityBoundary),
    ).toBe(false);
  });

  it('publishes a restrained four-place See list and retains the zero-star rating', () => {
    expect(bridgeOfEarnPackage.project.touristAppeal).toMatchObject({
      rating: 0,
      label: 'Not a tourist town',
    });
    expect(
      bridgeOfEarnPackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ['Dunbarney Parish Church', 52],
      ['Old Bridge of Earn remains', 46],
      ['Victory Park and play area', 42],
      ['Bridge of Earn War Memorial and Institute', 38],
    ]);
    expect(visitRecommendation(52)?.label).toBe('Worth a look');
    expect(visitRecommendation(42)?.label).toBe('Point of interest');
  });

  it('ships researched food and trail categories in deliberate order', () => {
    const curation = publishedPlannerCurationForProject(bridgeOfEarnPackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => bridgeOfEarnPackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? [])).toEqual([
      'The Village Inn and Restaurant',
      'The Earn Coffee Shop',
      'Spice Garden',
      'Tower Bakery',
    ]);
    expect(names(curation.trails ?? [])).toEqual([
      'Bridge of Earn-Forgandenny Circular',
      'West of Bridge of Earn circular',
    ]);
    expect(foodRecommendation(82)?.label).toBe('Top food stop');
    expect(foodRecommendation(81)?.label).toBe('Top food stop');
    expect(foodRecommendation(67)?.label).toBe('Good local option');
    expect(trailRecommendation(82)?.label).toBe('Recommended');
    expect(trailRecommendation(77)?.label).toBe('Interesting trail');

    const dogFriendlyNames = (curation.eat ?? []).filter((id) =>
      bridgeOfEarnPackage.features
        .find((feature) => feature.id === id)
        ?.sourceRecords.some((source) => source.notes?.includes('dog_friendly=yes')),
    );
    expect(names(dogFriendlyNames)).toEqual([
      'The Village Inn and Restaurant',
      'The Earn Coffee Shop',
    ]);
  });

  it('publishes only one public car park, one named picnic stop and no invented toilets', () => {
    const curation = publishedPlannerCurationForProject(bridgeOfEarnPackage.project.id);
    expect(curation.parking).toEqual(['osm-community:way-1107763327']);
    expect(curation.picnic).toEqual(['curated-picnic:bridge-of-earn-victory-park']);
    expect(curation.toilets).toEqual([]);

    const parking = bridgeOfEarnPackage.features.find(
      (feature) => feature.id === 'osm-community:way-1107763327',
    );
    expect(parking?.name).toBe('Victory Park / Institute car park');
    expect(
      parking?.sourceRecords.some(
        (source) =>
          source.notes?.includes('access=public') &&
          source.notes.includes('price_display=Free') &&
          source.notes.includes('payment_required=no'),
      ),
    ).toBe(true);
    expect(
      bridgeOfEarnPackage.features.filter(
        (feature) =>
          feature.featureType === 'parking' && feature.tags.includes('visitor-audit-excluded'),
      ),
    ).toHaveLength(11);
  });

  it('keeps every published visitor point inside the active visitor boundary', () => {
    const curation = publishedPlannerCurationForProject(bridgeOfEarnPackage.project.id);
    const visitorBoundary = bridgeOfEarnPackage.project.townStudyArea?.visitorBoundary;
    expect(visitorBoundary).toBeDefined();
    const ids = [
      ...(bridgeOfEarnPackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ];
    for (const id of new Set(ids)) {
      const feature = bridgeOfEarnPackage.features.find((candidate) => candidate.id === id);
      const coordinates =
        feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : undefined;
      expect(coordinates, id).toBeDefined();
      expect(booleanPointInPolygon(point(coordinates!), visitorBoundary!), id).toBe(true);
    }
  });

  it('uses a place-specific editorial guide without practical-first copy', () => {
    expect(bridgeOfEarnPackage.project.visualIdentity).toMatchObject({
      theme: 'perthshire-church-and-river-crossing',
      heroImage: '/town-guides/bridge-of-earn-dunbarney-church-2026-guide.png',
    });
    expect(bridgeOfEarnPackage.project.visualIdentity?.motifs).toEqual([
      'Dunbarney',
      'Old bridge',
      'Country walks',
      'Local food',
    ]);
    const guideCopy = [
      bridgeOfEarnPackage.project.townGuide?.headline,
      bridgeOfEarnPackage.project.townGuide?.intro,
      bridgeOfEarnPackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets|evidence/i);
  });
});
