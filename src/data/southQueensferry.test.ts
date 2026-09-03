import { describe, expect, it } from 'vitest';
import { hasEstablishedDate, hasHistoricTimelineDate } from '../domain/timeline';
import { touristAppealLabel } from '../domain/tourism';
import { topVisitPlaces } from '../domain/visiting';
import { parkingPriceStatus, visitorNeedPlaces } from '../domain/visitorExperience';
import { publishedPlannerCuration } from './visitorPlannerCuration';
import { southQueensferryPackage } from './southQueensferry';

describe('South Queensferry published package', () => {
  it('publishes the NRS locality-backed South Queensferry package with reviewed non-map evidence', () => {
    expect(southQueensferryPackage.project.id).toBe('south-queensferry-scotland');
    expect(southQueensferryPackage.project.region).toBe('City of Edinburgh');
    expect(southQueensferryPackage.project.name).toBe('South Queensferry');
    expect(southQueensferryPackage.project.boundary.properties?.localityName).toBe(
      'South Queensferry',
    );
    expect(southQueensferryPackage.project.boundary.properties?.localityCode).toBe('S52000569');
    expect(touristAppealLabel(southQueensferryPackage.project)).toBe('South Queensferry ★★');
    expect(southQueensferryPackage.project.touristAppeal?.summary).toContain(
      'Forth Bridge and Hawes waterfront viewpoint',
    );
    expect(southQueensferryPackage.features).toHaveLength(523);
    expect(southQueensferryPackage.validation).toHaveLength(0);

    const listedBuildings = southQueensferryPackage.features.filter((feature) =>
      feature.tags.includes('hes-listed-building'),
    );
    expect(listedBuildings).toHaveLength(128);
    expect(listedBuildings.every(hasEstablishedDate)).toBe(true);
    expect(listedBuildings.filter(hasHistoricTimelineDate)).toHaveLength(116);

    expect(
      southQueensferryPackage.features.filter(
        (feature) => feature.id.startsWith('nrhe:') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(114);

    expect(
      southQueensferryPackage.features.filter(
        (feature) => feature.id.startsWith('hes-') && hasHistoricTimelineDate(feature),
      ),
    ).toHaveLength(121);

    const currentPlaces = southQueensferryPackage.features.filter((feature) =>
      feature.tags.includes('osm-community-place'),
    );
    expect(currentPlaces).toHaveLength(209);
    expect(currentPlaces.every((feature) => feature.reviewed)).toBe(true);

    const currentParks = southQueensferryPackage.features.filter((feature) =>
      feature.tags.includes('osm-current-park'),
    );
    expect(currentParks).toHaveLength(6);
    expect(currentParks.every((feature) => feature.reviewed)).toBe(true);

    expect(
      southQueensferryPackage.features.filter((feature) =>
        feature.tags.includes('south-queensferry-visitor-context-curated'),
      ),
    ).toHaveLength(43);

    expect(
      southQueensferryPackage.features.filter((feature) =>
        feature.tags.includes('south-queensferry-deeper-nrhe-date-reviewed'),
      ),
    ).toHaveLength(2);

    expect(
      southQueensferryPackage.features.filter((feature) =>
        feature.tags.includes('reviewed-no-defensible-date'),
      ),
    ).toHaveLength(52);
  });

  it('uses the premium visitor-guide template with scored in-town recommendations', () => {
    expect(southQueensferryPackage.project.visualIdentity).toMatchObject({
      theme: 'bridge-coastal',
      badgeImage: '/town-guides/south-queensferry-illustrated-street-guide.png',
      heroImage: '/town-guides/south-queensferry-illustrated-street-guide.png',
      heroAlt: expect.stringContaining('cobbled street'),
      primaryColour: '#123F46',
    });
    expect(southQueensferryPackage.project.townGuide).toMatchObject({
      headline: 'Big bridge views, boat trips and a colourful waterfront old town',
      suggestedTime: 'Half day to full day',
      currentAdvisory: {
        title: 'High Street works',
        sourceUrl:
          'https://www.edinburgh.gov.uk/roads-travel-parking/queensferry-town-centre-improvements/6',
      },
    });
    expect(southQueensferryPackage.project.townGuide?.intro).not.toMatch(
      /parking|toilets|evidence/i,
    );

    const attractions = topVisitPlaces(southQueensferryPackage, 10);
    expect(attractions.map((place) => place.name)).toEqual([
      'Forth Bridge and Hawes waterfront viewpoint',
      'Forth cruises from Hawes Pier',
      'Forth Road Bridge pedestrian and cycle crossing',
      'Historic High Street, harbour, Tolbooth and closes',
      'Queensferry Museum',
      'Priory Church of St Mary of Mount Carmel',
      'Port Edgar Marina waterfront',
      'Briggers Memorial and Guardian of the Bridges',
    ]);
    expect(attractions.map((place) => place.visitorScore)).toEqual([
      87, 86, 77, 75, 71, 66, 64, 56,
    ]);
    expect(attractions.every((place) => place.reason?.length)).toBe(true);
    expect(attractions.map((place) => place.freeAdmission)).toEqual([
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('ships curated food and practical planner lists for South Queensferry', () => {
    const curation = publishedPlannerCuration['south-queensferry-scotland'] ?? {};
    const food = visitorNeedPlaces(southQueensferryPackage, 'eat', 20, {
      curatedFeatureIds: curation.eat,
    });
    expect(food.slice(0, 12).map((place) => place.name)).toEqual([
      'Rogue Bros at The Boat House',
      'Dune Bakery',
      'The Railbridge',
      'Down the Hatch',
      'Scotts',
      'The Hawes Inn',
      'Manna House Bakery',
      'The Ferry Tap',
      'The Little Bakery',
      'Thirty Knots',
      'The Little Parlour',
      'Antico Cafe Bar',
    ]);
    expect(food.slice(0, 12).map((place) => place.visitorScore)).toEqual([
      82, 81, 79, 78, 78, 77, 76, 76, 75, 74, 73, 72,
    ]);
    expect(food.filter((place) => place.dogFriendly).map((place) => place.name)).toEqual([
      'Dune Bakery',
      'Down the Hatch',
      'The Hawes Inn',
      'Manna House Bakery',
      'The Ferry Tap',
      'Outboard',
    ]);
    expect(food.slice(0, 12).map((place) => place.tagline)).toEqual([
      'Waterfront dining',
      'Best pastries',
      'Bridge-view dining',
      'Canadian comfort food',
      'Best marina setting',
      'Historic pub',
      'Bakery lunch',
      'Historic pub',
      'All-day bakery cafe',
      'Good for groups',
      'Family treat',
      'All-day',
    ]);
    expect(food).toHaveLength(13);

    expect(
      visitorNeedPlaces(southQueensferryPackage, 'parking', 20, {
        curatedFeatureIds: curation.parking,
      }).map((place) => place.name),
    ).toEqual([
      'Hawes Pier / seafront car park',
      'The Binks Car Park',
      'Port Edgar Marina visitor parking',
      'Forth Bridges Viewpoint car park',
    ]);
    expect(
      parkingPriceStatus(
        southQueensferryPackage.features.find(
          (feature) => feature.id === 'osm-community:way-260629261',
        )!,
      ),
    ).toBe('free');
    expect(
      visitorNeedPlaces(southQueensferryPackage, 'toilets', 20, {
        curatedFeatureIds: curation.toilets,
      }).map((place) => place.name),
    ).toEqual([
      'High Street public toilets',
      'Hawes Pier public toilets',
      'Forth Bridges viewpoint toilets',
      'Port Edgar Marina public toilets',
    ]);
    expect(
      visitorNeedPlaces(southQueensferryPackage, 'picnic', 20, {
        curatedFeatureIds: curation.picnic,
      }).map((place) => place.name),
    ).toEqual([
      'The Binks east picnic table',
      'The Binks west picnic table',
      'Forth Bridges rest bench',
      'Queensferry Museum rest bench',
      'Inchcolm Park rest bench',
    ]);
    expect(
      visitorNeedPlaces(southQueensferryPackage, 'trails', 20, {
        curatedFeatureIds: curation.trails,
      }),
    ).toEqual([
      expect.objectContaining({
        name: 'Forth Bridges Trail - South Queensferry section',
        visitorScore: 92,
        externalUrl: 'https://www.theforthbridges.org/visit-the-forth-bridges/forth-bridges-trail/',
      }),
      expect.objectContaining({
        name: 'South Queensferry Treasure Trail',
        visitorScore: 90,
        externalUrl:
          'https://www.treasuretrails.co.uk/products/things-to-do-south-queensferry-lothian',
      }),
      expect.objectContaining({
        name: 'Benchmark and Sundial Walk',
        visitorScore: 78,
        externalUrl: '/trails/south-queensferry/south-queensferry-heritage-trail-walk.pdf',
      }),
    ]);
  });
});
