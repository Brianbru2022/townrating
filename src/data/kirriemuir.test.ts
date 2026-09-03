import { describe, expect, it } from 'vitest';
import { booleanPointInPolygon, point } from '@turf/turf';
import type { Point } from 'geojson';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { touristAppealLabel } from '../domain/tourism';
import { foodRecommendation, topVisitPlaces, visitRecommendation } from '../domain/visiting';
import { visitorFacts, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCurationForProject } from './visitorPlannerCuration';
import { kirriemuirPackage } from './kirriemuir';

describe('Kirriemuir published package', () => {
  it('publishes the NRS locality-backed Kirriemuir package with reviewed non-map evidence', () => {
    expect(kirriemuirPackage.project.id).toBe('kirriemuir-scotland');
    expect(kirriemuirPackage.project.region).toBe('Angus');
    expect(kirriemuirPackage.project.boundary.geometry.type).toBe('MultiPolygon');
    expect(kirriemuirPackage.project.boundary.properties).toMatchObject({
      sourceDataset: 'Curated Kirriemuir visitor study boundary',
      localityName: 'Kirriemuir',
      localityCode: 'S52000379',
      originalSourceDataset: 'NRS 2022 Census Locality Boundaries',
    });
    expect(kirriemuirPackage.project.townStudyArea?.localityBoundary.properties?.name).toBe(
      'Kirriemuir',
    );
    expect(kirriemuirPackage.project.townStudyArea?.localityCode).toBe('S52000379');
    expect(touristAppealLabel(kirriemuirPackage.project)).toBe('Kirriemuir ★');
    expect(kirriemuirPackage.project.touristAppeal?.summary).not.toMatch(/parking|toilets/i);
    expect(kirriemuirPackage.project.touristAppeal?.summary).toContain(
      "J M Barrie's Birthplace",
    );
    expect(kirriemuirPackage.project.townGuide).toMatchObject({
      headline: 'Storybook streets, rock history and a hilltop view of Angus',
      suggestedTime: 'Half day',
      perfectFor: [
        'A half-day story walk',
        'Families mixing museums and play',
        'Visitors who like small towns with character',
      ],
      suggestedFirstVisit: {
        title: 'Birthplace, statues and Kirrie Hill',
      },
      lastReviewedAt: '2026-08-02',
    });
    expect(kirriemuirPackage.project.townGuide?.intro).not.toMatch(/parking|toilets|evidence/i);
    expect(kirriemuirPackage.project.townGuide?.dontMiss).toContain(
      'Kirriemuir Camera Obscura',
    );
    expect(kirriemuirPackage.project.visualIdentity).toMatchObject({
      theme: 'storybook',
      badgeImage: '/town-guides/kirriemuir-town-centre-guide.jpg',
      badgeAlt:
        'Editorial illustration of Kirriemuir town centre with the Peter Pan statue and red sandstone clock building',
      heroImage: '/town-guides/kirriemuir-town-centre-guide.jpg',
      heroAlt:
        'Editorial illustration of Kirriemuir town centre with the Peter Pan statue and red sandstone clock building',
      heroObjectPosition: '50% 50%',
      primaryColour: '#153A3F',
      accentColour: '#C98722',
      backgroundColour: '#F8EBCF',
    });
    expect(kirriemuirPackage.project.visitorHighlights?.map((highlight) => highlight.name)).toEqual(
      [
        "J M Barrie's Birthplace",
        'Kirriemuir Camera Obscura',
        'Tayside Police Museum',
        'Bon Scott Statue',
        'Kirriemuir Den',
        'Kirrie Hill viewpoint and public park',
        'Peter Pan Statue',
        "Kirriemuir Cemetery, Barrie's grave and war memorial",
        'Neverland Park',
      ],
    );
    expect(
      kirriemuirPackage.project.visitorHighlights?.map((highlight) => highlight.visitorScore),
    ).toEqual([68, 66, 58, 51, 48, 47, 45, 44, 43]);
    expect(
      kirriemuirPackage.project.visitorHighlights?.every((highlight) =>
        kirriemuirPackage.features.some(
          (feature) => feature.id === highlight.featureId && feature.geometry?.type === 'Point',
        ),
      ),
    ).toBe(true);
    const kirriemuirAttractions = topVisitPlaces(kirriemuirPackage, 9);
    expect(kirriemuirAttractions.map((place) => place.name)).toEqual([
      "J M Barrie's Birthplace",
      'Kirriemuir Camera Obscura',
      'Tayside Police Museum',
      'Bon Scott Statue',
      'Kirriemuir Den',
      'Kirrie Hill viewpoint and public park',
      'Peter Pan Statue',
      "Kirriemuir Cemetery, Barrie's grave and war memorial",
      'Neverland Park',
    ]);
    expect(kirriemuirAttractions.map((place) => place.visitorScore)).toEqual([
      68, 66, 58, 51, 48, 47, 45, 44, 43,
    ]);
    expect(kirriemuirAttractions.map((place) => place.tagline)).toEqual([
      'Peter Pan origin',
      'Hilltop view',
      'Small museum',
      'Rock landmark',
      'Family pause',
      'Angus outlook',
      'Town-centre photo',
      'Quiet Barrie thread',
      'Family play stop',
    ]);
    expect(kirriemuirAttractions.map((place) => visitRecommendation(place.visitorScore)?.label))
      .toEqual([
        'Worth a look',
        'Worth a look',
        'Worth a look',
        'Worth a look',
        'Worth a look',
        'Worth a look',
        'Worth a look',
        'Point of interest',
        'Point of interest',
      ]);
    expect(
      kirriemuirAttractions.map((place) => {
        const feature = kirriemuirPackage.features.find((item) => item.id === place.id);
        return visitorFacts(feature!).find((fact) => fact.label === 'Time to spend')?.value;
      }),
    ).toEqual([
      '45-60 minutes',
      '30-45 minutes',
      '20-30 minutes',
      '5-10 minutes',
      '20-40 minutes',
      '20-30 minutes',
      '5-10 minutes',
      '10-20 minutes',
      '20-45 minutes',
    ]);
    expect(kirriemuirAttractions[0]).toMatchObject({
      openingTimes:
        '26 March-25 October: Thursday-Sunday, 10:30am-4:30pm; last entry 4pm. Closed 26 October-28 February 2027.',
      admission:
        'Adult £10; concession £9; family £24; one-adult family £18.50; Young Scot £1; NTS members free.',
      organisationPills: ['NTS'],
    });
    expect(kirriemuirAttractions.slice(1).every((place) => place.freeAdmission)).toBe(true);
    expect(kirriemuirAttractions[1]).toMatchObject({
      admission: 'Free; donations appreciated.',
      openingTimes:
        'During the 2026 season: Saturday, Sunday and Monday, 11:30am-4:30pm; last camera viewing 4:15pm. The view is weather and daylight dependent.',
    });

    const activeBoundary = kirriemuirPackage.project.boundary;
    const originalNrsBoundary = kirriemuirPackage.project.townStudyArea?.localityBoundary;
    expect(originalNrsBoundary).toBeDefined();
    for (const featureId of [
      'osm-community:node-5893732662',
      'osm-community:way-164703492',
      'hes-listed-building:LB36904',
      'hes-listed-building:LB36903',
    ]) {
      const feature = kirriemuirPackage.features.find((item) => item.id === featureId);
      expect(feature?.geometry?.type).toBe('Point');
      const featurePoint = point((feature?.geometry as Point).coordinates);
      expect(booleanPointInPolygon(featurePoint, activeBoundary)).toBe(true);
      expect(booleanPointInPolygon(featurePoint, originalNrsBoundary!)).toBe(false);
    }
    expect(kirriemuirPackage.features).toHaveLength(331);
    expect(kirriemuirPackage.validation).toHaveLength(0);

    const listedBuildings = kirriemuirPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(106);
    expect(listedBuildings.filter(hasEstablishedDate)).toHaveLength(97);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(96);

    expect(
      kirriemuirPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(66);

    expect(
      kirriemuirPackage.features.filter(
        (feature) =>
          feature.id.startsWith('hes-') &&
          !feature.tags.includes('hes-listed-building') &&
          hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(2);

    const currentPlaces = kirriemuirPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(98);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = kirriemuirPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(9);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      kirriemuirPackage.features.filter((feature) =>
        feature.tags.includes('kirriemuir-service-reviewed'),
      ),
    ).toHaveLength(110);
    expect(
      kirriemuirPackage.features.filter((feature) =>
        feature.tags.includes('kirriemuir-visitor-context-curated'),
      ),
    ).toHaveLength(2);
    expect(
      kirriemuirPackage.features.filter((feature) => feature.tags.includes('service-context-food')),
    ).toHaveLength(15);
    expect(
      kirriemuirPackage.features.filter((feature) =>
        feature.tags.includes('service-context-toilets'),
      ),
    ).toHaveLength(3);
    expect(
      kirriemuirPackage.features.filter((feature) =>
        feature.tags.includes('service-context-parking'),
      ),
    ).toHaveLength(15);
    const parkingCuration = publishedPlannerCurationForProject('kirriemuir-scotland');
    const curatedTrails = visitorNeedPlaces(kirriemuirPackage, 'trails', 10, {
      curatedFeatureIds: parkingCuration.trails ?? [],
    });
    expect(curatedTrails).toEqual([
      expect.objectContaining({
        name: 'Kirriemuir Explorer',
        visitorScore: 86,
        externalUrl: 'https://www.walkhighlands.co.uk/angus/kirriemuir.shtml',
        freeAdmission: true,
      }),
      expect.objectContaining({
        name: 'Kirriemuir Path Network',
        visitorScore: 78,
        externalUrl: 'https://www.angus.gov.uk/media/kirriemuir_path_network',
        freeAdmission: true,
      }),
    ]);
    const kirriemuirExplorer = kirriemuirPackage.features.find(
      (feature) => feature.id === 'curated-trail:kirriemuir-explorer',
    );
    expect(kirriemuirExplorer).toBeDefined();
    expect(visitorFacts(kirriemuirExplorer!)).toEqual(
      expect.arrayContaining([
        { label: 'Trail type', value: 'Self-guided town and heritage walk' },
        { label: 'Distance', value: '4.75 km / 3 miles' },
        { label: 'Time to spend', value: 'about 1.5 hours' },
        { label: 'Price', value: 'Free.' },
      ]),
    );
    const curatedEat = visitorNeedPlaces(kirriemuirPackage, 'eat', 20, {
      curatedFeatureIds: parkingCuration.eat ?? [],
    });
    expect(curatedEat.slice(0, 8).map((place) => place.name)).toEqual([
      '88 Degrees Coffee House',
      'The Garden Cafe at Pathhead Farm',
      'Airlie Arms Hotel & Restaurant',
      'Three Bellies Brae',
      'Saucy Asian Lunch Club',
      "Lee's Takeaway & Coffee Shop",
      'Cafe Obscura',
      'A Longer Table Community Coffee Room',
    ]);
    expect(curatedEat.slice(0, 8).map((place) => place.visitorScore)).toEqual([
      81, 79, 72, 69, 65, 61, 58, 47,
    ]);
    expect(curatedEat.slice(0, 8).map((place) => foodRecommendation(place.visitorScore)?.label)).toEqual([
      'Top food stop',
      'Great choice',
      'Great choice',
      'Good local option',
      'Good local option',
      'Good local option',
      'Useful food stop',
      'Useful food stop',
    ]);
    expect(curatedEat.slice(0, 8).map((place) => place.priceBand)).toEqual([
      '££',
      '££',
      '££',
      '££',
      '££',
      '£',
      '£',
      '£',
    ]);
    expect(curatedEat.slice(0, 8).map((place) => place.tagline)).toEqual([
      'Best coffee & cake',
      'Best all-round',
      'Full-menu choice',
      'Pub lunch',
      'Asian street food',
      'Budget breakfast',
      'Hilltop cafe',
      'Community coffee',
    ]);
    expect(curatedEat).toHaveLength(8);
    expect(curatedEat.map((place) => place.name)).not.toContain(
      'Kirriemuir Golf Club Clubhouse',
    );
    expect(curatedEat[0]).toMatchObject({
      openingTimes:
        'Wednesday-Saturday 10am-4pm. Sunday 10am-3pm. Monday-Tuesday closed.',
      tagline: 'Best coffee & cake',
      dogFriendly: true,
      reason: expect.stringContaining('Custom-roasted coffee'),
    });
    expect(curatedEat[1]).toMatchObject({
      openingTimes:
        'Daily 9am-4pm. Main menu 10am-3pm. Tea, coffee and traybakes all day.',
      tagline: 'Best all-round',
      dogFriendly: true,
      reason: expect.stringContaining('proper farm cafe'),
    });
    expect(
      curatedEat
        .filter((place) => place.dogFriendly)
        .map((place) => place.name),
    ).toEqual([
      '88 Degrees Coffee House',
      'The Garden Cafe at Pathhead Farm',
      'Airlie Arms Hotel & Restaurant',
      'Cafe Obscura',
      'A Longer Table Community Coffee Room',
    ]);
    expect(curatedEat[1].reason).not.toContain('Best all-round option');
    const gardenCafe = kirriemuirPackage.features.find(
      (feature) => feature.id === 'osm-community:node-13128975000',
    );
    expect(gardenCafe).toBeDefined();
    expect(visitorFacts(gardenCafe!)).toEqual(
      expect.arrayContaining([
        {
          label: 'Opening times',
          value: 'Daily 9am-4pm. Main menu 10am-3pm. Tea, coffee and traybakes all day.',
        },
        { label: 'Price guide', value: '££' },
      ]),
    );
    const curatedParking = visitorNeedPlaces(kirriemuirPackage, 'parking', 10, {
      curatedFeatureIds: parkingCuration.parking ?? [],
    });
    expect(curatedParking.map((place) => place.name)).toEqual([
      'Reform Street Car Park',
      'Bellies Brae Car Park',
      'Glengate Car Park',
      'Hill / Barrie Pavilion Car Park',
    ]);
    expect(visitorNeedPlaces(kirriemuirPackage, 'parking', 10).map((place) => place.name)).toEqual([
      'Bellies Brae Car Park',
      'Glengate Car Park',
      'Hill / Barrie Pavilion Car Park',
      'Reform Street Car Park',
    ]);
    const staleLocalParking = visitorNeedPlaces(kirriemuirPackage, 'parking', 10, {
      curatedFeatureIds: [
        'osm-community:way-348872934',
        'osm-community:way-697332621',
        'osm-community:way-854920533',
      ],
    });
    expect(staleLocalParking.map((place) => place.name)).toEqual([
      'Reform Street Car Park',
      'Hill / Barrie Pavilion Car Park',
    ]);
    const reformStreet = kirriemuirPackage.features.find(
      (feature) => feature.id === 'osm-community:way-348872934',
    );
    expect(reformStreet).toBeDefined();
    expect(visitorFacts(reformStreet!)).toEqual(
      expect.arrayContaining([
        { label: 'Access', value: 'Public' },
        { label: 'Parking type', value: 'Open surface car park' },
        { label: 'Spaces', value: '63' },
        { label: 'Accessible spaces', value: '3' },
        { label: 'Pricing', value: 'Free' },
        { label: 'Max stay', value: '4 hours' },
        { label: 'Payment', value: 'No payment required' },
      ]),
    );
    expect(
      visitorNeedPlaces(kirriemuirPackage, 'toilets', 10, {
        curatedFeatureIds: parkingCuration.toilets ?? [],
      }).map((place) => place.name),
    ).toEqual([
      'Kirrie Hill Public Toilets',
      'Reform Street Public Toilets',
      'Kirriemuir Den Public Toilets',
    ]);
    expect(
      visitorNeedPlaces(kirriemuirPackage, 'picnic', 10, {
        curatedFeatureIds: parkingCuration.picnic ?? [],
      }).map((place) => place.name),
    ).toEqual([
      'Kirrie Hill Picnic Area',
      'Kirrie Hill Picnic Tables',
      'Barrie Garden rest bench',
      'Rosefield Community Garden rest bench',
      'The Den rest bench',
    ]);
    expect(visitorNeedPlaces(kirriemuirPackage, 'picnic', 10).map((place) => place.name)).toEqual([
      'Kirrie Hill Picnic Area',
      'Kirrie Hill Picnic Tables',
    ]);
    const belliesBrae = kirriemuirPackage.features.find(
      (feature) => feature.id === 'osm-community:way-548034700',
    );
    expect(belliesBrae).toBeDefined();
    expect(visitorFacts(belliesBrae!)).toEqual(
      expect.arrayContaining([
        { label: 'Spaces', value: '63' },
        { label: 'Accessible spaces', value: '3' },
        { label: 'EV charging spaces', value: '2' },
        { label: 'Max stay', value: '72 hours' },
      ]),
    );
    expect(
      kirriemuirPackage.features.filter((feature) =>
        feature.tags.includes('service-context-heritage'),
      ),
    ).toHaveLength(15);
    expect(
      kirriemuirPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(52);
  });
});
