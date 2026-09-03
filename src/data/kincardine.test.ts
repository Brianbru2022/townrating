import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import { hasHistoricTimelineDate } from '../domain/timeline';
import { validateFeatures } from '../domain/validation';
import { foodRecommendation, trailRecommendation, visitRecommendation } from '../domain/visiting';
import { kincardinePackage } from './kincardine';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Kincardine-on-Forth published package', () => {
  it('keeps the supplied all-dated heritage snapshot, statutory refresh and authoritative parish extent', () => {
    const historicFeatures = kincardinePackage.features.filter(
      (feature) =>
        !feature.tags.includes('osm-community-place') &&
        !(
          feature.id.startsWith('curated-') &&
          feature.tags.includes('kincardine-on-forth-scotland-visitor-pack')
        ),
    );
    expect(kincardinePackage.project.id).toBe('kincardine-on-forth-scotland');
    expect(kincardinePackage.project.boundary.properties?.parishName).toBe('Tulliallan');
    expect(kincardinePackage.project.townStudyArea?.localityName).toBe('Kincardine');
    expect(kincardinePackage.project.townStudyArea?.bufferMetres).toBe(500);
    expect(historicFeatures).toHaveLength(317);
    expect(
      historicFeatures.filter(
        (feature) =>
          feature.documentedDateText &&
          feature.earliestPossibleYear !== undefined &&
          feature.latestPossibleYear !== undefined &&
          feature.dateBasis !== 'unknown',
      ),
    ).toHaveLength(224);
    expect(historicFeatures.filter((feature) => feature.id.startsWith('nrhe:'))).toHaveLength(
      248,
    );
    expect(historicFeatures.some((feature) => feature.datePrecision)).toBe(true);
    expect(historicFeatures.filter((feature) => feature.tags.includes('nrhe-period-extracted'))).toHaveLength(
      158,
    );
    expect(historicFeatures.filter(hasHistoricTimelineDate)).toHaveLength(218);
    expect(validateFeatures(kincardinePackage.project, kincardinePackage.features)).not.toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
  });

  it('keeps unapproved maps out of the selector', () => {
    expect(kincardinePackage.historicMaps).toHaveLength(1);
    expect(
      kincardinePackage.historicMaps.some((map) => map.id === 'nls-os-1920s-public-api'),
    ).toBe(false);
    expect(kincardinePackage.settlementPolygons).toEqual([]);
    expect(kincardinePackage.curationMetadata?.importedPacks[0]?.historicMapCatalogue).toHaveLength(7);
    expect(kincardinePackage.features.filter((feature) => !feature.geometry)).toHaveLength(4);
  });

  it('preserves the official locality while publishing narrow visitor extensions', () => {
    const studyArea = kincardinePackage.project.townStudyArea;
    expect(studyArea?.localityCode).toBe('S52000355');
    expect(studyArea?.localityBoundary.properties).toMatchObject({
      name: 'Kincardine',
      Popcount: 2882,
    });
    expect(studyArea?.visitorBoundary?.properties).toMatchObject({
      sourceDataset: 'Curated Kincardine visitor boundary',
      originalSourceDataset: studyArea?.sourceName,
    });
    expect(
      booleanPointInPolygon(point([-3.7188, 56.069]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.727187, 56.065216]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.71334, 56.07526]), studyArea!.visitorBoundary!),
    ).toBe(true);
    expect(
      booleanPointInPolygon(point([-3.71492, 56.08303]), studyArea!.visitorBoundary!),
    ).toBe(false);
  });

  it('publishes a realistic five-place See list and keeps the town at one star', () => {
    expect(kincardinePackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(
      kincardinePackage.project.visitorHighlights?.map((highlight) => [
        highlight.name,
        highlight.visitorScore,
      ]),
    ).toEqual([
      ['Historic Kincardine townscape and Mercat Cross', 66],
      ['Kincardine Bridge engineering viewpoint', 64],
      ['Tulliallan Old Parish Church and Woodlea Cemetery', 54],
      ['Railway Tavern historic interior', 48],
      ["Kincardine Sailor's Memorial", 43],
    ]);
    expect(visitRecommendation(66)?.label).toBe('Worth a look');
    expect(visitRecommendation(43)?.label).toBe('Point of interest');
  });

  it('ships deliberate Eat and Trails categories with category-specific scores', () => {
    const curation = publishedPlannerCurationForProject(kincardinePackage.project.id);
    const names = (ids: string[]) =>
      ids.map((id) => kincardinePackage.features.find((feature) => feature.id === id)?.name);

    expect(names(curation.eat ?? [])).toEqual([
      "Marco's Kitchen",
      'The Puttery at Tulliallan Golf Club',
      "Bayne's Family Bakers",
      "Ilario's",
    ]);
    expect(names(curation.trails ?? [])).toEqual([
      'Fife Coastal Path from Kincardine',
      'Round the Horn village wander',
      'Kincardine Bridge Forth crossing walk',
    ]);
    expect(foodRecommendation(82)?.label).toBe('Top food stop');
    expect(foodRecommendation(76)?.label).toBe('Great choice');
    expect(foodRecommendation(67)?.label).toBe('Good local option');
    expect(trailRecommendation(84)?.label).toBe('Recommended');
    expect(trailRecommendation(78)?.label).toBe('Interesting trail');

    const roundTheHorn = kincardinePackage.features.find(
      (feature) => feature.id === 'curated-trail:kincardine-round-the-horn',
    );
    expect(
      roundTheHorn?.sourceRecords.some(
        (source) =>
          source.notes?.includes('visit_score=78') &&
          source.notes.includes('Police College grounds') &&
          source.notes.includes('time_to_spend=75-120 minutes'),
      ),
    ).toBe(true);
  });

  it('publishes only the verified public car park and grouped picnic location', () => {
    const curation = publishedPlannerCurationForProject(kincardinePackage.project.id);
    expect(curation.parking).toEqual(['osm-community:way-385084824']);
    expect(curation.toilets).toEqual([]);
    expect(curation.picnic).toEqual(['curated-picnic:kincardine-wood-lea']);

    const parking = kincardinePackage.features.find(
      (feature) => feature.id === 'osm-community:way-385084824',
    );
    expect(parking?.name).toBe('Walker Street Car Park');
    expect(
      parking?.sourceRecords.some(
        (source) =>
          source.notes?.includes('capacity=67') &&
          source.notes.includes('opening_hours=24/7') &&
          source.notes.includes('price_display=Free'),
      ),
    ).toBe(true);
    expect(
      kincardinePackage.features.find(
        (feature) => feature.id === 'curated-picnic:kincardine-wood-lea',
      )?.name,
    ).toBe('Wood Lea picnic area');
  });

  it('keeps every published visitor point inside the active visitor boundary', () => {
    const curation = publishedPlannerCurationForProject(kincardinePackage.project.id);
    const visitorBoundary = kincardinePackage.project.townStudyArea?.visitorBoundary;
    expect(visitorBoundary).toBeDefined();
    const ids = [
      ...(kincardinePackage.project.visitorHighlights ?? []).map(
        (highlight) => highlight.featureId,
      ),
      ...Object.values(curation).flat(),
    ];
    for (const id of new Set(ids)) {
      const feature = kincardinePackage.features.find((candidate) => candidate.id === id);
      const coordinates =
        feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : undefined;
      expect(coordinates, id).toBeDefined();
      expect(booleanPointInPolygon(point(coordinates!), visitorBoundary!), id).toBe(true);
    }

    expect(
      booleanPointInPolygon(
        point([-3.727187, 56.065216]),
        kincardinePackage.project.boundary,
      ),
    ).toBe(false);
  });

  it('uses a place-specific guide identity and omits unsupported dog-friendly claims', () => {
    expect(kincardinePackage.project.visualIdentity).toMatchObject({
      theme: 'forth-bridge-and-historic-port',
      heroImage: '/town-guides/kincardine-forth-bridge-watercolour-guide.png',
    });
    expect(kincardinePackage.project.visualIdentity?.motifs).toEqual([
      'Kincardine Bridge',
      'Historic port',
      'Mercat Cross',
      'Fife Coastal Path',
    ]);
    const guideCopy = [
      kincardinePackage.project.townGuide?.headline,
      kincardinePackage.project.townGuide?.intro,
      kincardinePackage.project.townGuide?.visitorMood,
    ].join(' ');
    expect(guideCopy).not.toMatch(/parking|toilets/i);

    const curation = publishedPlannerCurationForProject(kincardinePackage.project.id);
    const foodSources = (curation.eat ?? []).flatMap(
      (id) => kincardinePackage.features.find((feature) => feature.id === id)?.sourceRecords ?? [],
    );
    expect(foodSources.some((source) => source.notes?.includes('dog_friendly=yes'))).toBe(false);
  });
});
