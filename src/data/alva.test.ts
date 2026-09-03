import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { validateFeatures } from '../domain/validation';
import { topVisitPlaces } from '../domain/visiting';
import {
  parkingPriceStatus,
  visitorFacts,
  visitorNeedPlaces,
  visitorPlaceType,
} from '../domain/visitorExperience';
import { alvaPackage } from './alva';
import { publishedPlannerCuration } from './visitorPlannerCuration';

describe('Alva published package', () => {
  it('uses the NRS Alva parish boundary and retains the dated curated pack alongside NRHE evidence', () => {
    const historicFeatures = alvaPackage.features.filter(
      (feature) =>
        !feature.tags.includes('osm-community-place') &&
        !(feature.id.startsWith('curated-') && feature.tags.includes('alva-scotland-visitor-pack')),
    );
    expect(alvaPackage.project.boundary.properties?.parishName).toBe('Alva');
    expect(alvaPackage.project.townStudyArea?.localityName).toBe('Alva');
    expect(alvaPackage.project.townStudyArea?.bufferMetres).toBe(500);
    expect(historicFeatures).toHaveLength(164);
    expect(historicFeatures.filter((feature) => feature.id.startsWith('curated:'))).toHaveLength(34);
    expect(historicFeatures.filter((feature) => feature.id.startsWith('curated:')).every(hasEstablishedDate)).toBe(true);
    expect(historicFeatures.filter(hasEstablishedDate)).toHaveLength(164);
    expect(historicFeatures.filter(hasHistoricTimelineDate)).toHaveLength(101);
    expect(historicFeatures.filter((feature) => feature.id.startsWith('nrhe:'))).toHaveLength(
      124,
    );
    expect(
      historicFeatures.filter((feature) => feature.tags.includes('inventory-presence-date')),
    ).toHaveLength(62);
    expect(alvaPackage.features.filter((feature) => feature.tags.includes('osm-current-park'))).toHaveLength(2);
    expect(validateFeatures(alvaPackage.project, alvaPackage.features)).not.toContainEqual(
      expect.objectContaining({ severity: 'error' }),
    );
    expect(alvaPackage.features.some((feature) => /\bmenstrie\b/i.test(feature.name))).toBe(false);
    expect(alvaPackage.features.find((feature) => feature.id === 'nrhe:47074')).toMatchObject({
      earliestPossibleYear: 1873,
      latestPossibleYear: 1877,
      dateBasis: 'estimated_from_authoritative_source',
    });
    expect(alvaPackage.features.find((feature) => feature.id === 'nrhe:111955')).toMatchObject({
      latestPossibleYear: 1866,
      dateBasis: 'first_mapped',
    });
    expect(alvaPackage.features.find((feature) => feature.id === 'nrhe:111955')?.earliestPossibleYear).toBeUndefined();
  });

  it('publishes the reviewed community inventory without an unapproved historic map', () => {
    const communityFeatures = alvaPackage.features.filter((feature) =>
      feature.tags.includes('community-layer'),
    );
    expect(communityFeatures).toHaveLength(15);
    expect(communityFeatures.flatMap((feature) => feature.sourceRecords)).not.toContainEqual(
      expect.any(String),
    );
    expect(alvaPackage.historicMaps).toHaveLength(1);
    expect(alvaPackage.historicMaps.some((map) => map.id === 'nls-os-1920s-public-api')).toBe(false);
    expect(alvaPackage.settlementPolygons).toEqual([]);
    expect(alvaPackage.curationMetadata?.importedPacks[0]?.historicMapCatalogue).toHaveLength(6);
  });

  it('publishes the audited Alva guide and a deliberately compact attraction list', () => {
    expect(alvaPackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(alvaPackage.project.townGuide).toMatchObject({
      headline: 'A dramatic Ochil glen and a compact Hillfoots town',
      suggestedTime: '2-4 hours; longer for an extended glen walk',
      suggestedFirstVisit: { title: 'Alva Glen, then coffee or the parks' },
    });
    expect(alvaPackage.project.visualIdentity).toMatchObject({
      theme: 'ochil-glen',
      badgeImage: '/town-guides/alva-glen-watercolour-guide.png',
      heroImage: '/town-guides/alva-glen-watercolour-guide.png',
    });
    expect(alvaPackage.project.townGuide?.intro).not.toMatch(/parking|toilets|evidence/i);

    const attractions = topVisitPlaces(alvaPackage, 10);
    expect(attractions.map((place) => place.name)).toEqual([
      'Alva Glen',
      'Johnstone & Cochrane Parks',
      'Johnstone Mausoleum & Old Alva Kirkyard',
    ]);
    expect(attractions.map((place) => place.visitorScore)).toEqual([79, 62, 53]);
    expect(attractions.every((place) => place.freeAdmission)).toBe(true);
    expect(attractions.every((place) => !place.organisationPills?.includes('Free'))).toBe(true);
  });

  it('presents Alva Glen as a visitor attraction without NRHE record language', () => {
    const alvaGlen = alvaPackage.features.find((feature) => feature.id === 'nrhe:47054');

    expect(alvaGlen).toBeDefined();
    expect(visitorPlaceType(alvaGlen!)).toBe('Glen and nature walk');
    expect(visitorFacts(alvaGlen!).map((fact) => fact.label)).not.toContain('Historic date');
    expect(visitorFacts(alvaGlen!)).toContainEqual({
      label: 'Time to spend',
      value: '60-150 minutes',
    });
  });

  it('ships researched food, trail and practical planner lists', () => {
    const curation = publishedPlannerCuration['alva-scotland'] ?? {};
    const food = visitorNeedPlaces(alvaPackage, 'eat', 20, {
      curatedFeatureIds: curation.eat,
    });
    expect(food.map((place) => place.name)).toEqual([
      'Little Owls Cafe, Bakery & Kitchen',
      'The No 5 Inn',
      'No71 Coffee House',
      'Alva Tandoori',
      'Bollinis of Alva',
      "Bayne's",
    ]);
    expect(food.map((place) => place.visitorScore)).toEqual([84, 82, 79, 77, 71, 65]);
    expect(food.filter((place) => place.dogFriendly).map((place) => place.name)).toEqual([
      'The No 5 Inn',
    ]);

    const parking = visitorNeedPlaces(alvaPackage, 'parking', 20, {
      curatedFeatureIds: curation.parking,
    });
    expect(parking.map((place) => place.name)).toEqual([
      'Upper Queen Street Car Park',
      'Lower Cobden Street Car Park',
      'Cochrane Park Car Park',
      'Alva Glen Car Park',
    ]);
    expect(
      parking.every(
        (place) =>
          parkingPriceStatus(alvaPackage.features.find((feature) => feature.id === place.id)!) ===
          'free',
      ),
    ).toBe(true);

    expect(
      visitorNeedPlaces(alvaPackage, 'toilets', 20, {
        curatedFeatureIds: curation.toilets,
      }).map((place) => place.name),
    ).toEqual([
      'Alva Pop-up Library public toilets',
      'Cochrane Park seasonal public toilets',
    ]);
    expect(
      visitorNeedPlaces(alvaPackage, 'picnic', 20, {
        curatedFeatureIds: curation.picnic,
      }).map((place) => place.name),
    ).toEqual(['Johnstone & Cochrane Parks picnic tables']);
    expect(
      visitorNeedPlaces(alvaPackage, 'trails', 20, {
        curatedFeatureIds: curation.trails,
      }),
    ).toEqual([
      expect.objectContaining({
        name: "Alva Glen to Smuggler's Cave",
        visitorScore: 84,
        externalUrl: 'https://www.clackmannanshire.scot/index.php/leisure/alva-glen',
      }),
      expect.objectContaining({
        name: 'Alva textile-town heritage walk',
        visitorScore: 68,
        externalUrl: 'https://www.clacks.gov.uk/property/alvaconservationarea/',
      }),
    ]);
  });

  it('preserves the NRS locality while using a narrow, audited Alva Glen extension', () => {
    const townStudyArea = alvaPackage.project.townStudyArea;
    const originalBoundary = townStudyArea?.localityBoundary;
    const visitorBoundary = townStudyArea?.visitorBoundary;
    expect(townStudyArea?.sourceName).toBe(
      'National Records of Scotland 2022 Census Locality Boundaries',
    );
    expect(visitorBoundary?.properties?.sourceDataset).toBe('Curated Alva visitor boundary');
    expect(originalBoundary).toBeDefined();
    expect(visitorBoundary).toBeDefined();
    if (!originalBoundary || !visitorBoundary) return;

    const alvaGlen = alvaPackage.features.find((feature) => feature.id === 'nrhe:47054');
    expect(alvaGlen?.geometry?.type).toBe('Point');
    if (alvaGlen?.geometry?.type === 'Point') {
      const glenPoint = point(alvaGlen.geometry.coordinates);
      expect(booleanPointInPolygon(glenPoint, originalBoundary)).toBe(false);
      expect(booleanPointInPolygon(glenPoint, visitorBoundary)).toBe(true);
    }

    const woodland = alvaPackage.features.find(
      (feature) =>
        feature.id === 'curated-attraction:alva-ochil-hills-woodland-park-and-wood-hill',
    );
    expect(woodland?.geometry?.type).toBe('Point');
    if (woodland?.geometry?.type === 'Point') {
      expect(booleanPointInPolygon(point(woodland.geometry.coordinates), visitorBoundary)).toBe(
        false,
      );
    }

    const curation = publishedPlannerCuration['alva-scotland'] ?? {};
    const publicFeatureIds = new Set([
      ...(alvaPackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);
    for (const featureId of publicFeatureIds) {
      const feature = alvaPackage.features.find((candidate) => candidate.id === featureId);
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point') continue;
      const location = point(feature.geometry.coordinates);
      expect(booleanPointInPolygon(location, visitorBoundary), featureId).toBe(true);
      expect(booleanPointInPolygon(location, alvaPackage.project.boundary), featureId).toBe(true);
    }
  });
});
