import { booleanPointInPolygon, point } from '@turf/turf';
import { describe, expect, it } from 'vitest';
import { topVisitPlaces } from '../domain/visiting';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { alloaPackage } from './alloa';
import { publishedPlannerCuration } from './visitorPlannerCuration';

describe('Alloa published package', () => {
  it('retains the official HES period evidence for Alloa Tower', () => {
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:320380')).toMatchObject({
      name: 'Alloa Tower',
      earliestPossibleYear: 1400,
      latestPossibleYear: 1499,
      dateBasis: 'documented_date_range',
      dateConfidence: 'high',
    });
  });

  it('keeps catalogue views out of the map while preserving archaeology and named-site review queues', () => {
    expect(
      alloaPackage.features.filter((feature) => feature.tags.includes('catalogue-general-view')),
    ).toHaveLength(35);
    expect(
      alloaPackage.features.filter((feature) => feature.tags.includes('archaeology-evidence')),
    ).toHaveLength(21);
    expect(
      alloaPackage.features.filter((feature) => feature.tags.includes('curation-priority-named-site')),
    ).toHaveLength(0);
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:130814')).toMatchObject({
      earliestPossibleYear: 1879,
      latestPossibleYear: 1960,
      dateBasis: 'documented_date_range',
    });
  });

  it('does not publish adjacent settlements in the Alloa town view', () => {
    const outOfScope = alloaPackage.features.filter(
      (feature) => feature.evidenceScope === 'out_of_scope',
    );
    expect(outOfScope).toHaveLength(166);
    expect(outOfScope.some((feature) => feature.name.includes('TULLIBODY'))).toBe(true);
    expect(outOfScope.some((feature) => feature.name.includes('SAUCHIE'))).toBe(true);
  });

  it('uses feature-level evidence rather than guessed years for the Mar Inn and Gray and Harrower mill', () => {
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:47197')).toMatchObject({
      latestPossibleYear: 1744,
      dateBasis: 'present_by',
      survival: 'site_only_or_demolished',
    });
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:47197')?.earliestPossibleYear).toBeUndefined();
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:141970')).toMatchObject({
      earliestPossibleYear: 1731,
      latestPossibleYear: 1731,
      dateBasis: 'documented_construction',
    });
  });

  it('retains the distinction between building dates and named-site evidence', () => {
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:47202')).toMatchObject({
      earliestPossibleYear: 1861,
      dateBasis: 'documented_date_range',
    });
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:47235')).toMatchObject({
      latestPossibleYear: 1799,
      dateBasis: 'present_by',
    });
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:47235')?.earliestPossibleYear).toBeUndefined();
  });

  it('keeps source-reviewed but undated named records in the public review path', () => {
    expect(
      alloaPackage.features.filter((feature) => feature.tags.includes('alloa-date-researched-no-date')),
    ).toHaveLength(14);
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:141370')).toMatchObject({
      latestPossibleYear: 1815,
      dateBasis: 'present_by',
    });
    expect(alloaPackage.features.find((feature) => feature.id === 'nrhe:133349')?.tags).toContain(
      'map-hidden',
    );
  });

  it('publishes a visitor-first local-detour Alloa guide with a selective attraction list', () => {
    expect(alloaPackage.project.touristAppeal).toMatchObject({
      rating: 1,
      label: 'Local detour',
    });
    expect(alloaPackage.project.visualIdentity).toMatchObject({
      theme: 'tower-industrial',
      badgeImage: '/town-guides/alloa-tower-watercolour-guide.png',
      heroImage: '/town-guides/alloa-tower-watercolour-guide.png',
      motifs: ['Medieval keep', 'Football heritage', 'Brewing & glass', 'Public art'],
    });
    expect(alloaPackage.project.townGuide).toMatchObject({
      headline: 'A medieval tower, football stories and traces of an industrial town',
      suggestedTime: 'Half day when Alloa Tower is open; 1-2 hours on a Tower-closed day',
      suggestedFirstVisit: {
        title: 'Alloa Tower, then the town-centre stories',
      },
    });
    expect(alloaPackage.project.townGuide?.intro).not.toMatch(/parking|toilets|evidence/i);

    const attractions = topVisitPlaces(alloaPackage, 10);
    expect(attractions.map((place) => place.name)).toEqual([
      'Alloa Tower',
      'Alloa Athletic Football Museum',
      'Alloa Speirs Centre heritage displays',
      'Alloa Town Hall events',
      'Old Alloa Kirkyard and Mar & Kellie Mausoleum',
    ]);
    expect(attractions.map((place) => place.visitorScore)).toEqual([84, 64, 58, 55, 50]);
    expect(attractions.map((place) => place.freeAdmission)).toEqual([false, true, true, false, true]);
    expect(attractions[0]?.organisationPills).toEqual(['NTS']);
    expect(attractions.slice(1).every((place) => !place.organisationPills?.includes('Free'))).toBe(
      true,
    );
  });

  it('ships the audited Alloa food and practical planner lists', () => {
    const curation = publishedPlannerCuration['alloa-scotland'] ?? {};
    const food = visitorNeedPlaces(alloaPackage, 'eat', 20, {
      curatedFeatureIds: curation.eat,
    });
    expect(food.slice(0, 8).map((place) => place.name)).toEqual([
      "Bar Aldo's",
      'MOCS',
      'Take A Break',
      'Makers Cafe',
      "D'Nisi",
      'Bees On The Primrose',
      'The Ladybird Tea Room',
      'Jaadoo Indian Restaurant',
    ]);
    expect(food.slice(0, 8).map((place) => place.visitorScore)).toEqual([83, 81, 80, 78, 76, 74, 74, 73]);
    expect(food).toHaveLength(11);
    expect(food.filter((place) => place.dogFriendly).map((place) => place.name)).toEqual([
      'Take A Break',
      "D'Nisi",
    ]);

    const parking = visitorNeedPlaces(alloaPackage, 'parking', 20, {
      curatedFeatureIds: curation.parking,
    });
    expect(parking.map((place) => place.name)).toEqual([
      'King Street Car Park',
      'Alloa Railway Station Car Park',
      'Candleriggs Car Park',
      'Mill Road Car Park',
      'East Vennel Car Park',
      'Greenside Street Car Park',
      'Marshill Car Park',
      "St Mungo's Wynd Car Park",
    ]);
    expect(
      parking.every(
        (place) =>
          parkingPriceStatus(alloaPackage.features.find((feature) => feature.id === place.id)!) ===
          'free',
      ),
    ).toBe(true);

    expect(
      visitorNeedPlaces(alloaPackage, 'toilets', 20, {
        curatedFeatureIds: curation.toilets,
      }).map((place) => place.name),
    ).toEqual([
      'Speirs Centre public toilets',
      'Alloa Hub public toilet',
      'Grange Road public toilets',
    ]);
    expect(
      visitorNeedPlaces(alloaPackage, 'picnic', 20, {
        curatedFeatureIds: curation.picnic,
      }).map((place) => place.name),
    ).toEqual(['Greenfield Park lawns']);
    expect(
      visitorNeedPlaces(alloaPackage, 'trails', 20, {
        curatedFeatureIds: curation.trails,
      }),
    ).toEqual([
      expect.objectContaining({
        name: 'Alloa Town and Landmarks Treasure Trail',
        visitorScore: 86,
        externalUrl:
          'https://www.treasuretrails.co.uk/products/things-to-do-alloa-stirling-falkirk',
      }),
      expect.objectContaining({
        name: 'Alloa town-centre public art walk',
        visitorScore: 74,
        externalUrl: 'https://www.clacks.gov.uk/document/3588.pdf',
      }),
    ]);
  });

  it('keeps every public Alloa recommendation inside the locality and study boundaries', () => {
    const localityBoundary = alloaPackage.project.townStudyArea?.localityBoundary;
    expect(localityBoundary).toBeDefined();
    const curation = publishedPlannerCuration['alloa-scotland'] ?? {};
    const featureIds = new Set([
      ...(alloaPackage.project.visitorHighlights ?? []).map((highlight) => highlight.featureId),
      ...Object.values(curation).flat(),
    ]);

    for (const featureId of featureIds) {
      const feature = alloaPackage.features.find((candidate) => candidate.id === featureId);
      expect(feature?.geometry?.type, featureId).toBe('Point');
      if (feature?.geometry?.type !== 'Point' || !localityBoundary) continue;
      const location = point(feature.geometry.coordinates);
      expect(booleanPointInPolygon(location, localityBoundary), featureId).toBe(true);
      expect(booleanPointInPolygon(location, alloaPackage.project.boundary), featureId).toBe(true);
    }
  });
});
