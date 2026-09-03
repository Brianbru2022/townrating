import { describe, expect, it } from 'vitest';
import { publishedDogAccessForPlace } from './dogAccessCuration';
import { stonehavenCoastPackages } from './stonehavenCoast';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { townScoreBand } from '../domain/tourism';
import { parkingPriceStatus, topFoodAndDrink } from '../domain/visitorExperience';
import { topVisitPlaces } from '../domain/visiting';
import { homePoiOverviews, homeTownOverviews } from '../map/homeOverview';

describe('Stonehaven coast and Mearns settlement publication gate', () => {
  it('keeps all reviewed localities selectable but maps only 60+ towns', () => {
    expect(stonehavenCoastPackages).toHaveLength(30);
    expect(homeTownOverviews(stonehavenCoastPackages).map((town) => town.name)).toEqual([
      'Stonehaven',
      'Catterline',
      'Gourdon',
      'Inverbervie',
    ]);
    expect(stonehavenCoastPackages.map((pkg) => pkg.project.name)).toEqual(
      expect.arrayContaining([
        'Rickarton', 'Cowie', 'Fiddes', 'Carmont', 'Tewel', 'Mergie', 'Tannachie',
        'Newmill', 'Mains of Dellavaird', 'Glenbervie', 'Drumlithie', 'Glenfarquhar Lodge',
      ]),
    );
    expect(stonehavenCoastPackages.map((pkg) => pkg.project.name)).toEqual(
      expect.arrayContaining([
        'Pitforthie', 'Roadside of Catterline', 'Kinneff', 'Mains of Allardice',
        'Inverbervie', 'Gourdon',
      ]),
    );
    expect(stonehavenCoastPackages.filter((pkg) => pkg.project.id === 'catterline-scotland')).toHaveLength(1);
    expect(stonehavenCoastPackages.filter((pkg) => pkg.project.id === 'roadside-of-kinneff-scotland')).toHaveLength(1);
  });

  it('maps independently qualifying coastal Mearns settlements after evidence-led scoring', () => {
    const ids = [
      'pitforthie-fordoun-scotland', 'roadside-of-catterline-scotland', 'kinneff-scotland',
      'mains-of-allardice-scotland', 'inverbervie-scotland', 'gourdon-aberdeenshire-scotland',
    ];
    const additions = stonehavenCoastPackages.filter((pkg) => ids.includes(pkg.project.id));
    expect(additions).toHaveLength(6);
    expect(additions.every((pkg) => pkg.project.region === 'Aberdeenshire')).toBe(true);
    expect(homeTownOverviews(additions).map((town) => town.name)).toEqual(['Gourdon', 'Inverbervie']);
    expect(additions.filter((pkg) => !['gourdon-aberdeenshire-scotland', 'inverbervie-scotland'].includes(pkg.project.id)).every((pkg) => (pkg.project.touristAppeal?.score ?? 0) < 60)).toBe(true);
  });

  it('keeps every dog-owner score separate and no higher than the town score', () => {
    for (const pkg of stonehavenCoastPackages) {
      const town = pkg.project.touristAppeal!;
      expect(town.dogOwnerScore!).toBeLessThanOrEqual(town.score!);
      expect(town.dogAccessScoreAdjustment).toBeLessThanOrEqual(0);
      expect(town.dogAccessScoreAdjustment).toBeGreaterThanOrEqual(-3);
      expect(townScoreBand(town.score!).label).toBe(town.label);
    }
  });

  it('publishes Dunnottar Castle only as a standalone See attraction', () => {
    const stonehaven = stonehavenCoastPackages.find(
      (pkg) => pkg.project.id === 'stonehaven-scotland',
    )!;
    expect(stonehavenCoastPackages.some((pkg) => pkg.project.id === 'dunnottar-scotland')).toBe(
      true,
    );
    expect(
      stonehaven.project.visitorHighlights?.some((item) => /Dunnottar Castle/i.test(item.name)),
    ).toBe(false);
    expect(topVisitPlaces(stonehaven, 20).some((item) => item.name === 'Dunnottar Castle')).toBe(
      false,
    );
    expect(
      homePoiOverviews(stonehavenCoastPackages, 'attraction', 100).find(
        (place) => place.featureId === 'curated-attraction:dunnottar-castle',
      ),
    ).toMatchObject({
      name: 'Dunnottar Castle',
      discoveryScope: 'standalone',
      visitorScore: 84,
    });
  });

  it('publishes the researched Stonehaven attraction, food and practical contract', () => {
    const pkg = stonehavenCoastPackages.find((item) => item.project.id === 'stonehaven-scotland')!;
    expect(topVisitPlaces(pkg, 20).map((item) => item.name)).toEqual([
      'Stonehaven Open Air Pool',
      'Stonehaven Harbour and Auld Toon',
      'Stonehaven Fireballs Ceremony',
      'Stonehaven Beach and Promenade',
      'Black Hill War Memorial and Viewpoint',
      'Stonehaven Paddleboarding',
      'Stonehaven Tolbooth Museum',
      'The Quay Gallery',
    ]);
    const food = topFoodAndDrink(pkg, 50);
    expect(food).toHaveLength(11);
    expect(food.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "Molly's Café Bar",
        'Cool Gourmet',
        'Old Pier Coffee House',
        'The Villa Coffee Shop',
        "Aunty Betty's",
        'Pinky Promise Café',
        'Café Noir Coffee House',
        'Graingers Delicatessen',
        'Waterfront Café',
        "Drifter's Café",
        'Red Red Robin',
      ]),
    );
    expect(food.every((item) => (item.visitorScore ?? 0) >= 60)).toBe(true);
    const curation = publishedPlannerCurationForProject(pkg.project.id);
    expect(curation.eat).toHaveLength(11);
    expect(curation.parking).toHaveLength(4);
    expect(curation.picnic).toEqual([
      'curated-picnic:stonehaven-beach-road-tables',
      'curated-picnic:stonehaven-bay-walk-tables',
    ]);
    expect(curation.toilets).toHaveLength(3);
    expect(curation.trails).toEqual([
      'curated-trails:stonehaven-dunnottar-castle-coastal-trail',
      'curated-trails:stonehaven-parks-harbour-treasure-trail',
      'curated-trails:stonehaven-boardwalk-cowie-geology-walk',
      'curated-trails:stonehaven-market-square-harbour-loop',
      'curated-trails:stonehaven-mineralwell-park-cowie-water-loop',
    ]);
    const marketParking = pkg.features.find(
      (feature) => feature.id === 'curated-parking:stonehaven-market-square',
    )!;
    expect(marketParking.shortDescription).toContain('£0.70/1 hour');
    expect(marketParking.shortDescription).toContain('code 985573');
    expect(parkingPriceStatus(marketParking)).toBe('paid');
    expect(
      parkingPriceStatus(
        pkg.features.find(
          (feature) => feature.id === 'curated-parking:stonehaven-beach-promenade',
        )!,
      ),
    ).toBe('free');
    expect(
      pkg.features.find(
        (feature) => feature.id === 'curated-parking:stonehaven-beach-promenade',
      )?.shortDescription,
    ).toContain('optional cashless contributions');
    expect(pkg.project.visualIdentity).toMatchObject({
      theme: 'stonehaven-sheltered-harbour-and-waterfront',
      heroImage: '/town-guides/stonehaven-harbour-watercolour-guide-v1.png',
    });
    expect(
      publishedDogAccessForPlace(
        pkg.project.id,
        'eat',
        'curated-eat:stonehaven-cool-gourmet',
      ),
    ).toMatchObject({ rating: 3, status: 'welcoming' });
    expect(
      publishedDogAccessForPlace(
        pkg.project.id,
        'eat',
        'curated-eat:stonehaven-graingers-delicatessen',
      ),
    ).toMatchObject({ rating: 0, status: 'unconfirmed', label: 'Dog policy not published' });
    expect(curation.eat).not.toContain('curated-eat:stonehaven-tolbooth-seafood-restaurant');
    expect(curation.eat).not.toContain('curated-eat:stonehaven-the-view-golf-club');
  });

  it('publishes Catterline and Crawton without overlap or invented facilities', () => {
    const catterline = stonehavenCoastPackages.find(
      (item) => item.project.id === 'catterline-scotland',
    )!;
    const crawton = stonehavenCoastPackages.find((item) => item.project.id === 'crawton-scotland')!;
    expect(topVisitPlaces(catterline, 10).map((item) => item.name)).toEqual([
      'Catterline Harbour and Joan Eardley Landscape',
    ]);
    expect(topFoodAndDrink(catterline, 10).map((item) => item.name)).toEqual([
      'The Creel Inn & Grill',
    ]);
    expect(topVisitPlaces(crawton, 10).map((item) => item.name)).toEqual([]);
    expect(
      homePoiOverviews(stonehavenCoastPackages, 'attraction', 100).find(
        (place) => place.name === 'RSPB Fowlsheugh Nature Reserve',
      ),
    ).toMatchObject({
      discoveryScope: 'standalone',
      visitorScore: 84,
    });
    expect(publishedPlannerCurationForProject(catterline.project.id).toilets).toEqual([]);
    expect(publishedPlannerCurationForProject(catterline.project.id).trails).toEqual([
      'curated-trails:catterline-coastal-village-walk',
    ]);
    expect(catterline.project.touristAppeal).toMatchObject({
      score: 68,
      dogOwnerScore: 67,
      dogAccessScoreAdjustment: -1,
      dogAccessRating: 2,
    });
    expect(catterline.project.visualIdentity).toMatchObject({
      theme: 'catterline-crescent-bay-and-pier',
      badgeImage: '/town-guides/catterline-bay-watercolour-guide-v1.png',
      heroImage: '/town-guides/catterline-bay-watercolour-guide-v1.png',
    });
    const catterlineHeritage = catterline.features.filter((feature) =>
      feature.sourceRecords.some((record) =>
        record.sourceUrl?.includes('historicenvironment.scot'),
      ),
    );
    expect(catterlineHeritage).toHaveLength(4);
    expect(catterlineHeritage[0]).toMatchObject({
      documentedDateText: expect.stringContaining('early 19th century'),
      earliestPossibleYear: 1800,
    });
    expect(
      publishedDogAccessForPlace(
        catterline.project.id,
        'eat',
        'curated-eat:catterline-creel-inn',
      ),
    ).toMatchObject({
      rating: 3,
      sourceName: 'The Creel Inn & Grill',
      sourceUrl: 'https://www.creelinn.co.uk/',
    });
    expect(publishedPlannerCurationForProject(crawton.project.id).toilets).toEqual([]);
    expect(publishedPlannerCurationForProject(crawton.project.id).parking).toEqual([
      'curated-parking:crawton-car-park',
    ]);
  });

  it('stores current, source-backed dog policies for every published highlight', () => {
    for (const pkg of stonehavenCoastPackages) {
      for (const place of pkg.project.visitorHighlights ?? []) {
        const policy = publishedDogAccessForPlace(pkg.project.id, 'attraction', place.featureId);
        expect(policy?.reviewedAt).toBe('2026-08-27');
        expect(policy?.sourceUrl).toMatch(/^https:/);
      }
    }
  });

  it('dates every visible heritage-designated pin in this batch', () => {
    const designated = stonehavenCoastPackages
      .flatMap((pkg) => pkg.features)
      .filter(
        (feature) =>
          feature.designationType &&
          feature.evidenceScope !== 'out_of_scope' &&
          !feature.tags.includes('map-hidden'),
      );
    expect(designated.length).toBeGreaterThan(0);
    expect(
      designated.every((feature) => feature.documentedDateText && feature.earliestPossibleYear),
    ).toBe(true);
  });

  it('publishes a complete, source-backed Stonehaven heritage-date register', () => {
    const stonehaven = stonehavenCoastPackages.find(
      (pkg) => pkg.project.id === 'stonehaven-scotland',
    )!;
    const heritagePins = stonehaven.features.filter(
      (feature) =>
        feature.tags.includes('hes-listed-building') &&
        feature.evidenceScope !== 'out_of_scope' &&
        !feature.tags.includes('map-hidden'),
    );
    expect(heritagePins).toHaveLength(157);
    expect(
      heritagePins.every(
        (feature) =>
          Boolean(feature.documentedDateText) &&
          feature.earliestPossibleYear !== undefined &&
          feature.latestPossibleYear !== undefined,
      ),
    ).toBe(true);
    expect(
      stonehaven.features.find(
        (feature) => feature.id === 'curated-attraction:stonehaven-harbour-auld-toon',
      ),
    ).toMatchObject({
      documentedDateText:
        '16th-century origins; Old Pier before 1795; South Pier 1825–26; Fish Jetty 1830s; breakwater 1901–08',
      earliestPossibleYear: 1500,
      latestPossibleYear: 1908,
    });
    expect(
      stonehaven.features.find(
        (feature) => feature.id === 'curated-attraction:stonehaven-black-hill-war-memorial',
      ),
    ).toMatchObject({ documentedDateText: 'Unveiled 20 May 1923' });
  });
});
