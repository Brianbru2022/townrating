import { describe, expect, it } from 'vitest';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { touristAppealLabel } from '../domain/tourism';
import { topVisitPlaces, visitRecommendation } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { gourockPackage } from './gourock';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';

describe('Gourock published package', () => {
  it('publishes the NRS locality-backed Gourock package with imported date evidence', () => {
    expect(gourockPackage.project.id).toBe('gourock-scotland');
    expect(gourockPackage.project.region).toBe('Inverclyde');
    expect(gourockPackage.features).toHaveLength(303);
    expect(gourockPackage.validation).toHaveLength(0);

    const listedBuildings = gourockPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(65);
    expect(listedBuildings.every(hasEstablishedDate)).toBe(true);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(63);

    expect(
      gourockPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(100);

    const currentPlaces = gourockPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(88);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    expect(
      gourockPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(28);
  });

  it('uses the visitor data pack for Gourock guide, attractions, food and parking', () => {
    expect(touristAppealLabel(gourockPackage.project)).toBe('Gourock ★');
    expect(gourockPackage.project.touristAppeal?.summary).toContain(
      'heated outdoor saltwater pool',
    );
    expect(gourockPackage.project.touristAppeal?.summary).not.toMatch(/parking|toilets/i);
    expect(gourockPackage.project.townGuide).toMatchObject({
      headline: 'Clyde views, outdoor swimming and a compact ferry-town wander',
      suggestedTime: 'Two to four hours, or half to full day with the pool or golf',
      perfectFor: ['Outdoor-pool days', 'Clyde-view cafe stops', 'Ferry-linked wanders'],
      suggestedFirstVisit: {
        title: 'Pool, waterfront and Kempock Street',
      },
      lastReviewedAt: '2026-08-04',
    });
    expect(gourockPackage.project.townGuide?.intro).not.toMatch(/parking|toilets|evidence/i);
    expect(gourockPackage.project.visualIdentity).toMatchObject({
      theme: 'coastal-ferry',
      badgeImage: '/town-guides/gourock-clyde-anchor-watercolour-guide.png',
      heroImage: '/town-guides/gourock-clyde-anchor-watercolour-guide.png',
      heroAlt: 'Watercolour-style illustrated view over Gourock, the Clyde and the Anchor and Cross viewpoint',
      primaryColour: '#123F46',
      accentColour: '#C98722',
      backgroundColour: '#EAF5F1',
    });

    const attractions = topVisitPlaces(gourockPackage, 10);
    expect(attractions.map((place) => place.name)).toEqual([
      'Gourock Outdoor Pool',
      'Gourock waterfront and Cove Road Esplanade',
      'Gourock Golf Club visitor round',
      'Granny Kempock Stone',
      'Tower Hill and the 1847 tower',
      'Gourock Park',
      'PictureHoose',
    ]);
    expect(attractions.map((place) => place.visitorScore)).toEqual([84, 67, 64, 59, 56, 52, 47]);
    expect(attractions.map((place) => visitRecommendation(place.visitorScore)?.label)).toEqual([
      'Recommended',
      'Worth a look',
      'Worth a look',
      'Worth a look',
      'Worth a look',
      'Worth a look',
      'Worth a look',
    ]);
    expect(attractions.map((place) => place.tagline)).toEqual([
      'Saltwater pool',
      'Clyde views',
      'Golf with views',
      'Folklore landmark',
      'Hilltop view',
      'Family park',
      'Rainy-day cinema',
    ]);
    expect(attractions.map((place) => place.freeAdmission)).toEqual([
      false,
      true,
      false,
      true,
      true,
      true,
      false,
    ]);

    const curation = publishedPlannerCurationForProject('gourock-scotland');
    const food = visitorNeedPlaces(gourockPackage, 'eat', 20, {
      curatedFeatureIds: curation.eat,
    });
    expect(food.slice(0, 10).map((place) => place.name)).toEqual([
      '1830 Eatery',
      'Wildfire Café',
      'The Cove',
      'Riviera',
      'Good Brew / The River',
      'Café Continental',
      'Wildfire Deli',
      'Bluebird Café',
      'Aulds',
      'The Spinnaker Hotel restaurant',
    ]);
    expect(food.slice(0, 10).map((place) => place.visitorScore)).toEqual([80, 78, 76, 74, 73, 72, 69, 67, 64, 63]);
    expect(food.slice(0, 10).map((place) => place.tagline)).toEqual([
      'Best breakfast',
      'Italian-style lunch',
      'Waterfront cafe',
      'Central cafe',
      'Best coffee',
      'Long-hours choice',
      'Takeaway picnic',
      'Family value',
      'Bakery stop',
      'Scenic lunch',
    ]);
    expect(food.slice(0, 10).map((place) => place.priceBand)).toEqual([
      '££',
      '££',
      '££',
      '££',
      '££',
      '££',
      '£',
      '£',
      '£',
      '£££',
    ]);
    expect(food).toHaveLength(10);
    expect(food.filter((place) => place.dogFriendly).map((place) => place.name)).toEqual([
      'Café Continental',
    ]);

    const parking = visitorNeedPlaces(gourockPackage, 'parking', 10, {
      curatedFeatureIds: curation.parking,
    });
    expect(parking.map((place) => place.name)).toEqual([
      'Kempock Street car park',
      'Station Road North car park',
      'Station Road South car park',
      'Cove Road car park',
      'Manor Crescent car park',
    ]);
    expect(parking.map((place) => place.name)).not.toContain(
      'Gourock Golf Club customer parking',
    );
    expect(
      visitorNeedPlaces(gourockPackage, 'toilets', 10, {
        curatedFeatureIds: curation.toilets,
      }).map((place) => place.name),
    ).toEqual(['Shore Street Public Toilets', 'Albert Road Toilets']);
    expect(
      visitorNeedPlaces(gourockPackage, 'picnic', 10, {
        curatedFeatureIds: curation.picnic,
      }),
    ).toEqual([]);
    expect(
      visitorNeedPlaces(gourockPackage, 'trails', 10, {
        curatedFeatureIds: curation.trails,
      }).map((place) => ({
        name: place.name,
        visitorScore: place.visitorScore,
        externalUrl: place.externalUrl,
      })),
    ).toEqual([
      {
        name: 'Gourock Circuit',
        visitorScore: 82,
        externalUrl: 'https://firthofclydewalks.weebly.com/11---gourock-circuit.html',
      },
    ]);

    const kempockCarPark = gourockPackage.features.find(
      (feature) => feature.id === 'curated-parking:gourock-kempock-street-car-park',
    );
    expect(kempockCarPark).toBeDefined();
    expect(visitorFacts(kempockCarPark!)).toEqual(
      expect.arrayContaining([
        { label: 'Parking type', value: 'Open surface car park' },
        { label: 'Access', value: 'Public' },
        { label: 'Spaces', value: '165' },
        { label: 'Accessible spaces', value: '4' },
        { label: 'EV charging spaces', value: '2' },
        {
          label: 'Pricing',
          value: '0-3 hours free, over 3 hours £2 per day. One free stay per town per day.',
        },
      ]),
    );

    expect(
      gourockPackage.features.filter((feature) =>
        feature.tags.includes('gourock-visitor-context-curated'),
      ),
    ).toHaveLength(23);
    expect(
      gourockPackage.features.filter((feature) => feature.tags.includes('service-context-food')),
    ).toHaveLength(10);
    expect(
      gourockPackage.features.filter((feature) =>
        feature.tags.includes('service-context-parking'),
      ),
    ).toHaveLength(5);
    expect(
      gourockPackage.features.filter((feature) =>
        feature.tags.includes('service-context-toilets'),
      ),
    ).toHaveLength(2);
  });
});
